// ── Character Caption Palette ──────────────────────────────────────────────
// D106: Default caption colors. Warm/cool pairs — never assigned twice.
// Applied in character order: first character in show.characters gets index 0.
// Used by: planToOverlays (thought-bar color assignment),
//          buildLetteringPrompt (thought-bar color in AI lettering spec).
export const CHARACTER_CAPTION_PALETTE: string[] = [
  '#8B4513',  // saddle brown — warm, earthy
  '#2F4F6F',  // dark slate blue — cool, considered
  '#5C4033',  // deep umber — grounded
  '#1A5276',  // dark navy — formal
  '#6B3A2A',  // terracotta — vivid
  '#264653',  // dark teal — measured
];
