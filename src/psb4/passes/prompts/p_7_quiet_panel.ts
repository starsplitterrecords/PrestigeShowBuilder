import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_7_quiet_panel', description: 'Quiet Panel Pass 7',
  slots: [],
  render: (inputs) => `You are a visual editor performing Phase 7 (Quiet Panel Pass).

Plan silence. Graphic novels need emotional information that is NOT spoken.

Each quiet panel must do emotional or narrative work — not decoration.

Analyze the preceding conversation history (all completed issue/chapter drafts, visual motif map, and private wound map) and identify 4–6 quiet panels for each issue/section.

\`\`\`json
{
  "panels": [
    {
      "section": "Issue 2, Act 1",
      "placement": "After the argument scene, before the cut to exterior.",
      "visualDescription": "Specific, drawable visual description of the panel.",
      "emotionalFunction": "What emotion this panel communicates without words.",
      "panelType": "setup" | "callback" | "payoff" | "reversal" | "grief" | "recognition" | "transition",
      "suggestedSize": "small / half-page / wide / splash / page-turn"
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
