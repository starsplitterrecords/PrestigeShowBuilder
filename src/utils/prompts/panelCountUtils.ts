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
  foreground?: string;
  midground?: string;
  background?: string;
  relationalStaging?: string;
  directAddress?: boolean;
  primarySpeaker?: string;  // visual description of the character to frame
  captions?: CaptionEntry[];
  balloons: {
    speakerHandle: string;
    text: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  }[];
  panelPrompt: string;      // specific prompt for this panel
  characterPositions?: CharacterPosition[];
}

export interface ComicPagePlan {
  beatFid: string;
  panelCount: 1 | 2 | 3 | 4 | 5 | 6;
  layoutName: string;
  panels: PanelPlan[];
  generationPrompt: string;  // @deprecated
  fallbacks?: string[];
  panelPlanSource?: 'ai-plan' | 'heuristic-plan' | 'none';
}

export const LINE_COUNT_TO_PANEL_COUNT = (n: number): 1 | 2 | 3 | 4 => {
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 3) return 3;
  return 4;
};
