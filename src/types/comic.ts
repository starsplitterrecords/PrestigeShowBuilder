import type { CaptionEntry } from './beat';
import type { CharacterPosition } from './character';

export interface TextOverlaySpec {
  kind: 'balloon' | 'caption-bar' | 'caption-box';
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-full';
  // For balloons: tail direction
  tailDirection?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  // D117: speaker handle for both speech balloons and thought bars
  // Used by buildLetteringPrompt to resolve name + visualAnchor
  characterHandle?: string;
  color?: string;   // CSS color for character bars
  // Style
  style: 'speech' | 'thought-bar' | 'narrator' | 'location' | 'internal' | 'floating';
  panelIndex: number;  // D111: 0-based panel index within the page
  chained?: boolean;   // D115: true if this balloon is part of a chain (no tail drawn)
}

export type ComicGenerationMethod =
  | 'single-panel'
  | 'beat-page'
  | 'scene-page'
  | 'lettered'
  | 'refined'
  | 'freetext'
  | 'visual'
  | 'script'
  | 'cover-pass1'
  | 'uploaded';

export type ComicVariantType = 'base' | 'lettered' | 'refined';

export interface ComicGalleryEntry {
  assetId: string;             // primary asset (composite or first panel)
  panelAssetIds?: string[];    // NEW: D209 - individual panel assets for sequential generation
  beatFid: string;
  sceneFid?: string;
  spec?: any;                       // visual method
  plan?: any;                       // script method
  generationMethod?: ComicGenerationMethod;  // NEW
  baseGenerationMethod?: 'single-panel' | 'beat-page' | 'scene-page' | 'cover' | 'freetext' | 'uploaded'; // D210
  variantType?: ComicVariantType; // D210
  panelPlanSource?: 'ai-plan' | 'heuristic-plan' | 'none'; // D210
  fallbacksUsed?: string[]; // D210
  sourceScriptVersion?: number;   // D212
  sourceVisualVersion?: number;   // D212
  sourceLayoutVersion?: number;   // D212
  sourcePageVersion?: number;     // D212
  priorRefCount?: number;         // D212
  portraitRefCount?: number;      // D212
  lockedRefCount?: number;        // D212
  refinementInstruction?: string;   // D158
  refinedFromAssetId?: string;      // D158
  imageSize?: string;               // D157
  sourceAssetId?: string;  // D116: for lettered entries, the clean image assetId
  status?: "draft" | "approved" | "archived";  // D71
  issueId?: string;       // D303
  pageNumber?: number;    // D303 — 1-indexed within the issue
  isCover?: boolean;      // D306 — when true, entry is the cover for issueId
  versionFamilyId?: string;                     // D71
  regenNotes?: string;                          // D71 — reviewer note from reroll
  overlays?: TextOverlaySpec[];                 // D108: text rendered as DOM overlay
  pageIndex?: number;                           // D108: page position within scene
  layoutName?: string;                          // D111: used for overlay panel positioning
  createdAt: number;                            // D240: ms since epoch
}

export type PanelZone =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type PanelDepth = 'foreground' | 'midground' | 'background';

/**
 * ScenePanelSpec — D107
 * A single panel within a scene-based page plan.
 * Belongs to a specific beat, has a shot type and action description.
 */
export interface ScenePanelSpec {
  panelIndex: number;          // 0-based within the page
  beatFid: string;             // which beat this panel belongs to
  shotType: string;            // e.g. 'CLOSE-UP: Bjorn'
  action: string;              // visual description for this panel
  subtext?: string;            // emotional subtext for this panel
  direction?: string;          // camera/lighting direction for this panel
  primarySpeaker?: string;     // visual anchor for character framing
  balloons: {
    speakerHandle: string;
    text: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  }[];
  captions: CaptionEntry[];    // captions belonging to this panel
  isActionPanel?: boolean;     // true if panel depicts physical action, not dialogue
  characterPositions?: CharacterPosition[];
}

/**
 * ScenePagePlan — D107
 * One comic page derived from one or more beats in a scene.
 */
export interface ScenePagePlan {
  pageIndex: number;           // 0-based within the scene
  sceneFid: string;
  beatFids: string[];          // beats that appear on this page
  panelCount: number;          // total panels on this page
  layoutName: string;          // e.g. 'ASYMMETRIC_LEFT_FEATURE'
  layoutDescription: string;   // full layout instruction for the image model
  panels: ScenePanelSpec[];
  generationPrompt: string;    // assembled prompt for generateComicPage
  panelPlanSource?: 'ai-plan' | 'heuristic-plan' | 'none'; // D238
  fallbacks?: string[];
}

export interface IssuePageAssignment {
  id: string;
  showId: string;
  issueId: string;
  issueTitle?: string;
  pageNumber: number;
  isCover?: boolean;
  seasonId?: string;
  episodeId?: string;
  actId?: string;
  sceneId?: string;
  beatFid?: string;
  galleryEntryId?: string;
  assetId?: string;
  status: 'planned' | 'generated' | 'approved' | 'lettered' | 'exported';
  createdAt: number;
  updatedAt: number;
}

