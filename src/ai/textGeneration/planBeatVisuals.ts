import { Show, CinematicBeat, Scene, BeatPanelPlan, BeatPropEntry } from "../../types/models";
import { GoogleGenAI } from "@google/genai";
import { getDynamicSystemInstruction } from "../../aiConstants";
import { getApiKey } from "../../domainUtils";
import { withRetry } from "../geminiClient";
import { appendTextGenerationLog } from "../../apiUtils";
import { prompts, buildSchemas } from "../../utils/prompts/prompts";
import { resolveContext } from "./contextResolver";
import { panelPlanManifest } from "./manifests/panelPlan";
import { resolveTextModel, GenerationMode } from "../../utils/generationMode";

export interface BeatPlanResult {
  panels: BeatPanelPlan[];
  props: BeatPropEntry[];
}

export const planBeatVisuals = async (
  show: Show,
  beat: CinematicBeat,
  scene: Scene,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void,
  dispatch?: any
): Promise<BeatPlanResult> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);
    const startTime = Date.now();

    // D269: resolver assembles per F25 §4.6.
    const resolved = resolveContext(panelPlanManifest, { show, beat, scene });

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
        generator: "planBeatVisuals",
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
      })
    );

    const props: BeatPropEntry[] = (raw.props || []).map(
      (p: any) => ({
        label: p.label || '',
        description: p.description || '',
        appearsInPanels: p.appearsInPanels || [],
      })
    ).filter((p: BeatPropEntry) =>
      p.label && p.description && p.appearsInPanels.length > 1
    );

    return { panels, props };
  });
};
