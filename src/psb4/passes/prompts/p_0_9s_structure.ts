import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_9s_structure',
  description: 'Scene Structure Extraction Pass 0.9S',
  slots: ['ISSUE_DRAFT', 'EPISODE_CONTEXT', 'REGISTER_GUIDANCE'],
  render: (inputs) => `You are expanding our issue draft into structured acts and scenes.

${inputs.EPISODE_CONTEXT}
${inputs.REGISTER_GUIDANCE ? `REGISTER:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

=== ISSUE DRAFT ===
${inputs.ISSUE_DRAFT}

Your task is to organise this issue draft's beatSpine into Acts and Scenes with scene-level context (setting, dramaticWant, function). No dialogue.

PAGE BEAT MAPPING RULES:
- Every page beat in the beatSpine becomes exactly one
  page beat in your output. Do not consolidate.
- sourceBeatNumbers must contain exactly ONE entry.
  Never map multiple source page beats to one output page beat.
- If the beatSpine has 22 page beats, your output must
  have 22 page beats distributed across scenes.
- Scenes will naturally have 2–5 page beats each.
  A scene with 1 page beat is acceptable.
  A scene with 8+ page beats should be split.
- At THIS stage, preserve the beat spine one-to-one (do not consolidate).
  Beats are EXPANDED later, during segmentation, when the written scene
  is paginated — so do not try to add or merge beats here.

Return a complete JSON payload matching SceneStructurePayload.

The JSON schema must be as follows:
\`\`\`json
{
  "acts": [
    {
      "actNumber": 1,
      "title": "Act title",
      "scenes": [
        {
          "sceneNumber": 1,
          "title": "Scene title",
          "setting": "Scene setting",
          "dramaticWant": "What character(s) want in this scene",
          "function": "Dramatic function of this scene",
          "beats": [
            {
              "description": "Narrative prose description of the page beat sequence",
              "beatType": "DIALOGUE",
              "characterHandles": ["BJORN", "LIN"],
              "subtext": "Underlying tension/themes",
              "visualNote": "Visual direction/composition ideas",
              "direction": "Camera positioning/angle",
              "source": "preserved",
              "sourceBeatNumbers": [1]
              // Always exactly one number. Never consolidate.
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

Do NOT write dialogue. Return scene structure only.
Leave script as an empty array on every page beat.
Dialogue will be generated in the next pass.

Before returning: count your output page beats.
The total must match the number of entries
in the beatSpine above. If it does not, you have
consolidated page beats. Expand before returning.

No conversational prose before or after the JSON block.`
};

registerPromptTemplate(template);
export default template;
