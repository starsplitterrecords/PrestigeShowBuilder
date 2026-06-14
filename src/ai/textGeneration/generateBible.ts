import { Show } from "../../types/models";
import { GoogleGenAI } from "@google/genai";
import { withRetry } from "../geminiClient";
import { getApiKey } from "../../domainUtils";
import { schemas } from "../../utils/prompts/prompts";
import { MINE_CONCEPT_PREAMBLE, MINE_CONCEPT_FIELDS, MINE_CHARACTERS_PREAMBLE } from "../../constants/prompts/textGenPrompts";

import { resolveTextModel, GenerationMode } from "../../utils/generationMode";

export const mineConceptFromRichInput = async (
  show: Show,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<{
  titleSuggestion: string;
  premise: string;
  themes: string;
}> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);

    const prompt = `
${MINE_CONCEPT_PREAMBLE}

[SOURCE DOCUMENT]:
${show.richInput}

${MINE_CONCEPT_FIELDS}
`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schemas.minedConcept,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');

    if (onLog) {
      onLog({ prompt, response: text, model: modelId });
    }

    const parsed = JSON.parse(text);

    const premiseParts = [
      parsed.premise,
      parsed.worldRules     ? `\nWORLD: ${parsed.worldRules}` : '',
      parsed.centralConflict ? `\nCONFLICT: ${parsed.centralConflict}` : '',
      parsed.emotionalCore   ? `\nEMOTIONAL CORE: ${parsed.emotionalCore}` : '',
      parsed.seriesResolution ? `\nRESOLUTION: ${parsed.seriesResolution}` : '',
    ].filter(Boolean).join('');

    return {
      titleSuggestion: parsed.titleSuggestion,
      premise: premiseParts,
      themes: parsed.themes,
    };
  });
};

import { getDynamicSystemInstruction } from "../../aiConstants";

export const extractNarrativeMechanism = async (
  show: Show,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
    const source = show.richInput || show.expandedBible || show.premise;
    if (!source || source.length < 100) return '';

    const prompt = `
Read this show's source material:
${source.substring(0, 2000)}

Identify the show's NARRATIVE MECHANISM — the structural device through which
the story's past or hidden world enters the present-day narrative.

Describe it in 3-5 sentences covering:
  1. What the mechanism is (memory bleed, haunting, vision, echo, etc.)
  2. What TRIGGERS it (artifact contact, trauma, location, etc.)
  3. What it looks like from OUTSIDE the experiencing character (physical symptoms, visual tells)
  4. Whether it is involuntary (intrudes) or voluntary (recalled)
  5. Whether different characters experience DIFFERENT versions of the same events

Write in present tense, from a production/director perspective.
No preamble. No labels. Just the description.
`.trim();

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    const text = response.text?.trim() || '';
    if (onLog) {
      onLog({ prompt, response: text, model: modelId });
    }
    return text;
  });
};

export const mineCharactersFromRichInput = async (
  show: Show,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<any[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);
    const prompt = `
${MINE_CHARACTERS_PREAMBLE}
 
[SOURCE DOCUMENT]:
${show.richInput}
 
[SHOW CONTEXT]:
Title: ${show.titleSuggestion || show.name}
Premise: ${show.premise}
Style: ${show.styleConfig.positivePrompt}
`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json',
        responseSchema: schemas.mineCharactersCore,
      },
    });
    
    try {
      const text = response.text;
      if (!text) throw new Error("Empty response from AI");

      if (onLog) {
        onLog({ prompt, response: text, model: modelId });
      }

      return JSON.parse(text);
    } catch (e) {
      throw new Error('AI returned unparseable response for mining characters.');
    }
  });
};
