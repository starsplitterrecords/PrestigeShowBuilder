import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_0_9_clean_issue', description: 'Clean Issue Pass 0.9',
  slots: ['ARC_LADDER', 'KEEP_CUT_ORDERS', 'CHARACTERS_ROSTER', 'REGISTER_GUIDANCE', 'EPISODE_CONTEXT', 'ISSUE_ROLE', 'NEXT_ANCHOR_SPEC'],
  render: (inputs) => `You are building the graphic novel issue by issue in a single development conversation.

=== STRUCTURAL ROLE OF THIS ISSUE ===
${inputs.ISSUE_ROLE}

${inputs.EPISODE_CONTEXT}

${inputs.NEXT_ANCHOR_SPEC ? `=== TARGET ANCHOR — BUILD TOWARD THIS ===\nThe next structural anchor this issue must deliver toward:\n${inputs.NEXT_ANCHOR_SPEC}\n` : ''}
=== ARC LADDER ===
${inputs.ARC_LADDER}

=== KEEP / CUT / CONSOLIDATE ORDERS ===
${inputs.KEEP_CUT_ORDERS}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

${inputs.REGISTER_GUIDANCE ? `REGISTER:\n${inputs.REGISTER_GUIDANCE}\n` : ''}
PRODUCTION SCALE:
- This issue will be produced as a 22-page comic.
- Your beatSpine must contain 20–24 page beats.
- Each page beat = one production page.
- One charged exchange between two characters = one page beat.
- One action sequence = one page beat.
- One reveal, discovery, or turn = one page beat.
- One silent visual moment = one page beat.
- A scene that runs three pages = three page beats.
- If your beatSpine has fewer than 20 entries,
  you have compressed the story. Expand it.
  Split compound scenes. Break multi-page
  exchanges into their component pages.
- Do not summarise. Do not compress.
  Every page needs its own page beat.

CONSTRUCTION RULES:
- Treat the existing teleplay (earlier in this conversation) as a variant pool.
- Anchor issues: write with full creative investment. These are the structural pillars.
- Bridge issues: honor your story-previous issue's output state exactly. Build toward the indicated anchor.
- Every page beat must change at least one of: goal, danger, relationship, belief, secret, option, emotional pressure.
- Include the output state and setup for next in the JSON — these are used by subsequent issues.

Produce this issue in full.
\`\`\`json
{
  "issueNumber": 1,
  "workingTitle": "...",
  "function": "What story work this issue does in the arc.",
  "corePromise": "The specific dramatic problem this issue must solve.",
  "beatSpine": [
    // 20–24 entries required. One entry = one page.
    { "beatNumber": 1, "beat": "...", "sourceUsed": "scene ref or 'new connective tissue'", "storyFunction": "...", "characterTurn": "...", "consequence": "..." },
    { "beatNumber": 2, "beat": "...", "sourceUsed": "scene ref or 'new connective tissue'", "storyFunction": "...", "characterTurn": "...", "consequence": "..." },
    { "beatNumber": 3, "beat": "...", "sourceUsed": "scene ref or 'new connective tissue'", "storyFunction": "...", "characterTurn": "...", "consequence": "..." }
    // ... continue to beat 20–24
  ],
  "treatment": "Full continuous prose treatment of the issue — acts, scenes, dialogue page beats, visual page beats. Write this in full.",
  "preservedMaterial": ["list of source scenes or page beats kept"],
  "consolidatedMaterial": ["list of merges made"],
  "addedConnectiveTissue": ["brief description of any new page beats added for causality"],
  "outputState": "Complete description of story condition at end of this issue.",
  "setupForNext": "What the next issue inherits as its starting condition.",
  "unresolvedItems": ["items left for emotional passes"]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
