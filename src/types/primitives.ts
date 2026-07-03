export type SyncStatus = 'synced' | 'local-newer' | 'cloud-newer' | 'conflict' | 'error';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type Viewport = 'mobile' | 'desktop';

export type WorkspaceView = 
  | 'vault' 
  | 'dashboard' 
  | 'concept' 
  | 'setup' 
  | 'characters' 
  | 'art-dept' 
  | 'character-concepts' 
  | 'issue-compiler'
  | 'teleplay'
  | 'export'
  | 'generation-log'
  | 'workbench'
  | 'workbench_v2'
  | 'psb4-replay'
  | 'psb4'
  | 'production-audit'
  | 'visual-planning';

export const FULLSCREEN_VIEWS: readonly WorkspaceView[] = [
  'workbench',
  'workbench_v2',
  'characters',
  'issue-compiler',
  'teleplay',
  'psb4',
  'psb4-replay',
  'visual-planning'
];

export const HIDE_BREADCRUMB_VIEWS: readonly WorkspaceView[] = [
  'workbench',
  'workbench_v2',
  'psb4-replay'
];

export const HIDE_PROJECT_TREE_VIEWS: readonly WorkspaceView[] = [
  ...FULLSCREEN_VIEWS
];


/**
* Per-show writing rules for the punch-up pass.
* Each category is an array of rule strings.
* The author edits these in SetupPanel.
* During a punch-up session the author can toggle rules
* and temporarily edit them without saving.
*/
export interface WritingRules {
 dialogueRules:  string[];  // how characters speak in this show
 blockingRules:  string[];  // physical action and staging rules
 structureRules: string[];  // beat and scene construction rules
 craftNotes:     string[];  // catch-all: tone, register, any other rule
}

export interface NodePath {
  seasonIdx: number;
  episodeIdx?: number;
  actIdx?: number;
  sceneIdx?: number;
  beatIdx?: number;    // ADD — index into scene.cinematicBeats
  highlightLogId?: string; // D239: jump to entry in GenerationLogPanel
}

export interface ShowSummary {
  id: string;
  name: string;
  titleSuggestion: string;
  premise: string;
  initMode: 'rich' | 'seed' | 'mine';
  draftVersion: number;
  createdAt: number;
  lastModified: number;
  characterCount: number;
  episodeCount: number;
  sceneCount: number;
  localLastSyncedAt?: number;
  cloudLastModified?: number;
  ownerId?: string;
}

export type ShowRegister = 'comedy' | 'drama' | 'mixed';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
