import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_11_grief', description: "Reader's Grief Pass 11",
  slots: [],
  render: (inputs) => `You are an emotional architect performing Phase 11 (Reader's Grief Pass).

Identify what the reader should mourn by the end.

Even happy endings need cost. Even tragic endings need meaning. The goal is not to make the ending sad — it is to make the victory, defeat, or transformation feel PAID FOR.

Analyze the preceding conversation history (all completed issue/chapter drafts, earned-line guide, and arc closure report) and fill the following fields.

\`\`\`json
{
  "losses": [
    {
      "loss": "What is lost.",
      "type": "practical|emotional|relational|ideological|bodily|symbolic|comic|romantic|communal",
      "seedLocation": "Where the seed of this loss appears.",
      "lossMoment": "When the loss happens.",
      "acknowledgment": "How the loss is acknowledged — by whom, in what form.",
      "finaleFeeling": "How the finale lets the reader feel this loss."
    }
  ],
  "summary": "What the reader should carry away — the feeling the ending leaves behind."
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
