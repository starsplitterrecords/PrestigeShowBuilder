import { Show, CinematicBeat, Scene, Character, Season } from "../../types/models";
import { compareHandles } from "../../utils/handleUtils";
import { resolveCharacter } from "../../domainUtils";
import { CONTENT_GENERATION_STANDARD } from "../../constants/prompts/contentGenerationStandard";
import {
 DIALOGUE_SCRIPT_INSTRUCTIONS,
 COMEDY_LINE_GENERATION_GUIDELINES,
 VISUAL_FROM_DESCRIPTION_INSTRUCTIONS,
 PANEL_PLAN_INSTRUCTIONS,
 RECONCILE_BEAT_INSTRUCTIONS,
 STAGE_BRANCH_INSTRUCTIONS,
 BEAT_GENERATION_INSTRUCTIONS,
 VISUAL_FROM_SCRIPT_INSTRUCTIONS,
 SUGGEST_FIELD_INSTRUCTIONS,
} from "../../constants/prompts/textGenPrompts";

export type CardLength = 'card' | 'brief' | 'section' | 'full';
const CARD_LIMITS = {
 card: 100,
 brief: 200,
 section: 800,
 full: Infinity,
} as const;

function truncate(s: string, length: CardLength): string {
 const limit = CARD_LIMITS[length];
 if (limit === Infinity) return s;
 return s.length <= limit ? s : s.slice(0, limit);
}

/**
* Per-generator manifest declaring Required Layer 1/2/3 fields.
* F25 §7 specifies the architecture; each generator gets its own
* manifest under ./manifests/.
*/
export interface GenerationManifest {
 generatorName: string;  // for logging
 layer1: {
   show: {
     title?: boolean;
     premise?: 'card' | 'brief' | 'full';
     register?: boolean;
     themes?: 'card' | 'brief' | 'full';
     narrativeMechanism?: 'card' | 'brief' | 'full';
   };
   characters:
     | 'cards-in-beat'
     | 'cards-all'
     | 'full-in-beat'
     | 'visual-in-beat'
     | 'visual-all'
     | 'none';
 };
 layer2: {
   beat?: 'description' | 'description+subtext' | 'full' | 'planning' | 'rescue' | 'script-source';
   sceneSummary?: 'card' | 'brief' | 'section';
   sceneSetting?: 'card' | 'brief';
   sceneWant?: 'card' | 'brief';
   actSummary?: 'card' | 'brief' | 'section';
   episodeSummary?: 'card' | 'brief' | 'section';
   episodeArcStories?: boolean; // D271: aStory + bStory + endState
   precedingDialogueInScene?: boolean;
   precedingBeatDescriptions?: number; // count, 0 = none
   previousBeatVisual?: boolean;

   // D271: branch context for stage generators
   seasonArc?: 'section' | 'full';
   characterArcLanes?: boolean;
   episodePairings?: boolean;
   characterPhilosophies?: boolean;
   precedingActSummaries?: number; // count
   precedingSceneSummaries?: number; // count
 };
 layer3: {
   contentGenerationStandard?: boolean;
   instructions: string;  // identifier for which prompt block
   comedyGuidelinesIfComedy?: boolean;
 };
}

/**
* The resolver's output: a clean context object that the
* generator's prompt template consumes. Each section is
* a string ready to inject; absent sections are empty.
*/
export interface ResolvedContext {
 identityBlock: string;     // Layer 1 assembled
 situationBlock: string;    // Layer 2 assembled
 authorityBlock: string;    // Layer 3 assembled
 // Diagnostic: which manifest produced this
 manifestName: string;
}

export interface ResolverInput {
  show: Show;
  beat?: CinematicBeat;
  scene?: Scene;
  episode?: {
    summary?: string;
    aStory?: string;
    bStory?: string;
    endState?: string;
    oneLiner?: string;
  };
  actSummary?: string;
  precedingBeatsInScene?: CinematicBeat[];
  previousBeatVisual?: string;

  // D271: stage-level branch context
  branchIdxs?: {
    s?: number;
    e?: number;
    a?: number;
    sc?: number;
  };
  seasonArcText?: string;
  characterArcLanes?: string;
  episodePairings?: string;
  characterPhilosophies?: string;
  precedingActs?: { idx: number; summary: string }[];
  precedingScenes?: { idx: number; summary: string }[];
  season?: Season;
}
export const resolveContext = (
 manifest: GenerationManifest,
 input: ResolverInput,
): ResolvedContext => {
 // === LAYER 1: Identity ===
 const identityParts: string[] = [];
 
 if (manifest.layer1.show.title) {
   identityParts.push(`TITLE: ${input.show.titleSuggestion
     || input.show.name}`);
 }
 if (manifest.layer1.show.premise) {
   identityParts.push(`PREMISE: ${truncate(
     input.show.premise || '', manifest.layer1.show.premise)}`);
 }
 if (manifest.layer1.show.register) {
   identityParts.push(`REGISTER: ${input.show.register || 'drama'}`);
 }
 if (manifest.layer1.show.themes) {
   identityParts.push(`THEMES: ${truncate(
     input.show.themes || '',
     manifest.layer1.show.themes)}`);
 }
 if (manifest.layer1.show.narrativeMechanism) {
   identityParts.push(`NARRATIVE MECHANISM: ${truncate(
     input.show.narrativeMechanism || '',
     manifest.layer1.show.narrativeMechanism)}`);
 }
 
 // Characters by mode
 const charBlock = buildCharacterBlock(
   input.show, input.beat, manifest.layer1.characters);
 if (charBlock) identityParts.push(charBlock);
 
 const identityBlock = identityParts.length
   ? `[IDENTITY]\n${identityParts.join('\n')}\n[/IDENTITY]`
   : '';
 
 // === LAYER 2: Situation ===
 const situationParts: string[] = [];
 
 if (manifest.layer2.beat && input.beat) {
   situationParts.push(buildBeatBlock(
     input.beat, manifest.layer2.beat));
 }
 
 if (manifest.layer2.sceneSetting && input.scene?.setting) {
   situationParts.push(`SETTING: ${truncate(
     input.scene.setting, manifest.layer2.sceneSetting)}`);
 }
 if (manifest.layer2.sceneWant && input.scene?.dramaticWant) {
   situationParts.push(`SCENE WANT: ${truncate(
     input.scene.dramaticWant, manifest.layer2.sceneWant)}`);
 }
 if (manifest.layer2.sceneSummary && input.scene?.summary) {
   situationParts.push(`SCENE: ${truncate(
     input.scene.summary, manifest.layer2.sceneSummary)}`);
 }

 if (manifest.layer2.episodeArcStories && input.episode) {
  const arcParts: string[] = [];
  if (input.episode.aStory)
    arcParts.push(`A-STORY: ${input.episode.aStory}`);
  if (input.episode.bStory)
    arcParts.push(`B-STORY: ${input.episode.bStory}`);
  if (input.episode.oneLiner)
    arcParts.push(`ONE LINER: ${input.episode.oneLiner}`);
  if (input.episode.endState)
    arcParts.push(`END STATE: ${input.episode.endState}`);
  if (arcParts.length)
    situationParts.push(arcParts.join('\n'));
 }

 if (manifest.layer2.episodeSummary && (input.episode?.summary)) {
  situationParts.push(`EPISODE SUMMARY: ${truncate(input.episode.summary, manifest.layer2.episodeSummary)}`);
 }

 if (manifest.layer2.actSummary && input.actSummary) {
  situationParts.push(`ACT SUMMARY: ${truncate(input.actSummary, manifest.layer2.actSummary)}`);
 }

 if (manifest.layer2.seasonArc && (input.season || input.seasonArcText)) {
   let arcText = input.seasonArcText || '';
   if (input.season) {
     arcText = buildSeasonArcText(
       input.season,
       manifest.layer2.seasonArc,
       input.branchIdxs?.e
     );
   }
   situationParts.push(`SEASON ARC:\n${arcText}`);
 }

 if (manifest.layer2.characterArcLanes && input.characterArcLanes) {
  situationParts.push(`CHARACTER ARC LANES:\n${
    input.characterArcLanes}`);
 }

 if (manifest.layer2.episodePairings && input.episodePairings) {
  situationParts.push(`EPISODE PAIRINGS:\n${
    input.episodePairings}`);
 }

 if (manifest.layer2.characterPhilosophies
     && input.characterPhilosophies) {
  situationParts.push(`CHARACTER PHILOSOPHIES:\n${
    input.characterPhilosophies}`);
 }

 if (manifest.layer2.precedingActSummaries && input.precedingActs) {
  const count = manifest.layer2.precedingActSummaries;
  const slice = input.precedingActs.slice(-count);
  if (slice.length) {
    situationParts.push(`PRECEDING ACTS:\n${
      slice.map(a => `  Act ${a.idx + 1}: ${truncate(
        a.summary, 'brief')}`).join('\n')}`);
  }
 }

 if (manifest.layer2.precedingSceneSummaries && input.precedingScenes) {
  const count = manifest.layer2.precedingSceneSummaries;
  const slice = input.precedingScenes.slice(-count);
  if (slice.length) {
    situationParts.push(`PRECEDING SCENES:\n${
      slice.map(s => `  Scene ${s.idx + 1}: ${truncate(
        s.summary, 'brief')}`).join('\n')}`);
  }
 }
 
 // Preceding dialogue: ALL same-scene lines (per F25 §4.1)
 if (manifest.layer2.precedingDialogueInScene
   && input.precedingBeatsInScene) {
   const precedingDialogue = input.precedingBeatsInScene
     .flatMap(b => b.script?.entries || [])
     .map(entry => {
        if ('characterHandle' in entry) {
          return `  ${entry.characterHandle}: ${entry.text}`;
        }
        return `  [${entry.kind.toUpperCase()}]: ${entry.text}`;
     })
     .join('\n');
   if (precedingDialogue) {
     situationParts.push(
       `PRECEDING DIALOGUE IN SCENE:\n${precedingDialogue}`);
   }
 }
 
 // Preceding beat descriptions (count-bounded)
 if (manifest.layer2.precedingBeatDescriptions
   && input.precedingBeatsInScene) {
   const count = manifest.layer2.precedingBeatDescriptions;
   const slice = input.precedingBeatsInScene.slice(-count);
   if (slice.length) {
     situationParts.push(`PRECEDING BEATS:\n${
       slice.map((b, i) => `  [-${slice.length - i}] ${
         truncate(b.description, 'brief')}`).join('\n')}`);
   }
 }
 
 if (manifest.layer2.previousBeatVisual && input.previousBeatVisual) {
   situationParts.push(`PREVIOUS BEAT VISUAL: ${truncate(
     input.previousBeatVisual, 'brief')}`);
 }
 
 const situationBlock = situationParts.length
   ? `[SITUATION]\n${situationParts.join('\n\n')}\n[/SITUATION]`
   : '';
 
 // === LAYER 3: Authority ===
 const authorityParts: string[] = [];
 
 if (manifest.layer3.contentGenerationStandard) {
   authorityParts.push(CONTENT_GENERATION_STANDARD);
 }
 // Generator-specific instructions resolved by name
 authorityParts.push(resolveInstructionsByName(manifest.layer3.instructions));
 
 if (manifest.layer3.comedyGuidelinesIfComedy
   && input.show.register === 'comedy') {
   authorityParts.push(COMEDY_LINE_GENERATION_GUIDELINES);
 }
 
 const authorityBlock = authorityParts.filter(Boolean).join('\n\n');
 
 return {
   identityBlock,
   situationBlock,
   authorityBlock,
   manifestName: manifest.generatorName,
 };
};
 
function buildSeasonArcText(
  season: Season,
  mode: 'section' | 'full',
  episodeIdx?: number
): string {
  // Prefer structured fields when present.
  if (season.thesis || season.spine) {
    if (mode === 'section') {
      // Targeted: just this episode's entry from the grid + spine
      const epEntry = season.outlineGrid?.find(
        e => e.episodeNumber === (episodeIdx ?? 0) + 1);
      const epTurn = season.episodeTurns?.find(
        t => t.episodeNumber === (episodeIdx ?? 0) + 1);
      return [
        season.spine && `SPINE: ${season.spine}`,
        epEntry && `THIS EPISODE: ${epEntry.title} — ${epEntry.aStory} | ${epEntry.bStory} | End: ${epEntry.endState}`,
        epTurn && `EPISODE TURN: ${epTurn.turnLabel} — ${epTurn.turnDescription}`,
      ].filter(Boolean).join('\n\n');
    } else {
      // Full: stitch all sections
      return [
        season.thesis && `THESIS: ${season.thesis}`,
        season.engine && `ENGINE: ${season.engine}`,
        season.spine && `SPINE: ${season.spine}`,
        season.characterArcs?.length && "CHARACTER ARCS:\n" + season.characterArcs.map(a => 
          `${a.handle}: Want: ${a.want}. Need: ${a.need}. Lie: ${a.lie}. Pressure: ${a.pressure || ""}. Breaking Point: ${a.breakingPoint || ""}. Final Choice: ${a.finalChoice || ""}.`
        ).join('\n'),
        season.episodeTurns?.length && "EPISODE TURNS:\n" + season.episodeTurns.map(t => 
          `Ep ${t.episodeNumber}: ${t.turnLabel} — ${t.turnDescription}`
        ).join('\n'),
        season.ensembleMap && `ENSEMBLE: ${season.ensembleMap}`,
        season.episodeBeatTemplate && `BEAT TEMPLATE: ${season.episodeBeatTemplate}`,
        season.escalation && `ESCALATION: ${season.escalation}`,
        season.finale && `FINALE: ${season.finale}`,
        season.outlineGrid?.length && "OUTLINE GRID:\n" + season.outlineGrid.map(e => 
          `Ep ${e.episodeNumber} / ${e.title} / A-Story: ${e.aStory} / B-Story: ${e.bStory} / End state: ${e.endState}`
        ).join('\n'),
        season.philosophicalMap?.length && "PHILOSOPHICAL FACTION MAP:\n" + season.philosophicalMap.map(p => 
          `${p.handle} | ${p.faction} | ${p.philosophy}`
        ).join('\n'),
      ].filter(Boolean).join('\n\n');
    }
  }
  // Fallback: legacy description prose
  return season.description;
}

// Helper renderers
function buildCharacterBlock(
  show: Show,
  beat: CinematicBeat | undefined,
  mode: GenerationManifest["layer1"]["characters"]
): string {
  if (mode === "none") return "";

  const charsToShow: Character[] = (() => {
    if (mode === "cards-all" || mode === "visual-all") {
      return show.characters || [];
    }
    if (!beat) return [];
    return (beat.characterIds || [])
      .map((cid) => resolveCharacter(show, cid))
      .filter((c): c is Character => !!c);
  })();

  if (!charsToShow.length) return "";

  const isVisualMode = mode === "visual-in-beat" || mode === "visual-all";

  const lines = charsToShow.map((c) => {
    if (isVisualMode) {
      // D268: visual modes inject physicalDescription
      // and visualAnchor; voice info excluded entirely
      // since visual generators do not need it.
      const physical = c.physicalDescription || c.role || "";
      const anchor = c.visualAnchor ? ` Visual Anchor: ${c.visualAnchor}` : "";
      return `${c.name} (${c.handle}): ${physical}${anchor}`;
    }

    // Voice modes (existing behavior)
    const card =
      c.voiceCard && !c.voiceCardStale
        ? c.voiceCard
        : c.voiceProfile?.split(/[.!?]/)[0]?.trim().slice(0, 100) ||
          c.role ||
          "No voice defined";
    const showFull = mode === "full-in-beat";
    if (showFull && c.voiceProfile) {
      return `${c.handle} (${c.role}):\n  CARD: ${card}\n  FULL: ${c.voiceProfile}`;
    }
    return `${c.handle} (${c.role}): ${card}`;
  });

  return `CHARACTERS:\n${lines.join("\n")}`;
}
 
function buildBeatBlock(
  beat: CinematicBeat,
  mode: "description" | "description+subtext" | "full" | "planning" | "rescue" | "script-source"
): string {
  const parts: string[] = [];

  if (mode === 'script-source') {
    const parts: string[] = [];
    parts.push(`BEAT TYPE: ${beat.beatType || 'DIALOGUE'}`);
    if (beat.description)
      parts.push(`DESCRIPTION: ${beat.description}`);
    const transcript = renderSimpleTranscript(beat);
    parts.push(`TRANSCRIPT:\n${transcript || '(no dialogue)'}`);
    return parts.join('\n');
  }

  if (mode === 'rescue') {
    // D270: all current beat fields, explicitly labeled.
    // Reconcile needs full visibility into what it is rewriting.
    parts.push(`TYPE: ${beat.beatType || 'DIALOGUE'}`);
    parts.push(`CURRENT DESCRIPTION: ${beat.description || '(empty)'}`);
    if (beat.visualDescription)
      parts.push(`VISUAL DESCRIPTION: ${beat.visualDescription}`);
    if (beat.direction)
      parts.push(`DIRECTION: ${beat.direction}`);
    if (beat.subtext)
      parts.push(`SUBTEXT: ${beat.subtext}`);
    if (beat.continuityAnchor)
      parts.push(`CONTINUITY ANCHOR: ${beat.continuityAnchor}`);

    const transcript = renderSimpleTranscript(beat);
    parts.push(`DIALOGUE TRANSCRIPT:\n${
      transcript || '(no dialogue in this beat)'}`);

    return parts.join('\n');
  }

  parts.push(`DESCRIPTION: ${beat.description}`);
  if (
    mode === "description+subtext" ||
    mode === "full" ||
    mode === "planning"
  ) {
    if (beat.subtext) parts.push(`SUBTEXT: ${beat.subtext}`);
  }
  if (mode === "full" || mode === "planning") {
    if (beat.visualDescription)
      parts.push(`VISUAL: ${beat.visualDescription}`);
    if (beat.direction) parts.push(`DIRECTION: ${beat.direction}`);
    if (beat.continuityAnchor)
      parts.push(`CONTINUITY ANCHOR: ${beat.continuityAnchor}`);
  }
  if (mode === "planning") {
    // D269: indexed transcript for panel allocation
    const transcript = renderIndexedTranscript(beat);
    if (transcript)
      parts.push(`SCRIPT ENTRIES (indices for allocation):\n${transcript}`);
  }
  return parts.join("\n");
}

function renderSimpleTranscript(beat: CinematicBeat): string {
  const entries = beat.script?.entries || [];
  if (!entries.length) return "";
  return entries
    .map((e) => {
      if ("style" in e) {
        return `CAPTION (${e.style}): ${e.text}`;
      }
      // Strip @show.firstname to just firstname for readability
      const speaker = e.characterHandle?.split(".").pop() || e.characterHandle || "(unknown)";
      return `${speaker}: ${e.text}`;
    })
    .join("\n");
}

function renderIndexedTranscript(beat: CinematicBeat): string {
  const entries = beat.script?.entries || [];
  if (!entries.length) return "";
  return entries
    .map((e, i) => {
      if ("style" in e) {
        // Caption
        return `[${i}] CAPTION (${e.style}): ${e.text}`;
      }
      const paren = e.parenthetical ? ` (${e.parenthetical})` : "";
      return `[${i}] ${e.characterHandle}: ${e.text}${paren}`;
    })
    .join("\n");
}
 
function resolveInstructionsByName(name: string): string {
  // Map manifest instruction identifiers to actual prompt strings.
  // Add cases as new generators come online.
  switch (name) {
    case "dialogueScript":
      return DIALOGUE_SCRIPT_INSTRUCTIONS;
    case "visualFromDescription":
      return VISUAL_FROM_DESCRIPTION_INSTRUCTIONS;
    case "visualFromScript":
      return VISUAL_FROM_SCRIPT_INSTRUCTIONS;
    case "panelPlan":
      return PANEL_PLAN_INSTRUCTIONS;
    case "reconcileBeat":
      return RECONCILE_BEAT_INSTRUCTIONS;
    case "stageBranch":
      return STAGE_BRANCH_INSTRUCTIONS;
    case "beatGeneration":
      return BEAT_GENERATION_INSTRUCTIONS;
    case "suggestField":
      return SUGGEST_FIELD_INSTRUCTIONS;
    default:
      console.warn(`[Resolver] Unknown instruction name: ${name}`);
      return "";
  }
}

/**
 * Translate legacy branch indices into ResolverInput.
 * Walks the show tree and populates seasonArcText,
 * characterArcLanes, episodePairings, etc.
 */
export function buildResolverInputFromBranchIdxs(
  show: Show,
  idxs?: { s?: number; e?: number; a?: number; sc?: number }
): ResolverInput {
  const input: ResolverInput = { show, branchIdxs: idxs };

  if (idxs?.s == null) return input;
  const season = show.seasons?.[idxs.s];
  if (!season) return input;

  // Season-level fields
  input.season = season;
  input.seasonArcText = season.description;
  input.characterArcLanes = renderArcLanes(season.characterArcLanes);
  input.episodePairings = renderPairings(season.episodePairings);
  input.characterPhilosophies = renderPhilosophies(show, season.characterPhilosophies);

  if (idxs.e == null) return input;
  const episode = season.episodes?.[idxs.e];
  if (!episode) return input;

  // Episode-level fields
  input.episode = {
    summary: episode.summary,
    aStory: episode.aStory,
    bStory: episode.bStory,
    oneLiner: episode.oneLiner,
    endState: episode.endState,
  };

  if (idxs.a == null) return input;
  const act = episode.acts?.[idxs.a];
  if (!act) return input;

  input.actSummary = act.summary;
  input.precedingActs = (episode.acts || [])
    .slice(0, idxs.a)
    .map((a, i) => ({ idx: i, summary: a.summary || "" }))
    .filter((a) => a.summary);

  if (idxs.sc == null) return input;
  const scene = act.scenes?.[idxs.sc];
  if (!scene) return input;

  input.scene = scene;
  input.precedingScenes = (act.scenes || [])
    .slice(0, idxs.sc)
    .map((s, i) => ({ idx: i, summary: s.summary || "" }))
    .filter((s) => s.summary);

  return input;
}

// Helper renderers
function renderArcLanes(lanes?: any[]): string {
  if (!lanes?.length) return "";
  return lanes.map((l) => `${l.character || l.handle}: ${l.lane || l.want || ""}`).join("\n");
}
function renderPairings(pairings?: any[]): string {
  if (!pairings?.length) return "";
  return pairings.map((p) => `${p.char1} <-> ${p.char2}: ${p.dynamic || p.position || ""}`).join("\n");
}
function renderPhilosophies(show: Show, phils?: any[]): string {
  if (!phils?.length) return "";
  return phils
    .map((p) => {
      const char = show.characters.find((c) => compareHandles(c.handle, p.handle));
      const name = char?.name ?? p.handle;
      const faction = p.faction ? ` [${p.faction}]` : "";
      return `${name} (${p.handle})${faction}: ${p.philosophy}`;
    })
    .join("\n");
}
