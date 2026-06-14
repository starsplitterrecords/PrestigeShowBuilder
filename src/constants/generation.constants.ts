// ── Page planning limits ───────────────────────────────────────────────────
export const MAX_BALLOON_CHARS      = 65;  // splitBalloonText threshold
export const TARGET_PANELS_PER_PAGE = 4;   // ideal; 3-5 is acceptable
export const MAX_PANELS_PER_PAGE    = 6;   // hard cap on panels per page
export const MAX_BALLOONS           = 3;   // assembleComicPrompt selectBalloonLines cap

// ── splitBalloonText window lookahead ──────────────────────────────────────
export const BALLOON_SPLIT_LOOKAHEAD = 12; // chars beyond MAX_BALLOON_CHARS to scan for split point

// ── Action words used by hasSignificantAction ─────────────────────────────
// A beat containing 2+ of these words in beat.description gets a bonus action panel.
export const ACTION_WORDS: string[] = [
  'grabs', 'throws', 'strikes', 'runs', 'leaps', 'charges',
  'pulls', 'pushes', 'draws', 'fires', 'falls', 'crashes', 'blocks',
  'steps', 'turns', 'moves', 'reaches', 'catches', 'tosses', 'wraps',
  'braces', 'anchors', 'loops', 'drags', 'hands', 'holds', 'lifts',
];
export const SIGNIFICANT_ACTION_MIN_DESC_LENGTH = 80;   // below this length: not action-heavy
export const SIGNIFICANT_ACTION_WORD_THRESHOLD  = 2;    // need at least this many action words

// ── PANEL_VARIETY_SHOTS ────────────────────────────────────────────────────
// Panels 2+ in a multi-panel page rotate through these shot descriptions.
// Ordered to provide natural visual progression across a page.
export const PANEL_VARIETY_SHOTS: string[] = [
  'MEDIUM SHOT: Waist up. Both characters and their relationship readable.',
  'CLOSE-UP: Tight on expression. Reaction is the subject.',
  'WIDE SHOT: Full environment. Characters placed in their space.',
  'MEDIUM WIDE: Three-quarter. Character and immediate surroundings.',
  'TWO-SHOT: Both characters share the frame equally. Relationship is the subject.',
  'LOW ANGLE: Camera below eye level. Subject appears larger, more powerful.',
];

// ── SHOT_TYPES ─────────────────────────────────────────────────────────────
// Used by assembleComicPrompt to derive the primary shot from beat.direction.
export const SHOT_TYPES: Array<{ signal: string[]; shot: string }> = [
  { signal: ['close', 'face', 'reaction', 'eyes'], shot: 'CLOSE-UP: Face fills the frame. Expression is the subject.' },
  { signal: ['wide', 'establish', 'room', 'environment', 'location'], shot: 'WIDE SHOT: Environment dominant. Characters present but secondary to location.' },
  { signal: ['over', 'shoulder', 'ots', 'behind'], shot: 'OVER-THE-SHOULDER: Camera behind one character, facing the other. Conversation framing.' },
  { signal: ['pov', 'point of view', 'sees', 'through'], shot: 'POINT-OF-VIEW: Camera as character eyes. Subjective. Viewer inhabits the character.' },
  { signal: ['low', 'below', 'looking up', 'imposing'], shot: 'LOW ANGLE: Camera below eyeline. Figure looms. Power and threat.' },
  { signal: ['high', 'above', 'looking down', 'vulnerable'], shot: 'HIGH ANGLE: Camera above eyeline. Character small in frame. Vulnerability or surveillance.' },
  { signal: ['two', 'together', 'both', 'side by side'], shot: 'TWO-SHOT: Both characters share the frame equally. Relationship is the subject.' },
  { signal: ['action', 'fight', 'run', 'move', 'burst', 'leap'], shot: 'MEDIUM WIDE: Full figure in motion. Enough environment to read the space.' },
];

// ── Portrait shot compositions ─────────────────────────────────────────────
// Used by generateCharacterPortrait in imageGeneration.ts.
export const PORTRAIT_SHOTS: Array<{ name: string; instruction: string }> = [
  { name: 'HEADSHOT',      instruction: 'COMPOSITION: Tight headshot. Face and neck fill the frame. No torso. Extreme close-up on facial features and expression.' },
  { name: 'BUST',          instruction: 'COMPOSITION: Bust shot. Head and shoulders. Upper chest visible. Classic portrait crop.' },
  { name: 'THREE_QUARTER', instruction: 'COMPOSITION: Three-quarter shot. Waist up. Character placed in their environment. Face and posture both readable.' },
  { name: 'FULL_BODY',     instruction: 'COMPOSITION: Full body shot. Head to toe. Full figure visible. Environment present. Silhouette readable.' },
  { name: 'ACTION_POSE',   instruction: 'COMPOSITION: Full body action pose. Figure in motion or tension. Dynamic framing. Camera low angle. Environment implied.' },
];

// ── Image size tiers ───────────────────────────────────────────────────
export const IMAGE_SIZE_CONCEPT     = '1K';   // portraits -- display + reference
export const IMAGE_SIZE_PRODUCTION  = '2K';   // pages -- output quality in paid mode
export const IMAGE_SIZE_PRODUCTION_FREE = '1K'; // pages -- free mode
export const IMAGE_SIZE_REFERENCE   = '512';  // vault refs -- input context only

// Cost per output image in USD. References cost the same as 1K (same token count).
// 512 is cheaper but not broken out separately -- use 1K cost as a conservative estimate.
export const COST_PER_IMAGE: Record<string, number> = {
  '512': 0.02,
  '1K':  0.04,
  '2K':  0.08,
  '4K':  0.00,  // canvas upscale -- no API cost
};

export const COST_PER_VIDEO = 0.20; // Veo 3.1 Fast estimate

export type ImageStage = 'concept' | 'production' | 'lettering' | 'reference';

/**
 * Returns the correct imageSize string for a given stage and mode.
 * Reference stage always returns 512 regardless of mode --
 * references are input context, not output assets.
 */
export function resolveImageSize(
  mode: 'free' | 'paid',
  stage: ImageStage
): string {
  if (stage === 'reference') return IMAGE_SIZE_REFERENCE;
  if (stage === 'concept')   return IMAGE_SIZE_CONCEPT;
  if (stage === 'lettering') return IMAGE_SIZE_CONCEPT; // inherits -- caller uses source size
  // production:
  return mode === 'paid' ? IMAGE_SIZE_PRODUCTION : IMAGE_SIZE_PRODUCTION_FREE;
}

/**
 * Returns the correct aspect ratio for a reference vault entry.
 * minor-character uses 3:4 (portrait). Everything else uses 1:1 (square).
 */
export function resolveReferenceAspect(type: string): string {
  return type === 'minor-character' ? '3:4' : '1:1';
}

// ── Generation compression quality values ──────────────────────────────────
export const COMPRESS_QUALITY_PORTRAIT    = 0.88;
export const COMPRESS_QUALITY_PANEL       = 0.80;
export const COMPRESS_QUALITY_PAGE        = 0.82;
export const COMPRESS_QUALITY_LETTERED    = 0.85;
export const COMPRESS_QUALITY_COVER_PASS1 = 0.82;
export const COMPRESS_QUALITY_COVER_PASS2 = 0.80;

// ── Generation log cap ─────────────────────────────────────────────────────
export const GENERATION_LOG_MAX = 500;

// ---- Publication platform presets -----------------------------------
export interface PublicationPreset {
 id: string;
 label: string;
 targetWidth:  number;
 targetHeight: number;
 dpi:          number;
 hasBleed:     boolean;
 description:  string;
}
 
export const PUBLICATION_PRESETS: PublicationPreset[] = [
 {
   id: "raw",
   label: "Original Source (Raw Assets)",
   targetWidth:  0, targetHeight: 0, dpi: 0, hasBleed: false,
   description: "No upscaling. Exports zipped images at their native generated resolution.",
 },
 {
   id: "globalcomix",
   label: "GlobalComix (Digital)",
   targetWidth:  1536, targetHeight: 2048, dpi: 150, hasBleed: false,
   description: "1536x2048px / 150 DPI / Digital / No bleed",
 },
 {
   id: "kdp-standard",
   label: "KDP 6.625x10.25in (Standard US Comic)",
   targetWidth:  2063, targetHeight: 3150, dpi: 300, hasBleed: true,
   description: "2063x3150px / 300 DPI / 0.125in bleed / White letterbox",
 },
 {
   id: "kdp-65x10",
   label: "KDP 6.5x10.0in (Alt US Comic)",
   targetWidth:  2025, targetHeight: 3075, dpi: 300, hasBleed: true,
   description: "2025x3075px / 300 DPI / 0.125in bleed / White letterbox",
 },
 {
   id: "kdp-custom",
   label: "KDP Custom Trim Size",
   targetWidth:  0, targetHeight: 0, dpi: 300, hasBleed: true,
   description: "Enter trim inches -- pixels calculated at 300 DPI + 0.125in bleed",
 },
];
 
export function calcPublicationPixels(
 trimWidthIn: number, trimHeightIn: number,
 dpi: number, bleedIn: number = 0.125
): { width: number; height: number } {
 return {
   width:  Math.round((trimWidthIn  + bleedIn * 2) * dpi),
   height: Math.round((trimHeightIn + bleedIn * 2) * dpi),
 };
}
