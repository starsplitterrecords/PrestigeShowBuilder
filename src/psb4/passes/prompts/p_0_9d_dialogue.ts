import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_0_9d_dialogue',
  description: 'Scene Dialogue Generation Pass 0.9D',
  slots: ['SCENE_STRUCTURE', 'EPISODE_CONTEXT', 'REGISTER_GUIDANCE', 'CHARACTER_VOICES'],
  render: (inputs) => `You have structured this issue into acts and scenes.
Now write the complete dialogue for every page beat.

${inputs.EPISODE_CONTEXT}
${inputs.REGISTER_GUIDANCE ? 'REGISTER: ' + inputs.REGISTER_GUIDANCE + '\n' : ''}
=== SCENE STRUCTURE ===
${inputs.SCENE_STRUCTURE}

${inputs.CHARACTER_VOICES ? inputs.CHARACTER_VOICES + '\n\n' : ''}DIALOGUE RULES:
- Write each character strictly in the voice defined above.
- Every DIALOGUE page beat must have at least 2 script entries.
- TABLEAU page beats: one silent action note as a caption (captionStyle: 'grey')
  or no script entries if purely visual.
- ESTABLISHING page beats: optional location caption (captionStyle: 'yellow') only.
- MEMORY_BLEED page beats: internal caption (captionStyle: 'white').
- characterHandle must exactly match the handle used throughout this session.
- parenthetical only when it changes the read of the line.
- Do not repeat information. Do not state what the visuals will show.

Return the COMPLETE scene structure with script entries added to every page beat.
The JSON structure is identical to the scene structure above with script arrays added.
\`\`\`json
{
  "acts": [
    {
      "actNumber": 1,
      "title": "Act title",
      "scenes": [
        {
          "sceneNumber": 1,
          "title": "Scene title",
          "setting": "Scene setting",
          "dramaticWant": "What character(s) want in this scene",
          "function": "Dramatic function of this scene",
          "beats": [
            {
              "description": "...",
              "beatType": "DIALOGUE",
              "characterHandles": ["BJORN", "LIN"],
              "subtext": "...",
              "visualNote": "...",
              "direction": "...",
              "source": "preserved",
              "sourceBeatNumbers": [1],
              "script": [
                { "kind": "line", "characterHandle": "BJORN", "text": "...", "parenthetical": "..." },
                { "kind": "caption", "text": "...", "captionStyle": "yellow" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
\`\`\``
};

registerPromptTemplate(template);
export default template;
