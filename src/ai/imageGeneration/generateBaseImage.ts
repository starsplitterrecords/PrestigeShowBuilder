import { GoogleGenAI } from "@google/genai";
import { Show, Character } from "../../types/models";
import { withRetry, compressAndStore } from '../geminiClient';
import { getApiKey } from '../../domainUtils';
import { 
  PORTRAIT_SHOTS,
  COMPRESS_QUALITY_PORTRAIT, 
  resolveImageSize,
  resolveReferenceAspect,
} from '../../constants/generation.constants';
import { GenerationMode, canGenerateMedia } from "../../utils/generationMode";

const resolvePortraitComposition = (character: Character, show: Show): string => {
  const base = character.isMinor
    ? PORTRAIT_SHOTS[0].instruction  // HEADSHOT
    : (() => {
        const hash = character.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return PORTRAIT_SHOTS[(hash % 3) + 1].instruction;
      })();
  const showComposition = show.styleConfig.compositionPrompt;
  return showComposition ? `${base}\n${showComposition}` : base;
};

export const generateCharacterPortrait = async (
  show: Show,
  character: Character,
  useComicStyle: boolean = true,
  mode: GenerationMode = 'paid'
): Promise<{ assetId: string; prompt: string } | null> => {
  if (!canGenerateMedia(mode)) return null;
  
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const physicalDesc = character.visualAnchor || character.physicalDescription || character.role;
    const composition = resolvePortraitComposition(character, show);
    
    // D309: Combine base style and comic-specific style if both exist.
    const basePositive = show.styleConfig.positivePrompt;
    const comicPositive = useComicStyle ? show.comicStyle?.artistStyle : null;
    const stylePositive = [basePositive, comicPositive].filter(Boolean).join('. ');

    const baseNegative = show.styleConfig.negativePrompt;
    const comicNegative = useComicStyle ? show.comicStyle?.negativePrompt : null;
    const styleNegative = [baseNegative, comicNegative].filter(Boolean).join('. ') || 'none';

    const prompt = [
      `Character portrait. ${physicalDesc}`,
      `STYLE: ${stylePositive}.`,
      `EXCLUDE: ${styleNegative}.`,
      composition,
      'Consistent character likeness. Expressive face.',
      'NO TEXT. NO UI ELEMENTS. NO LABELS. NO HUD. NO HOLOGRAPHIC OVERLAYS.',
    ].filter(Boolean).join('\n');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { 
        aspectRatio: "9:16",
        imageSize: resolveImageSize(mode, 'concept')
      } }
    });
    const portraitPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!portraitPart) return null;
    const portraitDataUri = `data:image/png;base64,${portraitPart.inlineData!.data}`;
    const assetId = await compressAndStore(portraitDataUri, COMPRESS_QUALITY_PORTRAIT);
    if (!assetId) return null;
    return { assetId, prompt };
  });
};

export const generateReferenceImage = async (
  prompt: string,
  show: Show,
  refType: string = 'other',   // LockedReferenceType -- drives aspect ratio
  mode: GenerationMode = 'paid'
): Promise<string | null> => {
  if (!canGenerateMedia(mode)) return null;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const basePositive = show.styleConfig.positivePrompt;
    const comicPositive = show.comicStyle?.artistStyle;
    const stylePos = [basePositive, comicPositive].filter(Boolean).join('. ');

    const baseNegative = show.styleConfig.negativePrompt;
    const comicNegative = show.comicStyle?.negativePrompt;
    const styleNeg = [baseNegative, comicNegative].filter(Boolean).join('. ') || 'none';

    const fullPrompt = [
      `Reference image. ${prompt}`,
      `STYLE: ${stylePos}.`,
      `EXCLUDE: ${styleNeg}.`,
      'Clear, detailed visual reference. High quality.',
      'NO TEXT. NO UI ELEMENTS. NO LABELS. NO HUD.'
    ].filter(Boolean).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: [{ text: fullPrompt }] },
      config: { imageConfig: { 
        aspectRatio: resolveReferenceAspect(refType),
        imageSize: resolveImageSize(mode, 'reference')
      } }
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) return null;

    const dataUri = `data:image/png;base64,${part.inlineData!.data}`;
    const assetId = await compressAndStore(dataUri, COMPRESS_QUALITY_PORTRAIT);
    return assetId;
  });
};
