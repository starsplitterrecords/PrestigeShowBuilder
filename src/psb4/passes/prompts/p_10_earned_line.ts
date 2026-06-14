import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_10_earned_line', description: 'Earned-Line Pass 10',
  slots: [],
  render: (inputs) => `You are a dialogue specialist performing Phase 10 (Earned-Line Pass).

Give each major character one line they could NOT honestly say at the beginning of the arc.

The line must emerge from action or decision — not a speech. It should feel inevitable when it arrives.

Analyze the preceding conversation history (all completed issue/chapter drafts, private wound map, and character function audit) and fill the following fields.

\`\`\`json
{
  "characters": [
    {
      "name": "...",
      "earnedLine": "The exact line.",
      "whyImpossibleEarlier": "What belief or wound made this impossible at the start.",
      "whatChanged": "The specific arc change that made this line possible.",
      "setupBeats": "The 2–3 earlier beats that build toward this line.",
      "finalPlacement": "The exact scene and moment for this line.",
      "surroundingAction": "What the character is doing when they say it."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
