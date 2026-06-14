import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_0_11_sequential_build', description: 'Sequential Issue Build 0.11',
  slots: ['REGISTER_GUIDANCE','EPISODE_CONTEXT'],
  render: (inputs) => `You are a veteran comics writer performing Phase 0.11 (Sequential Issue Build).

This issue must build directly from the prior output state. It is not standalone — it is the next movement in an arc.

DOUBLE-HINGE RULE:
- Backward hinge: this issue must pay off one unresolved consequence from the prior issue.
- Forward hinge: this issue must create one unavoidable condition for the next issue or finale.

RULES:
- Honor the previous output state exactly. Do not reset character relationships.
- Do not repeat the previous issue's climax shape unless it escalates or transforms.
- Every issue must end with a changed operating condition.
- Make the issue solve one problem while creating the next.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}
${inputs.EPISODE_CONTEXT ? `ISSUE CONTEXT:\n${inputs.EPISODE_CONTEXT}\n` : ''}

Analyze the preceding conversation history (arc ladder, prior output states, keep/cut orders, characters, and teleplay source) and fill the following fields.

\`\`\`json
{
  "issueNumber": 0,
  "workingTitle": "...",
  "function": "...",
  "corePromise": "...",
  "beatSpine": [
    { "beatNumber": 1, "beat": "...", "sourceUsed": "...", "storyFunction": "...", "characterTurn": "...", "consequence": "..." }
  ],
  "treatment": "Full continuous prose treatment of this issue.",
  "preservedMaterial": [],
  "consolidatedMaterial": [],
  "addedConnectiveTissue": [],
  "outputState": "...",
  "setupForNext": "...",
  "unresolvedItems": []
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
