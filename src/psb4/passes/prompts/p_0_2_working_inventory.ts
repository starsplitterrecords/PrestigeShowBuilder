import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_2_working_inventory',
  description: "What's Working Inventory Pass 0.2 Prompt Template",
  slots: ['TELEPLAY_SOURCE', 'CHARACTERS_ROSTER', 'REGROUNDING_BRIEF'],
  render: (inputs) => {
    return `${inputs.REGROUNDING_BRIEF ? `=== PROJECT REGROUNDING BRIEF ===\n${inputs.REGROUNDING_BRIEF}\n\n` : ''}=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

You are a professional script consultant performing Phase 0.2 (What's Working Inventory).
Your goal is to catalog the strongest character moments, dialogue dynamics, set pieces, and thematic choices that already work exceptionally well and should be heavily protected during any rebuilding and revision passes.

Analyze the provided teleplay source material and produce a structured list of draft elements that represent the high-water marks of the existing material.
Ensure your entire output is valid JSON in a fenced \`\`\`json block. The JSON object MUST have a single "elements" array of objects, where each object has exactly these four fields:
1. "element": Name or label of the working element (e.g. "Vance and Lin's tactical banter").
2. "whyItWorks": Specific dramatic or comedic reasoning explaining why this element operates successfully (e.g. "Juxtaposes high-stakes procedures with mundaneness to establish real camaraderie").
3. "whatToProtect": Guidance on how to preserve this strength exactly during future revision or rewriting passes.
4. "exampleFromDraft": A concise quote or reference from the draft showcasing this working element.

Output Format:
\`\`\`json
{
  "elements": [
    {
      "element": "...",
      "whyItWorks": "...",
      "whatToProtect": "...",
      "exampleFromDraft": "..."
    }
  ]
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
