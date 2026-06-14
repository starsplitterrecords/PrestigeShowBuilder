import { PromptTemplate, registerPromptTemplate } from './index';
const template: PromptTemplate = {
  id: 'p_0_10_output_state', description: 'Output State / Handoff 0.10',
  slots: ['EPISODE_CONTEXT'],
  render: (inputs) => `You are a story producer performing Phase 0.10 (Output State / Next-Issue Handoff).

Read the completed issue draft and the arc ladder from preceding conversation history. Produce a precise, production-useful output state that the next issue will inherit.

Do not end with a vague teaser. End with a specific, executable handoff.

${inputs.EPISODE_CONTEXT ? `ISSUE CONTEXT:\n${inputs.EPISODE_CONTEXT}\n` : ''}

Analyze the preceding conversation history (completed issue draft and arc ladder) and fill the following fields.

\`\`\`json
{
  "issueNumber": 0,
  "externalCondition": "What changed in the world, mission, relationship, or system.",
  "protagonistCondition": "What they now have, what they lost, what they know, what they can no longer pretend.",
  "antagonistCondition": "What the opposition now understands and how their strategy changed.",
  "emotionalCondition": "What wound, mistrust, grief, hope, or obligation now carries forward.",
  "practicalCondition": "What resources remain, what is gone, what new options exist.",
  "nextConcreteProblem": "The specific concrete problem the next issue must address.",
  "unresolvedArgument": "The specific unresolved conflict or disagreement that carries forward.",
  "visualMotifCarriedForward": "An object, image, or visual element that should recur.",
  "newEngineRequired": "What the next issue must do differently to avoid repeating this one."
}
\`\`\`
No conversational prose before or after the JSON block.`
};
registerPromptTemplate(template);
export default template;
