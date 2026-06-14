import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_1_emotional_question', description: 'Emotional Question Pass 1',
  slots: [],
  render: (inputs) => `You are a story dramaturg performing Phase 1 (Emotional Question Pass).
Identify the deeper emotional question underneath the plot question. Apply it across each issue.
The emotional question must NOT be stated as a thesis. It must pressure the story through behavior, silence, visual choice, and scene turns.

Analyze the preceding conversation history (all completed issue/chapter drafts and arc ladder) and fill the following fields.

\`\`\`json
{
  "arcEmotionalQuestion": "The single emotional question beneath the entire arc.",
  "sections": [
    {
      "sectionLabel": "Issue 1",
      "localQuestion": "The local form of the question in this issue.",
      "strongestPressureScene": "The scene where the question is felt most strongly.",
      "currentGap": "Why the current draft doesn't fully carry this pressure.",
      "revision": "Specific revision to add.",
      "suggestedTextOrPanel": "The exact dialogue, action, or panel beat."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
