import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_7_keep_cut_orders',
  description: 'Keep / Cut / Consolidate Orders Pass 0.7',
  slots: [
    'REGISTER_GUIDANCE',
    'TELEPLAY_SOURCE',
    'CHARACTERS_ROSTER',
    'REGROUNDING_BRIEF',
    'REPETITION_DIAGNOSIS',
    'FORM_FUNCTION_AUDIT',
    'CHARACTER_FUNCTION_AUDIT',
    'PREMISE_CASHOUT'
  ],
  render: (inputs) => {
    return `${inputs.REGROUNDING_BRIEF ? `=== PROJECT REGROUNDING BRIEF ===\n${inputs.REGROUNDING_BRIEF}\n\n` : ''}=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

${inputs.REPETITION_DIAGNOSIS ? `=== REPETITION DIAGNOSIS ===\n${inputs.REPETITION_DIAGNOSIS}\n\n` : ''}${inputs.FORM_FUNCTION_AUDIT ? `=== FORM FUNCTION AUDIT ===\n${inputs.FORM_FUNCTION_AUDIT}\n\n` : ''}${inputs.CHARACTER_FUNCTION_AUDIT ? `=== CHARACTER FUNCTION AUDIT ===\n${inputs.CHARACTER_FUNCTION_AUDIT}\n\n` : ''}${inputs.PREMISE_CASHOUT ? `=== PREMISE CASHOUT ===\n${inputs.PREMISE_CASHOUT}\n\n` : ''}
You are a veteran script editor and story producer performing Phase 0.7 (Keep / Cut / Consolidate Orders).
Your task is to synthesize all prior diagnostic passes into a single set of executable revision directives.

This is the last diagnostic pass before the material enters reconstruction. Be specific and directive. Not "consider cutting" but "cut all scenes where Character X repeats the same refusal without new information."

Categories:
- keep: material that must survive into the clean draft
- cut: repeated, redundant, or dramatically inert material
- consolidate: scene functions that should be merged into one scene
- limit: imagery, actions, or grammar that may appear only N times
- compress: overwritten description habits or expository passages

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the provided teleplay source, characters roster, and prior diagnostic history inputs, and produce a complete, prioritized list of revision directives. Each directive should be a single clear instruction.

Ensure your entire output is valid JSON in a fenced \`\`\`json block:

\`\`\`json
{
  "orders": [
    {
      "category": "keep" | "cut" | "consolidate" | "limit" | "compress",
      "directive": "Specific, executable instruction.",
      "reason": "Why this directive is necessary for the story to work."
    }
  ],
  "summary": "One paragraph on the overall revision direction established by these orders."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
