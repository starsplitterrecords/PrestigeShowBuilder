
/**
 * CONTENT_GENERATION_STANDARD
 *
 * Shared rules governing content generation across the production
 * pipeline. Cited by every generator that produces narrative prose:
 *   - generateActScenes (scenes)
 *   - generateCinematicBeats (beats)
 *   - generateDialogueScript (dialogue)
 *
 * Authoritative document: PSB_Content_Generation_Standard.md
 * When that file changes, update this constant in the same commit.
 *
 * This constant REPLACES the earlier BEAT_DESCRIPTION_STANDARD
 * (beatDescriptionStandard.ts), which governed only production-layer
 * rewrites. The new standard covers both generation and rewriting.
 */
export const CONTENT_GENERATION_STANDARD = `
CONTENT GENERATION STANDARD
 
THE UNIVERSAL RULE:
Write only what can be drawn. Describe actions, positions, objects,
light, distance, surfaces, gestures — what changes physically.
Do not describe interpretation, psychology, thematic meaning,
symbolic explanation, or internal realization. If the artist
cannot draw it, do not write it.
 
BAN INTENT-HEAVY LANGUAGE in production prose:
needs, wants, tries, hopes, ensures, requires, decides, realizes,
understands, processes, knows, recognizes, accepts, refuses to
acknowledge. These ideas belong in subtext or structural notes.
 
BAN ABSTRACT AND THEMATIC LANGUAGE in production prose:
authority, compliance, sovereignty, dominance, procedural,
territorial, bureaucratic, survival, acknowledgment, legitimacy,
identity, power dynamic.
 
Also avoid abstract phrasing: tension builds, situation escalates,
dynamic shifts, illusion breaks, authority transfers,
the atmosphere changes.
 
DESCRIBE READABLE EXPRESSIONS, NOT ANATOMY OR INTERNAL STATE:
  KEEP: visibly withholding his anger, visibly relaxes, refuses to
        look at her, rigid and watchful, still will not meet her
        eyes, holds her gaze, presses her lips together.
  CUT (muscle-level): jaw tightens, eyebrows furrow, nostrils flare.
  CUT (internal state): she chooses survival over compliance,
        he wants her to take the paper, she feels authority.
  Test: would a viewer at normal panel size SEE this?
 
DESCRIPTION IS NOT SUBTEXT:
description names what happens; subtext names the pressure under
the action. If the meaning is in subtext, do not repeat it in
description. Bad: "She proves she is not just another clerk."
Good: "She drops the wood into the fire."
 
KEEP OBJECTS, DROP SYMBOLISM:
Concrete props survive. Commentary about what they mean does not.
The phone survives. "The blue light reflects off silver buttons
of his tunic" does not — it is commentary, not staging.
 
PANEL DIRECTION IS FRAMING, NOT INTERPRETATION:
Use close-up, low angle, over-the-shoulder, wide shot, profile
two-shot, tracking from behind. Do not use panel direction to
explain story meaning.
Bad: "emphasizing the breakdown of procedural authority"
Good: "over-the-shoulder from behind Carrie, holding the pen
       between them"
 
STAGE EVERY CHARACTER NAMED IN characterIds. Even silent characters
need a position, posture, or held action. Do not add characters
the beat does not list.
 
HANDLES use the form @show.firstname (e.g. @vik.carrie,
@vik.bjorn). Lowercase firstname, not role.
 
NEGATIVE FILTER — if any of these appear in description or
visualDescription, rewrite before returning:
  Abstract phrasing: tension builds, situation escalates, dynamic
    shifts, illusion breaks, authority transfers, power dynamic.
  Internal narration: realizes, understands, knows, processes,
    accepts, decides, recognizes, sees that, feels that.
  Thematic explanation: survival, sovereignty, bureaucracy,
    territoriality, compliance, identity, acknowledgment.
  Repeated explanation: if description says what the image
    already shows, cut it.
  Decorative micro-actions: if three small actions do the work of
    one strong action, keep only the strongest.
 
QUALITY CHECK — validate before returning.
For every scene:
  1. Does the first beat start in motion (not neutral setup)?
  2. Is there exactly one scene shift?
  3. Does the scene end on a physical change, not an explanation?
  4. Can every panel be drawn?
  5. Are people doing things while they talk?
For every beat:
  1. Can the whole beat be summarized as one visible turn?
  2. Is description 2–5 sentences max?
  3. Is visualDescription a real image sentence, not an interpretation?
  4. Is subtext short and oppositional?
  5. Does the beat give each present character a distinct lane?
For dialogue:
  1. Would a person say these lines out loud?
  2. Is anything explained that the panel already shows?
  3. Are lines short, not run past reasonable single-breath length?
 
If any check fails, rewrite before returning.
`;
