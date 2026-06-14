import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_0_regrounding',
  description: 'Project Regrounding Pass 0.0 Prompt Template',
  slots: ['TELEPLAY_SOURCE', 'CHARACTERS_ROSTER', 'REGISTER_GUIDANCE', 'GN_PACKET'],
  render: (inputs) => {
    return `You are a professional showrunner and television executive performing Phase 0.0 (Project Regrounding) for the television bible series.
Your task is to analyze the authoritative teleplay source material and characters roster, then output a unified Project Regrounding Brief containing exactly eleven fields in structured JSON.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

${inputs.GN_PACKET ? `=== GENERATED NOVELTY PACKET (GN) ===\n${inputs.GN_PACKET}\n` : ''}

=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

Ensure your entire output is valid JSON in a fenced \`\`\`json block. The JSON object MUST have the following eleven fields:
1. "title": The definitive title verified from source.
2. "premise": Concise summary of the show's core premise and story hook.
3. "genre": The precise genre classification (e.g., historical war drama, mockumentary comedy, etc.).
4. "tone": The atmospheric, stylistic tone (e.g., somber and intense, deadpan, cynical).
5. "themes": Core thematic threads running through the season.
6. "narrativeMechanism": The central structural device, narrative trigger, or organizing mechanic of the storytelling (how the scenes sequence/interconnect).
7. "conflictEngine": What primary forces, pressures, or rivalries drive the season-long dramatic tension.
8. "characterRosterStatus": A clean authoritative summary of the key characters, their roles, and overall state in the series bible.
9. "seasonArcSummary": Overall narrative progression of the season from beginning, middle, to end.
10. "settingDetails": Sensory details of the visual world, locations, and time period.
11. "editorialPriorities": The definitive list of what elements to protect, refine, or correct under current authoritative guidance.

Output Format:
\`\`\`json
{
  "title": "...",
  "premise": "...",
  "genre": "...",
  "tone": "...",
  "themes": "...",
  "narrativeMechanism": "...",
  "conflictEngine": "...",
  "characterRosterStatus": "...",
  "seasonArcSummary": "...",
  "settingDetails": "...",
  "editorialPriorities": "..."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
