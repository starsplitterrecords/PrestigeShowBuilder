import { GoogleGenAI } from "@google/genai";
import { Show } from "../../types/models";
import { withRetry, compressAndStore } from '../geminiClient';
import { getApiKey } from '../../domainUtils';
import { 
  COMPRESS_QUALITY_COVER_PASS1, 
  COMPRESS_QUALITY_COVER_PASS2, 
} from '../../constants/generation.constants';
import { GenerationMode } from "../../utils/generationMode";
import { assembleStyleHeader, resolveImageSize } from "./imageGenerationHelpers";

import { GenerationPartSummary } from "../../types/models";

export const generateCoverWithTreatment = async (
  show: Show,
  pass1Prompt: string,
  characterPortraitRefs: { label: string; dataUri: string; assetId?: string }[] = [],
  treatmentPrompt: string,
  anchorRefs: { label: string; dataUri: string; assetId?: string }[] = [],
  onPass1Complete?: () => void,
  mode: GenerationMode = 'paid'
): Promise<{ 
  assetId: string; 
  pass1AssetId?: string;
  request: {
    model: string;
    aspectRatio: string;
    imageSize: string;
    styleHeader: string;
    compositePrompt: string;
    parts: GenerationPartSummary[];
  }
} | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const toBase64 = (uri: string) =>
      uri.replace(/^data:image\/\w+;base64,/, '');

    const modelName = 'gemini-3.1-flash-image-preview';
    const imageSize = resolveImageSize(mode, 'production');

    const styleHeader = assembleStyleHeader(show);

    // ── PASS 1: scene image with character references ────────────
    const pass1Parts: any[] = [];
    pass1Parts.push({ text: styleHeader });

    // Anchor reference (prior approved cover) if available
    if (anchorRefs.length > 0) {
      pass1Parts.push({ text: '[VISUAL REFERENCE — prior approved cover. Match overall composition and character appearance.]' });
      anchorRefs.forEach(ref => {
        pass1Parts.push({ inlineData: { mimeType: 'image/png', data: toBase64(ref.dataUri) } });
      });
    }

    // Character portrait references
    characterPortraitRefs.forEach(({ label, dataUri }) => {
      pass1Parts.push({ text: `[CHARACTER REFERENCE: ${label} — render this character's face and build exactly as shown. Same likeness in the cover image.]` });
      pass1Parts.push({ inlineData: { mimeType: 'image/png', data: toBase64(dataUri) } });
    });

    pass1Parts.push({ text: pass1Prompt });

    const pass1Response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: pass1Parts },
      config: { imageConfig: { 
        aspectRatio: '3:4',
        imageSize
      } },
    });

    const pass1Part = pass1Response.candidates?.[0]?.content?.parts
      ?.find(p => p.inlineData);
    if (!pass1Part) return null;
    const pass1DataUri = `data:image/png;base64,${pass1Part.inlineData!.data}`;

    // D98: store pass 1 so caller can display both versions
    const pass1AssetId = await compressAndStore(pass1DataUri, COMPRESS_QUALITY_COVER_PASS1).catch(() => undefined);

    onPass1Complete?.();

    // ── PASS 2: apply cover treatment over the pass 1 image ──────
    const pass2Parts: any[] = [];
    const pass2Header = '[BASE IMAGE — apply the cover treatment design to this image. Preserve the photographic scene in the lower three-quarters. Add the designed cover header to the upper quarter.]';

    pass2Parts.push({ text: pass2Header });
    pass2Parts.push({ inlineData: { mimeType: 'image/png', data: toBase64(pass1DataUri) } });

    pass2Parts.push({ text: treatmentPrompt });

    const pass2Response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: pass2Parts },
      config: { imageConfig: { 
        aspectRatio: '3:4',
        imageSize
      } },
    });

    const pass2Part = pass2Response.candidates?.[0]?.content?.parts
      ?.find(p => p.inlineData);
    if (!pass2Part) return null;
    const pass2DataUri = `data:image/png;base64,${pass2Part.inlineData!.data}`;

    const pass2AssetId = await compressAndStore(pass2DataUri, COMPRESS_QUALITY_COVER_PASS2);
    if (!pass2AssetId) return null;

    const partsSummary: GenerationPartSummary[] = pass2Parts.map(p => {
      if ('text' in p) return { kind: 'text', text: p.text };
      return { kind: 'image', label: 'Pass 1 Result' };
    });

    return { 
      assetId: pass2AssetId, 
      pass1AssetId: pass1AssetId ?? undefined,
      request: {
        model: modelName,
        aspectRatio: '3:4',
        imageSize,
        styleHeader,
        compositePrompt: treatmentPrompt,
        parts: partsSummary
      }
    };
  });
};
