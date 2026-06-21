// DA-095: persist the EXACT prompt per image.
// The final generator returns a rich `request` (styleHeader, directorNote,
// compositePrompt, parts summary) plus `metadata` (which only carried the
// composite prompt). The page writers persisted metadata alone, so the stored
// "exact prompt" was missing the style header (STYLE / LETTERING / EXCLUDE) and
// the director's note — the layers most worth debugging. This helper merges the
// request and an assembled full-text prompt into the metadata that gets stored
// on the ImageVersion, so the "This image" panel can show the true model input.
 
export interface GeneratedPageResultLike {
  assetId?: string;
  metadata?: any;
  request?: {
    model?: string;
    aspectRatio?: string;
    imageSize?: string;
    styleHeader?: string;
    directorNote?: string;
    compositePrompt?: string;
    parts?: any;
  };
}
 
export function buildStoredImageMetadata(result: GeneratedPageResultLike | null | undefined): any {
  const metadata = result?.metadata ? { ...result.metadata } : {};
  const req = result?.request;
  if (!req) return metadata;
 
  const fullTextPrompt = [
    req.styleHeader || '',
    req.directorNote ? `DIRECTOR'S NOTE (PRIORITY): ${req.directorNote}` : '',
    req.compositePrompt || '',
  ].filter(Boolean).join('\n\n');
 
  return {
    ...metadata,
    request: req,          // full model request: style header, director note, composite, parts
    fullTextPrompt,        // the assembled exact text the model received
  };
}
