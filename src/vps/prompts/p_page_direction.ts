export const p_page_direction = {
  id: 'p_page_direction',
  slots: [
    'PAGE_ADDRESS',
    'BEAT_TYPE',
    'BEAT_DESCRIPTION',
    'SUBTEXT',
    'AUTHOR_VISUAL_NOTE',
    'AUTHOR_DIRECTION',
    'SCENE_CONTEXT',
    'ENVIRONMENT',
    'CHARACTERS_PRESENT',
    'SCRIPT_BLOCK',
    'PANEL_COUNT_HINT',
    'REGISTER_GUIDANCE'
  ],
  render: (i: Record<string, string>) => `You are directing a single comic page. You know the
story — direct this page so the panels stage, block, and express what
is actually happening. The pages before this one in the scene are in
the conversation above; keep visual continuity with them.

=== THIS PAGE (${i.PAGE_ADDRESS}, ${i.BEAT_TYPE}) ===
What happens: ${i.BEAT_DESCRIPTION}
Beneath the surface: ${i.SUBTEXT}
${i.AUTHOR_DIRECTION ? 'Author direction (honour it): ' + i.AUTHOR_DIRECTION + '\n' : ''}
${i.AUTHOR_VISUAL_NOTE ? 'Author visual note: ' + i.AUTHOR_VISUAL_NOTE + '\n' : ''}

${i.REGISTER_GUIDANCE ? i.REGISTER_GUIDANCE + '\n\n' : ''}=== SCENE ===
${i.SCENE_CONTEXT}

=== ENVIRONMENT (the place — render it consistently) ===
${i.ENVIRONMENT}

=== CHARACTERS ON THIS PAGE ===
${i.CHARACTERS_PRESENT}

=== SCRIPT (allocate each indexed entry to one panel) ===
${i.SCRIPT_BLOCK}
${i.PANEL_COUNT_HINT ? '\nAuthor requests ' + i.PANEL_COUNT_HINT + ' panels on this page.\n' : ''}

DIRECTION RULES:

1. PANEL COUNT serves the page. A quiet beat may be one panel; an
   exchange may be three or four. Do not pad; do not crush two distinct
   moments into one panel. If the author requested a count, honour it.

2. DEPTH on every panel. Give foreground, midground, and background.
   A flat single plane is the failure. Stage across depth — a hand or
   object near, the subject in the middle, context behind.

3. BLOCKING IS RELATIONAL. When two or more characters share a panel,
   write relationalStaging: how they occupy the frame together — the
   distance between them, who faces whom, who is responding and who is
   not. For each character give zone, depth, facing, bodyLanguage,
   facialExpression, and inResponseTo (what they are reacting to in
   this panel). Never describe characters as independent figures who
   merely share a background. If a panel is solo, relationalStaging is
   empty and inResponseTo describes their relationship to the moment.

4. EXPRESSION MATCHES SUBTEXT, not just the line. A character saying
   'I'm fine' through a clenched jaw is the point.

5. DIALOGUE ALLOCATION. Put each script entry's index into exactly one
   panel via dialogueIndices / captionIndices. Prefer one speaker's
   line per panel for clean balloons — but the silent characters still
   appear and react in that panel. A clean balloon and a populated
   scene are not in tension if you choose whose line lands where.

6. DIRECT ADDRESS — a character looking at the reader — is rare and
   high-impact. Default directAddress false. Set it true only for a
   genuine beat of audience implication or emotional breakthrough, and
   give a directAddressRationale. Do not default to characters facing
   the reader.

7. PROPS that recur across this page's panels get a label and a
   concrete description so they stay consistent.

8. PAGE REGISTER. Give the lighting, mood, emotionalRegister, and
   environmentalDetail shared by all panels on this page — they are the
   same moment in the same place.

9. PAGE LAYOUT serves the drama. Choose pageComposition.layoutName from
   the set matching your panel count, and name the focalPanelIndex —
   the panel that should dominate the page. Use a splash (isSplash true,
   one panel) only for a genuine full-page moment. Match arrangement to
   beat: a reveal or a dominant image → a FOCUS/FEATURE layout with a
   clear focal panel; rising tension → an ESCALATION layout; a measured
   exchange → an even row/stack. Do not default to an even grid.

   Valid layoutName by panel count:
   1: 'SPLASH'
   2: 'WIDE_TIGHT' | 'EQUAL_CONFRONTATION' | 'CINEMATIC_STRIP' |
      'ASYMMETRIC_WEIGHT' | 'TIGHT_WIDE'
   3: 'ACTION_SEQUENCE' | 'DIALOGUE_ROW' | 'FEATURE_DETAIL' |
      'ESCALATION' | 'TRIPTYCH_H' | 'WIDE_SPLIT'
   4: 'FOUR-PANEL 2x2 GRID' | 'FOUR-PANEL FEATURE'

10. DIALOGUE LEAK PREVENTION: Dialogue, captions, signs, labels, and sound effects must only appear in explicit text-render fields. Do not copy dialogue or readable text into ACTION, FOREGROUND, MIDGROUND, BACKGROUND, STAGING, visual direction, camera direction, environmental detail, or prop descriptions. Visual fields must describe only what is seen, not text to render.

Return JSON only:
\`\`\`json
{
  "pageRegister": {
    "lighting": "...",
    "mood": "...",
    "emotionalRegister": "...",
    "environmentalDetail": "moderate"
  },
  "pageComposition": {
    "layoutName": "FEATURE_DETAIL",
    "focalPanelIndex": 0,
    "isSplash": false,
    "compositionNote": "the reveal dominates; details react around it"
  },
  "panels": [
    {
      "shotType": "two-shot",
      "action": "...",
      "foreground": "...",
      "midground": "...",
      "background": "...",
      "relationalStaging": "...",
      "blocking": [
        {
          "handle": "@ech.Arvok",
          "zone": "middle-left",
          "depth": "midground",
          "facing": "away, toward console",
          "bodyLanguage": "...",
          "facialExpression": "...",
          "inResponseTo": "Luzia's entrance he refuses to acknowledge"
        }
      ],
      "dialogueIndices": [0],
      "captionIndices": [],
      "directAddress": false,
      "props": []
    }
  ]
}
\`\`\``
};
