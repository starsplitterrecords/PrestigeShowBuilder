import { GenerationManifest } from "../contextResolver";
 
/**
 * Manifest for reconcileBeatDescription per F25 §4.7.
 *
 * Reconcile is a RESCUE PASS for polluted beat descriptions.
 * The Content Generation Standard is the OPERATING INSTRUCTION,
 * not just authority context — its negative filter IS what the
 * generator applies as a transformation.
 *
 * Notable choices:
 * - characters: cards-in-beat. Voice cards (not full profiles)
 *   so the rescue can preserve speaker identity in description
 *   without dragging psychology back in.
 * - beat: rescue. All fields visible plus simple transcript.
 * - show register: included so rescue preserves register tone
 *   (deadpan vs dramatic).
 *
 * Notable absences:
 * - preceding/following beats (rescue is local)
 * - episode/act summaries (too far away)
 * - themes / narrativeMechanism / premise
 * - styleConfig (visual styling not relevant to description)
 */
export const reconcileBeatManifest: GenerationManifest = {
  generatorName: 'reconcileBeatDescription',
  layer1: {
    show: {
      register: true,  // preserve register tone in rescue
    },
    characters: 'cards-in-beat',
  },
  layer2: {
    beat: 'rescue',
    sceneSetting: 'card',
    sceneSummary: 'card',
    // No preceding/following context — rescue is local.
  },
  layer3: {
    contentGenerationStandard: true,  // PRIMARY tool, not authority
    instructions: 'reconcileBeat',
    // No comedy guidelines. Reconcile preserves register but
    // does not generate to it.
  },
};
