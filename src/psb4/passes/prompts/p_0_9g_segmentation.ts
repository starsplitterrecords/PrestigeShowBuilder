import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_9g_segmentation',
  description: 'Scene Segmentation Pass 0.9G',
  slots: ['SCENE_SCRIPT', 'SCENE_STRUCTURE', 'REGISTER_GUIDANCE'],
  render: (i) => `You are a comics editor breaking written scenes (which are indexed script units [0], [1], [2], etc.) into page-beats.
Your job is to decide where page-breaks fall. You are NOT writing or editing dialogue or action. You are allocating existing screenplay units verbatim into pageBeats.

${i.REGISTER_GUIDANCE ? i.REGISTER_GUIDANCE + '\n' : ''}
=== WRITTEN SCENES WITH UNIT INDICES ===
${i.SCENE_SCRIPT}

=== DRAMATIC SKELETON REFERENCE ===
${i.SCENE_STRUCTURE}

THE MAPPING INSTRUCTIONS:
- You must organize the [N] units in each scene into sequential pageBeats.
- Every single unit [N] from the WRITTEN SCENES must be mapped. Do not skip any units.
- Do not repeat units across multiple pageBeats (unless absolutely necessary for visual overlap).
- Place units in sequential order. A pageBeat should cover a contiguous block of indices (e.g. unitIndices: [0, 1, 2], then the next pageBeat covers [3, 4, 5], etc.)
- A single dialogue line or caption generally belongs to a pageBeat. Do not bundle too many dialogue indices (e.g., more than 6-8 dialogue units) onto a single pageBeat (page) or it will be too crowded. Let dialogue-dense scenes expand to multiple pageBeats!
- Set 'beatType' based on the content of the units:
  * "DIALOGUE" if the pageBeat contains spoken lines or captions.
  * "TABLEAU" if the pageBeat is purely silent action units.
  * "ESTABLISHING" for scene-opening location units.
  * "MEMORY_BLEED" for flashbacks or dream sequences.

OUTPUT FORMAT:
Provide your output strictly as a JSON object inside a \`\`\`json markdown fence. It must match the following structure:
\`\`\`json
{
  "scenes": [
    {
      "actNumber": 1,
      "sceneNumber": 1,
      "pageBeats": [
        {
          "unitIndices": [0, 1, 2],
          "beatType": "DIALOGUE",
          "description": "Short summary of what happens in these script units.",
          "visualNote": "Direction or design cues for the artist.",
          "direction": "Pacing or page-turn logic (e.g., 'Page turn reveal!')"
        }
      ]
    }
  ]
}
\`\`\``
};

registerPromptTemplate(template);
export default template;
