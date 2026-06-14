import { GenerationManifest } from "../contextResolver";
 
/**
 * Manifest for deriveVisualFromScript per F25 §4.4.
 *
 * Edge case generator: produces visual fields when a beat has
 * dialogue but no description-derived visuals. Most beats use
 * deriveVisualFromDescription (D268 path) instead; this is the
 * legacy/fallback path.
 */
export const visualFromScriptManifest: GenerationManifest = {
  generatorName: 'deriveVisualFromScript',
  layer1: {
    show: {
      // No show-level fields needed.
    },
    characters: 'visual-in-beat',
  },
  layer2: {
    beat: 'script-source',
    sceneSetting: 'card',
    sceneSummary: 'card',
    previousBeatVisual: true,
  },
  layer3: {
    contentGenerationStandard: true,
    instructions: 'visualFromScript',
  },
};
