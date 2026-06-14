import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_0_14_arc_closure', description: 'Arc Closure Verification 0.14',
  slots: ['ARC_LADDER','ISSUE_DRAFT','FINALE_LOCK'],
  render: (inputs) => `You are a story auditor performing Phase 0.14 (Arc Closure / Payoff Verification).

Read the completed arc — all issues — against the arc ladder and finale lock. Verify that the finale pays off every major thread.

=== ARC LADDER ===\n${inputs.ARC_LADDER}
=== ALL ISSUE DRAFTS ===\n${inputs.ISSUE_DRAFT}
=== FINALE LOCK ===\n${inputs.FINALE_LOCK}

\`\`\`json
{
  "issuePayoffMap": [
    { "issueLabel": "Issue 1", "seed": "...", "finalePayoff": "...", "payoffType": "practical|emotional|moral|visual|thematic", "readerReUnderstanding": "..." }
  ],
  "characterClosureMap": [
    { "character": "...", "startingPosition": "...", "finalAction": "...", "closureAchieved": true, "remainingOpenTension": "..." }
  ],
  "motifClosureMap": [
    { "motif": "...", "payoff": "..." }
  ],
  "unresolvedThreads": ["intentionally open threads"],
  "finalAftertaste": "What the ending proves / refuses to pretend / leaves costly.",
  "remainingRevisionRisks": ["risks that remain in the draft"]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
