import { Show, Character } from '../../types/models';

export type EnsembleAspect = 'vertical' | 'horizontal' | 'square';

interface EnsemblePromptResult {
  styleHeader: string;
  compositePrompt: string;
}

export function buildEnsemblePrompt(
  show: Show,
  aspect: EnsembleAspect,
  featuredIds?: string[]
): EnsemblePromptResult {
  // Filter to characters with at least a name and (ideally) a portrait or
  // visualAnchor. Skip characters that are pure archetypes if isMinor &&
  // no portraitAssetId — they shouldn't be in the cast photo.
  const featuredChars: Character[] = (show.characters || []).filter(c => {
    if (featuredIds && !featuredIds.includes(c.id)) return false;
    if (!c.name?.trim()) return false;
    if (c.isMinor && !c.portraitAssetId) return false;
    return true;
  });

  // Style header pulls from comicStyle so the ensemble matches the show's art.
  const styleHeader = show.comicStyle
    ? `${show.comicStyle.artistStyle}. ${show.comicStyle.colorPalette}. ${show.comicStyle.lineWeight}.`.trim()
    : 'Comic art style.';

  if (featuredChars.length === 0) {
    return {
      styleHeader,
      compositePrompt: 'ERROR: No characters selected for ensemble generation.'
    };
  }

  const charLines = featuredChars.map(c => {
    const feat = c.identifyingFeature?.trim()
      || c.visualAnchor?.trim()
      || c.physicalDescription?.trim()
      || c.role
      || '';
    return `${c.name}${feat ? ': ' + feat : ''}`;
  }).join('\n');

  const aspectGuidance = aspect === 'horizontal'
    ? 'Wide horizontal composition — characters arranged left-to-right across the frame.'
    : aspect === 'square'
    ? 'Square composition — tighter group, characters clustered.'
    : 'Vertical composition — characters arranged with foreground/background depth, like a poster.';

  const isSingle = featuredChars.length === 1;

  const compositePrompt = isSingle ? [
    'PROMOTIONAL CHARACTER PORTRAIT — single subject.',
    '',
    'STRICT CONSTRAINT: Only one character in frame. No background characters, no silhouettes, no extra figures.',
    '',
    'CHARACTER (render with exact appearance from attached reference):',
    charLines,
    '',
    'COMPOSITION:',
    aspectGuidance,
    'Key art portrait — subject centered, posed, aware of the camera, engaged with the viewer.',
    'Subject occupies the central portion of the frame; head and shoulders prominent for vertical and square; full body acceptable for horizontal.',
    'No speech balloons. No captions. No text of any kind. No panel borders.',
    '',
    'BACKGROUND:',
    'Atmospheric, evocative of the show\'s tone (neutral or abstracted).',
    'Solid color, gradient, or thematic abstraction acceptable. Avoid photorealistic environments.',
    '',
    `The art style is the show's established comic style (see STYLE HEADER above). Render the character in that style consistently.`,
  ].join('\n') : [
    `PROMOTIONAL CAST IMAGE — featuring ONLY these ${featuredChars.length} characters.`,
    '',
    'STRICT CONSTRAINT: Do not include any background characters or extra figures. Only render the specific individuals listed below.',
    '',
    'CHARACTERS (render each character with their exact appearance from attached references):',
    charLines,
    '',
    'COMPOSITION:',
    aspectGuidance,
    'Promotional poster framing — characters posed, aware of the camera, at least passively engaged with the viewer.',
    'Clear hierarchy — main characters prominent, secondary characters arranged to complement them.',
    'No speech balloons. No captions. No text of any kind. No panel borders.',
    '',
    'BACKGROUND:',
    'Atmospheric, evocative of the show\'s tone (neutral or abstracted).',
    'Solid color, gradient, or thematic abstraction acceptable. Avoid photorealistic environments.',
    '',
    `The art style is the show's established comic style (see STYLE HEADER above). Render every character in that style consistently.`,
  ].join('\n');

  return { styleHeader, compositePrompt };
}
