import type { PanelZone, PanelDepth } from './comic';

export interface Character {
  id: string;
  fid?: string;
  name: string;
  handle: string;
  role: string;
  physicalDescription: string;
  visualAnchor?: string;
  identifyingFeature?: string;  // D300
  voiceProfile?: string;
  voiceRule?: string;        // one hard constraint sentence extracted from voiceProfile
  castingNotes?: string;
  evolution?: string;
  summary?: string;
  isMinor?: boolean;
  isProtagonist?: boolean;   // present-day frame character who experiences the show's mechanism
  memoryBleedPalette?: string;     // Short color description for the watercolor wash of this character's memory bleeds.
  voiceConstraints?: string;   // How they say things: phrases, idiosyncrasies, etc.
  portraitAssetId?: string;
  visualAnchorAssetId?: string; // Add for backward compatibility or if used in some places
  captionColor?: string;  // D106: CSS color for internal monologue captions (e.g. '#8B4513')
  voiceCard?: string;        // D267: short dialogue-relevant excerpt
  voiceCardStale?: boolean;  // D267: flagged true when voiceProfile changes
}

/**
 * CharacterArcLane — D125
 * One character's full season arc, extracted from the season arc description.
 * Covers the character's want, need, lie, pressure point, breaking point,
 * and final choice as the author specified them in the season arc.
 */
export interface CharacterArcLane {
  handle: string;        // e.g. '@ech.theo'
  want?: string;         // what they consciously pursue
  need?: string;         // what they actually require
  lie?: string;          // the false belief driving their want
  pressure?: string;     // how the arc applies force to this character
  breakingPoint?: string;// the moment of maximum crisis
  finalChoice?: string;  // the irreversible decision at the end
}

export interface CharacterPhilosophy {
  handle: string;       // character handle e.g. "@ech.starbreaker"
  faction?: string;     // faction name e.g. "Vanguard" or "Concordant"
  philosophy: string;   // one sentence: what this character embodies/represents
}

/**
 * EpisodePairing — D125
 * A recurring character pairing at a structural beat position.
 * Extracted from the 'Episode Beat Template' section of the season arc.
 * Used to ensure non-core characters appear throughout the season,
 * not only in their 'assigned' episode.
 */
export interface EpisodePairing {
  position: string;   // e.g. 'Cold open', 'Complication', 'Confrontation'
  char1: string;      // handle of first character
  char2: string;      // handle of second character
}

export interface CharacterPosition {
  characterHandle: string;  // e.g. "@vik.bjorn"
  zone: PanelZone;
  depth: PanelDepth;
  facing?: 'left' | 'right' | 'forward' | 'away' | 'up' | 'down';
  // DA-042 — directed expression/relationship (VPS-populated).
  bodyLanguage?: string;
  facialExpression?: string;
  inResponseTo?: string;    // what this character reacts to in-panel
}
