import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_9_callback_map', description: 'Emotional Callback Map Pass 9',
  slots: [],
  render: (inputs) => `You are a story architect performing Phase 9 (Emotional Callback Map).

Map every object, phrase, gesture, injury, location, joke, ritual, and visual motif that was seeded early and must be paid off later.

Prioritize callbacks that make the ending feel INEVITABLE rather than merely clever.

Analyze the preceding conversation history (all completed issue/chapter drafts, visual motif map, and arc ladder) and fill the following fields.

\`\`\`json
{
  "callbacks": [
    {
      "element": "The object, phrase, gesture, or image.",
      "seedLocation": "Where it first appears and in what context.",
      "reinforcement": "Where it recurs mid-arc.",
      "payoffLocation": "Where it pays off — finale or late-arc scene.",
      "emotionalMeaning": "What it means when it pays off.",
      "payoffActionOrLine": "The specific panel action or line of dialogue for the payoff."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
