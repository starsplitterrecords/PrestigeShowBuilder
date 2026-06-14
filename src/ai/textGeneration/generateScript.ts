import { Show, CinematicBeat, Scene, ScriptLine } from "../../types/models";
import { GoogleGenAI } from "@google/genai";
import { getDynamicSystemInstruction } from "../../aiConstants";
import { resolveCharacter, generateLineFid, getApiKey } from "../../domainUtils";
import { withRetry } from "../geminiClient";
import { appendTextGenerationLog } from "../../apiUtils";
import { prompts, buildSchemas } from "../../utils/prompts/prompts";
import { generateShowBiblePart } from "./context";
import { resolveContext, buildResolverInputFromBranchIdxs } from "./contextResolver";
import { dialogueScriptManifest } from "./manifests/dialogueScript";
import { visualFromDescriptionManifest } from "./manifests/visualFromDescription";
import { visualFromScriptManifest } from "./manifests/visualFromScript";
import { reconcileBeatManifest } from "./manifests/reconcileBeat";
import { EPISODE_BEATS_MANIFEST } from "./manifests/episodeBeats";
import { BEAT_DIRECTION_INSTRUCTIONS, DIALOGUE_SCRIPT_INSTRUCTIONS, COMEDY_LINE_GENERATION_GUIDELINES } from "../../constants/prompts/textGenPrompts";
import { CONTENT_GENERATION_STANDARD } from "../../constants/prompts/contentGenerationStandard";

import { resolveTextModel, GenerationMode } from "../../utils/generationMode";

export const generateBeatDirection = async (
  show: Show,
  beat: CinematicBeat,
  sceneContext?: { beatIndex: number; totalBeats: number },
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<string | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
 
    const characters = (beat.characterIds || []).map(cid => {
      const c = resolveCharacter(show, cid);
      return c ? `${c.name} (${c.handle})` : cid;
    }).join(', ');
 
    const prompt = [
      BEAT_DIRECTION_INSTRUCTIONS,
      '',
      `BEAT ${(sceneContext?.beatIndex ?? 0) + 1} of ${sceneContext?.totalBeats ?? 1}`,
      `TYPE: ${beat.beatType || 'DIALOGUE'}`,
      `ACTION: ${beat.description}`,
      `SUBTEXT: ${beat.subtext}`,
      `LOCATION: ${beat.continuityAnchor || 'Scene environment'}`,
      characters ? `CHARACTERS: ${characters}` : null,
    ].filter(Boolean).join('\n');
 
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
 
    const text = response.text?.trim();
    if (onLog) {
      onLog({ prompt, rawResponse: text || '', model: modelId });
    }
    if (!text || text.length < 10) return null;
    return text.replace(/^direction:\s*/i, '').split('\n')[0].trim();
  });
};

export const generateDialogueScript = async (
  show: Show,
  beat: CinematicBeat,
  scene: Scene,
  precedingBeatsInScene: CinematicBeat[],
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void,
  dispatch?: any
): Promise<ScriptLine[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);
    const startTime = Date.now();

    // D267: resolver assembles exactly the context F25 §4.1 specifies.
    const resolved = resolveContext(dialogueScriptManifest, {
      show,
      beat,
      scene,
      precedingBeatsInScene,
    });

    const prompt = `
${resolved.identityBlock}

${resolved.situationBlock}

${resolved.authorityBlock}

TECHNICAL:
— Parentheticals: visible physical behavior only. Not tone. Not intention.
— Handle format: @${show.showCode?.toLowerCase() || 'show'}.charactername

LINE BUDGET (conditional):
— Return only the dialogue this beat truly needs.
— Default: 1 to 3 lines.
— Use 0 lines (empty array) if the beat is primarily visual,
  transitional, atmospheric, or action-driven. Silence is a
  legitimate output. The art and staging carry the moment.
— Use 4 to 6 lines only if this beat IS the core verbal exchange
  of the scene — the moment where the central conversation lands.
— Do not reset the conversation. Continue from the prior beat's
  last spoken line where applicable.
— Do not give every present character a turn unless the beat
  requires it.
— Do not make this beat feel like a complete mini-scene.
  Beats are part of a scene; some beats carry weight, others
  pass through quickly.

REGISTER:
— If the scene is quiet: let silence do work; prefer 0-1 lines.
— If the scene is pressured: overlap and cut off; full budget
  available.
`;

    // D291: constrain handles to roster
    const schemas = buildSchemas(show);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json',
        responseSchema: schemas.lineExchange,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');
    const durationMs = Date.now() - startTime;

    if (onLog) {
      onLog({ prompt, response: text, model: modelId });
    }

    if (dispatch) {
      appendTextGenerationLog(dispatch, show, {
        generator: "generateDialogueScript",
        targetFid: beat.fid,
        targetKind: "beat",
        prompt,
        model: modelId,
        mode: mode === 'free' ? 'free' : 'paid',
        rawResponse: text,
        durationMs,
      });
    }

    const raw = JSON.parse(text);
    const arr = Array.isArray(raw) ? raw : (raw.lines || raw.items || [raw]);

    return arr.map((item: any, i: number) => ({
      fid: generateLineFid(beat.fid, i),
      order: i,
      characterHandle: item.characterHandle || '',
      text: item.text || '',
      parenthetical: item.parenthetical || '',
      isDone: false,
    }));
  });
};

export const generateSceneDialogue = async (
  show: Show,
  beats: CinematicBeat[],
  scene: Scene,
  onBeatComplete: (beatId: string, lines: ScriptLine[]) => void,
  onProgress: (current: number, total: number) => void,
  mode: GenerationMode = 'paid'
): Promise<void> => {
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    onProgress(i, beats.length);
    const precedingBeatsInScene = beats.slice(0, i);
    const scriptData = await generateDialogueScript(show, beat, scene, precedingBeatsInScene, mode);
    onBeatComplete(beat.id, scriptData);
    if (i < beats.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }
  onProgress(beats.length, beats.length);
};

export const deriveVisualFromScript = async (
  show: Show,
  beat: CinematicBeat,
  scene: Scene,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void,
  dispatch?: any
): Promise<{
  description: string;
  visualDescription: string;
  direction: string;
  continuityAnchor: string;
}> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
    const startTime = Date.now();

    // D276: resolver assembles per F25 §4.4.
    const resolved = resolveContext(visualFromScriptManifest, { show, beat, scene });

    const prompt = `
${resolved.identityBlock}

${resolved.situationBlock}

${resolved.authorityBlock}
`.trim();

    // D291: constrain handles to roster
    const schemas = buildSchemas(show);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json',
        responseSchema: schemas.beatVisualFields,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');
    const durationMs = Date.now() - startTime;

    if (onLog) {
      onLog({ prompt: prompt, response: text, model: modelId });
    }

    if (dispatch) {
      appendTextGenerationLog(dispatch, show, {
        generator: "deriveVisualFromScript",
        targetFid: beat.fid,
        targetKind: "beat",
        prompt: prompt,
        model: modelId,
        mode: mode === 'free' ? 'free' : 'paid',
        rawResponse: text,
        durationMs,
      });
    }

    const raw = JSON.parse(text);

    return {
      description: raw.description || '',
      visualDescription: raw.visualDescription || '',
      direction: raw.direction || '',
      continuityAnchor: raw.continuityAnchor || '',
    };
  });
};

export const deriveVisualFromDescription = async (
  show: Show,
  beat: CinematicBeat,
  scene: Scene,
  previousBeat: CinematicBeat | null,  // for staging continuity
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void,
  dispatch?: any
): Promise<{
  visualDescription: string;
  direction: string;
}> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
    const startTime = Date.now();

    // D268: resolver assembles per F25 §4.5.
    const resolved = resolveContext(
      visualFromDescriptionManifest,
      {
        show,
        beat,
        scene,
        previousBeatVisual: previousBeat?.visualDescription || undefined,
      }
    );

    const prompt = `
${resolved.identityBlock}

${resolved.situationBlock}

${resolved.authorityBlock}
`.trim();

    // D291: constrain handles to roster
    const schemas = buildSchemas(show);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json',
        responseSchema: schemas.beatProductionFields,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');
    const durationMs = Date.now() - startTime;

    if (onLog) {
      onLog({ prompt, response: text, model: modelId });
    }

    if (dispatch) {
      appendTextGenerationLog(dispatch, show, {
        generator: "deriveVisualFromDescription",
        targetFid: beat.fid,
        targetKind: "beat",
        prompt,
        model: modelId,
        mode: mode === 'free' ? 'free' : 'paid',
        rawResponse: text,
        durationMs,
      });
    }

    const raw = JSON.parse(text);

    return {
      visualDescription: raw.visualDescription || '',
      direction: raw.direction || '',
    };
  });
};

export const generateEpisodeBeats = async (
  show: Show,
  sIdx: number,
  eIdx: number,
  aIdx: number,
  scIdx: number,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<CinematicBeat[]> => {
  const scene = show.seasons[sIdx].episodes[eIdx].acts[aIdx].scenes[scIdx];
  
  // D271: Character pool logic moved to resolver or simplified.
  // We no longer manually build the context blocks here.
  // The generateShowBiblePart rewired in context.ts handles it.

  const basePrompt = prompts.generateCinematicBeats(sIdx, eIdx, aIdx, scIdx, scene, show);

  const schemas = buildSchemas(show);

  const data = await generateShowBiblePart(
    show,
    basePrompt,
    schemas.cinematicBeats,
    { s: sIdx, e: eIdx, a: aIdx, sc: scIdx },
    mode,
    onLog
  );
  return data;
};

export const reconcileBeatDescription = async (
  show: Show,
  beat: CinematicBeat,
  scene: Scene,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void,
  dispatch?: any
): Promise<{ description: string }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);
    const startTime = Date.now();

    // D270: resolver assembles per F25 §4.7.
    const resolved = resolveContext(reconcileBeatManifest, { show, beat, scene });

    const prompt = `
${resolved.identityBlock}

${resolved.situationBlock}

${resolved.authorityBlock}
`.trim();

    // D291: constrain handles to roster
    const schemas = buildSchemas(show);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json',
        responseSchema: schemas.reconciledBeatDescription,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');
    const durationMs = Date.now() - startTime;

    if (onLog) {
      onLog({ prompt, rawResponse: text, model: modelId });
    }

    if (dispatch) {
      appendTextGenerationLog(dispatch, show, {
        generator: "reconcileBeatDescription",
        targetFid: beat.fid,
        targetKind: "beat",
        prompt,
        model: modelId,
        mode: mode === 'free' ? 'free' : 'paid',
        rawResponse: text,
        durationMs,
      });
    }

    return JSON.parse(text);
  });
};
