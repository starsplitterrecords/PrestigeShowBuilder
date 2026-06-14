import { GenerationManifest } from "../contextResolver";

/**
 * Manifest for suggestField. Smallest manifest in the system.
 *
 * suggestField is a generic field-suggestion helper. The user
 * clicks "Suggest" on a form field; the function takes the show,
 * the field name, and a free-form context string, then returns
 * a single short suggested value.
 *
 * Notable choices:
 * - characters: none. Field suggestions do not need character
 *   context. The fields being suggested are typically show-level
 *   (premise, themes, narrative mechanism).
 * - beat/scene: not included. No production context relevant.
 * - contentGenerationStandard: false. Field suggestions are short
 *   prose snippets, not the kind of visual or dialogue content
 *   the standard governs.
 */
export const suggestFieldManifest: GenerationManifest = {
  generatorName: 'suggestField',
  layer1: {
    show: {
      title: true,
      premise: 'card',
      themes: 'card',
      register: true,
    },
    characters: 'none',
  },
  layer2: {},
  layer3: {
    contentGenerationStandard: false,
    instructions: 'suggestField',
  },
};
