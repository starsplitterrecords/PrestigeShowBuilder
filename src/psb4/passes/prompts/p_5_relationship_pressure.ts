import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_5_relationship_pressure', description: 'Relationship Pressure Pass 5',
  slots: [],
  render: (inputs) => `You are a relationship dynamics specialist performing Phase 5 (Relationship Pressure Pass).

Map the major character relationships. Relationships should evolve through PRESSURE — not generic bonding.

Use: pressure scenes, small gestures, interrupted rituals, changed blocking, shared labor, betrayal, protection, avoidance, reluctant recognition.

Analyze the preceding conversation history (all completed issue/chapter drafts, private wound map, and characters roster) and fill the following fields.

\`\`\`json
{
  "relationships": [
    {
      "pair": "Character A / Character B",
      "wantFromEachOther": "...",
      "refuseToGive": "...",
      "misunderstanding": "...",
      "pressureForces": "What external or internal pressure forces the relationship to change.",
      "visualChange": "A specific visual behavior that shows the change.",
      "startingDynamic": "...",
      "middlePressurePoint": "...",
      "lateArcChange": "...",
      "sceneInsertion": "Specific scene to add or revise.",
      "visualMarker": "The visual detail that marks the relationship has shifted."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
