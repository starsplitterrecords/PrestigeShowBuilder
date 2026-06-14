import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_8_page_rhythm', description: 'Page Rhythm Pass 8',
  slots: [],
  render: (inputs) => `You are a comics pacing specialist performing Phase 8 (Page Rhythm Pass).

Audit the arc for page rhythm. Identify where the story is too verbal, too compressed, too visually repetitive, or too static.

Analyze the preceding conversation history (all completed issue/chapter drafts and quiet panel plan) and fill the following fields.

\`\`\`json
{
  "sections": [
    {
      "sectionLabel": "Issue 3, Act 2",
      "currentRhythmIssue": "Too dialogue-heavy — four consecutive pages of talking heads.",
      "recommendedTreatment": "Insert two silent panels. Convert one speech to a visual action sequence.",
      "sceneOrPageAffected": "Pages 14–18 of Issue 3.",
      "reason": "The reader needs breath before the next escalation."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
