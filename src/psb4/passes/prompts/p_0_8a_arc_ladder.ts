import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_8a_arc_ladder',
  description: 'Arc Imagination / Issue Ladder Pass 0.8A',
  slots: ['SCOPE_ISSUE_COUNT', 'REGISTER_GUIDANCE'],
  render: (inputs) => {
    const scopeGuidance = inputs.SCOPE_ISSUE_COUNT && inputs.SCOPE_ISSUE_COUNT !== 'not specified (assess from material)'
      ? `TARGET ARC LENGTH: ${inputs.SCOPE_ISSUE_COUNT} issues. Build the ladder to exactly this length.`
      : `TARGET ARC LENGTH: Not specified. Assess the material and recommend 4, 6, or 8 issues based on story density and engine strength. Explain your recommendation before building.`;

    return `You are a veteran graphic novel editor and series architect performing Phase 0.8A (Arc Imagination / Issue Ladder).
Your task is to determine the natural arc structure and build the full issue-by-issue ladder.

${scopeGuidance}

Rules:
- Every issue must end with a changed operating condition. The reader must not be able to return to the prior state.
- No two adjacent issues may share the same climax shape.
- The middle issues must look backward (paying off a prior consequence) and forward (creating an unavoidable pressure for the next issue).
- The penultimate issue must make the finale feel forced by story conditions, not merely scheduled.
- The finale must combine pressures that previously seemed separate.

Climax types to rotate across: revelation, confrontation, collapse, sacrifice, reversal, escape, betrayal, arrival, loss, transformation.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the preceding conversation history to build the full issue ladder, then provide the arc-level summary fields.

Ensure your entire output is valid JSON in a fenced \`\`\`json block:

\`\`\`json
{
  "recommendedIssueCount": 4 | 6 | 8,
  "arcLengthRationale": "Why this length fits the material.",
  "issues": [
    {
      "number": 1,
      "workingTitle": "...",
      "function": "What story work this issue does in the arc.",
      "externalProblem": "The concrete external pressure driving this issue.",
      "characterConflict": "The character or emotional conflict at the center.",
      "oppositionMove": "What the antagonist or opposing force does.",
      "climaxType": "One word or phrase: revelation / confrontation / collapse / etc.",
      "endingCondition": "The condition of the story world when this issue closes.",
      "howWorldChanged": "What is now permanently different."
    }
  ],
  "protagonistArc": "The full arc from issue 1 to finale.",
  "supportingArcs": "Brief arc summary for each major supporting character.",
  "antagonistEscalation": "How the opposition escalates across the arc.",
  "recurringEngine": "The core repeating dramatic mechanism that keeps the series alive.",
  "mustNotRepeat": "What climax shapes, scene types, or emotional beats must not recur.",
  "nextTask": "The best next production task."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
