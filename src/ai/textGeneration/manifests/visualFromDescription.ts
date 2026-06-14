import { GenerationManifest } from "../contextResolver";
 
/**
 * Manifest for deriveVisualFromDescription per F25 §4.5.
 *
 * Notable choices:
 * - characters: visual-in-beat (physicalDescription + visualAnchor only)
 * - beat: description+subtext (subtext shapes what is visible)
 * - contentGenerationStandard: TRUE. This generator legitimately
 *   needs the standard — its job is producing visual prose,
 *   which is exactly what the standard governs.
 * - previousBeatVisual: true (one previous beat for continuity)
 *
 * Notable absences:
 * - voice cards (visual generation does not consume voice)
 * - themes / narrativeMechanism / premise (already shaped
 *   the beat upstream; not needed again here)
 * - long preceding-beat history (one previous is sufficient)
 */
export const visualFromDescriptionManifest: GenerationManifest = {
  generatorName: 'deriveVisualFromDescription',
  layer1: {
    show: {
      // No show-level fields needed. The beat's contents
      // and the character roster carry everything.
    },
    characters: 'visual-in-beat',
  },
  layer2: {
    beat: 'description+subtext',
    sceneSetting: 'card',
    sceneSummary: 'card',
    previousBeatVisual: true,
  },
  layer3: {
    contentGenerationStandard: true,
    instructions: 'visualFromDescription',
  },
};
