import { UID } from '../types/production';

export enum VpsRecordType {
  ENVIRONMENT_DESIGN = 'environment_design',  // DA-040
  PAGE_DIRECTION = 'page_direction',          // DA-041
}

export type VpsPhase = 'environment' | 'page_direction' | 'done' | null;
export type VpsProgressStatus =
  'pending' | 'running' | 'complete' | 'failed';

export interface VpsRun {
  id: string;                  // ULID, primary key
  showId: string;
  issueUid: UID;               // the promoted Issue this run plans
  status: 'active' | 'completed' | 'abandoned' | 'failed';
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  currentPhase: VpsPhase;
  currentPass: string | null;
  phaseProgress: {
    environment: VpsProgressStatus;
    page_direction: VpsProgressStatus;
  };
  schemaVersion: 1;
}

// Reviewable result of a VPS pass. Does not touch production data
// until applied. scopeKey identifies which slice of the issue it covers:
//   environment_design → null (issue-wide)
//   page_direction     → the ProductionPage uid (DA-041)
export interface VpsRecord {
  id: string;                  // ULID, primary key
  runId: string;               // FK → vps_runs
  showId: string;
  issueUid: UID;
  recordType: VpsRecordType;
  scopeKey: string | null;
  payload: any;
  payloadVersion: number;
  createdAt: number;
  createdByPass: string;
  consoleEntryId: string | null;
  // Review state
  authorEdited: boolean;
  authorEditedAt: number | null;
  // Apply state — the explicit commit onto production data
  applied: boolean;
  appliedAt: number | null;
  supersedesRecordId: string | null;
  // DA-045 — set when an upstream change invalidates this record.
  stale: boolean;
  staleReason: string | null;  // 'content-changed' | 'environment-reapplied'
  schemaVersion: 1;
}

// VPS pass spec — sibling of PassSpec, adapted to issue/page scope.
export interface VpsPassSpec {
  id: string;
  phase: VpsPhase;
  name: string;
  description: string;
  // 'issue' → one model call over the whole issue (settings are few)
  // 'page'  → one model call per page, threaded with history (DA-041)
  scope: 'issue' | 'page';
  promptTemplateId: string;
  parserId: string;
  outputRecordType: VpsRecordType;
  outputPayloadVersion: number;
  defaultModel: 'gemini-pro' | 'gemini-flash';
  defaultTemperature: number;
}

// ---- Payloads ----

// DA-040 output. One entry per DISTINCT setting in the issue.
export interface EnvironmentDesignPayload {
  environments: Array<{
    settingName: string;          // matches ProductionScene.setting
    settingAnchorId?: string;     // resolved anchor id if one exists
    source: 'reused' | 'generated';
    visualDescription: string;    // image-ready: architecture,
      // materials, light character, spatial layout, lived-in detail
    mood: string;
    interiorExterior: 'interior' | 'exterior' | 'mixed';
  }>;
}

// DA-041 output. One record per page.
export interface PageDirectionPayload {
  pageRegister: {
    lighting: string;      // scene light: source, colour, hardness
    mood: string;          // emotional atmosphere of this page
    emotionalRegister: string;  // the beat's dramatic temperature
    environmentalDetail: 'sparse' | 'moderate' | 'rich';
  };
  // DA-047 — how the panels are arranged on the page.
  pageComposition: {
    layoutName: string;      // a name from the valid set for panelCount
    focalPanelIndex: number; // 0-based; the panel that dominates
    isSplash: boolean;       // single full-page image
    compositionNote: string; // why this arrangement serves the beat
  };
  panels: Array<{
    shotType: string;      // 'extreme close-up', 'two-shot', 'wide'…
    action: string;        // what happens in this panel
    foreground: string;
    midground: string;
    background: string;
    // How the characters occupy the frame TOGETHER.
    relationalStaging: string;
    blocking: Array<{
      handle: string;
      zone: string;        // 9-zone label; coerced at apply
      depth: 'foreground' | 'midground' | 'background';
      facing: string;      // free text; coerced to enum at apply
      bodyLanguage: string;
      facialExpression: string;
      inResponseTo: string; // what this character is reacting to
    }>;
    dialogueIndices: number[]; // 0-based into PageBeat.script.entries
    captionIndices: number[];
    directAddress: boolean;
    directAddressRationale?: string;  // required when true
    props: Array<{ label: string; description: string }>;
  }>;
}
