import { GenerationManifest } from "../contextResolver";

/**
 * Manifest for beat pool generation. Heavy context consumer.
 */
export const EPISODE_BEATS_MANIFEST: GenerationManifest = {
  generatorName: 'episodeBeats',
  layer1: {
    show: {
      title: true,
      premise: 'brief',
      register: true,
      themes: 'card',
    },
    characters: 'cards-all',
  },
  layer2: {
    seasonArc: 'section',
    episodeSummary: 'section',
    episodeArcStories: true,
    precedingActSummaries: 3,
  },
  layer3: {
    contentGenerationStandard: true,
    instructions: 'beatGeneration',
  },
};
