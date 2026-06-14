import type { Character, CharacterArcLane, CharacterPhilosophy, EpisodePairing } from './character';
import type { CinematicBeat } from './beat';
import type { ComicGalleryEntry, IssuePageAssignment } from './comic';
import type { GenerationLogEntry, GenerationStats, TextGenerationLogEntry } from './generation';
import type { ShowRegister, WritingRules } from './primitives';
import type { LockedReference, SettingAnchor } from './reference';
import {
  Issue, ProductionPage, IssueManifest,
  ImageVersion, PromotionRecord
} from './production';

export interface Show {
  id: string;
  name: string;
  titleSuggestion: string;
  premise: string;
  themes: string;
  activeRunId?: string;
  initMode: 'rich' | 'seed' | 'mine';
  richInput?: string;
  seedCharacters?: string;
  expandedBible?: string;
  narrativeMechanism?: string; // how the show's central structural device works and what triggers it
  draftVersion: number;
  createdAt: number;
  lastModified: number;
  showCode: string;
  ownerId?: string;
  register?: ShowRegister;  // D267: gates comedy guidelines and other register-specific behavior.
  depthConfig: {
    lines?: boolean;
  };
  structureConfig?: {
    episodesPerSeason?: number;  // default 1 (minimal) — D90
    actsPerEpisode?: number;     // default 1 (minimal) — D90
    scenesPerAct?: number;       // default 1 (minimal) — D90
    beatsPerScene?: number;      // default 1 (minimal) — D90
  };
  styleConfig: {
    positivePrompt: string;
    negativePrompt: string;
    compositionPrompt?: string;  // Staging, figure arrangement, set-dressing — independent of visual style
  };
  comicStyle?: {
    artistStyle: string;
    colorPalette: string;
    lineWeight: string;
    negativePrompt?: string;
    compositionPrompt?: string;
  };
  characters: Character[];
  settingAnchors?: SettingAnchor[];
  seasons: Season[];
  comicGallery?: ComicGalleryEntry[];
  issuePageAssignments?: IssuePageAssignment[];
  coverAnchorAssetId?: string;  // First approved cover — used as visual reference for subsequent covers
  coverTreatmentPrompt?: string; // Per-show graphic design treatment applied as pass 2 of two-pass cover generation.
  lockedReferences?: LockedReference[];
  generationLog?: GenerationLogEntry[];
  textGenerationLog?: TextGenerationLogEntry[];
  writingRules?: WritingRules;
  generationStats?: GenerationStats; // D204: track AI usage stats
  beatStats?: Record<string, GenerationStats>; // D204: per-beat stats
  isInitialSequence?: boolean; // D309: trigger pause after first generation
  gnPacket?: import('../psb4/types').GnPacket;
  gnPacketConfirmed?: boolean;   // true once author has reviewed and confirmed the packet
  
  // ── New production model (DA-001) ──
  issues?: Issue[];
  productionPages?: ProductionPage[];
  issueManifests?: IssueManifest[];
  /** @deprecated DA-013: moved to production_image_versions IDB store */
  imageVersions?: ImageVersion[];
  promotionRecords?: PromotionRecord[];
  unresolvedSpeakerSettings?: Record<string, 'unresolvedSpeaker' | 'nonCharacterVoice' | 'resolvedCharacter' | 'unknown'>;
  unresolvedSpeakerMapping?: Record<string, string>;
}

export interface SeasonArcCharacterLane {
  handle: string;
  want?: string;
  need?: string;
  lie?: string;
  pressure?: string;
  breakingPoint?: string;
  finalChoice?: string;
}

export interface SeasonArcEpisodeTurn {
  episodeNumber: number;
  turnLabel: string;
  turnDescription: string;
}

export interface SeasonArcOutlineEntry {
  episodeNumber: number;
  title: string;
  aStory: string;
  bStory: string;
  spineMovement?: string;
  turn?: string;
  endState: string;
}

export interface SeasonArcFactionEntry {
  handle: string;
  faction: string;
  philosophy: string;
}

export interface Season {
  id: string;
  number: number;
  description: string;  // backward-compat prose; D292 derives from structured fields
  // D292: structured fields
  thesis?: string;
  engine?: string;
  spine?: string;
  characterArcs?: SeasonArcCharacterLane[];
  episodeTurns?: SeasonArcEpisodeTurn[];
  ensembleMap?: string;
  episodeBeatTemplate?: string;
  escalation?: string;
  finale?: string;
  outlineGrid?: SeasonArcOutlineEntry[];
  philosophicalMap?: SeasonArcFactionEntry[];
  episodes: Episode[];
  characterArcLanes?: CharacterArcLane[];  // D125: extracted from arc
  characterPhilosophies?: CharacterPhilosophy[];
  episodePairings?: EpisodePairing[];       // D125: extracted from arc
}

export interface Episode {
  id: string;
  fid?: string;
  number: number;
  title: string;
  oneLiner: string;
  aStory?: string;
  bStory?: string;
  endState?: string;
  summary: string;
  productionNotes?: string;
  acts: Act[];
  gndsArchived?: boolean;         // true after promotion
  promotedToIssueUid?: string;    // UID of the Issue this became
}

export interface Act {
  id: string;
  fid?: string;
  number: number;
  summary: string;
  contentStale?: boolean;
  gndsArchived?: boolean;
  scenes: Scene[];
}

export interface Scene {
  id: string;
  fid?: string;
  number: number;
  title: string;
  summary: string;
  setting?: string;         // Named location with one sensory detail
  settingAnchorId?: string;  // references Show.settingAnchors[].id
  dramaticWant?: string;    // What a character wants in this scene
  isExterior?: boolean;
  contentStale?: boolean;
  gndsArchived?: boolean;
  productionNotes?: string;
  cinematicBeats: CinematicBeat[];
}
