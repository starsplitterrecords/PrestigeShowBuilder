import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_4_form_function_audit',
  description: 'Form-Function Audit Pass 0.4',
  slots: ['REGISTER_GUIDANCE', 'TELEPLAY_SOURCE', 'CHARACTERS_ROSTER', 'REGROUNDING_BRIEF', 'WORKING_INVENTORY'],
  render: (inputs) => {
    return `${inputs.REGROUNDING_BRIEF ? `=== PROJECT REGROUNDING BRIEF ===\n${inputs.REGROUNDING_BRIEF}\n\n` : ''}=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

${inputs.WORKING_INVENTORY ? `=== WORKING INVENTORY ===\n${inputs.WORKING_INVENTORY}\n\n` : ''}
You are a professional story consultant performing Phase 0.4 (Form-Function Audit).
Your task is to audit the draft at the scene level. For each major scene, determine whether it is doing structural work or merely providing atmosphere, posture, lore, repeated mood, or action description.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the provided teleplay source material, rosters, inventories, and briefs, and, for each major scene or beat cluster, identify:
1. intention — what is this scene trying to accomplish?
2. conflict — what opposing forces or pressures are active?
3. turn — what shifts during or at the end of the scene?
4. consequence — what is now different because this scene happened?
5. visualFunction — what does this scene communicate visually or physically?
6. changesStory — does this scene actually change the story's condition? (true/false)
7. decision — keep | cut | merge | compress | rewrite | tone

"tone" is a valid decision only if the scene establishes register without which subsequent scenes would lose context. It is not a catch-all excuse.

A weak scene is one where changesStory is false. For weak scenes, make the decision specific and actionable.

Ensure your entire output is valid JSON in a fenced \`\`\`json block:

\`\`\`json
{
  "scenes": [
    {
      "sceneId": "scene label or identifier from source",
      "intention": "...",
      "conflict": "...",
      "turn": "...",
      "consequence": "...",
      "visualFunction": "...",
      "changesStory": true,
      "decision": "keep",
      "note": "brief reason for decision"
    }
  ],
  "weakSceneCount": 0,
  "summary": "One paragraph assessment of the draft's structural efficiency."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
