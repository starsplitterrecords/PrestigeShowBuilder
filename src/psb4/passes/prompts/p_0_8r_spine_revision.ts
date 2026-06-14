import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_8r_spine_revision',
  description: 'Incorporate author notes into a revised version of the Clean Spine.',
  slots: ['AUTHOR_NOTES', 'CLEAN_SPINE'],
  render: (inputs) => {
    // Count sections in original spine so we can enforce preservation.
    let sectionCount = 0;
    try {
      const parsed = JSON.parse(inputs.CLEAN_SPINE || '{}');
      sectionCount = Array.isArray(parsed.sections) ? parsed.sections.length : 0;
    } catch {}
    const countLine = sectionCount > 0
      ? `The original spine has ${sectionCount} sections. Your output MUST contain all ${sectionCount} sections.`
      : 'Preserve all sections from the original spine.';

    return `You are a senior script producer performing Phase 0.8R (Spine Revision).
Your task is to revise the Clean Spine according to the author's notes below.

AUTHOR NOTES:
${inputs.AUTHOR_NOTES || '(No notes provided — return the original spine unchanged.)'}

ORIGINAL CLEAN SPINE:
${inputs.CLEAN_SPINE || '(Not available)'}

REVISION RULES:
- ${countLine}
- Revise ONLY the sections the author's notes address. Leave the rest unchanged.
- Do not merge sections. Do not drop sections. Do not add new sections.
- Retain the characters, themes, and causal logic of the show unless explicitly directed otherwise.
- Every section must still change the story's operating condition.

Ensure your entire output is valid JSON in a fenced \`\`\`json block:

\`\`\`json
{
  "sections": [
    {
      "label": "Act 1 / Issue 1 / etc.",
      "storyEvent": "What concretely happens.",
      "characterConflict": "What opposing forces are in collision.",
      "emotionalTurn": "What shifts emotionally or morally.",
      "oppositionMove": "What the antagonist or opposing force does.",
      "consequence": "What is now different and cannot be undone.",
      "pageTurnQuestion": "What question makes the reader unable to stop here."
    }
  ],
  "summary": "One paragraph on the arc shape established by this revised spine."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
