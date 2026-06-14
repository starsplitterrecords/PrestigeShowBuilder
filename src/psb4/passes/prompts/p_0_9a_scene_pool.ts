import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_0_9a_scene_pool', description: 'Character Care Scene Pool 0.9A',
  slots: ['REGISTER_GUIDANCE'],
  render: (inputs) => `You are a character specialist building modular emotional scenes for a graphic novel.

Your task is to build a scene pool of short character scenes that can be inserted throughout the arc to make readers care about the cast.

RULES:
- Each scene reveals character through BEHAVIOR, not exposition.
- No trauma monologues. No lore dumps. No generic bonding.
- Each scene must be drawable — a visual artist must be able to work from it.
- Scenes should create affection, amusement, concern, admiration, or emotional investment.
- Every scene has three versions: full, compressed, single-panel.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the preceding conversation history (regrounding brief, character function audit, arc ladder, and characters roster) and build 8–12 scenes total.

\`\`\`json
{
  "scenes": [
    {
      "title": "...",
      "characters": ["..."],
      "placementSuggestion": "Best insertion point in the arc (e.g., 'Early Issue 2, before the operation')",
      "lengthNote": "half-page / one-page / two-page",
      "emotionalFunction": "What feeling this scene creates in the reader.",
      "whatItReveals": "What we learn about the character(s).",
      "fullVersion": "Full prose draft of the scene including dialogue and panel beats.",
      "compressedVersion": "The scene in 2–3 panels.",
      "singlePanelVersion": "The scene reduced to one image.",
      "laterPayoff": "Which later moment this scene helps the reader feel more deeply.",
      "integrationRule": "When to use full vs compressed vs single-panel."
    }
  ],
  "characterHabits": [
    { "character": "...", "habit": "...", "emotionalMeaning": "...", "bestUse": "...", "payoff": "..." }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
