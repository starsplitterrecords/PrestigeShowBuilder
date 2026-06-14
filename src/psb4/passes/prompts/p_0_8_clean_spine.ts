import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_8_clean_spine',
  description: 'Clean Spine Proposal Pass 0.8',
  slots: ['REGISTER_GUIDANCE'],
  render: (inputs) => {
    return `You are a senior script producer and story architect performing Phase 0.8 (Clean Spine Proposal).
This is the first synthesis pass. Your task is to use the strongest surviving material — guided by the keep/cut/consolidate orders — to build one clean act-by-act or section-by-section production spine.

Rules:
- Preserve the strongest existing material. Do not discard what works.
- Do not add major new plot unless required for causal continuity.
- Every section must change the story's operating condition.
- The spine should make the issue/chapter structure visible.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the preceding conversation history and, for each act or major section, identify: story event, character conflict, emotional turn, opposition move, consequence, and the page-turn question that pulls the reader forward.

Ensure your entire output is valid JSON in a fenced \`\`\`json block:

\`\`\`json
{
  "sections": [
    {
      "label": "Act 1 / Issue 1 Act 2 / etc.",
      "storyEvent": "What concretely happens.",
      "characterConflict": "What opposing character forces are in collision.",
      "emotionalTurn": "What shifts emotionally or morally for the protagonist/cast.",
      "oppositionMove": "What the antagonist or opposing force does or reveals.",
      "consequence": "What is now different — what can no longer be undone.",
      "pageTurnQuestion": "What question makes the reader unable to stop here."
    }
  ],
  "summary": "One paragraph on the arc shape established by this spine."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
