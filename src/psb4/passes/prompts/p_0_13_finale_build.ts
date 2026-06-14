import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_0_13_finale_build', description: 'Finale Build 0.13',
  slots: ['REGISTER_GUIDANCE','EPISODE_CONTEXT'],
  render: (inputs) => `You are a veteran comics writer performing Phase 0.13 (Finale Build).

The finale must be BOTH a climactic high AND a satisfying emotional resolution.

RULES:
- Do not merely repeat the first-issue climax at bigger scale.
- Combine pressures that previously seemed separate.
- Resolve the book's emotional question through action, not thesis speech.
- Pay off motifs through use, sacrifice, transformation, or reversal.
- Preserve cost. Victory must not erase consequence.
- Make the antagonist lose because of the protagonist's changed operating principle, not because the antagonist becomes stupid.
- End with a final image that carries the moral aftertaste.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}
${inputs.EPISODE_CONTEXT ? `ISSUE CONTEXT:\n${inputs.EPISODE_CONTEXT}\n` : ''}

Analyze the preceding conversation history (arc ladder, finale lock, prior output states, character care scene pool, characters roster, and teleplay source) and fill the following fields.

\`\`\`json
{
  "issueNumber": 0,
  "workingTitle": "...",
  "function": "...",
  "corePromise": "The locked finale premise.",
  "beatSpine": [
    { "beatNumber": 1, "beat": "...", "sourceUsed": "...", "storyFunction": "...", "characterTurn": "...", "consequence": "..." }
  ],
  "treatment": "Full continuous prose treatment of the finale — from opening condition through climax through resolution to final image.",
  "preservedMaterial": [],
  "consolidatedMaterial": [],
  "addedConnectiveTissue": [],
  "outputState": "The final arc output state — what is permanently changed.",
  "setupForNext": "n/a — finale",
  "unresolvedItems": ["intentional open threads only"]
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
