import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_2_private_wound', description: 'Private Wound Pass 2',
  slots: [],
  render: (inputs) => `You are a character psychologist performing Phase 2 (Private Wound Pass).

For each major character, define one private wound, fear, hunger, shame, or ache that drives their choices across the arc.

Surface through: repeated habits, object choices, avoided questions, overreactions, misplaced tenderness, rituals, silence, physical distance.
NEVER through: trauma monologues, direct exposition, or therapy-speak.

Analyze the preceding conversation history (all completed issue/chapter drafts, characters roster, and prior passes) and fill the following fields.

\`\`\`json
{
  "characters": [
    {
      "name": "...",
      "privateWound": "One sentence defining the wound.",
      "behavioralDistortion": "How the wound distorts their behavior without them knowing.",
      "surfacePoint1": "Scene/beat where it should surface + the behavior or line.",
      "surfacePoint2": "...",
      "surfacePoint3": "...",
      "payoffMoment": "The moment near the end where the wound is addressed or transformed."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
