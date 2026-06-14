import { AI_TEMPLATES } from './narrativeTemplates';
import { Show, Character, Episode, Act, Scene } from '../../types/models';
import { CONTENT_GENERATION_STANDARD } from './contentGenerationStandard';

export const prompts = {
  expandConcept: (name: string, premise: string) => `
EXPAND CONCEPT: ${name}
${premise ? `USER'S PREMISE SEED: ${premise}\n` : ''}
FOLLOW THIS FORMAT STRICTLY:
${AI_TEMPLATES.PREMISE}
COMMON FAILURE MODES TO AVOID:
- Backstory instead of engine.
- Vague stakes.
- No constraint (character could just leave).
- Too many concepts, no single hook.
ALSO RETURN: Extract 3-5 core thematic keywords that are SPECIFIC to this show's
world and premise. These must come from the content of the premise, not from
generic prestige drama vocabulary.
Format: 'keyword, keyword, keyword' — short noun phrases, no elaboration.
`,
  generateCharacters: (seed: string, show: Show) => `
GENERATE ENSEMBLE FOR: ${show.titleSuggestion || show.name}
WORLD: ${show.premise ? show.premise.substring(0, 300) : show.styleConfig.positivePrompt}
${seed ? `SEED DIRECTIVE: ${seed}\n` : ''}
NAME RULE: All character names must feel native to the world described above.
 - Derive names from the show's specific geography, culture, and era.
 - Do NOT draw from generic prestige TV naming pools.
 - Do NOT use common English first names (James, Sarah, Michael, etc.).
 - Names should be pronounceable but unexpected.
For each character, populate a COMPLETE PRODUCTION NARRATIVE BLOCK:
${AI_TEMPLATES.CHARACTER}
ENSEMBLE REQUIREMENTS: 4-6 leads, diverse lanes (Anchor, Catalyst, Heart, Brain).
`,
  generateCharacterConceptPrompt: (char: Character) => `
GENERATE DEFINITIVE CONCEPT VIDEO PROMPT:
Describe a single-shot scene (under 15s) that proves this character is interesting.
MUST SHOW: Competence, Contradiction, Pressure, Cost.
Build it so the audience predicts what they'll do, but is surprised by WHY.
`,
  generateSeasonArc: (sIdx: number) => `
GENERATE SEASON ${sIdx + 1} NARRATIVE ARC:
FOLLOW THIS TEMPLATE STRICTLY:
${AI_TEMPLATES.SEASON_ARC}
ENSURE: The external climax and internal choice land together. Cost paid is permanent.
`,
  generateEpisodes: (idx: number, show?: Show) => {
    const count = show?.structureConfig?.episodesPerSeason ?? 1;
    const noun = count === 1 ? 'episode' : 'episodes';
    return `Divide Season ${idx + 1} Arc into exactly ${count} ${noun}. ` +
      `Each episode must feel like a standalone unit with a clear A-story (engine) ` +
      `and B-story (character).`;
  },
  generateEpisodeFullStructure: (
    sIdx: number,
    eIdx: number,
    ep: Episode,
    show: Show
  ): string => {
    const storyBrief = ep.aStory || ep.bStory
      ? `A-STORY: ${ep.aStory || 'TBD'}\nB-STORY: ${ep.bStory || 'TBD'}\nEND STATE: ${ep.endState || 'TBD'}\n`
      : '';

    const actCount   = show?.structureConfig?.actsPerEpisode ?? 3;
    const sceneCount = show?.structureConfig?.scenesPerAct   ?? 5;

    const actLabels = [
      'ACT 1: The Inciting Incident forces the protagonist into a specific want.',
      'ACT 2: The protagonist pursues the want but hits a concrete obstacle.',
      'ACT 3: A choice is made that changes the protagonist irreversibly.',
    ];

    const actLines = Array.from({ length: actCount }, (_, i) =>
      `${i + 1}. ${actLabels[i] ?? `ACT ${i + 1}: Develop the narrative arc.`}`
    ).join('\n');

    const sceneMin = Math.max(1, sceneCount - 1);
    const sceneMax = sceneCount + 2;
    const sceneRange = `${sceneMin}–${sceneMax} scenes (target: ${sceneCount})`;

    const mechanismMandate = show.narrativeMechanism ? `
[MECHANISM MANDATE]
${show.narrativeMechanism}

Every episode MUST contain at least one scene where the mechanism activates for a
present-day protagonist. The mechanism is not metaphor or mood — it is a physical
event that intrudes into the scene.

Bleed scenes must:
  — Be triggered by a specific physical event (artifact contact, location resonance,
    extreme cognitive pressure) — not by emotion alone
  — Show a specific champion or historical figure from the appropriate faction
  — Place the protagonist in a position of RESPONDING to the intrusion as a
    physical reality, not daydreaming
  — Be distinct per protagonist: Theo and Rae experience different sides of the war
` : '';

    // D124: arc mandate header — this episode's brief from the season arc
    // Presented first, before any structural instructions, as a hard directive.
    const arcMandate = (ep.aStory || ep.bStory || ep.endState) ? [
      '╔══════════════════════════════════════════════════════════╗',
      '║  ARC MANDATE — execute this story, not a new one         ║',
      '╚══════════════════════════════════════════════════════════╝',
      `THIS EPISODE IS: ${ep.title}`,
      ep.aStory   ? `A-STORY (what must happen): ${ep.aStory}`   : '',
      ep.bStory   ? `B-STORY (what must develop): ${ep.bStory}` : '',
      ep.endState ? `END STATE (where this episode must land): ${ep.endState}` : '',
      ep.oneLiner ? `SPINE/TURN: ${ep.oneLiner}` : '',
      '',
      'Every act, every scene must serve the above story.',
      'Do not invent a different episode. Execute this one.',
      '',
    ].filter(Boolean).join('\n') : '';

    return [
      arcMandate,
      `Episode ${eIdx + 1}: ${ep.title}.`,
      `LOGLINE: ${ep.oneLiner}`,
      storyBrief,
      `ACT STRUCTURE RULES — generate exactly ${actCount} acts:`,
      actLines,
      `Define Acts through visible narrative shifts. A-story drives structure; B-story runs in parallel.`,
      '',
      'For EACH act, also generate its scenes. Scene rules:',
      `Subdivide each act into ${sceneRange}.`,
      '[PROTAGONIST MANDATE]',
      'Every episode must include at least one scene anchored to each present-day protagonist.',
      'A protagonist may experience a memory bleed in any scene — but they must be PRESENT',
      'in the episode as an active agent, not merely referenced.',
      'No protagonist should be absent from a complete episode.',
      `Scale to the act's dramatic weight:
  — Act 1 (inciting): ${sceneMin}–${sceneCount} scenes. Move fast.
  — Act 2 (pursuit/obstacle): ${sceneCount}–${sceneMax} scenes. Build.
  — Act 3 (choice/consequence): ${sceneMin}–${sceneCount} scenes. Compress.
Do not pad an act with filler scenes to reach a number.
Do not compress a complex act that needs space.`,
      '[SCENE GENERATION RULES]',
      '1. DRAMATIC WANT FIRST: Every scene must be driven by a specific character want.',
      '2. LOCATION: Each scene must be set in a named, textured location.',
      '3. NO ADVERBS: Do not use adverbs to describe physical actions.',
      '4. Each scene must serve either the A-story engine or B-story relationship.',
      '',
      '[OUTPUT FORMAT — populate all fields]',
      'title:        Short evocative scene title, 2-5 words.',
      'summary:      [Character Name] wants [Goal] but [Obstacle].',
      'setting:      Named location with one sensory detail.',
      '              E.g. "The supply closet, 2am — bleach and a flickering fluorescent."',
      'dramaticWant: One sentence. What a specific character needs from this scene.',
      'location:     Room or place name only. E.g. "Supply Closet".',
      'isExterior:   true if outdoors.',
      'timeOfDay:    DAY, NIGHT, CONTINUOUS, or LATER.',
      mechanismMandate,
    ].filter(Boolean).join('\n');
  },
  generateEpisodeDetails: (sIdx: number, eIdx: number, ep: Episode, show?: Show) => {
    const storyBrief = ep.aStory || ep.bStory
      ? `A-STORY: ${ep.aStory || 'TBD'}\nB-STORY: ${ep.bStory || 'TBD'}\nEND STATE: ${ep.endState || 'TBD'}\n`
      : '';
    const actCount = show?.structureConfig?.actsPerEpisode ?? 3;
    const actLines = Array.from({ length: actCount }, (_, i) => {
      const labels = [
        `ACT 1: The Inciting Incident forces the protagonist into a specific want.`,
        `ACT 2: The protagonist pursues the want but hits a concrete obstacle.`,
        `ACT 3: A choice is made that changes the protagonist irreversibly.`,
      ];
      return `${i + 1}. ${labels[i] ?? `ACT ${i+1}: Develop the narrative arc.`}`;
    }).join("\n");
    const actNoun = actCount === 1 ? 'act' : 'acts';
    return `Deep dive into Episode ${eIdx + 1}: ${ep.title}.\n` +
      `LOGLINE: ${ep.oneLiner}\n` +
      storyBrief +
      `ACT STRUCTURE RULES — generate exactly ${actCount} ${actNoun}:\n${actLines}\n` +
      `Define Acts through visible narrative shifts. A-story drives structure; B-story runs in parallel.`;
  },
  generateActScenes: (sIdx: number, eIdx: number, aIdx: number, act: Act, show: Show) => {
    const ep = show.seasons[sIdx]?.episodes[eIdx];
    const storyContext = ep?.aStory || ep?.bStory
      ? `EPISODE A-STORY: ${ep.aStory}\nEPISODE B-STORY: ${ep.bStory}\nEPISODE END STATE: ${ep.endState}\n`
      : '';
    const sceneCount = show?.structureConfig?.scenesPerAct ?? 5;
    const sceneMin = Math.max(1, sceneCount - 1);
    const sceneMax = sceneCount + 2;
    const sceneRange = `${sceneMin}–${sceneMax} scenes (target: ${sceneCount})`;

    const actMechanism = show.narrativeMechanism
      ? `\n[MECHANISM NOTE]\nIf a scene in this act involves an artifact,
    a charged location, or a protagonist under extreme pressure,
    the narrative mechanism may activate. Include at least one such scene per act.`
      : '';

    return `
[CONTENT GENERATION STANDARD]
${CONTENT_GENERATION_STANDARD}

Subdivide Act ${act.number} into ${sceneRange}.
Scale to the act's dramatic weight:
  — Act 1 (inciting): ${sceneMin}–${sceneCount} scenes. Move fast.
  — Act 2 (pursuit/obstacle): ${sceneCount}–${sceneMax} scenes. Build.
  — Act 3 (choice/consequence): ${sceneMin}–${sceneCount} scenes. Compress.
Do not pad an act with filler scenes to reach a number.
Do not compress a complex act that needs space.
[STORY CONTEXT]
${storyContext}
ACT FUNCTION: ${act.summary}

[SCENE GENERATION RULES]
1. DRAMATIC WANT FIRST: Every scene must be driven by a specific character want.
2. LOCATION: Each scene must be set in a named location.
3. STRUCTURAL ROLE: Each scene must serve either the A-story engine or B-story relationship.
4. ONE SHIFT PER SCENE: Each scene does ONE thing — someone enters, a rule is declared, a line is crossed, a demand is made, a paper is delivered, someone leaves. If a scene has three big turns, it is three scenes.
5. START IN MOTION: The opening beat must already be happening. Not setup or atmosphere.
6. END BEFORE RESOLUTION: Exit on the physical turn, not on explanation.

[FRAMING — answer in the framing field before writing prose]
- whatsAlreadyHappening: one sentence, physical situation already in motion.
- oneShift: the single change this scene makes.
- exitCondition: the physical event that ends the scene.

${actMechanism}

[OUTPUT FORMAT — populate all fields]
title: Short evocative scene title, 2-5 words.
summary: [Character Name] wants [Goal] but [Obstacle].
setting: The named location with one sensory detail. E.g. 'The supply closet, 2am — bleach and a flickering fluorescent.'
dramaticWant: One sentence. What a specific character needs from this scene. Not action — intent.
location: The room or place name only, no sensory detail. E.g. 'Supply Closet', 'Rooftop', 'Conference Room B'.
isExterior: true if the scene is outdoors.
timeOfDay: DAY, NIGHT, CONTINUOUS, or LATER.`;
  },
  generateCinematicBeats: (sIdx: number, eIdx: number, aIdx: number, scIdx: number, sc: Scene, show: Show) => {
    const totalEps = show.seasons[sIdx]?.episodes?.length || 1;
    const totalActs = show.seasons[sIdx]?.episodes[eIdx]?.acts?.length || 1;
    const totalScenes =
      show.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes?.length || 1;
    const position =
      `Ep ${eIdx+1}/${totalEps} · Act ${aIdx+1}/${totalActs} · Scene ${scIdx+1}/${totalScenes}`;
    const isOpening = eIdx === 0 && aIdx === 0 && scIdx === 0;
    const isFinale  = eIdx === totalEps - 1;
    const positionNote = isOpening
      ? 'SERIES OPENING — establish world, tone, protagonist immediately.\n       Drop the audience into action, not exposition.'
      : isFinale
      ? 'FINALE — every beat must pay off an established thread. Nothing is decorative.'
      : '';

    const beatCount = show?.structureConfig?.beatsPerScene ?? 5;
    const beatMin = Math.max(1, beatCount - 2);
    const beatMax = beatCount + 2;
    const beatNote = `Generate ${beatMin}–${beatMax} cinematic beats.
The target is ${beatCount}. Adjust based on scene function:
  — Establishing or transition scenes: ${beatMin}
  — Action or major confrontation: ${beatMax}`;

    return `
[CONTENT GENERATION STANDARD]
${CONTENT_GENERATION_STANDARD}

${beatNote}

[POSITION]: ${position}
[SCENE]:    ${sc.summary}
${positionNote ? `[NOTE]: ${positionNote}` : ''}

[ADDITIONAL RULES]
═════════════
ONE BEAT = ONE VISIBLE TURN.
Shape: image → action → reaction → new position.
Do not stack action + realization + moral meaning + thematic statement + future implication inside one beat. That is five beats.

Beats must not repeat the same argument in new words. A beat earns its slot by changing: who holds the object, who crosses the line, who retreats, who speaks plainly, who touches first, who exits.

Every character in this beat's characterIds gets a lane — a distinct position, posture, or held action — even if silent.

FRAMING — answer framing fields before writing prose:
- beatFunction: what changes physically (one sentence)
- imageAnchor: the one thing the reader remembers seeing
- whoMovesFirst: character name only
- whatVisiblyChanges: physical result (one sentence)

REFERENCE PRESSURE CURVE (for scenes at target beat count)
═════════════
Beat 1 — ENTRY        Characters arrive mid-want. Establish environment and power imbalance.
Beat 2 — ENGAGEMENT   First contact. Surface subject introduced — not the real one.
Beat 3 — PRESSURE     Surface subject becomes inadequate. Something physical changes.
Beat 4 — PIVOT        One character makes an irreversible choice. Real subject surfaces.
Beat 5 — EXIT         Consequence arrives. Characters leave changed in a concrete way.

For shorter scenes: compress to ENTRY → PIVOT → EXIT.
For longer scenes: expand PRESSURE into multiple beats before PIVOT.
For establishing scenes: ENTRY + one environmental beat only.
`;
  },
};
