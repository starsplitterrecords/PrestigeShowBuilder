import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_4_nobody_right', description: 'Nobody Is Fully Right Pass 4',
  slots: [],
  render: (inputs) => `You are a conflict specialist performing Phase 4 (Nobody Is Fully Right Pass).

Strengthen conflicts so every major disagreement is value-versus-value, not hero-versus-obstacle.

Both sides must have a valid emotional and practical claim. Identify where one character sounds too obviously right or wrong.

Analyze the preceding conversation history (all completed issue/chapter drafts and character function audit) and identify 6–10 key conflict scenes.

\`\`\`json
{
  "conflicts": [
    {
      "scene": "Scene or beat label",
      "argument": "What is being argued.",
      "sideAProtects": "What Side A is protecting.",
      "sideBProtects": "What Side B is protecting.",
      "blindSpotA": "What Side A cannot see.",
      "blindSpotB": "What Side B cannot see.",
      "revision": "Specific dialogue or panel beat revision that makes both sides harder to dismiss."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
