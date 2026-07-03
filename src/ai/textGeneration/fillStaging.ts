import { Show, CinematicBeat, Scene, BeatPanelPlan } from "../../types/models";
import { GoogleGenAI } from "@google/genai";
import { getDynamicSystemInstruction } from "../../aiConstants";
import { getApiKey } from "../../domainUtils";
import { withRetry } from "../geminiClient";
import { appendTextGenerationLog } from "../../apiUtils";
import { buildSchemas } from "../../utils/prompts/prompts";
import { resolveTextModel, GenerationMode } from "../../utils/generationMode";

export interface FillStagingResult {
  panels: BeatPanelPlan[];
}

export const fillBeatStaging = async (
  show: Show,
  beat: CinematicBeat,
  scene: Scene,
  existingPanels: BeatPanelPlan[],
  mode: GenerationMode = 'free',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void,
  dispatch?: any
): Promise<FillStagingResult> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);
    const startTime = Date.now();

    // D291: constrain handles to roster
    const schemas = buildSchemas(show);

    const systemInstruction = getDynamicSystemInstruction(show);

    const prompt = `
You are a master storyboard artist and cinematic director specializing in high-end panel staging, physical expression, and 3D depth layering.

We have an EXISTING, fully structured panel plan for a comic page beat. It has defined shot types, panel-by-panel actions, characters active in each panel, and dialogue associations. However, it is missing detailed visual staging, depth planes, emotional/physical acting, and camera relationships.

YOUR TASK:
Take the existing panel plans, the script lines, and scene description, and return the EXACT same panels, with their existing fields (shotType, action, subtext, direction, dialogueIndices, captionIndices, and characterPositions list/handles/zones) PRESERVED, but with all depth staging and character performance fields RICHLY POPULATED.

DO NOT alter, omit, or re-order the existing panels.
DO NOT change the dialogueIndices or captionIndices.
DO NOT change the characters present in each panel.

For each panel, you MUST populate:
1. FOREGROUND / MIDGROUND / BACKGROUND: stage three distinct planes of depth.
   - Foreground: What occupies the near plane (e.g. a partial shoulder, a close object, blurred debris, an outstretched arm). Never leave flat.
   - Midground: The primary subject(s) and immediate action environment.
   - Background: The setting details, lighting cues, or context behind.
2. RELATIONAL STAGING: If 2 or more characters are in a panel, describe their physical relationship (distance, body alignment, who faces/looks at whom, active engagement). If only 1 character is present, leave this empty.
3. DIRECT ADDRESS: Is a character breaking the fourth wall to look directly at the reader? (Normally false, set true only for rare, extreme impact).
4. For each character in the panel's "characterPositions", enrich with:
   - bodyLanguage: Specific physical posture, gestures, load-bearing stance, or physical lean.
   - facialExpression: Highly specific emotional expression, muscle tension, micro-expression, eye line.
   - inResponseTo: What this character is reacting to (e.g., a specific line from another character, a sudden sound, or the immediate situation if solo).

Here is the scene context and script:
- Show: ${show.name}
- Episode/Scene Details: ${scene.title || 'Untitled Scene'} (${scene.setting || 'No setting details'})
- Character Roster: ${(show.characters ?? []).map(c => `${c.name || c.handle} (${c.handle})`).join(', ')}

Here are the script lines for this beat:
${(beat.script?.entries ?? beat.script?.lines ?? []).map((e: any, idx: number) => {
  if (e.kind === 'caption') return `[Caption ${idx}]: ${e.text}`;
  return `[Line ${idx}] ${e.speakerName || e.characterHandle || 'UNKNOWN'}: "${e.text}"`;
}).join('\n')}

Existing panel plans to fill with staging details (parsed as a structured skeleton):
${JSON.stringify(existingPanels, null, 2)}

Please fill in the missing staging elements for these panels, and return the completed panels adhering exactly to the schema.
`.trim();

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: schemas.beatPanelPlan,
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
        generator: "fillBeatStaging",
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

    const panels: BeatPanelPlan[] = (raw.panels || []).map(
      (p: any) => ({
        shotType: p.shotType || '',
        action: p.action || '',
        subtext: p.subtext || '',
        direction: p.direction || '',
        dialogueIndices: p.dialogueIndices || [],
        captionIndices: p.captionIndices || [],
        characterPositions: p.characterPositions || [],
        foreground: p.foreground || undefined,
        midground: p.midground || undefined,
        background: p.background || undefined,
        relationalStaging: p.relationalStaging || undefined,
        directAddress: p.directAddress === true,
      })
    );

    return { panels };
  });
};
