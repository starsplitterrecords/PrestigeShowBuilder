import { Show, ScenePagePlan, GenerationPartSummary } from "../../types/models";
import { ComicPagePlan, ComicPanelSpec } from "../../utils/prompts/panelCountUtils";
import { GenerationMode } from "../../utils/generationMode";

export interface GeneratedImageResult {
  assetId: string;
  panelAssetIds?: string[];
  plan?: ComicPagePlan | ScenePagePlan;
  spec?: ComicPanelSpec;
  request: {
    model: string;
    aspectRatio: string;
    imageSize: string;
    styleHeader: string;
    directorNote?: string;
    compositePrompt: string;
    parts: GenerationPartSummary[];
  };
  metadata?: any;
}

export interface RefPartInput {
  dataUri: string;
  assetId: string;    // for lineage capture
  label: string;      // human label
  description?: string;
  isCharacter?: boolean;
}

export const COMPRESS_QUALITY_PAGE = 0.82;
export const COMPRESS_QUALITY_LETTERED = 0.85;

export function assembleStyleHeader(show: Show): string {
  const comic = show.comicStyle;
  
  // D309: Combine base style and comic-specific style if both exist.
  // The user explicitly requested "Base Visual Style" to be included in comic runs.
  const basePositive = show.styleConfig.positivePrompt;
  const comicPositive = comic?.artistStyle;
  const stylePositive = [basePositive, comicPositive].filter(Boolean).join('. ');

  const baseNegative = show.styleConfig.negativePrompt;
  const comicNegative = comic?.negativePrompt;
  const styleNegative = [baseNegative, comicNegative].filter(Boolean).join('. ') || 'none';

  const baseComp = show.styleConfig.compositionPrompt;
  const comicComp = comic?.compositionPrompt;
  const styleComposition = [baseComp, comicComp].filter(Boolean).join('. ');

  return [
    `STYLE: ${stylePositive}.`,
    `EXCLUDE: ${styleNegative}.`,
    styleComposition ? `COMPOSITION: ${styleComposition}.` : null,
  ].filter(Boolean).join('\n');
}

export function resolveImageSize(
  mode: GenerationMode,
  context: string
): string {
  if (context === 'reference') return '512';
  if (context === 'concept')   return '1K';
  if (context === 'lettering') return '1K';
  // production:
  return mode === 'paid' ? '2K' : '1K';
}

const toBase64 = (uri: string): string =>
  uri.replace(/^data:image\/\w+;base64,/, '');

// DA-101: the mimeType sent to the model must match the actual bytes. Every
// AI-generated image (pages, AI-generated portraits) is re-encoded to JPEG by
// compressAndStore regardless of what the model originally returned, so a
// hardcoded 'image/png' here was wrong for any generated reference — only
// true for refs that happen to be uploaded PNGs. Read it off the data URI.
export const mimeTypeFromDataUri = (uri: string): string => {
  const match = uri.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : 'image/jpeg';
};

export function buildPriorPageParts(
  parts: any[],
  priorPages: RefPartInput[],
  label?: string
): any[] {
  const tracked: { partIndex: number; assetId: string; label: string }[] = [];
  if (priorPages.length === 0) return tracked;
  const groupLabel = label || '[PRIOR PAGE CONTINUITY REFERENCE: Use this only for continuity of recurring character appearance, environment, lighting feel, palette, and overall art style. Do not copy prior-page dialogue, captions, balloons, signs, sound effects, panel layout, panel count, camera angles, or story action unless explicitly requested in the current page prompt.]';
  parts.push({ text: groupLabel });
  priorPages.forEach((page, i) => {
    const imgIndex = parts.length;
    parts.push({ inlineData: { mimeType: mimeTypeFromDataUri(page.dataUri), data: toBase64(page.dataUri) } });
    parts.push({ text: `[Prior page ${i + 1}]` });
    tracked.push({ partIndex: imgIndex, assetId: page.assetId, label: page.label });
  });
  return tracked;
}

export function buildCharacterRefParts(
  parts: any[],
  characterRefs: RefPartInput[]
): any[] {
  const tracked: { partIndex: number; assetId: string; label: string }[] = [];
  for (const ref of characterRefs) {
    const labelText = ref.isCharacter
      ? `[CHARACTER REFERENCE: ${ref.label} — Whenever this character appears, render them exactly as shown in the attached reference. Do not add this character to panels where they are not staged or requested. Same face, same hair colour, same build. Do not alter their appearance.]`
      : `[VISUAL REFERENCE: ${ref.label}${ref.description ? ` — ${ref.description}` : ''}]`;
    parts.push({ text: labelText });
    const imgIndex = parts.length;
    parts.push({ inlineData: { mimeType: mimeTypeFromDataUri(ref.dataUri), data: toBase64(ref.dataUri) } });
    tracked.push({ partIndex: imgIndex, assetId: ref.assetId, label: ref.label });
  }
  return tracked;
}
