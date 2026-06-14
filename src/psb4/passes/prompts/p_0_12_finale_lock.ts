import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_0_12_finale_lock', description: 'Finale Lock 0.12',
  slots: [],
  render: (inputs) => `You are a senior story producer performing Phase 0.12 (Finale Lock).

The finale should feel FORCED by story conditions, not merely scheduled by the outline.

Audit the penultimate issue and determine whether it locks the finale into inevitability.

Analyze the preceding conversation history and fill the following fields.

\`\`\`json
{
  "isFinaleInevitable": "yes" | "no" | "partially",
  "whatForcesIt": "The concrete crisis that now requires the finale.",
  "cannotBeDelayed": "The practical and emotional pressure that makes delay impossible.",
  "mustBeResolved": "The story/moral/character obligations the finale must answer.",
  "lockedFinalePremise": "One sentence: Because [penultimate consequence], the protagonists must [final action], while [antagonist pressure] forces them to choose between [A] and [B].",
  "requiredConditions": ["condition the finale must establish"],
  "characterObligations": ["character arc payoff required in finale"],
  "antagonistObligations": ["how antagonist must function in finale"],
  "requiredPayoffs": ["callbacks, motifs, promises that must be paid"],
  "forbiddenRepetitions": [{ "priorDid": "...", "finaleMustnot": "..." }],
  "finalStartingState": "Exact condition of the story world when the finale opens."
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
