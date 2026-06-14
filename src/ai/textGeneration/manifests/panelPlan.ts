import { GenerationManifest } from "../contextResolver";
 
/**
 * Manifest for planBeatVisuals per F25 §4.6.
 *
 * Notable choices:
 * - characters: visual-in-beat. Same mode as D268 — panel
 *   planning needs physicalDescription + visualAnchor for
 *   character placement, not voice info.
 * - beat: planning. Full beat fields PLUS indexed script
 *   transcript for dialogue allocation across panels.
 * - contentGenerationStandard: TRUE. Panel planning produces
 *   visual prose (panel actions, character positions); the
 *   standard governs that prose.
 *
 * Notable absences:
 * - voice cards (panel planning is visual)
 * - themes / narrativeMechanism / premise
 * - preceding context (panel planning is local to one beat)
 */
export const panelPlanManifest: GenerationManifest = {
  generatorName: 'planBeatVisuals',
  layer1: {
    show: {
      // No show-level fields. Panel planning works from
      // the beat's contents and the present characters.
    },
    characters: 'visual-in-beat',
  },
  layer2: {
    beat: 'planning',  // includes indexed script transcript
    sceneSetting: 'card',
    sceneSummary: 'card',
  },
  layer3: {
    contentGenerationStandard: true,
    instructions: 'panelPlan',
  },
};
