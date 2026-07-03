// comicStyleHeader.ts — DA-114
// DA-114: LETTERING removed from this header. It now appears as a single
// consolidated LETTERING SPEC block at the bottom of buildCompositePrompt,
// immediately before STYLE, so the model reads it adjacent to the text it
// governs rather than at the top of a multi-section prompt it hasn't parsed yet.
import { Show } from '../../types/show';

export const DEFAULT_LETTERING_STYLE =
  'Professional comic-book lettering conventions. Use consistent balloon shape, stroke weight, tail style, font weight, caption styling, and joined-balloon treatment across every page of this comic. Speech balloons are white with thin black borders, slightly irregular oval shapes, professional bold all-caps comic lettering, balanced line breaks, smooth tails aimed at speaker mouths, and fully legible text. Use clean bridge connectors only for joined balloons from the same speaker.';

export function sanitizeNegativePromptForFinalComicPage(
  negativePrompt: string,
  silentPage: boolean
): string {
  if (silentPage) return negativePrompt;

  const banned = [
    'text', 'letters', 'lettering', 'words', 'captions',
    'speech balloons', 'speech bubbles', 'title', 'logo', 'typography',
  ];

  return negativePrompt
    .split(',')
    .map(s => s.trim())
    .filter(term => {
      const lower = term.toLowerCase();
      return !banned.some(b => lower === b || lower.includes(b));
    })
    .join(', ');
}

// DA-114: Style only — no LETTERING block here.
// LETTERING is emitted once, in buildCompositePrompt's closing section,
// adjacent to the TEXT TO RENDER items it governs.
export function assembleComicStyleHeader(show: Show, silentPage: boolean = false): string {
  const cs = (show.comicStyle || {}) as any;

  const styleBits = [
    cs.artistStyle,
    cs.colorPalette ? `Color palette: ${cs.colorPalette}` : '',
    cs.lineWeight ? `Line weight: ${cs.lineWeight}` : '',
  ].filter(Boolean).join('. ');

  const out = [`STYLE: ${styleBits || 'professional comic book art, clean linework'}.`];

  if (cs.compositionPrompt) out.push(`COMPOSITION: ${cs.compositionPrompt}.`);
  if (cs.negativePrompt) {
    const sanitized = sanitizeNegativePromptForFinalComicPage(cs.negativePrompt, silentPage);
    if (sanitized) out.push(`EXCLUDE: ${sanitized}.`);
  }

  return out.join('\n');
}
