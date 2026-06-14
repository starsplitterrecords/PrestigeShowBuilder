import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_1_engine_read',
  description: 'Engine Read Pass 0.1 Prompt Template',
  slots: ['REGISTER_GUIDANCE', 'TELEPLAY_SOURCE', 'CHARACTERS_ROSTER', 'REGROUNDING_BRIEF'],
  render: (inputs) => {
    return `${inputs.REGROUNDING_BRIEF ? `=== PROJECT REGROUNDING BRIEF ===\n${inputs.REGROUNDING_BRIEF}\n\n` : ''}=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

You are a visionary series creator and script editor performing Phase 0.1 (Engine Read) for the series.
Your task is to identify and lock down the primary conflict engine, genre lane, and structural forces driving this season.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Your task is to analyze the preceding project regrounding brief and teleplay source material and outline a focused seven-field "Engine Read" that establishes the core dramatic dynamics.
Ensure your entire output is valid JSON in a fenced \`\`\`json block. The JSON object MUST have the following seven fields:
1. "premise": The core dramatic premise of the series.
2. "genreLane": The locked-in genre rules and expectations that guide the narrative tone (e.g. grounded military realism, pitch black satirical comedy).
3. "characterEngine": How central character relationships and philosophies collide to generate infinite story turns.
4. "externalPressure": What outside circumstances, operational environments, or macro threats keep characters under load.
5. "visualWorld": The aesthetic palette, lighting rules, sensory textures, and visual motifs defining the world on-screen.
6. "antagonistMode": How the antagonistic force or main oppositional element functions (is it systemic, a specific rival, ambient pressure, etc.).
7. "endingImage": The definitive thematic final frame/image that encapsulates the season's resolution.

Output Format:
\`\`\`json
{
  "premise": "...",
  "genreLane": "...",
  "characterEngine": "...",
  "externalPressure": "...",
  "visualWorld": "...",
  "antagonistMode": "...",
  "endingImage": "..."
}
\`\`\`
No conversational prose before or after the JSON block.`;
  }
};

registerPromptTemplate(template);
export default template;
