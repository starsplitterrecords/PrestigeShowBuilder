// generateFinalComicPage.ts — DA-076
// ONE model call produces the finished, lettered comic page (spec §1, §6, §8).
// Consumes only the FinalPageBeat contract. No dialogue context, no second
// style header, no lettering pass.

import { GoogleGenAI } from '@google/genai';
import { Show } from '../../types/show';
import { withRetry, compressAndStore } from '../geminiClient';
import { getApiKey } from '../../domainUtils';
import {
  GeneratedImageResult,
  RefPartInput,
  COMPRESS_QUALITY_PAGE,
  resolveImageSize,
  buildCharacterRefParts,
  buildPriorPageParts,
  mimeTypeFromDataUri,
} from './imageGenerationHelpers';
import { assertImageRequestHasRequiredCharacterRefs } from './generatePanelImage';
import { GenerationMode } from '../../utils/generationMode';
import { FinalPageBeat } from './finalPageContract';
import { buildCompositePrompt } from './finalPagePromptPreview';
import { assembleComicStyleHeader } from './comicStyleHeader';

export const generateFinalComicPage = async (
  show: Show,
  contract: FinalPageBeat,
  priorPages: RefPartInput[],
  characterRefs: RefPartInput[],   // portraits + setting + locked, as today
  options: {
    mode?: GenerationMode;
    revisionImage?: string;
    directorNote?: string;
    requiredCharacterAssetIds?: string[];
    // DA-115: bypass the assembler entirely. When set, this string replaces
    // buildCompositePrompt(). Character refs and style header still attach.
    rawPromptOverride?: string;
  } = {}
): Promise<GeneratedImageResult | null> => {
  const generationStartedAt = new Date().toISOString();
  const mode = options.mode ?? 'paid';

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const toBase64 = (uri: string) => uri.replace(/^data:image\/\w+;base64,/, '');

    const modelName = 'gemini-3-pro-image';
    const imageSize = resolveImageSize(mode, 'production');
    const styleHeader = assembleComicStyleHeader(show, contract.silentPage);

    // ── Parts: refs → composite prompt → style (DA-114: subject first, style last)
    // Image parts go first so character references are loaded before staging is read.
    // Composite prompt follows (characters → location → panels → lettering).
    // Style header is last — aesthetics after subject and action.
    const parts: any[] = [];

    const charOnly = characterRefs.filter(r => r.isCharacter === true);
    const otherRefs = characterRefs.filter(r => r.isCharacter !== true);

    const trackedChars = buildCharacterRefParts(parts, charOnly);
    const trackedOther = buildCharacterRefParts(parts, otherRefs);
    const trackedPrior = buildPriorPageParts(parts, priorPages);
    const trackedImages = [...trackedPrior, ...trackedChars, ...trackedOther];

    if (options.revisionImage) {
      parts.push({
        text: 'REVISION REFERENCE: The following image is the current version. Revise it according to the instructions below.',
      });
      parts.push({
        inlineData: {
          mimeType: mimeTypeFromDataUri(options.revisionImage),
          data: toBase64(options.revisionImage),
        },
      });
    }

    // DA-114: directorNote (location/setting) is passed into buildCompositePrompt
    // as settingNote so it appears between CHARACTERS and the panel header —
    // the model reads location context after knowing who's in the scene.
    // DA-115: rawPromptOverride bypasses the assembler entirely. Character refs
    // and style header are still attached; only the composite text is replaced.
    const c = contract;
    const compositePrompt = options.rawPromptOverride ?? buildCompositePrompt(contract, options.directorNote, show);

    parts.push({ text: compositePrompt });

    // DA-114: style last.
    parts.push({ text: styleHeader });

    const requiredAssetIds = options.requiredCharacterAssetIds
      ?? charOnly.map(r => r.assetId);

    assertImageRequestHasRequiredCharacterRefs({
      parts,
      requiredCharacterAssetIds: requiredAssetIds,
      trackedImages,
      context: c.address || 'generateFinalComicPage',
    });

    const partsSummary = parts.map((p, idx) => {
      if ('text' in p) {
        return {
          kind: 'text' as const,
          text: p.text.length > 500 ? p.text.slice(0, 497) + '...' : p.text,
        };
      }

      const track = trackedImages.find(t => t.partIndex === idx);
      return {
        kind: 'image' as const,
        assetId: track?.assetId,
        label: track?.label || '(image)',
      };
    });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: '3:4',
          imageSize,
        },
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart) return null;

    // Served-response diagnostics: what actually came back, not what we asked for.
    // servedModelVersion can differ from the requested alias when Google re-points
    // a preview endpoint — the signal that distinguishes endpoint drift from a
    // throttle when an image "suddenly looks like a different kind of image".
    const servedModelVersion = (response as any).modelVersion ?? null;
    const responseId = (response as any).responseId ?? null;
    const finishReason = response.candidates?.[0]?.finishReason ?? null;
    const usage = (response as any).usageMetadata
      ? {
          promptTokenCount: (response as any).usageMetadata.promptTokenCount ?? null,
          totalTokenCount: (response as any).usageMetadata.totalTokenCount ?? null,
        }
      : null;

    const imageDataUri = `data:image/png;base64,${imagePart.inlineData!.data}`;
    const assetId = await compressAndStore(imageDataUri, COMPRESS_QUALITY_PAGE);
    if (!assetId) return null;

    return {
      assetId,
      panelAssetIds: [],
      request: {
        model: modelName,
        aspectRatio: '3:4',
        imageSize,
        styleHeader,
        directorNote: options.directorNote,
        compositePrompt,
        parts: partsSummary,
      },
      metadata: {
        prompt: compositePrompt,
        model: modelName,                 // requested alias
        servedModelVersion,               // what Google actually served (drift signal)
        responseId,                       // correlate to a specific API response
        finishReason,                     // non-STOP => degraded/filtered path
        usage,                            // token usage of this generation
        variantType: 'final',
        pageBeatUid: c.pageBeatUid,
        address: c.address,
        silentPage: c.silentPage,

        // Audit trail (spec §8): the full Text Render Contract + reference manifest.
        textRenderContract: c.panels.map(p => ({
          panel: p.index + 1,
          text: p.text.map(t => ({
            kind: t.kind,
            speaker: t.speakerName,
            text: t.text,
            position: t.position,
            chained: t.chained,
            captionStyle: t.captionStyle,
          })),
        })),

        attachedReferenceAssetIds: trackedImages.map(t => t.assetId).filter(Boolean),
        attachedImagePartCount: trackedImages.length,
        generationStartedAt,
        generationCompletedAt: new Date().toISOString(),
      },
    };
  });
};