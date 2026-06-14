import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_5_character_function_audit',
  description: 'Character Function Audit Pass 0.5',
  slots: ['REGISTER_GUIDANCE', 'TELEPLAY_SOURCE', 'CHARACTERS_ROSTER', 'REGROUNDING_BRIEF'],
  render: (inputs) => {
    return `${inputs.REGROUNDING_BRIEF ? `=== PROJECT REGROUNDING BRIEF ===\n${inputs.REGROUNDING_BRIEF}\n\n` : ''}=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

You are a professional series dramaturg performing Phase 0.5 (Character Function Audit).
Your task is to audit each major character for repeated behavior versus actual arc movement.

A character trapped in repeated behavior is not growing — they are performing. Repetition is only valid if it builds toward a payoff or escalates in stakes.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the provided teleplay source material, characters roster, and project brief, and, for each major character, identify:
1. strongestFunction — what this character does best in the material as written
2. repeatedBehaviorRisk — the specific behavior that risks becoming a loop (not an arc)
3. flatteningRisk — low | medium | high
4. neededPerSection — what this character must do at least once per issue/chapter to remain dynamic: be right, be wrong, be surprising, be vulnerable, or visibly change
5. revisionRequirement — the minimum change needed to prevent flattening

Do not invent new backstory. Work from the draft's existing behavior patterns.

Ensure your entire output is valid JSON in a fenced \`\`\`json block:

\`\`\`json
{
  "characters": [
    {
      "name": "...",
      "handle": "@show.Name or null",
      "strongestFunction": "...",
      "repeatedBehaviorRisk": "...",
      "flatteningRisk": "low" | "medium" | "high",
      "neededPerSection": "...",
      "revisionRequirement": "..."
    }
  ],
  "summary": "One paragraph on the cast's overall dynamic health."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
