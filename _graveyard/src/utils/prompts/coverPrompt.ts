import { Show, Character } from "../../types/models";
import { resolveCharacter } from "../../domainUtils";

/**
 * Cover prompt assembly. Two-pass system per D102:
 * pass 1 produces a clean scene image; pass 2 applies title
 * and publisher treatment over it.
 *
 * Extracted from assembleComicPrompt.ts in D286 (F5B pass 1).
 */

function stripHandles(text: string): string {
  // Replace @word.Word with just the name portion (after the dot)
  return text.replace(
    /@[a-zA-Z0-9]+\.([a-zA-Z0-9]+)/g,
    (_, name) => name
  );
}

export const assembleCoverPrompt = (
  show: Show,
  context?: {
    level: 'Show'|'Season'|'Episode'|'Act'|'Scene'|'Beat';
    title: string;
    summary: string;
    characterIds?: string[];
    visualDescription?: string;
  }
): string => {
  // D309: Combine base style and comic artist style.
  const basePositive = show.styleConfig.positivePrompt;
  const comicPositive = show.comicStyle?.artistStyle;
  const style = [basePositive, comicPositive].filter(Boolean).join('. ') || 'comic book cover art, professional illustration';

  const baseNegative = show.styleConfig.negativePrompt;
  const comicNegative = show.comicStyle?.negativePrompt;
  const neg = [baseNegative, comicNegative].filter(Boolean).join('. ');
  
  const title = show.titleSuggestion || show.name;

  // D102: resolve characters using show-leads fallback (D101 pattern)
  // Never use raw beat characterIds — they are unresolved role strings
  const resolvedChars = (() => {
    const fromContext = (context?.characterIds ?? []).map(cid => resolveCharacter(show, cid)).filter(Boolean);
    if (fromContext.length > 0) return fromContext as Character[];
    return (show.characters || []).filter(c => !c.isMinor).slice(0, 3);
  })();
  const characterDesc = resolvedChars
    .map(c => c.visualAnchor || c.physicalDescription || c.role)
    .filter(Boolean).join('. ');

  // D102: build a tight visual concept, not a narrative dump.
  // Strip handle names. Use scene/episode title + themes only — not full prose summary.
  // D159: Include summary/visual context to give the cover specific scope.
  const visualConcept = (() => {
    const themeLine = show.themes ? stripHandles(show.themes) : '';
    const coreContext = context?.visualDescription || context?.summary || '';
    const truncatedContext = coreContext.length > 200 ? coreContext.slice(0, 200) + '...' : coreContext;
    
    if (context?.title) {
      const scopeLabel = context.level;
      return `${scopeLabel}: "${context.title}". ${truncatedContext} ${themeLine}`;
    }
    return `${truncatedContext} ${themeLine}`;
  })();

  return [
    // D102: pass 1 = clean scene image. No title. No logo.
    `COMIC BOOK COVER IMAGE — '${title}'.`,
    `TONE AND GENRE: ${visualConcept}`,
    characterDesc ? `CHARACTERS: ${characterDesc}` : null,
    'COMPOSITION: Full-page dramatic illustration. Single character or ensemble in a',
    'cinematic, high-impact pose. Artwork fills the entire frame edge to edge.',
    'NO TITLE TEXT. NO LOGO. NO SPEECH BALLOONS. NO CAPTIONS. NO LABELS.',
    'Do not render any text, letters, numbers, or symbols anywhere in the image.',
    `ARTIST STYLE: ${style}.`,
    neg ? `EXCLUDE: ${neg}.` : null,
  ].filter(Boolean).join('\n');
};

export const assembleCoverTreatmentInstructions = (
  show: Show
): string => {
  const title = (show.titleSuggestion || show.name).toUpperCase();
  const publisher = "STAR SPLITTER";
  return [
    `APPLY COVER TREATMENT to the provided scene image.`,
    `PRESERVE the photographic scene completely. Do not alter any characters, settings, or lighting.`,
    `ADD the following cover design elements only:`,
    ``,
    `PUBLISHER BLOCK: Upper top-left corner. Small rectangular box containing the text`,
    `"${publisher}" and a small star icon. Professional comic book corner-box style.`,
    ``,
    `TITLE: Render "${title}" in large bold comic book typography integrated into the`,
    `top third of the image. Stylized lettering, possibly with slight 3D depth or`,
    `dynamic perspective. The title must be fully legible and dominant.`,
    ``,
    `NO other additions. No speech balloons, captions, credits, barcodes, or issue numbers.`,
  ].join("\n");
};
