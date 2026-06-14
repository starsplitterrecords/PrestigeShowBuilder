import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_3_repetition_diagnosis',
  description: 'Repetition / Scene-Dump Diagnosis Pass 0.3',
  slots: ['REGISTER_GUIDANCE', 'TELEPLAY_SOURCE', 'CHARACTERS_ROSTER', 'REGROUNDING_BRIEF'],
  render: (inputs) => {
    return `${inputs.REGROUNDING_BRIEF ? `=== PROJECT REGROUNDING BRIEF ===\n${inputs.REGROUNDING_BRIEF}\n\n` : ''}=== TELEPLAY SOURCE MATERIAL ===
${inputs.TELEPLAY_SOURCE}

=== CHARACTERS ROSTER ===
${inputs.CHARACTERS_ROSTER}

You are a professional script editor and dramaturg performing Phase 0.3 (Repetition / Scene-Dump Diagnosis).
Your task is to identify whether this material is functioning as a shaped story or as a scene-generation dump.

A scene-generation dump repeats the same dramatic function under different surface details. Each scene type should appear once unless the second instance escalates or transforms the story condition.

${inputs.REGISTER_GUIDANCE ? `REGISTER GUIDANCE:\n${inputs.REGISTER_GUIDANCE}\n` : ''}

Analyze the provided teleplay source material, characters roster, and project brief, and apply the following test.

SCENE TEST — apply this to every repeated scene type:
- What changed?
- What was discovered?
- What became harder or impossible?
- What relationship shifted?
- What choice was forced?
- What danger advanced?
- What belief cracked?

If the answer is "sort of" or "nothing," the scene is not yet doing enough work.

Identify every repeated scene function. For each loop, provide: the recurring action pattern, which scenes repeat it, why the repetition weakens dramatic motion, which version to keep, which to cut/merge, and what escalation would be required if the beat must repeat.

Then deliver a verdict: is this material a shaped_story, a scene_dump, or mixed?

Ensure your entire output is valid JSON in a fenced \`\`\`json block with this exact structure:

\`\`\`json
{
  "loops": [
    {
      "patternName": "...",
      "occurrences": ["scene label or chapter reference", "..."],
      "whyWeakens": "...",
      "keepVersion": "...",
      "cutOrMerge": ["...", "..."],
      "requiredEscalation": "..."
    }
  ],
  "verdict": "shaped_story" | "scene_dump" | "mixed",
  "summary": "One paragraph diagnosis of the material's structural health."
}
\`\`\`
No conversational prose before or after the JSON block. If no repeated loops are found, return an empty loops array with verdict "shaped_story".`;
  }
};

registerPromptTemplate(template);
export default template;
