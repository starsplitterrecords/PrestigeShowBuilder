import { Show } from "../../types/models";
import { compareHandles } from "../../utils/handleUtils";
import { GoogleGenAI } from "@google/genai";
import { getDynamicSystemInstruction } from "../../aiConstants";
import { withRetry } from "../geminiClient";
import { getApiKey } from "../../domainUtils";
import { appendTextGenerationLog } from "../../apiUtils";

import { resolveTextModel, GenerationMode } from "../../utils/generationMode";
import { resolveContext, buildResolverInputFromBranchIdxs } from "./contextResolver";
import { STAGE_BRANCH_MANIFEST } from "./manifests/stageBranch";
import { suggestFieldManifest } from "./manifests/suggestField";

export const getProjectDNA = (show: Show) => {
  const ensemble = show.characters.map(c => 
    `${c.name} (${c.handle}): ${c.role}. ${c.voiceProfile ? `VOICE: ${c.voiceProfile}` : ''}`
  ).join('\n');

  return `
[PROJECT DNA]
TITLE: ${show.titleSuggestion || show.name}
PREMISE: ${show.premise}
THEMES: ${show.themes}
STYLE: ${show.styleConfig.positivePrompt}
EXCLUDE (NEVER GENERATE): ${show.styleConfig.negativePrompt || 'N/A'}
ENSEMBLE:
${ensemble}
[/PROJECT DNA]
`;
};

function buildEnsembleContext(
  show: Show,
  sIdx: number,
  eIdx: number
): string {
  const season = show.seasons[sIdx];
  if (!season) return '';

  const totalEps = season.episodes.length || 1;
  const pct = (eIdx + 1) / totalEps;

  const arcPhase =
    pct <= 0.37 ? 'ESTABLISHING — want active, lie unchallenged' :
    pct <= 0.62 ? 'PRESSURE — need emerging, lie cracking under weight' :
    pct <= 0.87 ? 'BREAKING — pressure at maximum, final choice approaching' :
                  'RESOLUTION — final choice, permanent change';

  const lines: string[] = [];

  const lanes = season.characterArcLanes;
  if (lanes && lanes.length > 0) {
    lines.push(`[CHARACTER ARC POSITIONS — Episode ${eIdx + 1} of ${totalEps}: ${arcPhase}]`);
    for (const lane of lanes) {
      const char = show.characters.find(c => compareHandles(c.handle, lane.handle));
      const name = char?.name ?? lane.handle.split('.').pop() ?? lane.handle;
      const phaseField =
        pct <= 0.37 ? (lane.want   ?? '') :
        pct <= 0.62 ? (lane.pressure ?? lane.want ?? '') :
        pct <= 0.87 ? (lane.breakingPoint ?? lane.pressure ?? '') :
                       (lane.finalChoice  ?? lane.breakingPoint ?? '');
      const lieNote = lane.lie ? ` Lie they carry: ${lane.lie}` : '';
      if (phaseField) {
        lines.push(`  ${name} (${lane.handle}): ${phaseField}${lieNote}`);
      }
    }
    lines.push('');
  }

  const pairings = season.episodePairings;
  if (pairings && pairings.length > 0) {
    lines.push('[RECURRING EPISODE BEAT PAIRINGS — these characters appear in every episode]');
    for (const p of pairings) {
      const n1 = show.characters.find(c => compareHandles(c.handle, p.char1))?.name ?? p.char1.split('.').pop();
      const n2 = show.characters.find(c => compareHandles(c.handle, p.char2))?.name ?? p.char2.split('.').pop();
      lines.push(`  ${p.position}: ${n1} (${p.char1}) + ${n2} (${p.char2})`);
    }
    lines.push('');
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

export const generateShowBiblePart = async (
  show: Show, 
  prompt: string, 
  schema: any, 
  contextIdxs?: { s?: number, e?: number, a?: number, sc?: number },
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string; systemInstruction?: string; durationMs?: number }) => void
) => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // D271: Consume resolver for stage-level context
    const resolverInput = buildResolverInputFromBranchIdxs(show, contextIdxs);
    const resolved = resolveContext(STAGE_BRANCH_MANIFEST, resolverInput);

    const fullPrompt = `
${resolved.identityBlock}

${resolved.situationBlock}

[TASK: NARRATIVE SYNTHESIS]
${prompt}

${resolved.authorityBlock}
`.trim();

    const modelId = resolveTextModel(mode);
    const systemInstruction = ""; // Instructions are now in the authority block
    
    const startTime = Date.now();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    const durationMs = Date.now() - startTime;
    if (!text) throw new Error("Empty response from AI");

    if (onLog) {
      onLog({ prompt: fullPrompt, rawResponse: text, model: modelId, systemInstruction, durationMs });
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`AI response could not be parsed. Raw: ${text.substring(0, 200)}`);
    }
  });
};

export const suggestField = async (
  show: Show,
  fieldName: string,
  context: string,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string; systemInstruction?: string; durationMs?: number }) => void,
  dispatch?: any
): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    // D277: resolver assembles show identity.
    const resolved = resolveContext(suggestFieldManifest, { show });

    const fullPrompt = `
${resolved.identityBlock}

[CONTEXT]
${context}
[/CONTEXT]

[TASK]
Field to suggest: "${fieldName}".
${resolved.authorityBlock}
[/TASK]
`.trim();

    const modelId = resolveTextModel(mode, true); // Use Flash for quick suggestions
    const systemInstruction = ""; // Instructions are now in the authority block

    const startTime = Date.now();
    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
    });

    const text = response.text?.trim() || '';
    const durationMs = Date.now() - startTime;

    if (onLog) {
      onLog({ prompt: fullPrompt, response: text, model: modelId, systemInstruction, durationMs });
    }

    if (dispatch) {
      appendTextGenerationLog(dispatch, show, {
        generator: "suggestField", 
        prompt: fullPrompt,
        model: modelId,
        mode: mode === 'free' ? 'free' : 'paid',
        rawResponse: text,
        durationMs,
        systemInstruction,
      } as any);
    }

    return text;
  });
};
