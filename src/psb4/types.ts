export enum ArtifactType {
  REGROUNDING_BRIEF = 'regrounding_brief',
  ENGINE_READ = 'engine_read',
  WORKING_INVENTORY = 'working_inventory',
  REPETITION_DIAGNOSIS = 'repetition_diagnosis',
  FORM_FUNCTION_AUDIT = 'form_function_audit',
  CHARACTER_FUNCTION_AUDIT = 'character_function_audit',
  PREMISE_CASHOUT = 'premise_cashout',
  KEEP_CUT_ORDERS = 'keep_cut_orders',
  CLEAN_SPINE = 'clean_spine',
  ARC_LADDER = 'arc_ladder',
  ISSUE_DRAFT = 'issue_draft',
  OUTPUT_STATE = 'output_state',
  SCENE_POOL_ENTRY = 'scene_pool_entry',
  FINALE_LOCK = 'finale_lock',
  ARC_CLOSURE_REPORT = 'arc_closure_report',
  EMOTIONAL_QUESTION = 'emotional_question',
  PRIVATE_WOUND = 'private_wound',
  PAGE_TURN_MAP = 'page_turn_map',
  BALANCED_CONFLICT = 'balanced_conflict',
  RELATIONSHIP_PRESSURE = 'relationship_pressure',
  VISUAL_MOTIF = 'visual_motif',
  QUIET_PANEL_PLAN = 'quiet_panel_plan',
  PAGE_RHYTHM = 'page_rhythm',
  CALLBACK_MAP = 'callback_map',
  EARNED_LINE = 'earned_line',
  GRIEF_INVENTORY = 'grief_inventory',
  MORAL_AFTERTASTE = 'moral_aftertaste',
  SCENE_STRUCTURE = 'scene_structure',
  SCENE_SCRIPT = 'scene_script',  // DA-055: full written scenes
  SEGMENTATION_PLAN = 'segmentation_plan'  // DA-057: page-break plan
}

export type Psb4Phase = 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment' | 'done' | null;
export type Psb4ProgressStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface Psb4Run {
  id: string;                    // ULID/UUID, primary key
  showId: string;                // foreign key to show
  status: 'active' | 'completed' | 'abandoned' | 'failed' | 'hydrating';
  hydrationStatus?: 'hydrating' | 'complete';
  createdAt: number;             // epoch ms
  updatedAt: number;
  completedAt: number | null;

  // Phase progress
  currentPhase: Psb4Phase;
  currentPass: string | null;    // pass id within current phase
  phaseProgress: {
    reduction: Psb4ProgressStatus;
    arc_lock:  Psb4ProgressStatus;
    rebuild:   Psb4ProgressStatus;
    enrichment:Psb4ProgressStatus;
  };

  // Source linkage
  sourceTeleplayHash: string;
  sourceCapturedAt: number;

  preserved: boolean;
  overrides?: Record<string, 'gemini-pro' | 'gemini-flash'>;
  scopeIssueCount?: 4 | 6 | 8;
  scopeEpisodeIds?: string[];
  arcLockNotes?: string;   // authored revision notes for 0.8R / 0.8RA

  hydrationProgress?: {
    copied: number;
    total: number;
    stage: string;
  };

  schemaVersion: 1;
}

export interface Psb4Artifact {
  id: string;                    // ULID, primary key
  runId: string;                 // foreign key to psb4_runs
  showId: string;                // denormalized field
  artifactType: ArtifactType;
  episodeId: string | null;
  scope: 'arc' | 'episode' | 'relationship' | 'character' | 'motif';

  payload: any;
  payloadVersion: number;

  createdAt: number;
  createdByPass: string;
  consoleEntryId: string | null;

  authorEdited: boolean;
  authorEditedAt: number | null;
  supersedesArtifactId: string | null;

  schemaVersion: 1;
}

export interface BeatSpineEntry {
  fid?: string;
  number?: number;
  heading?: string;
  description?: string;
  [key: string]: any;
}

export interface CharacterTurn {
  characterId: string;
  turnDescription: string;
  [key: string]: any;
}

export interface SourceRef {
  episodeId: string;
  beatFid: string;
  [key: string]: any;
}

export interface Psb4Corpus {
  id: string;                    // ULID, primary key
  runId: string;                 // foreign key to psb4_runs
  showId: string;                // denormalized
  episodeId: string;             // foreign key to the original PSB3 episode
  episodeIndex: number;

  // Content
  title: string;
  function: string;
  beatSpine: BeatSpineEntry[];
  cleanDraft: string;
  startingCondition: string;
  characterTurns: CharacterTurn[];
  oppositionEscalation: string;

  // Provenance
  preservedFromSource: SourceRef[];
  consolidatedFromSource: SourceRef[];
  addedConnective: string[];

  // Lock state
  locked: boolean;
  lockedAt: number | null;

  createdAt: number;
  createdByPass: string;
  consoleEntryId: string | null;

  schemaVersion: 1;
}

export interface ArtifactInput {
  runId: string;
  showId: string;
  artifactType: ArtifactType;
  episodeId: string | null;
  scope: 'arc' | 'episode' | 'relationship' | 'character' | 'motif';
  payload: any;
  payloadVersion: number;
  createdByPass: string;
  consoleEntryId?: string | null;
  authorEdited?: boolean;
}

export interface CorpusInput {
  runId: string;
  showId: string;
  episodeId: string;
  episodeIndex: number;
  title: string;
  function: string;
  beatSpine: BeatSpineEntry[];
  cleanDraft: string;
  startingCondition: string;
  characterTurns: CharacterTurn[];
  oppositionEscalation: string;
  preservedFromSource: SourceRef[];
  consolidatedFromSource: SourceRef[];
  addedConnective: string[];
  locked?: boolean;
  lockedAt?: number | null;
  createdByPass: string;
  consoleEntryId?: string | null;
}

export type EventType = 'prompt' | 'assembly' | 'synthesis' | 'error';

export interface Psb4ConsoleEntry {
  id: string;                    // ULID, primary key
  runId: string;                 // foreign key to psb4_runs
  showId: string;                // denormalized for cross-run queries

  eventType: EventType;
  phase: 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment';
  pass: string;                  // pass id, e.g. '0.1', '0.8A', '1', '9'
  step: string | null;           // optional sub-step label, e.g. 'episode_3' or 'character_LIN'

  // Inputs and outputs — opaque to the store
  input: any;                 // shape varies by eventType (see §2)
  output: any;                // shape varies by eventType
  error: string | null;          // populated only on failure

  // Linkage
  parentEntryId: string | null;  // for nested events (synthesis tied to a prompt)
  producedArtifactId: string | null;  // if this event produced an artifact
  producedCorpusId: string | null;    // if this event produced a corpus episode

  // Metadata
  metadata: {
    model?: string;
    temperature?: number;
    tokensIn?: number;
    tokensOut?: number;
    durationMs?: number;
    finishReason?: string;
    parser?: string;
    fragmentCount?: number;
    inputChars?: number;
    outputChars?: number;
    executionSequence?: number;  // 1-based; set by executor scope loop for episode-scoped passes
    [key: string]: any;
  };

  createdAt: number;
  schemaVersion: 1;
}

export type ConversationTurn = {
  role: 'user' | 'model';
  parts: [{ text: string }];
};

export interface CapturePromptParams<T> {
  runId: string;
  phase: 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment';
  pass: string;
  step?: string | null;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  prompt: string;
  parser?: (text: string) => T;
  parentEntryId?: string | null;
  history?: ConversationTurn[];
  executionSequence?: number;
}

export interface CaptureAssemblyParams {
  runId: string;
  phase: 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment';
  pass: string;
  step?: string | null;
  parentEntryId?: string | null;
  inputs: {
    artifactIds?: string[];
    corpusIds?: string[];
    fragments: Array<{ id?: string; name: string; content: string }>;
  };
  output: string;
  executionSequence?: number;
}

export interface CaptureSynthesisParams<T> {
  runId: string;
  phase: 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment';
  pass: string;
  step?: string | null;
  parentEntryId?: string | null;
  input: any;
  synthesized: T;
  parserName?: string;
  error?: string | null;
  executionSequence?: number;
}

// ----------------------------------------------------------------------------
// NORMALIZED TELEPLAY SOURCE RECORDS TYPES
// ----------------------------------------------------------------------------

export enum FlagCode {
  BAND_D_LOW_STRUCTURE = 'BAND_D_LOW_STRUCTURE',
  STALE_CHARACTER_ID_RECONCILED = 'STALE_CHARACTER_ID_RECONCILED',
  UNRECOGNIZED_CHARACTER_ID = 'UNRECOGNIZED_CHARACTER_ID',
  MISSING_EPISODE_TITLE = 'MISSING_EPISODE_TITLE',
  MISSING_SEASON_ARC = 'MISSING_SEASON_ARC',
  EMPTY_EPISODE = 'EMPTY_EPISODE',
  UNATTRIBUTED_DIALOGUE = 'UNATTRIBUTED_DIALOGUE',
  DUPLICATE_EPISODE_ID = 'DUPLICATE_EPISODE_ID',
  NO_CHARACTERS_IN_SHOW = 'NO_CHARACTERS_IN_SHOW'
}

export interface SourceFlag {
  level: 'info' | 'warn' | 'error';
  code: string;                  // matches FlagCode values
  episodeId: string | null;
  sceneId: string | null;
  beatId: string | null;
  message: string;
}

export interface NormalizedCharacter {
  id: string;                    // canonical id (e.g., @ech.lin)
  name: string;
  aliases: string[];             // includes any stale ids seen in the source
  voiceProfile: string | null;
  role: string | null;
}

export interface NormalizedLine {
  characterId: string | null;    // null if speaker is unattributed or ambient
  text: string;
  type: 'dialogue' | 'caption' | 'sfx' | 'narration' | 'unknown';
}

export interface NormalizedBeat {
  id: string;                    // synthesized if not in source
  index: number;
  characterIds: string[];        // reconciled against show.characters; stale ids flagged
  description: string | null;
  direction: string | null;
  continuityAnchor: string | null;
  panelPlans: object | null;
  lines: NormalizedLine[];
}

export interface NormalizedScene {
  id: string;                    // synthesized if not in source
  index: number;
  heading: string | null;        // INT./EXT. line if present
  beats: NormalizedBeat[];
}

export interface NormalizedEpisode {
  id: string;                    // PSB3 episode id (stable across reads)
  index: number;                 // 1-based ordinal
  title: string;
  summary: string | null;
  brief: object | null;          // from briefGrid if available
  scenes: NormalizedScene[];
  rawProse: string | null;       // present for band C/D; absent for A/B
}

export interface NormalizedSource {
  id: string;                    // ULID, primary key
  runId: string;                 // foreign key to psb4_runs
  showId: string;                // denormalized

  // Provenance
  capturedAt: number;
  exportSourceHash: string;      // hash of the raw export at capture time
  exportFormat: 'psb3-internal-v1' | 'psb3-prose' | 'unknown';
  detectedBand: 'A' | 'B' | 'C' | 'D';

  // Show context (snapshotted at capture for run reproducibility)
  show: {
    id: string;
    title: string;
    register: string | null;     // show.register if present
    characters: NormalizedCharacter[];
    gnPacket?: GnPacket;
  };

  // Season-level
  season: {
    title: string | null;
    arcSummary: string | null;
    structureConfig: object | null;
    briefGrid: object | null;    // the per-episode brief outline grid if present
  };

  // Episodes
  episodes: NormalizedEpisode[];

  // Flags
  flags: SourceFlag[];           // missing structure, stale ids, etc.

  schemaVersion: 1;
}

export interface DetectionResult {
  exportFormat: 'psb3-internal-v1' | 'psb3-prose' | 'unknown';
  detectedBand: 'A' | 'B' | 'C' | 'D';
}

export type ModelId = 'gemini-pro' | 'gemini-flash';

export type PassInputSpec =
  | { kind: 'source'; selector: 'full' | 'arc' | { episodeIndex: number } | { episodeId: string } }
  | { kind: 'artifact'; type: ArtifactType; episodeRef?: 'current' | 'prior' | 'all' }
  | { kind: 'show'; selector: 'register' | 'characters' | 'voice_profiles' }
  | { kind: 'literal'; label: string; value: string };

export interface PassSpec {
  id: string;                    // e.g., '0.0', '0.1', '0.8A'
  phase: 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment';
  name: string;                  // human-readable
  description: string;           // one-line summary

  scope: 'arc' | 'episode' | 'episode-anchored' | 'character' | 'relationship' | 'motif';

  inputs: PassInputSpec[];       // declarative input fragments
  promptTemplateId: string;      // prompt template id
  parserId: string;              // parser id
  outputArtifactType: ArtifactType;
  outputPayloadVersion: number;

  defaultModel: 'gemini-pro' | 'gemini-flash';
  defaultTemperature: number;

  // Register-aware framing
  registerFraming: {
    enabled: boolean;            // true if the pass should adapt to show.register
    proseGuidance: Partial<Record<string, string>>;
  };

  // Pre-conditions
  requires: ArtifactType[];      // artifact types that must already exist
  manual?: boolean;              // if true, auto-runner skips this pass
  needsPriorContext?: boolean;   // if true, pass receives a compact summary as conversation history
}

export interface AnchorScopeEntry {
  episodeId: string;
  prefixLabel: string;
  isAnchor: boolean;
  storyIndex: number;          // 0-based position in story order
  executionIndex: number;      // 0-based position in execution order
  priorStoryEpisodeId: string | null;   // story-previous episode
  nextAnchorEpisodeId: string | null;   // next anchor this bridges toward
}

export interface RegroundingBriefPayload {
  title: string;
  premise: string;
  genre: string;
  tone: string;
  themes: string;
  narrativeMechanism: string;
  conflictEngine: string;
  characterRosterStatus: string;
  seasonArcSummary: string;
  settingDetails: string;
  editorialPriorities: string;
}

export interface EngineReadPayload {
  premise: string;
  genreLane: string;
  characterEngine: string;
  externalPressure: string;
  visualWorld: string;
  antagonistMode: string;
  endingImage: string;
}

export interface WorkingElement {
  element: string;
  whyItWorks: string;
  whatToProtect: string;
  exampleFromDraft: string;
}

export interface WorkingInventoryPayload {
  elements: WorkingElement[];
}

export interface RepetitionDiagnosisPayload {
  loops: Array<{
    patternName: string;
    occurrences: string[];        // scene or chapter identifiers
    whyWeakens: string;
    keepVersion: string;
    cutOrMerge: string[];
    requiredEscalation: string;
  }>;
  verdict: 'shaped_story' | 'scene_dump' | 'mixed';
  summary: string;
}

export interface FormFunctionAuditPayload {
  scenes: Array<{
    sceneId: string;
    intention: string;
    conflict: string;
    turn: string;
    consequence: string;
    visualFunction: string;
    changesStory: boolean;
    decision: 'keep' | 'cut' | 'merge' | 'compress' | 'rewrite' | 'tone';
    note: string;
  }>;
  weakSceneCount: number;
  summary: string;
}

export interface CharacterFunctionAuditPayload {
  characters: Array<{
    name: string;
    handle?: string;
    strongestFunction: string;
    repeatedBehaviorRisk: string;
    flatteningRisk: 'low' | 'medium' | 'high';
    neededPerSection: string;
    revisionRequirement: string;
  }>;
  summary: string;
}

export interface PremiseCashoutPayload {
  issues: Array<{
    issueLabel: string;
    titlePremisePromise: string;
    concreteStoryProblem: string;
    characterCollisions: string;
    oppositionAngle: string;
    climaxRequirement: string;
  }>;
  reformulatedSeriesPremise?: string;
  summary: string;
}

export interface KeepCutOrdersPayload {
  orders: Array<{
    category: 'keep' | 'cut' | 'consolidate' | 'limit' | 'compress';
    directive: string;
    reason: string;
  }>;
  summary: string;
}

export interface CleanSpinePayload {
  sections: Array<{
    label: string;           // 'Act 1', 'Issue 1 Act 2', etc.
    storyEvent: string;
    characterConflict: string;
    emotionalTurn: string;
    oppositionMove: string;
    consequence: string;
    pageTurnQuestion: string;
  }>;
  summary: string;
}

export interface ArcLadderPayload {
  recommendedIssueCount: 4 | 6 | 8;
  arcLengthRationale: string;
  issues: Array<{
    number: number;
    workingTitle: string;
    function: string;
    externalProblem: string;
    characterConflict: string;
    oppositionMove: string;
    climaxType: string;
    endingCondition: string;
    howWorldChanged: string;
  }>;
  protagonistArc: string;
  supportingArcs: string;
  antagonistEscalation: string;
  recurringEngine: string;
  mustNotRepeat: string;
  nextTask: string;
}

export interface GnPacket {
  title?: string;
  genre?: string;
  format?: string;
  targetLength?: string;
  issueCount?: string;
  audience?: string;
  tone?: string;
  comparableWorks?: string;
  corePremise?: string;
  plotQuestion?: string;
  emotionalQuestion?: string;
  endingIfKnown?: string;
  opposingForce?: string;
  setting?: string;
  visualWorld?: string;
  recurringObjects?: string;
  knownMotifs?: string;
  knownCallbacks?: string;
  knownEndingImage?: string;
  hardConstraints?: string;
  whatShouldNotChange?: string;
  whatFeelsWeak?: string;
}

export interface IssueDraftPayload {
  issueNumber: number;
  workingTitle: string;
  function: string;
  corePromise: string;
  beatSpine: Array<{
    beatNumber: number;
    beat: string;
    sourceUsed: string;
    storyFunction: string;
    characterTurn: string;
    consequence: string;
  }>;
  treatment: string;
  preservedMaterial: string[];
  consolidatedMaterial: string[];
  addedConnectiveTissue: string[];
  outputState: string;
  setupForNext: string;
  unresolvedItems: string[];
}

export interface ScenePoolPayload {
  scenes: Array<{
    title: string;
    characters: string[];
    placementSuggestion: string;
    lengthNote: string;
    emotionalFunction: string;
    whatItReveals: string;
    fullVersion: string;
    compressedVersion: string;
    singlePanelVersion: string;
    laterPayoff: string;
    integrationRule: string;
  }>;
  characterHabits: Array<{
    character: string;
    habit: string;
    emotionalMeaning: string;
    bestUse: string;
    payoff: string;
  }>;
}

export interface OutputStatePayload {
  issueNumber: number;
  externalCondition: string;
  protagonistCondition: string;
  antagonistCondition: string;
  emotionalCondition: string;
  practicalCondition: string;
  nextConcreteProblem: string;
  unresolvedArgument: string;
  visualMotifCarriedForward: string;
  newEngineRequired: string;
}

export interface FinaleLockPayload {
  isFinaleInevitable: 'yes' | 'no' | 'partially';
  whatForcesIt: string;
  cannotBeDelayed: string;
  mustBeResolved: string;
  lockedFinalePremise: string;
  requiredConditions: string[];
  characterObligations: string[];
  antagonistObligations: string[];
  requiredPayoffs: string[];
  forbiddenRepetitions: Array<{ priorDid: string; finaleMustnot: string }>;
  finalStartingState: string;
}

export interface ArcClosurePayload {
  issuePayoffMap: Array<{
    issueLabel: string;
    seed: string;
    finalePayoff: string;
    payoffType: string;
    readerReUnderstanding: string;
  }>;
  characterClosureMap: Array<{
    character: string;
    startingPosition: string;
    finalAction: string;
    closureAchieved: boolean;
    remainingOpenTension: string;
  }>;
  motifClosureMap: Array<{ motif: string; payoff: string }>;
  unresolvedThreads: string[];
  finalAftertaste: string;
  remainingRevisionRisks: string[];
}

export interface EmotionalQuestionPayload {
  arcEmotionalQuestion: string;
  sections: Array<{
    sectionLabel: string;
    localQuestion: string;
    strongestPressureScene: string;
    currentGap: string;
    revision: string;
    suggestedTextOrPanel: string;
  }>;
}

export interface PrivateWoundPayload {
  characters: Array<{
    name: string;
    privateWound: string;
    behavioralDistortion: string;
    surfacePoint1: string;
    surfacePoint2: string;
    surfacePoint3: string;
    payoffMoment: string;
  }>;
}

export interface PageTurnMapPayload {
  sections: Array<{
    sectionLabel: string;
    emotionalPageTurnQuestion: string;
    actByActEscalation: string;
    currentWeakTransition: string;
    revisedPageTurn: string;
    readerPull: string;
  }>;
}

export interface BalancedConflictPayload {
  conflicts: Array<{
    scene: string;
    argument: string;
    sideAProtects: string;
    sideBProtects: string;
    blindSpotA: string;
    blindSpotB: string;
    revision: string;
  }>;
}

export interface RelationshipPressurePayload {
  relationships: Array<{
    pair: string;
    wantFromEachOther: string;
    refuseToGive: string;
    misunderstanding: string;
    pressureForces: string;
    visualChange: string;
    startingDynamic: string;
    middlePressurePoint: string;
    lateArcChange: string;
    sceneInsertion: string;
    visualMarker: string;
  }>;
}

export interface VisualMotifPayload {
  motifs: Array<{
    motif: string;
    emotionalMeaning: string;
    firstSeed: string;
    reinforcement: string;
    meaningShift: string;
    payoff: string;
    panelActions: string[];
  }>;
}

export interface QuietPanelPlanPayload {
  panels: Array<{
    section: string;
    placement: string;
    visualDescription: string;
    emotionalFunction: string;
    panelType: 'setup' | 'callback' | 'payoff' | 'reversal' | 'grief' | 'recognition' | 'transition';
    suggestedSize: string;
  }>;
}

export interface PageRhythmPayload {
  sections: Array<{
    sectionLabel: string;
    currentRhythmIssue: string;
    recommendedTreatment: string;
    sceneOrPageAffected: string;
    reason: string;
  }>;
}

export interface CallbackMapPayload {
  callbacks: Array<{
    element: string;
    seedLocation: string;
    reinforcement: string;
    payoffLocation: string;
    emotionalMeaning: string;
    payoffActionOrLine: string;
  }>;
}

export interface EarnedLinePayload {
  characters: Array<{
    name: string;
    earnedLine: string;
    whyImpossibleEarlier: string;
    whatChanged: string;
    setupBeats: string;
    finalPlacement: string;
    surroundingAction: string;
  }>;
}

export interface GriefInventoryPayload {
  losses: Array<{
    loss: string;
    type: string;
    seedLocation: string;
    lossMoment: string;
    acknowledgment: string;
    finaleFeeling: string;
  }>;
  summary: string;
}

export interface MoralAftertastePayload {
  intendedAftertaste: string;
  pages: Array<{
    page: string;
    beat: string;
    action: string;
    quietPanel: string;
    dialogue: string;
    callback: string;
    readerAftertaste: string;
  }>;
}

export interface SceneScriptEntry {
  kind: 'line' | 'caption' | 'action';
  characterHandle?: string;  // for kind='line'
  characterName?: string;    // for kind='line'
  text: string;
  parenthetical?: string;    // for kind='line', e.g. '(quietly)'
  captionStyle?: 'yellow' | 'white' | 'grey' | 'none';  // for kind='caption'
  speakerName?: string;
  characterId?: string;
}

export interface SceneStructureBeat {
  description: string;
  beatType: 'DIALOGUE' | 'TABLEAU' | 'ESTABLISHING' | 'MEMORY_BLEED';
  characterHandles: string[];
  subtext: string;
  visualNote: string;
  direction: string;
  source: 'preserved' | 'consolidated' | 'new';
  sourceBeatNumbers: number[];
  script?: SceneScriptEntry[];  // populated by 0.9D; absent in 0.9S output
  legacyFid?: string;
  sourceBeatFid?: string;
  unitIndices?: number[];
  characterIds?: string[];
}

export interface SceneStructurePayload {
  acts: Array<{
    actNumber: number;
    title: string;
    scenes: Array<{
      sceneNumber: number;
      title: string;
      setting: string;
      dramaticWant: string;
      function: string;
      beats: SceneStructureBeat[];
      pageBeats?: any[];
    }>;
  }>;
  metadata?: {
    showId: string;
    projectId: string;
    source09WArtifactId: string;
    source09SArtifactId: string;
    expectedSceneCount: number;
    completedSceneCount: number;
    completedSceneKeys: string[];
    missingSceneKeys: string[];
    passId: string;
    scope: string;
    episodeId?: string;
  };
}

export interface WrittenScene {
  actNumber: number;
  sceneNumber: number;
  title: string;
  setting: string;
  // The full scene as screenplay text — action lines + dialogue, in order.
  screenplay: string;
  // The same scene as an ordered, structured list for segmentation.
  script?: Array<{
    kind: 'line' | 'caption' | 'action';
    characterHandle?: string;  // for 'line'
    characterName?: string;    // for 'line' unresolved raw name
    parenthetical?: string;    // for 'line'
    text: string;
    // which 0.9S beat this unit belongs to (1-based beat number
    // within the scene). Used by DG-056 to trace page-beats to spine.
    coversBeat: number;
  }>;
}

export interface SceneScriptPayload {
  scenes: WrittenScene[];
}

export interface SegmentationPlanScene {
  actNumber: number;
  sceneNumber: number;
  pageBeats: Array<{
    unitIndices: number[];
    beatType: 'DIALOGUE' | 'TABLEAU' | 'ESTABLISHING' | 'MEMORY_BLEED';
    description: string;
    visualNote?: string;
    direction?: string;
  }>;
}

export interface SegmentationPlanPayload {
  scenes: SegmentationPlanScene[];
}

