import { Show, ScenePagePlan, GenerationPartSummary } from "../../types/models";
import { ComicPagePlan, ComicPanelSpec } from "../../utils/prompts/assembleComicPrompt";
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

export function buildPriorPageParts(
  parts: any[],
  priorPages: RefPartInput[],
  label?: string
): any[] {
  const tracked: { partIndex: number; assetId: string; label: string }[] = [];
  if (priorPages.length === 0) return tracked;
  const groupLabel = label || '[PRIOR PAGES FROM THIS SCENE — match art style and environment. Character appearances below take precedence over these pages.]';
  parts.push({ text: groupLabel });
  priorPages.forEach((page, i) => {
    const imgIndex = parts.length;
    parts.push({ inlineData: { mimeType: 'image/png', data: toBase64(page.dataUri) } });
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
      ? `[CHARACTER REFERENCE: ${ref.label} — this character must appear exactly as shown in all panels. Same face, same hair colour, same build. Do not alter their appearance.]`
      : `[VISUAL REFERENCE: ${ref.label}${ref.description ? ` — ${ref.description}` : ''}]`;
    parts.push({ text: labelText });
    const imgIndex = parts.length;
    parts.push({ inlineData: { mimeType: 'image/png', data: toBase64(ref.dataUri) } });
    tracked.push({ partIndex: imgIndex, assetId: ref.assetId, label: ref.label });
  }
  return tracked;
}
