import { GenerationManifest } from "../contextResolver";

/**
 * Manifest for stage-level generators (expandConcept, generateCharacters, etc).
 * Consumes the full branch context (Season arc, pairings, philosophies)
 * to ensure consistency during open-ended expansion.
 */
export const STAGE_BRANCH_MANIFEST: GenerationManifest = {
  generatorName: 'stageBranch',
  layer1: {
    show: {
      title: true,
      premise: 'full',
      register: true,
      themes: 'full',
      narrativeMechanism: 'full',
    },
    characters: 'cards-all',
  },
  layer2: {
    seasonArc: 'full',
    characterArcLanes: true,
    episodePairings: true,
    characterPhilosophies: true,
    precedingActSummaries: 5,
    precedingSceneSummaries: 10,
    episodeSummary: 'section',
    actSummary: 'section',
    sceneSummary: 'section',
  },
  layer3: {
    contentGenerationStandard: true,
    instructions: 'stageBranch',
  },
};
