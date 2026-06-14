import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_6_premise_cashout',
  description: 'Premise Cash-Out Pass 0.6',
  slots: ['REGISTER_GUIDANCE', 'TELEPLAY_SOURCE', 'CHARACTERS_ROSTER', 'REGROUNDING_BRIEF', 'CHARACTER_FUNCTION_AUDIT'],
  render: (inputs) => {
    return `${inputs.REGROUNDING_BRIEF ? `=== PROJECT REGROUNDING BRIEF ===\n${inputs.REGROUNDING_BRIEF}\n\n` : ''}=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

${inputs.CHARACTER_FUNCTION_AUDIT ? `=== CHARACTER FUNCTION AUDIT ===\n${inputs.CHARACTER_FUNCTION_AUDIT}\n\n` : ''}
You are a professional script editor performing Phase 0.6 (Premise Cash-Out Pass).
Your task is to audit whether the title and premise of each issue or major section are actually being cashed out by the story.

A vague premise produces vague scenes. A specific dramatic problem produces scenes that must happen.

Use this formulation to test each issue or section:
"They can only [goal] if they solve [specific problem].
Character A wants [safe/ideal method].
Character B can make [ugly/practical method] work.
Character C wants to use the solution for [secondary objective].
The opposition knows [weakness] and exploits it.
The climax forces [choice]."

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the provided teleplay source material and adjacent rosters/audits/briefs, and, for each issue or major section, identify: what the title/premise promises, the concrete story problem it should create, how each major character collides with that problem, how the antagonist/opposing force exploits it, and what the climax must prove.

If the premise is vague, output a reformulated version as one specific dramatic problem sentence.

Ensure your entire output is valid JSON in a fenced \`\`\`json block:

\`\`\`json
{
  "issues": [
    {
      "issueLabel": "Issue 1 or Chapter label",
      "titlePremisePromise": "...",
      "concreteStoryProblem": "...",
      "characterCollisions": "...",
      "oppositionAngle": "...",
      "climaxRequirement": "..."
    }
  ],
  "reformulatedSeriesPremise": "optional — only if the series premise needs sharpening",
  "summary": "One paragraph on how well the material cashes out its promises."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
