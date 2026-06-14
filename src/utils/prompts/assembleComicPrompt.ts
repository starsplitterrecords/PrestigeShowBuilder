// assembleComicPrompt.ts — pruned by DA-081
// This module was the beat-era page-prompt assembler (assembleComicPrompt,
// planComicPage, derivePanelAction, deriveSpeakerAwareShot,
// assignBalloonPosition, collectPageCharacters, resolveSettingContext).
// All of that is dead since DA-076/077; prompt assembly now lives in
// finalPageContract + generateFinalComicPage. What survives: the
// LINE_COUNT_TO_PANEL_COUNT mapping the contract uses, and the inert
// plan/spec interfaces still referenced as types.

import { CaptionEntry, CharacterPosition } from '../../types/models';

export interface BalloonSpec {
  characterId: string;
  text: string;
  tailDirection: 'left' | 'right' | 'up' | 'down' | 'lower-left' | 'lower-right' | 'upper-left' | 'upper-right';
  balloonType: 'speech' | 'thought' | 'caption' | 'whisper' | 'shout';
  position?: { x: number; y: number; width: number };
}

export interface ComicPanelSpec {
  panelIndex: number;
  visualPrompt: string;
  characterLocks: string[];
  dialogueBalloons: BalloonSpec[];
  artistStyle: string;
  reviewNote?: string;
  fallbacks?: string[];
}

export interface PanelPlan {
  panelNumber: number;      // 1-indexed
  shotType: string;         // e.g. "CLOSE-UP", "MEDIUM SHOT"
  action: string;           // What the camera shows — from beat.description, scoped to this panel
  subtext?: string;
  direction?: string;
  // DA-042 — panel-level direction carried from BeatPanelPlan.
  foreground?: string;
  midground?: string;
  background?: string;
  relationalStaging?: string;
  directAddress?: boolean;
  primarySpeaker?: string;  // D93: visual description of the character to frame
  captions?: CaptionEntry[];  // D99
  balloons: {
    speakerHandle: string;
    text: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  }[];
  panelPrompt: string;      // D209 - specific prompt for this panel
  characterPositions?: CharacterPosition[];
}

export interface ComicPagePlan {
  beatFid: string;
  panelCount: 1 | 2 | 3 | 4 | 5 | 6;
  layoutName: string;
  panels: PanelPlan[];
  generationPrompt: string;  // @deprecated D209 - was used for one-pass
  fallbacks?: string[];
  panelPlanSource?: 'ai-plan' | 'heuristic-plan' | 'none'; // D210
}

export const LINE_COUNT_TO_PANEL_COUNT = (n: number): 1 | 2 | 3 | 4 => {
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 3) return 3;
  return 4;
};
