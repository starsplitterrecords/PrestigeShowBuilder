import { CharacterPosition, TextOverlaySpec } from '../../types/models';
import {
  MAX_BALLOON_CHARS,
  BALLOON_SPLIT_LOOKAHEAD,
} from '../../constants/generation.constants';

/**
 * splitBalloonText — D115
 * Splits long balloon text into chunks <=MAX_BALLOON_CHARS at natural
 * sentence/clause boundaries. Each chunk becomes a separate chained balloon.
 */
export function splitBalloonText(text: string): string[] {
  const t = text.trim();
  if (t.length <= MAX_BALLOON_CHARS) return [t];

  const chunks: string[] = [];
  let remaining = t;

  while (remaining.length > MAX_BALLOON_CHARS) {
    const window = remaining.slice(0, MAX_BALLOON_CHARS + BALLOON_SPLIT_LOOKAHEAD);
    let best = -1;

    // Priority 1: sentence end (.  !  ?)
    for (let i = Math.min(MAX_BALLOON_CHARS, window.length) - 1; i > window.length / 3; i--) {
      if ('.!?'.includes(window[i])) { best = i + 1; break; }
    }
    // Priority 2: ellipsis (...)
    if (best === -1) {
      const e = window.lastIndexOf('...');
      if (e > window.length / 3) best = e + 3;
    }
    // Priority 3: comma
    if (best === -1) {
      for (let i = Math.min(MAX_BALLOON_CHARS, window.length) - 1; i > window.length / 3; i--) {
        if (window[i] === ',') { best = i + 1; break; }
      }
    }
    // Priority 4: last space
    if (best === -1) {
      for (let i = Math.min(MAX_BALLOON_CHARS, window.length) - 1; i > window.length / 3; i--) {
        if (window[i] === ' ') { best = i + 1; break; }
      }
    }
    // Fallback: hard cut
    if (best <= 0) best = MAX_BALLOON_CHARS;

    const chunk = remaining.slice(0, best).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(best).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * cleanLetteringText — Bug Fix: Speech Bubble Attribution Strip
 * Removes character attribution prefixes and surrounding quotes from dialogue.
 * 1. Strip handle prefix: @[^\s]+\.[^\s]+:\s*
 * 2. Strip plain name prefix: ^[A-Za-z][A-Za-z\s]+:\s*
 * 3. Strip surrounding quotes: Remove leading/trailing " or '
 * 4. Trim whitespace
 */
export function cleanLetteringText(text: string): string {
  if (!text) return "";
  let cleaned = text;

  // Step 1 — Strip handle prefix
  cleaned = cleaned.replace(/^@[^\s]+\.[^\s]+:\s*/, "");

  // Step 2 — Strip plain name prefix
  cleaned = cleaned.replace(/^[A-Za-z][A-Za-z\s]+:\s*/, "");

  // Step 3 — Strip surrounding quotes
  cleaned = cleaned.replace(/^["']+|["']+$/g, "");

  // Step 4 — Trim
  return cleaned.trim();
}

/**
 * placementFromSpeaker — D238
 * Derives balloon placement from speaker position in the panel.
 */
export function placementFromSpeaker(
  speakerPos: CharacterPosition | undefined,
  alreadyPlaced: Array<{ position: TextOverlaySpec['position'] }>
): { position: TextOverlaySpec['position']; tailDirection: TextOverlaySpec['tailDirection'] } {
  // No position → neutral top, tail down. (Better than a fixed corner
  // that may sit over another figure.)
  if (!speakerPos) {
    return { position: 'top-full', tailDirection: 'bottom-left' };
  }

  // Anchor to the speaker's horizontal side. The balloon sits above the
  // speaker; the tail points DOWN toward them. Facing does NOT move the
  // balloon — a speaker looking left is still the source of the line.
  const side: 'left' | 'right' | 'center' =
    speakerPos.zone.endsWith('-left') ? 'left'
    : speakerPos.zone.endsWith('-right') ? 'right'
    : 'center';

  let pos: TextOverlaySpec['position'];
  let tailStr: TextOverlaySpec['tailDirection'];
  if (side === 'left') { pos = 'top-left';  tailStr = 'bottom-left'; }
  else if (side === 'right') { pos = 'top-right'; tailStr = 'bottom-right'; }
  else { pos = 'top-full'; tailStr = 'bottom-left'; }

  // Collision: only when another balloon already holds this exact spot
  // in the same panel. Move this one to the opposite side so two
  // speakers in one panel do not overlap. A centre balloon shifts right.
  const occupied = alreadyPlaced.some(o => o.position === pos);
  if (occupied) {
    if (pos === 'top-left') { pos = 'top-right'; tailStr = 'bottom-right'; }
    else if (pos === 'top-right') { pos = 'top-left'; tailStr = 'bottom-left'; }
    else { pos = 'top-right'; tailStr = 'bottom-right'; }  // centre → right
  }

  return { position: pos, tailDirection: tailStr };
}
