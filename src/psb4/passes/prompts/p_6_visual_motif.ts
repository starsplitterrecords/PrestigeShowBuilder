import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_6_visual_motif', description: 'Visual Motif Pass 6',
  slots: ['REGISTER_GUIDANCE'],
  render: (inputs) => `You are a visual storytelling specialist performing Phase 6 (Visual Motif Pass).

Build recurring visual-emotional language from objects, gestures, and spaces the characters ACTUALLY INTERACT WITH.

This is not decorative symbolism. Every motif must change meaning across the arc.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the preceding conversation history (all completed issue/chapter drafts, arc ladder, and relationship pressure map) and fill the following fields.

\`\`\`json
{
  "motifs": [
    {
      "motif": "The object, gesture, or space.",
      "emotionalMeaning": "What it means emotionally.",
      "firstSeed": "Where it first appears and what the reader thinks it means.",
      "reinforcement": "Where it recurs and how the reader's understanding deepens.",
      "meaningShift": "The moment its meaning changes.",
      "payoff": "The finale use and what it means now.",
      "panelActions": ["Specific panel-level action or visual beat for each insertion point"]
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
