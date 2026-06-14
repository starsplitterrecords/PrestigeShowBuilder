import { GoogleGenAI } from '@google/genai';
import { Show } from '../../types/models';
import { StylePreset } from '../../stylePresets';
import { withRetry } from '../geminiClient';
import { getApiKey } from '../../domainUtils';

export interface StyleTestResult {
  preset: StylePreset;
  blob: Blob;
  prompt: string;
}

const DEFAULT_ENSEMBLE_COMPOSITION =
  'Full cast ensemble. All characters present and individually readable. ' +
  'Promotional poster composition. Characters posed and aware of frame. ' +
  'Clear hierarchy — principal characters prominent. ' +
  'Atmospheric background evocative of the show tone. No busy backgrounds. ' +
  'NO TEXT. NO TITLE. NO LABELS. NO SPEECH BALLOONS. NO UI ELEMENTS.';

export async function generateStyleTestImage(
  show: Show,
  preset: StylePreset
): Promise<StyleTestResult | null> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    // Build character list — skip minors without physicalDescription.
    const chars = (show.characters || [])
      .filter(c => c.name?.trim() &&
        (!c.isMinor || c.visualAnchor?.trim() || c.physicalDescription?.trim()))
      .slice(0, 12);  // safety cap

    const charBlock = chars.length > 0
      ? chars.map(c => {
          const desc = c.visualAnchor?.trim()
            || c.physicalDescription?.trim()
            || c.role || '';
          return `${c.name}${desc ? ': ' + desc : ''}`;
        }).join('\n')
      : 'Ensemble cast.';

    const composition = preset.composition?.trim()
      || DEFAULT_ENSEMBLE_COMPOSITION;

    const prompt = [
      `Full cast ensemble. ${show.titleSuggestion || show.name}.`,
      '',
      'CHARACTERS:',
      charBlock,
      '',
      `STYLE: ${preset.pos}.`,
      `EXCLUDE: ${preset.neg || 'none'}.`,
      '',
      composition,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: '4:3' } },
    });

    const part = response.candidates?.[0]?.content?.parts
      ?.find((p: any) => p.inlineData?.data);
    if (!part?.inlineData?.data) return null;

    const dataUri = `data:image/png;base64,${part.inlineData.data}`;
    const res = await fetch(dataUri);
    const blob = await res.blob();
    return { preset, blob, prompt };
  });
}
