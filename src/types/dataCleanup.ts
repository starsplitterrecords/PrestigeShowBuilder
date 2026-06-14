
import { Character } from "./models";

export type Operation = 'roster' | 'structural' | 'prose' | 'placeholders' | 'repair-double-at';

export interface RepairEntry {
  characterId: string;
  oldHandle: string;
  newHandle: string;
}

export interface RepairDoubleAtResult {
  rosterRepairs: RepairEntry[];
  structuralRepairs: StructuralChange[];
}

export interface RosterChange {
  characterId: string;
  oldHandle: string;
  newHandle: string;
  reason: 'old-prefix' | 'no-prefix' | 'case' | 'template-placeholder' | 'no-change' | 'casing-duplicate';
  needsManualReview: boolean;
  duplicateOf?: string;
}

export interface StructuralChange {
  path: string;
  oldValue: string;
  newValue: string;
}

export interface ProseChange {
  path: string;
  before: string;
  after: string;
  unresolvedHandles: string[];
}

export interface PlaceholderHit {
  path: string;
  value: string;
  placeholders: string[];
}
