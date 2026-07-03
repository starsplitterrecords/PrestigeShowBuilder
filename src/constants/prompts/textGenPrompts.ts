import { CONTENT_GENERATION_STANDARD } from "./contentGenerationStandard";

export const MINE_CONCEPT_PREAMBLE = `
You are reading a creative document written by a showrunner or creator.
Your job is EXTRACTION, not expansion. Do not invent, rewrite, or improve.
 
CRITICAL RULE: Use the author's exact sentences wherever possible.
Quote their language directly. Do not paraphrase or smooth their prose.
If they use fragmented sentences or line breaks for rhythm, preserve that.
Their voice is the asset. Your job is to locate and preserve it, not replace it.
`.trim();

export const MINE_CONCEPT_FIELDS = `
EXTRACT the following fields using only what is in the document above:
- titleSuggestion: The series title as stated.
- premise: The core premise. Quote the author's own sentences.
 Do NOT convert to logline format. Do NOT add ideas not in the document.
 Preserve their fragmentation and rhythm if that is how they wrote it.
 Maximum 600 characters.
- worldRules: What is normal in this world, in the author's words.
- centralConflict: The central dramatic tension, in the author's framing.
- emotionalCore: What the story is emotionally about, in their words.
- themes: 3-5 thematic keywords. Use the author's exact terminology.
- seriesResolution: How they describe the ending, if stated.
`.trim();

export const MINE_CHARACTERS_PREAMBLE = `
You are reading a creative document. It may contain character descriptions,
character sketches, casting notes, or character lists.
 
YOUR TASK: Extract every character described. Structure each into the production
narrative block format. Use the author's own words for descriptions — do NOT
invent attributes the document doesn't mention.
 
If the document describes a character's appearance, use that exact description.
If it names a character, use that exact name.
If it describes a role or function, use that framing.
Only fill in production format fields (wardrobe system, movement, etc.) if the
source document provides enough to derive them. Leave sparse if the source is sparse.
`.trim();

export const CHARACTER_SUMMARY_TASK = `
TASK 1 — FULL PRODUCTION NARRATIVE (summary field):
Write the complete CHARACTER template block.
 
CRITICAL — This character must feel native to their specific world.
Not a generic archetype occupying a role slot.
A person shaped by the specific pressures of the show.
 
Their voice must be THEIRS:
 — What sentence construction do they default to under pressure?
 — What word would they never use?
 — Do they finish sentences or leave them hanging?
 — When they want something, do they ask directly or approach sideways?
 
Their physicality must be SPECIFIC:
 — Not 'athletic build' — give an actual body.
 — Not 'distinctive eyes' — give a color, a shape, a quality.
 — What do they do with their hands when they're listening?
 — How do they enter a room?
 
FOLLOW THIS FORMAT:
[CHARACTER TEMPLATE]
`.trim();

export const PORTRAIT_ANALYSIS_FIELDS = `
Analyse the image and return JSON with exactly these three fields:
 
visualAnchor: Compact physical description for image generation. Face shape, hair (color/texture/length/style), eye color, skin tone, build, height impression, 1–2 defining features. Image-generation vocabulary — precise and concrete. 80–120 words.
 
physicalDescription: Casting DNA. Same physical facts written for a casting director. What is the physical type? Approximate age range? What kind of screen presence does this face project? What genre does this body belong in? 60–100 words.
 
castingNotes: One tight paragraph. Age range (e.g. 'late 30s'), physical archetype (e.g. 'lean and angular'), and the single most important thing a casting director needs to know about what this person projects on screen. 30–50 words.
 
Return only valid JSON. No preamble. No markdown. No explanation.
Example shape: { "visualAnchor": "...", "physicalDescription": "...", "castingNotes": "..." }
`.trim();

export const MINE_CHARACTER_TASK1 = `
TASK 1 — FULL PRODUCTION NARRATIVE (summary field):
Build a full production narrative block for this character.
Start from what the source document establishes — do not contradict it.
Where the source is sparse, infer from the show's world and themes.
Label inferred details as creative development, not established canon.
 
CRITICAL — VOICE AND SPECIFICITY:
This character must sound like they live inside THIS specific world.
Not a generic archetype. Not a category label.
Their voice, physicality, and psychology must emerge from this show's
specific aesthetic, moral logic, and dramatic engine.
 
Give them a way of speaking that is THEIRS. Not their role. Not their function.
What word would they never use? What do they do with their hands?
What do they want in THIS scene versus what they want from life?
`.trim();

export const MINE_CHARACTER_TASK2 = `
TASK 2 — VISUAL ANCHOR (visualAnchor field):
Write a compact physical description for image generation.
Include: face shape, hair (color, texture, length, style), eye color,
skin tone, build, height impression, 1-2 defining physical features.
80-120 words maximum.
`.trim();

export const BEAT_DIRECTION_INSTRUCTIONS = `
Write ONE camera direction sentence for this beat.
Describe what the camera sees: framing, angle, subject. Not emotion. Not tone.
Present tense, third person. Example: "Low angle on her face as she reads the file, the window behind her going dark."
One sentence only. No preamble. No explanation.
`.trim();

export const DIALOGUE_SCRIPT_INSTRUCTIONS = `
WRITE THE EXCHANGE FOR THIS BEAT.
 
This is a craft pass — the pipeline already generated a first draft.
Your job is to write something worth reading.
 
THE ONLY RULE THAT MATTERS:
Characters do not say what they mean.
They pursue what they want through indirection, deflection, and misdirection.
The subtext in the beat data is what they actually mean.
Not a single line should state it directly.
 
WHAT MAKES DIALOGUE WORTH READING:
— A line that arrives from an unexpected angle but feels inevitable in retrospect
— A silence that says more than the surrounding lines
— A character asking about one thing while meaning another
— A moment where one person's attempt to control the conversation backfires
— Specific, concrete language — objects, places, times — not abstract emotional language
— A final line that closes the exchange in a way that changes what came before it

${CONTENT_GENERATION_STANDARD}
`.trim();

export const COMEDY_LINE_GENERATION_GUIDELINES = `
COMEDY SCENE GENERATION PRINCIPLES:
You write comedy scenes that are genuinely funny because they are built on conflict, character, and escalation, not just clever wording.

Before writing or revising the scene, first diagnose it.

STEP 1: IDENTIFY THE COMIC ENGINE
Determine the underlying conflict pattern that produces the humor. Possible engines include:
- Denial vs Reality: One character tries to maintain a false version of events; another punctures it. (Humor: rationalization, bad self-protection).
- Status Battle: Characters fight over who defines the room, who is smarter, more adult, or more important. (Humor: tiny moments treated as power struggles).
- Overcommitment to a Bad Premise: A character says something wrong/dumb, then refuses to back off, doubling down at all costs.
- Literalism vs Social Convention: One character follows rules or language too exactly while others operate on normal human implication.
- Emotional Mismatch: One character treats the moment as tragic/sacred; the other treats it as routine/logistical.
- Competence in the Wrong Direction: Genuinely skilled character applies expertise to something trivial or counterproductive.
- Group Pile-on / Consensus Collapse: Ensemble converges on a ridiculous framing or traps one person under collective reaction.
- Misplaced Seriousness: Character treats something tiny as having historic, moral, or existential importance.
- Inappropriate Practicality: Character responds to high drama with brutally practical, logistical concerns.
- Taboo Precision: Character names what polite society leaves implied, too clearly or clinically.
- Shared Delusion with Different Motives: Multiple characters support the same lie but for totally different internal reasons.
- Escalating Misunderstanding: Crossed meanings compound; each clarification makes it less clear.
- The Person Who Won't Let It Go: Everyone wants to move on; one character cannot stop correcting or re-opening the issue.
- Performance vs Private Self: Character tries to maintain a polished persona while reality/evidence breaks through.
- Rules Replacing Judgment: Using procedure or doctrine to avoid thinking, feeling, or taking responsibility.
- One Sane Person in an Insane Frame: Normal reaction is treated as disruptive because the group has accepted absurdity.
- The Wrong Person Has Authority: Someone clearly unfit is forced to lead, explain, or decide.
- Competing Interpretations: Characters react to the same event but see entirely different meanings (heroism vs insult vs paperwork).

STEP 2: TRANSLATE INTO VISUAL STORYTELLING
Strip out literary or internal phrasing. Restate the moment in concrete physical terms.
- Identify the Core Visual Contradiction (e.g., authoritative speech while covered in frosting).
- Define what must be visible to make the scene readable without dialogue.
- Assign staging jobs: body language, posture, and spatial relationships must reinforce the engine.

STEP 3: WRITE DIALOGUE
Only after diagnosing and staging should you write the dialogue.
- Dialogue must serve the diagnosed comic engine and the visible staged reality.
- Favor conflict-driven dialogue over parallel wit.
- Sincerity in Absurdity: Characters must be fully sincere about ridiculous things.
- End on Exposure: State the humiliatingly accurate truth being avoided.

REQUIRED OUTPUT SECTIONS (Internal or explicit):
Primary engine:
Secondary engine:
Character functions:
Underlying emotional truth:
Plain-language scenario:
Best ending type:
Core visual contradiction:
What must be visible:
Character staging:
Visual beats:
Drawable production version:
`.trim();

export const VISUAL_FROM_DESCRIPTION_INSTRUCTIONS = `
DERIVE PRODUCTION-LAYER VISUAL FIELDS FROM NARRATIVE DESCRIPTION.
 
You are given a narrative description of a beat. The description
is the author’s worldbuilding and teleplay prose — it contains
more meaning-language than an image generator needs. Your task
is to produce a production-layer visualDescription and a single
direction note, both derived FROM the narrative description but
governed by the Content Generation Standard. Do not repeat or
rewrite the description.
 
Produce:
  visualDescription: production-layer prose per the standard
  direction: single SHOT TYPE: brief note
`.trim();

export const PANEL_PLAN_INSTRUCTIONS = `
PLAN THE COMIC PANELS FOR THIS BEAT.
The author has a narrative description and a script.
Your task is to break this beat into 1 to 4 distinct comic
panels that capture the full progression of the action and
dialogue.
 
REQUIREMENTS:
1. Break the beat into a sequence of panels (1 to 4). Do not
   cram all narrative elements into the first panel; distribute
   them naturally across the sequence.
2. For each panel, provide:
   - SHOT TYPE: framing and angle
   - ACTION: visual description of what is happening
   - SUBTEXT: emotional subtext or internal state
   - DIRECTION: specific camera or lighting direction
   - FOREGROUND / MIDGROUND / BACKGROUND: what occupies each plane
     of depth in this panel. A flat single plane is the failure —
     stage across depth (a hand or object near, the subject in the
     middle, context behind).
   - RELATIONAL STAGING: when two or more characters share a
     panel, how they occupy the frame together — the distance
     between them, who faces whom, who is responding and who is
     not. Never describe characters as independent figures who
     merely share a background. Leave empty for solo panels.
   - DIALOGUE INDICES: indices from script entries to appear
   - CAPTION INDICES: indices of captions to appear
   - CHARACTER POSITIONS: placement of each character in frame —
     for each character also give bodyLanguage, facialExpression,
     and inResponseTo (what they are reacting to in this panel; for
     a solo character, their relationship to the moment itself)
   - DIRECT ADDRESS: a character looking at the reader is rare and
     high-impact. Default false. Set true only for a genuine beat
     of audience implication or emotional breakthrough — never as
     the default for a character who happens to face the camera.
3. Rules for CHARACTER POSITIONS placement:
   — A character who speaks should be visible
   — In OVER-THE-SHOULDER, listening char foreground, speaking
     char midground, facing camera
   — In CLOSE-UP of single speaker, char is middle-center fg
   — In TWO-SHOT, chars in complementary zones
   — Facing direction points toward whoever is being addressed
   — Distinct chars in distinct zones; overlap reserved for
     physical contact
   — Non-speaking chars can be placed if in frame
4. Sequence of panels covers entire BEAT DESCRIPTION and all
   SCRIPT ENTRIES in order.
5. Each script entry assigned to exactly one panel.
6. CONTINUITY ANCHOR and grounding apply to all panels.
7. PROP INVENTORY: Identify any physical object that appears in
   more than one panel (tools, weapons, devices, containers,
   vehicles, furniture). For each such object, provide a concrete
   visual description specific enough for an artist to draw
   identically across all panels.
   — "hammer" is not sufficient.
   — "standard claw hammer, 16oz, wooden handle, steel head,
     no unusual markings" is sufficient.
   — Do not list props that appear in only one panel.
   — Do not describe characters or costumes here.
`.trim();

export const RECONCILE_BEAT_INSTRUCTIONS = `
RECONCILE BEAT DESCRIPTION
 
You are a Story Editor refining a beat description for a comic
production pipeline. The current description may contain
overblown psychology, abstract language, or thematic gloss.
Your job is to produce a reconciled description that is:
 
  - Cleaner to stage (a comic artist could draw it)
  - Truer to the current beat state (visualDescription,
    direction, subtext, continuity anchor)
  - Consistent with the dialogue (if present)
  - Aligned with the show register without performing the register
 
RECONCILIATION RULES:
1. LENGTH: 60-120 words.
2. CONTENT: physical action, body language, environment. Reconcile
   the existing fields into a single cohesive prose block.
3. STYLE: no adverbs. No internal monologue. No dialogue repetition.
   Use specific, camera-ready verbs.
4. NEGATIVE FILTER: apply the Content Generation Standard’s
   negative filter to your output. The standard’s rules about
   intent-heavy language, abstract phrasing, and thematic
   explanation are your operating instructions for this rescue.
5. CONSISTENCY: ensure the output is true to the current beat
   state and consistent with the dialogue.
 
Output a single JSON object with a 'description' field.
`.trim();

export const STAGE_BRANCH_INSTRUCTIONS = `
GENERATE STAGE BRANCH CONTENT
 
You are expanding a section of the show bible or planning a specific
narrative level (Act summary, Scene breakdown, Concept expansion).
 
Your task is to generate creative content that is:
  - Internally consistent with the Project DNA (Premise, Themes).
  - Aligned with the current Branch Context (Season arc, pairings, philosophies).
  - Production-ready: specific, evocative, and structurally sound.
 
CRITICAL RULE:
Do not perform the tone. Embody it through the choices made in the content.
Maintain character philosophies as the primary driver of their actions.
If planning a scene or act, focus on change and escalation.
`.trim();

export const BEAT_GENERATION_INSTRUCTIONS = `
GENERATE EPISODE BEAT POOL
 
You are a Staff Writer generating the full list of beats for an episode/scene.
These beats form the rhythmic skeleton of the production.
 
GOAL: Generate a sequence of beats that satisfy the Episode Arc and A/B Story
requirements while maintaining momentum.
 
RULES:
1. BEAT TYPES (use exactly these three values):
   - DIALOGUE: the default. Two or more characters speak, or one character speaks aloud while another reacts. The MAJORITY of beats in any scene with characters present should be DIALOGUE. Drama happens through speech and the silences between speech.
   - TABLEAU: a wordless moment. The camera holds on a configuration of bodies, objects, or environment that carries dramatic weight without anyone speaking. Use SPARINGLY — typically zero to two per scene. A scene with no dialogue is rarely correct.
   - ESTABLISHING: the first beat of a scene that sets the location and orientation before action begins. Use ZERO OR ONE per scene, only when needed to establish a new location.

   DEFAULT TO DIALOGUE. If you find yourself producing more TABLEAU and ESTABLISHING beats than DIALOGUE beats in any scene, you are wrong. Reconsider.

2. SUBTEXT: Every beat must have a subtext layer — what the character wants vs what they are doing.
3. DESCRIPTION: Focus on physical action and grounded dramatic moments. 60-100 words per beat.
4. CONTINUITY: Ensure environmental and character continuity across the pool.
5. ARC ALIGNMENT: Every beat must move the story closer to the episode's end state.
6. CHARACTER VOICES: Use their handles (@show.handle) and ensure their philosophies drive the beats.
`.trim();

export const VISUAL_FROM_SCRIPT_INSTRUCTIONS = `
DERIVE VISUAL CONTEXT FROM DIALOGUE.
 
The author has written the dialogue for this beat. Your task is
to generate the visual staging, atmospheric description, and
continuity details that match this specific exchange.
 
REQUIREMENTS:
1. DESCRIPTION: Write atmospheric prose (60-120 words). Focus on
   body language, physical space, and emotional subtext revealed
   by the dialogue. Do NOT repeat the dialogue.
2. VISUAL DESCRIPTION: A compact descriptor for panel 1
   (15-25 words). Concrete and visual.
3. DIRECTION: Shot type and framing for panel 1.
   Format: SHOT TYPE: brief note.
4. CONTINUITY ANCHOR: Location name and one visual detail.
   Format: Location name -- visual detail.
`.trim();

export const SUGGEST_FIELD_INSTRUCTIONS = `
Suggest a creative value consistent with the show identity and
context provided. Write only the suggested value. No preamble,
no quotes, no explanation.
`.trim();




