import { GoogleGenAI } from '@google/genai';
import { Show } from '../../types/models';
import { withRetry, compressAndStore } from '../geminiClient';
import { getApiKey } from '../../domainUtils';
import { resolveImageSize } from '../../constants/generation.constants';
import { GenerationMode } from '../../utils/generationMode';
import { buildEnsemblePrompt, EnsembleAspect } from '../../utils/prompts/ensemblePrompt';

interface CharacterRef {
  name: string;
  dataUri: string;
  characterId: string;
  assetId?: string;
}

interface EnsembleImageResult {
  assetId: string;
  dataUri: string;
}

const ASPECT_TO_RATIO: Record<EnsembleAspect, string> = {
  vertical: '3:4',
  horizontal: '4:3',
  square: '1:1',
};

export async function generateEnsembleImage(
  show: Show,
  characterRefs: CharacterRef[],
  aspect: EnsembleAspect,
  mode: GenerationMode = 'paid',
  featuredIds?: string[]
): Promise<EnsembleImageResult | null> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const toBase64 = (uri: string) =>
      uri.replace(/^data:image\/\w+;base64,/, '');

    const { styleHeader, compositePrompt } = buildEnsemblePrompt(show, aspect, featuredIds);
    const aspectRatio = ASPECT_TO_RATIO[aspect];
    const imageSize = resolveImageSize(mode, 'production');

    const parts: any[] = [];

    // Style header first
    parts.push({ text: styleHeader });

    // Character references - ONLY those that are featured
    const activeRefs = featuredIds 
      ? characterRefs.filter(r => featuredIds.includes(r.characterId))
      : characterRefs;

    activeRefs.forEach(({ name, dataUri }) => {
      parts.push({ text: `[CHARACTER REFERENCE: ${name} — render this character's face and build exactly as shown.]` });
      parts.push({ inlineData: { mimeType: 'image/png', data: toBase64(dataUri) } });
    });

    // Composition prompt last
    parts.push({ text: compositePrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: { imageConfig: { aspectRatio, imageSize } },
    });

    const imagePart = response.candidates?.[0]?.content?.parts
      ?.find((p: any) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) return null;

    const dataUri = `data:image/png;base64,${imagePart.inlineData.data}`;
    const assetId = await compressAndStore(dataUri, 0.92);

    return { assetId, dataUri };
  });
}
