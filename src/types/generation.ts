import type { ComicGenerationMethod } from './comic';

export interface GenerationPartSummary {
  kind: 'text' | 'image';
  // For text parts: the actual text (may be truncated for display)
  text?: string;
  // For image parts: the asset ID and a human label
  assetId?: string;
  label?: string;  // e.g. "Prior page 2", "Portrait: Bjorn"
}

export interface GenerationLogEntry {
  id: string;
  timestamp: number;
  assetId: string;
  beatFid: string;
  method: ComicGenerationMethod | "cover" | "portrait" | "reference" | "ensemble";
  imageSize?: string;   // D157
  stage?: string;       // D157
  prompt: string;       // The composite text prompt actually sent.
  durationMs?: number;
  fallbacks?: string[];  // D91 — keys of fallbacks that fired during generation

  // New fields D239
  model?: string;              // e.g. 'gemini-3.1-flash-image-preview'
  aspectRatio?: string;        // e.g. '3:4'
  styleHeader?: string;        // the STYLE/EXCLUDE/COMPOSITION block
  directorNote?: string;       // if any
  parts?: GenerationPartSummary[];  // ordered parts metadata
}

export interface TextGenerationLogEntry {
  id: string;
  timestamp: number;
  generator:
    | "generateActScenes"
    | "generateCinematicBeats"
    | "generateDialogueScript"
    | "deriveVisualFromDescription"
    | "deriveVisualFromScript"
    | "reconcileBeatDescription"
    | string;
  targetFid?: string;
  targetKind?: "act" | "scene" | "beat" | "episode" | "season" | "show" | string;
  prompt: string;
  systemInstruction?: string;
  schemaName?: string;
  model: string;
  mode?: "free" | "paid" | string;
  rawResponse?: string;
  durationMs?: number;
  keepFlag?: boolean;
}

export interface GenerationStats {
  punchUps: number;
  visualGenerations: number;
  autoLayouts: number;
  panelGenerations: number;
}

export interface ReadinessIssue {
  kind: string;          // machine-readable
  message: string;       // human-readable
  characterId?: string;  // optional context
}

export interface PipelineState {
  isRunning: boolean;
  currentTask: string;
  subTask: string;
  progress: { current: number; total: number };
  logs: string[];
  pendingConfirmation?: boolean;
  readinessWarnings?: ReadinessIssue[];
  readinessBeatFid?: string;
}
