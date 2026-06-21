import { Show } from '../../types/show';

export const DEFAULT_LETTERING_STYLE =
  'Professional comic-book lettering conventions. Use consistent balloon shape, stroke weight, tail style, font weight, caption styling, and joined-balloon treatment across every page of this comic. Speech balloons are white with thin black borders, slightly irregular oval shapes, professional bold all-caps comic lettering, balanced line breaks, smooth tails aimed at speaker mouths, and fully legible text. Use clean bridge connectors only for joined balloons from the same speaker.';

export function sanitizeNegativePromptForFinalComicPage(
  negativePrompt: string,
  silentPage: boolean
): string {
  if (silentPage) return negativePrompt;

  const banned = [
    'text',
    'letters',
    'lettering',
    'words',
    'captions',
    'speech balloons',
    'speech bubbles',
    'title',
    'logo',
    'typography',
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

export function assembleComicStyleHeader(show: Show, silentPage: boolean = false): string {
  const cs = (show.comicStyle || {}) as any;

  const styleBits = [
    cs.artistStyle,
    cs.colorPalette ? `Color palette: ${cs.colorPalette}` : '',
    cs.lineWeight ? `Line weight: ${cs.lineWeight}` : '',
  ].filter(Boolean).join('. ');

  const out = [`STYLE: ${styleBits || 'professional comic book art, clean linework'}.`];

  const letteringStyle = cs.letteringStyle || DEFAULT_LETTERING_STYLE;
  out.push(`LETTERING: ${letteringStyle}`);

  if (cs.compositionPrompt) out.push(`COMPOSITION: ${cs.compositionPrompt}.`);
  if (cs.negativePrompt) {
    const sanitized = sanitizeNegativePromptForFinalComicPage(cs.negativePrompt, silentPage);
    if (sanitized) {
      out.push(`EXCLUDE: ${sanitized}.`);
    }
  }

  return out.join('\n');
}
