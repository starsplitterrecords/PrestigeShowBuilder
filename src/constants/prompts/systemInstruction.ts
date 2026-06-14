import { WritingRules } from "../../types/models";

/**
 * AI SYSTEM INSTRUCTION
 * Technical: Defining the persona, constraints, and production protocols.
 */
export const SYSTEM_INSTRUCTION_BASE = `
You are a world-class Cinematic Architect and Creative Director.
Your task is to build a high-end "Prestige" TV series bible that is 100% UNIQUE
and professionally formatted for network buyers.

STRICT PRODUCTION PROTOCOLS:
1. NO TROPES: Avoid overused names or plot points. Be culturally specific.
2. CHARACTER HANDLES: Always use "@[showCode].[name]" format in all narrative summaries.
3. BEAT DENSITY: Every Cinematic Beat focuses on a maximum of TWO characters.
4. SINGLE-LINE DIALOGUE: Every beat MUST contain EXACTLY ONE line of dialogue.
5. [RENDERABILITY_RULE]
6. AESTHETIC SILOING: Adhere to provided templates for each stage.
7. COMPLETENESS: Minimum 250 characters for all narrative fields.
8. STRUCTURAL VARIATION: No two consecutive beats may use the same structural move.
   Vary: proximity, power balance, tempo, revelation type.
   Each scene must contain at least one power dynamic shift.
`;

// Scans richInput for overused words and returns an explicit generation warning.
// Returns empty string if richInput is absent or too short to analyse.
const getLexicalGuard = (show: { richInput?: string; showCode?: string }): string => {
  if (!show.richInput || show.richInput.length < 200) return '';

  const words = show.richInput
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);

  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  const STOP_WORDS = new Set([
    'their','there','these','those','which','where','while','about',
    'would','could','should','after','before','other','every','being',
    'between','through','without','because','within','across','against',
    'during','inside','outside','under','first','second','third',
    'characters','character','scene','story','physical','narrative',
    'episode','season','summary','world'
  ]);

  const saturated = Object.entries(freq)
    .filter(([word, count]) => count > 8 && !STOP_WORDS.has(word) && word !== show.showCode?.toLowerCase())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);

  if (saturated.length === 0) return '';

  return `\nLEXICAL GUARD — SOURCE DOCUMENT OVERUSE DETECTED:\n` +
    `The author's source material uses these words at unusually high frequency: ` +
    `${saturated.map(w => `"${w}"`).join(', ')}.\n` +
    `These words carry the show's THEMATIC DNA — do not strip them from the world.\n` +
    `But do NOT repeat any of them more than twice per scene in generated output.\n` +
    `Express the quality they represent through SPECIFIC DRAMATIC WANT instead.\n` +
    `Show what a character does with their body in service of what they need.\n` +
    `The action must be in pursuit of something — not a demonstration of intensity.\n` +
    `"heavy" → show WHY the weight matters: she cannot put it down until he acknowledges her.\n` +
    `"solid" → show what it means that it does not move: they cannot get through it together.\n` +
    `The reader should FEEL the word without seeing it repeated.`;
};

// Derives show-specific rules 9, 10, 11 from the show's own data.
// Called at generation time, not at import time.
export const getDynamicSystemInstruction = (show: {
  name: string;
  premise?: string;
  styleConfig: { positivePrompt: string; negativePrompt?: string };
  themes?: string;
  initMode?: string;
  richInput?: string;
  showCode?: string;
  writingRules?: WritingRules;
}): string => {

  // Derive a location example from the show's style and premise.
  // Use the style preset as the primary register anchor.
  const style = show.styleConfig.positivePrompt || '';
  const negTerms = show.styleConfig.negativePrompt
    ? show.styleConfig.negativePrompt.split(',').map(t => t.trim()).join(', ')
    : 'N/A';
  const premise = show.premise || '';
  const combined = `${show.name} ${style} ${premise}`.toLowerCase();

  const renderabilityRule = `5. DRAMATIC REGISTER — NARRATIVE GENERATION RULE:
Physical action is the CONTAINER. Drama is the CONTENT.
Do not confuse what characters do with what the scene is about.
EVERY scene must have a specific human want underneath the physical action.
That want must be named precisely.
Not "power" — he cannot leave this room without knowing if she will cover for him.
Not "control" — she needs the call to end before her voice breaks.
The physical action must be in SERVICE of that want, not a replacement for it.
WRONG: Two characters argue. One walks out.
RIGHT: One character starts to leave, stops with their hand on the door,
and does not turn around. They are listening for her to ask them to stay.`;

  const locationExample = deriveLocationExample(combined);
  const nameGuidance = deriveNameGuidance(combined, show.themes || '');
  const titleGuidance = deriveTitleGuidance(combined);

  const baseWithRenderability = SYSTEM_INSTRUCTION_BASE.replace(
    '5. [RENDERABILITY_RULE]',
    renderabilityRule
  ).replace(
    '@[showCode]',
    `@${show.showCode?.toLowerCase() || 'show'}`
  );

  const lexicalGuard = getLexicalGuard(show);

  const rules = show.writingRules;
  let rulesText = '';
  if (rules) {
    const formatRules = (label: string, list: string[]) => {
      if (!list || list.length === 0) return '';
      return `\n${label}:\n` + list.map(r => `  - ${r}`).join('\n');
    };
    rulesText = `\n\nWRITING RULES & PRODUCTION STANDARDS:\n` +
      formatRules('DIALOGUE RULES', rules.dialogueRules) +
      formatRules('BLOCKING & STAGING RULES', rules.blockingRules) +
      formatRules('STRUCTURE RULES', rules.structureRules) +
      formatRules('CRAFT NOTES', rules.craftNotes);
  }

  return baseWithRenderability +
    `\n8b. AESTHETIC EXCLUSIONS (NON-NEGOTIABLE): Never describe, imply, or reference\n   any of the following: ${negTerms}.` +
    `\n    If any location example below contains excluded terms,\n   use a clean equivalent instead.` +
    `\n9. SPECIFICITY MANDATE: All locations must be named and textured.` +
    `\n   Do not write 'a room' or 'an office'. Write '${locationExample}'.` +
    `\n   Every environment must contain at least one concrete tactile detail.` +
    `\n10. NAME AUTHENTICITY: ${nameGuidance}` +
    `\n11. EPISODE TITLES: ${titleGuidance}` +
    lexicalGuard +
    rulesText;
};

// ─── DERIVATION HELPERS ───────────────────────────────────────────────

const deriveLocationExample = (combined: string): string => {
  // Order matters — check most specific registers first.
  if (/space|orbit|station|ship|galaxy|planet|asteroid|colony/i.test(combined))
    return 'the observation deck of a deep-range relay station, 0300 ship-time, recycled air and instrument hum';
  if (/marine|ocean|aquarium|underwater|sea|reef|dive|fish|whale/i.test(combined))
    return 'the lower observation corridor of a marine research facility, 0500, blue-lit tank glass and the pressure hum of the filtration system';
  if (/hospital|medical|clinic|surgeon|nurse|patient|ward/i.test(combined))
    return 'the scrub corridor outside OR-4, 11pm, antiseptic and the squeak of a gurney wheel';
  if (/court|law|legal|lawyer|attorney|judge|trial/i.test(combined))
    return 'the overflow waiting room of a district court, 7am, fluorescent flicker and stacked case files';
  if (/school|academy|campus|university|college|teacher|student/i.test(combined))
    return 'the back stairwell of a prep school main building, between periods, chalk dust and the distant bell';
  if (/police|detective|crime|murder|investigation|precinct/i.test(combined))
    return 'the evidence lock-up of a mid-size precinct, 2am, humming fluorescent and labeled bins';
  if (/politic|government|senator|congress|white house|parliament|minister/i.test(combined))
    return 'the anteroom outside a committee chamber, 8am, a staffer\'s coffee and the low rumble of microphones being tested';
  if (/future|cyber|neon|tech|hack|ai|android|robot|dystopia/i.test(combined))
    return 'the lower transit concourse of a megacity tower, 0200, rain-slick chrome and the static of overhead ads';
  if (/period|victorian|medieval|historical|century|war|empire/i.test(combined))
    return 'the servants\' corridor behind the main hall, before dawn, candle grease and cold stone';
  if (/sport|team|coach|game|stadium|athlete|training|locker/i.test(combined))
    return 'the tunnel under the west stand, forty minutes before kick-off, liniment and compressed nerves';
  if (/kitchen|restaurant|chef|food|culinary|cook|dining/i.test(combined))
    return 'the prep kitchen at 6am, two hours before service, the smell of stock and a knife on the steel';
  if (/wild|nature|forest|mountain|desert|survival|expedition/i.test(combined))
    return 'the base camp supply tent at 3am, wind pulling at the canvas and a headlamp on a topographic map';
  // Generic prestige drama fallback — no domain-specific vocabulary
  return `a named location specific to the world of ${combined.split(' ')[0]}, textured with one sensory detail`;
};

const deriveNameGuidance = (combined: string, themes: string): string => {
  if (/space|orbit|galaxy|sci-fi|future|android/i.test(combined))
    return 'Invent names — coined syllables, phonemic combinations that sound plausible for this world. No real-world names.';
  if (/marine|ocean|aquarium|reef|sea/i.test(combined))
    return 'Use names from the coastal/research communities relevant to this show\'s geography. Avoid landlocked cultural registers.';
  if (/victorian|period|historical|medieval|century/i.test(combined))
    return 'Use era-appropriate names for the specific region and period. Research-quality, not generic.';
  if (/japan|tokyo|korea|seoul|china|beijing|asia/i.test(combined))
    return 'Use authentic names from the specific culture shown. Romanization should be consistent and accurate.';
  if (/latin|mexico|brazil|spanish|portugue/i.test(combined))
    return 'Use culturally authentic Latin American or Iberian names specific to the country and class shown.';
  // Generic: derive from themes if available, else from show name
  const worldRef = themes ? `the world of '${themes.split(',')[0].trim()}'` : `the world of this show`;
  return `Names must feel native to ${worldRef}. Derive from setting, not from default prestige TV naming pools.`;
};

const deriveTitleGuidance = (combined: string): string => {
  const base = 'Short, evocative, maximum 6 words. No colons, no academic subtitles, no technical framing.';
  if (/comedy|sitcom|funny|comic|humor/i.test(combined))
    return base + ' Titles should be wry, character-driven, or absurdly specific. e.g. "The Sourdough Incident", "Somebody\'s Dog".';
  if (/horror|gothic|dark|terror|dread/i.test(combined))
    return base + ' Titles should be ominous and imagistic. e.g. "Still Water", "The Hollow Season".';
  if (/thriller|spy|action|heist|crime/i.test(combined))
    return base + ' Titles should be terse and propulsive. e.g. "The Extraction", "Clean Hands".';
  return base + ' Model after prestige TV: short, imagistic, character-or-world-specific.';
};
