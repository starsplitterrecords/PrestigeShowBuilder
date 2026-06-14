import { Show, CinematicBeat, Scene, ScriptLine } from '../../types/models';
import { GoogleGenAI } from '@google/genai';
import { getApiKey, resolveCharacter, generateLineFid } from '../../domainUtils';
import { resolveContext } from './contextResolver';
import { dialogueScriptManifest } from './manifests/dialogueScript';
import { buildSchemas } from '../../utils/prompts/prompts';
import { getDynamicSystemInstruction } from '../../aiConstants';
import { resolveTextModel, GenerationMode } from '../../utils/generationMode';

export type ConversationTurn = {
  role: 'user' | 'model';
  parts: [{ text: string }];
};

export type SceneSession = {
  history: ConversationTurn[];  // grows as turns are added
};

export type BeatEntry = {
  eIdx: number; aIdx: number; scIdx: number; bIdx: number;
  beat: CinematicBeat;
};

const TIMEOUT_MS = 120_000;

async function callGeminiConversation({
  history, userPrompt, model, config
}: {
  history: ConversationTurn[];
  userPrompt: string;
  model: string;
  config: any;
}): Promise<{ text: string; updatedHistory: ConversationTurn[] }> {
  const ai = new GoogleGenAI({
    apiKey: getApiKey() || undefined,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const newUserTurn: ConversationTurn = { role: 'user', parts: [{ text: userPrompt }] };
  const contents = history.length > 0
    ? [...history, newUserTurn]
    : [newUserTurn];

  const callPromise = ai.models.generateContent({ model, contents, config }) as Promise<any>;
  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error(`Gemini timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
  );
  const response = await Promise.race([callPromise, timeout]);
  const text = (response as any).text || '';

  const modelTurn: ConversationTurn = { role: 'model', parts: [{ text }] };
  return {
    text,
    updatedHistory: [...history, newUserTurn, modelTurn]
  };
}

export function buildSceneFoundationPrompt(
  show: Show,
  scene: Scene,
  orderedBeats: CinematicBeat[],
  firstBeat: CinematicBeat
): string {
  // Use resolver for the first beat — gets identityBlock + authorityBlock
  const resolved = resolveContext(dialogueScriptManifest, {
    show, beat: firstBeat, scene,
    precedingBeatsInScene: [],
  });

  // Supplemental cast overview: all unique characters across ALL beats in scene
  // (the resolver's identityBlock only includes first beat's characters)
  const allCharHandles = new Set<string>();
  orderedBeats.forEach(b => (b.characterIds || []).forEach(id => allCharHandles.add(id)));
  const extraChars = [...allCharHandles]
    .filter(id => !(firstBeat.characterIds || []).includes(id))
    .map(id => resolveCharacter(show, id))
    .filter(Boolean);

  let supplementalCast = '';
  if (extraChars.length > 0) {
    const lines = extraChars.map(c => {
      const vc = c!.voiceConstraints || c!.voiceProfile || '';
      return `${c!.name} (${c!.handle}): ${vc}`;
    }).filter(Boolean);
    if (lines.length > 0) {
      supplementalCast = `\n[ADDITIONAL CAST APPEARING LATER IN SCENE]\n${lines.join('\n')}`;
    }
  }

  // Beat overview: all beats at a glance
  const beatOverview = orderedBeats.map((b, i) => {
    const type = b.beatType || 'DIALOGUE';
    return `Beat ${i + 1} (${type}): ${b.description || '(no description)'}`;
  }).join('\n');

  const beatOneRequest = buildBeatContinuationPrompt(firstBeat, 0, orderedBeats.length);

  return [
    '[SCENE DIALOGUE SESSION]',
    resolved.identityBlock,
    supplementalCast,
    resolved.situationBlock,
    `[BEAT OVERVIEW — ${orderedBeats.length} beats in this scene]`,
    beatOverview,
    '[/BEAT OVERVIEW]',
    resolved.authorityBlock,
    '',
    'I will send you each beat one at a time. For each beat, respond with only the JSON dialogue array.',
    '',
    beatOneRequest,
  ].filter(Boolean).join('\n');
}

export function buildBeatContinuationPrompt(
  beat: CinematicBeat,
  beatIdx: number,
  totalBeats: number
): string {
  const type = beat.beatType || 'DIALOGUE';
  const characters = (beat.characterIds || []).join(', ') || 'same cast';
  const parts = [
    `Beat ${beatIdx + 1} of ${totalBeats}: ${beat.fid}`,
    `Type: ${type}`,
    `Description: ${beat.description || '(no description)'}`,
    characters !== 'same cast' ? `Characters present: ${characters}` : null,
    beat.subtext ? `Subtext: ${beat.subtext}` : null,
    `Write the dialogue for this beat only. Return JSON array of script lines.`,
  ].filter(Boolean);
  return parts.join('\n');
}

export async function runSceneConversation(
  show: Show,
  scene: Scene,
  orderedBeats: CinematicBeat[],
  mode: GenerationMode = 'paid',
  onLog?: (beatFid: string, prompt: string, raw: string) => void
): Promise<Map<string, ScriptLine[]>> {
  const results = new Map<string, ScriptLine[]>();
  if (orderedBeats.length === 0) return results;

  const modelId = resolveTextModel(mode);
  const schemas = buildSchemas(show);
  const config = {
    systemInstruction: getDynamicSystemInstruction(show),
    responseMimeType: 'application/json',
    responseSchema: schemas.dialogueScript,
  };

  let history: ConversationTurn[] = [];

  for (let i = 0; i < orderedBeats.length; i++) {
    const beat = orderedBeats[i];

    // Skip non-dialogue beat types
    const beatType = beat.beatType ?? 'DIALOGUE';
    if (['TABLEAU', 'ESTABLISHING', 'MEMORY_BLEED'].includes(beatType)) {
      results.set(beat.fid, []);
      continue;
    }

    const userPrompt = i === 0
      ? buildSceneFoundationPrompt(show, scene, orderedBeats, beat)
      : buildBeatContinuationPrompt(beat, i, orderedBeats.length);

    try {
      const { text, updatedHistory } = await callGeminiConversation({
        history, userPrompt, model: modelId, config
      });
      history = updatedHistory;

      if (onLog) onLog(beat.fid, userPrompt, text);

      const lines = parseDialogueResponse(text, show, beat.fid);
      results.set(beat.fid, lines);
    } catch (err) {
      console.warn(`[sceneConversation] Beat ${beat.fid} failed:`, err);
      // Omit from results so stageLines falls back to individual generation
    }
  }

  return results;
}

function parseDialogueResponse(raw: string, show: Show, beatFid: string): ScriptLine[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const arr = Array.isArray(parsed) ? parsed : (parsed?.lines || parsed?.items || [parsed]);
    return arr.map((line: any, idx: number) => {
      const resolved = resolveCharacter(show, line.characterHandle || line.character);
      return {
        fid: generateLineFid(beatFid, idx),
        order: idx,
        characterHandle: resolved?.handle || line.characterHandle || line.character || '',
        text: line.text || line.line || '',
        parenthetical: line.parenthetical || '',
        isDone: false,
      };
    });
  } catch {
    return [];
  }
}
