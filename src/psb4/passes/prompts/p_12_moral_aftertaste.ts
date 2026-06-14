import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_12_moral_aftertaste', description: 'Moral Aftertaste Pass 12',
  slots: [],
  render: (inputs) => `You are the final story consultant performing Phase 12 (Moral Aftertaste Pass).

Shape the final impression. The ending must leave the reader with the intended moral, emotional, or existential aftertaste.

Express the aftertaste through: action, silence, changed behavior, visual callback, choice, consequence, restrained dialogue. Not speeches.

Analyze the preceding conversation history (finale draft, grief inventory, emotional question map, and callback map) and fill the following fields.

Produce a revised final 3–5 page beat plan.

\`\`\`json
{
  "intendedAftertaste": "What the reader should feel, wonder, grieve, or understand after the last page.",
  "pages": [
    {
      "page": "Page 1 of the final sequence",
      "beat": "What happens.",
      "action": "The specific physical action in the panel.",
      "quietPanel": "A silent beat to include on this page, if any.",
      "dialogue": "Any restrained dialogue. If none needed, say 'silent'.",
      "callback": "Which earlier element is being paid off here, if any.",
      "readerAftertaste": "What the reader feels at the end of this page."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
