import { PromptTemplate, registerPromptTemplate } from './index';

const template: PromptTemplate = {
  id: 'p_12D_final_script_revision',
  description: 'Final Script Revision Pass 12D',
  slots: [
    'SCENE_STRUCTURE',
    'EARNED_LINE',
    'CALLBACK_MAP',
    'VISUAL_MOTIF',
    'QUIET_PANEL_PLAN',
    'MORAL_AFTERTASTE',
    'GRIEF_INVENTORY',
    'PAGE_RHYTHM'
  ],
  render: (inputs) => `You are the Lead Scriptor performing Pass 12D (Final Script Revision).
Your job is to produce the definitive production script (Acts, Scenes, Beats) for this episode.

Below is the raw scene structure and draft script of the episode:
[SCENE_STRUCTURE]
${inputs.SCENE_STRUCTURE || 'No SCENE_STRUCTURE available.'}

To enrich this script, you MUST synthesize and apply all previous enrichment layers from the creative pipeline:

1. EARNED LINES (Earned dialogue beats that deliver maximum emotional payoff):
[EARNED_LINE]
${inputs.EARNED_LINE || 'No EARNED_LINE available.'}

2. CALLBACK MAPS (Payoffs of setups from earlier episodes):
[CALLBACK_MAP]
${inputs.CALLBACK_MAP || 'No CALLBACK_MAP available.'}

3. VISUAL MOTIFS (Recurring symbolic props or camera staging):
[VISUAL_MOTIF]
${inputs.VISUAL_MOTIF || 'No VISUAL_MOTIF available.'}

4. QUIET PANEL PLANS (Silent panels inserted to break up dense conversation and let moments land):
[QUIET_PANEL_PLAN]
${inputs.QUIET_PANEL_PLAN || 'No QUIET_PANEL_PLAN available.'}

5. MORAL AFTERTASTE (Emotional anchors and existential framing of endings):
[MORAL_AFTERTASTE]
${inputs.MORAL_AFTERTASTE || 'No MORAL_AFTERTASTE available.'}

6. GRIEF INVENTORY (Vulnerabilities, scars, or historical weight characters carry):
[GRIEF_INVENTORY]
${inputs.GRIEF_INVENTORY || 'No GRIEF_INVENTORY available.'}

7. PAGE RHYTHM (Dynamic timing of panel density per page):
[PAGE_RHYTHM]
${inputs.PAGE_RHYTHM || 'No PAGE_RHYTHM available.'}

Apply these layers directly to the script of each beat:
- Inject earned lines into dialogue.
- Introduce quiet panels where visual pauses are planned.
- Update visual descriptions to reflect visual motifs and subtext.
- Resolve characters correctly using their canonical handles in dialogue entries.
- Ensure the pacing matches specified page rhythm dynamics.

Preserve all fields from the input SCENE_STRUCTURE (dramaticWant, function, subtext, 
direction, source, sourceBeatNumbers) unless you are specifically revising them.
Do not reduce beat count. Quiet panels may be added but existing beats must be retained.

Output your reply in the exact same SCENE_STRUCTURE JSON format. The response must be a single complete JSON object matching the schema below:

\`\`\`json
{
  "acts": [
    {
      "actNumber": 1,
      "scenes": [
        {
          "sceneNumber": 1,
          "title": "Scene Title",
          "setting": "INT. ROOM - DAY",
          "dramaticWant": "What character(s) want in this scene.",
          "function": "Dramatic function of this scene.",
          "beats": [
            {
              "beatNumber": 1,
              "description": "Beat description",
              "beatType": "DIALOGUE",
              "visualNote": "Visual setup/motif notes",
              "characterHandles": ["@char1"],
              "script": [
                {
                  "kind": "caption",
                  "text": "Caption text",
                  "captionStyle": "grey",
                  "characterHandle": "@char1"
                },
                {
                  "kind": "dialogue",
                  "characterHandle": "@char1",
                  "text": "Dialogue text.",
                  "parenthetical": "whispering"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`
No conversational wrapper before or after the JSON block.`
};

registerPromptTemplate(template);
export default template;
