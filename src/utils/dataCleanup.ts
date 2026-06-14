
import { Show } from "../types/models";
import { RosterChange, StructuralChange, ProseChange, PlaceholderHit, RepairEntry, RepairDoubleAtResult } from "../types/dataCleanup";

/**
 * Show data cleanup operations.
 *
 * Each operation returns a preview + apply pair.
 * Operations are pure: they do not mutate the input show.
 * Apply produces a deep-cloned, mutated copy.
 *
 * Operations never touch log fields (generationLog,
 * textGenerationLog, generationLog[*].parts).
 */

const HANDLE_RE = /@[a-zA-Z0-9]+\.[a-zA-Z0-9]+/g;

// Field paths that contain log data — never touched by cleanup.
const LOG_FIELD_KEYS = new Set([
  'generationLog', 'textGenerationLog',
]);

// Canonical handle format: @SHOWCODE.PascalCase
export function canonicalize(
  rawName: string,
  showCode: string
): string {
  // Strip non-alphanumerics, PascalCase
  const pascal = rawName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(s => s[0].toUpperCase() + s.slice(1).toLowerCase())
    .join('');
  return `@${showCode.toLowerCase()}.${pascal}`;
}

// =================================================================
// Operation 1: Normalize Roster
// =================================================================

export function previewNormalizeRoster(
  show: Show,
  showCode: string
): RosterChange[] {
  const standardChanges: RosterChange[] = (show.characters ?? []).map(c => {
    const oldHandle = c.handle ?? '';
    const expected = canonicalize(c.name ?? '', showCode);
    let result: RosterChange;
    if (oldHandle === expected) {
      result = {
        characterId: c.id,
        oldHandle, newHandle: expected,
        reason: 'no-change',
        needsManualReview: false,
      };
    } else if (oldHandle.toLowerCase().includes('firstname') ||
        oldHandle.toLowerCase().includes('charactername')) {
      result = {
        characterId: c.id,
        oldHandle, newHandle: expected,
        reason: 'template-placeholder',
        needsManualReview: true,
      };
    } else if (oldHandle.match(/^@[a-z]+\./i)) {
      result = {
        characterId: c.id,
        oldHandle, newHandle: expected,
        reason: 'old-prefix',
        needsManualReview: false,
      };
    } else {
      result = {
        characterId: c.id,
        oldHandle, newHandle: expected,
        reason: 'no-prefix',
        needsManualReview: false,
      };
    }

    if (result.reason !== 'no-change' && result.newHandle === result.oldHandle) {
      result.reason = 'no-change';
      result.needsManualReview = false;
    }
    return result;
  });

  // D320: Second pass to scan for casing duplicates within the roster itself.
  const seenLowercase = new Map<string, { id: string, handle: string }>();
  const casingDuplicates: RosterChange[] = [];

  for (const c of show.characters ?? []) {
    if (!c.handle) continue;
    const lower = c.handle.toLowerCase();
    const previous = seenLowercase.get(lower);
    if (previous && previous.id !== c.id) {
      // Found two roster entries whose handles differ only by case.
      casingDuplicates.push({
        characterId: c.id,
        oldHandle: c.handle,
        newHandle: previous.handle,
        reason: 'casing-duplicate',
        needsManualReview: true,
        duplicateOf: previous.id,
      });
    } else {
      seenLowercase.set(lower, { id: c.id, handle: c.handle });
    }
  }

  return [...standardChanges, ...casingDuplicates];
}

export function applyNormalizeRoster(
  show: Show,
  changes: RosterChange[]
): Show {
  // Apply only changes the user did not flag for manual review, is not 'no-change', and where newHandle !== oldHandle.
  const applicable = changes.filter(
    c => !c.needsManualReview
      && c.reason !== 'no-change'
      && c.newHandle !== c.oldHandle
  );
  const next = structuredClone(show);
  for (const ch of applicable) {
    const target = next.characters?.find(c => c.id === ch.characterId);
    if (target) target.handle = ch.newHandle;
  }
  return next;
}

// =================================================================
// Operation 2: Normalize Structural References
// =================================================================

export function buildHandleMapping(
  show: Show
): Map<string, string> {
  // Map case-insensitive name portion → canonical handle.
  const mapping = new Map<string, string>();
  for (const c of show.characters ?? []) {
    const handle = c.handle ?? '';
    const dotIdx = handle.indexOf('.');
    if (dotIdx > 0) {
      const namePart = handle.slice(dotIdx + 1).toLowerCase();
      mapping.set(namePart, handle);
    }
  }
  return mapping;
}

// CATEGORY A field path keys — these get handle replacement.
const STRUCTURAL_FIELD_KEYS = new Set([
  // Per A24 audit. All keys here contain handles by design.
  'characterHandle',  // script.lines, script.entries, overlays, captions, panel.captions
  'speakerHandle',    // panel.balloons, plan.panels.balloons
  'characterIds',     // beat.characterIds
  'characterNames',   // beat.characterNames (misnamed — historically holds handles)
  'char1',            // episodePairings
  'char2',            // episodePairings
]);

export function previewNormalizeStructural(
  show: Show
): StructuralChange[] {
  const mapping = buildHandleMapping(show);
  const changes: StructuralChange[] = [];
  walkStructural(show, 'show', (path, value) => {
    const newValue = remapHandle(value, mapping);
    if (newValue && newValue !== value)
      changes.push({ path, oldValue: value, newValue });
  });
  return changes;
}

function remapHandle(
  raw: string,
  mapping: Map<string, string>
): string | null {
  const m = raw.match(/^@[a-zA-Z0-9]+\.([a-zA-Z0-9]+)$/);
  if (!m) return null;
  const namePart = m[1].toLowerCase();
  return mapping.get(namePart) ?? null;
}

function walkStructural(
  obj: any,
  path: string,
  visit: (path: string, value: string) => void
): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) =>
      walkStructural(item, `${path}[${i}]`, visit));
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (LOG_FIELD_KEYS.has(key)) continue;
      const nextPath = `${path}.${key}`;
      if (STRUCTURAL_FIELD_KEYS.has(key)) {
        if (typeof value === 'string') {
          visit(nextPath, value);
        } else if (Array.isArray(value)) {
          value.forEach((v, i) => {
            if (typeof v === 'string')
              visit(`${nextPath}[${i}]`, v);
          });
        }
      } else {
        walkStructural(value, nextPath, visit);
      }
    }
  }
}

export function applyNormalizeStructural(
  show: Show, changes: StructuralChange[]
): Show {
  const next = structuredClone(show);
  for (const c of changes) {
    setByPath(next, c.path.replace(/^show\./, ''), c.newValue);
  }
  return next;
}

function setByPath(obj: any, path: string, value: any) {
  const tokens = path.match(/[^.[\]]+/g) ?? [];
  let cur = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const nextToken = tokens[i];
    if (cur[nextToken] === undefined) return; // Path might have changed
    cur = cur[nextToken];
  }
  const lastToken = tokens[tokens.length - 1];
  cur[lastToken] = value;
}

// =================================================================
// Operation 3: Resolve Prose Handles to Names
// =================================================================

/**
 * D323: Build two indexes for tolerant prose lookup.
 *   exact:  full-handle string -> name (fastest path)
 *   byName: lowercased name-part -> name (case-insensitive,
 *           also tolerates old/mismatched prefix like @starsplit.*)
 */
function buildHandleToNameMapping(
  show: Show
): { exact: Map<string, string>; byName: Map<string, string> } {
  const exact = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of show.characters ?? []) {
    if (!c.name) continue;
    if (c.handle) {
      exact.set(c.handle, c.name);
      const dotIdx = c.handle.indexOf('.');
      if (dotIdx >= 0) {
        const namePart = c.handle.slice(dotIdx + 1).toLowerCase();
        byName.set(namePart, c.name);
      }
    }
  }
  return { exact, byName };
}

function resolveHandleToName(
  handle: string,
  maps: { exact: Map<string, string>; byName: Map<string, string> }
): string | undefined {
  const hit = maps.exact.get(handle);
  if (hit) return hit;
  const m = handle.match(/^@[a-zA-Z0-9]+\.([a-zA-Z0-9]+)$/);
  if (!m) return undefined;
  return maps.byName.get(m[1].toLowerCase());
}

export function previewResolveProse(
  show: Show
): ProseChange[] {
  const maps = buildHandleToNameMapping(show);
  const changes: ProseChange[] = [];
  walkProse(show, 'show', (path, value) => {
    const handles = value.match(HANDLE_RE) ?? [];
    if (handles.length === 0) return;
    const unresolved: string[] = [];
    let next = value;
    for (const h of handles) {
      const name = resolveHandleToName(h, maps);
      if (name) {
        next = next.split(h).join(name);
      } else {
        if (!unresolved.includes(h)) unresolved.push(h);
      }
    }
    if (next !== value)
      changes.push({
        path, before: value, after: next,
        unresolvedHandles: unresolved,
      });
  });
  return changes;
}

const PROSE_FIELD_KEYS = new Set([
  // Show-level
  'premise', 'richInput',
  // Season/episode/act/scene
  'description', 'summary', 'aStory', 'bStory',
  'dramaticWant',
  // Beat-level prose
  'direction', 'visualDescription', 'subtext',
  'groundingEnsemble',
  // Beat panelPlans prose
  'action', 'shotType',
  // Beat script entries/lines
  'parenthetical',
  // Character
  'physicalDescription', 'voiceProfile', 'voiceConstraints',
  'evolution',
  // Comic gallery prose
  'panelPrompt', 'generationPrompt',
  'assembledPrompt', 'beatSummary',
]);

function walkProse(
  obj: any,
  path: string,
  visit: (path: string, value: string) => void
): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) =>
      walkProse(item, `${path}[${i}]`, visit));
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (LOG_FIELD_KEYS.has(key)) continue;
      const nextPath = `${path}.${key}`;
      if (PROSE_FIELD_KEYS.has(key) && typeof value === 'string') {
        visit(nextPath, value);
      } else {
        walkProse(value, nextPath, visit);
      }
    }
  }
}

export function applyResolveProse(
  show: Show, changes: ProseChange[]
): Show {
  const next = structuredClone(show);
  for (const c of changes) {
    setByPath(next, c.path.replace(/^show\./, ''), c.after);
  }
  return next;
}

// =================================================================
// Operation 4: Surface Template Placeholders
// =================================================================

const PLACEHOLDER_RE =
  /@(show|SHOWCODE)\.[a-zA-Z]+|@[a-zA-Z0-9]+\.(charactername|firstname)/g;

export function findTemplatePlaceholders(
  show: Show
): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  walkProse(show, 'show', (path, value) => {
    const matches = value.match(PLACEHOLDER_RE);
    if (matches) hits.push({
      path, value, placeholders: Array.from(new Set(matches)),
    });
  });
  walkStructural(show, 'show', (path, value) => {
    const matches = value.match(PLACEHOLDER_RE);
    if (matches) hits.push({
      path, value, placeholders: Array.from(new Set(matches)),
    });
  });
  return hits;
}

/**
 * Diagnostic: walk the show and return all paths visited
 * by walkStructural + walkProse. Used to verify D298 coverage
 * by comparing against A24's catalog.
 */
export function auditWalkerCoverage(
  show: Show
): {
  structuralPaths: string[];
  proseFields: string[];
  unvisitedStringFields: string[];
} {
  const structuralPaths: string[] = [];
  const proseFields: string[] = [];
  const allStringNodes: { path: string; value: string }[] = [];

  walkStructural(show, 'show', (path, _value) => {
    structuralPaths.push(path);
  });
  walkProse(show, 'show', (path, _value) => {
    proseFields.push(path);
  });

  // Walk the entire show and find all string fields,
  // including those NOT visited by structural or prose walkers.
  function walkAll(obj: any, path: string, inLog: boolean) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'string') {
      if (!inLog) allStringNodes.push({ path, value: obj });
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) =>
        walkAll(item, `${path}[${i}]`, inLog));
      return;
    }
    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const nextInLog = inLog || LOG_FIELD_KEYS.has(key);
        walkAll(value, `${path}.${key}`, nextInLog);
      }
    }
  }
  walkAll(show, 'show', false);

  // Find paths visited by allStringNodes but not by
  // either structural or prose walkers.
  const visited = new Set([...structuralPaths, ...proseFields]);
  const unvisitedWithHandles = allStringNodes
    .filter(node => !visited.has(node.path) && HANDLE_RE.test(node.value))
    .map(node => node.path);

  return {
    structuralPaths: dedupe(structuralPaths),
    proseFields: dedupe(proseFields),
    unvisitedStringFields: unvisitedWithHandles,
  };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// =================================================================
// Operation 5: Repair Double-@ Handles
// =================================================================

export function previewRepairDoubleAt(
  show: Show
): RepairDoubleAtResult {
  const rosterRepairs: RepairEntry[] = [];
  for (const c of show.characters ?? []) {
    const oldHandle = c.handle ?? '';
    if (oldHandle.startsWith('@@')) {
      rosterRepairs.push({
        characterId: c.id,
        oldHandle,
        newHandle: oldHandle.replace(/^@@/, '@'),
      });
    }
  }

  const structuralRepairs: StructuralChange[] = [];
  walkStructural(show, 'show', (path, value) => {
    if (value.startsWith('@@')) {
      structuralRepairs.push({
        path,
        oldValue: value,
        newValue: value.replace(/^@@/, '@'),
      });
    }
  });

  return { rosterRepairs, structuralRepairs };
}

export function applyRepairDoubleAt(
  show: Show,
  result: RepairDoubleAtResult
): Show {
  const next = structuredClone(show);
  for (const r of result.rosterRepairs) {
    const target = next.characters?.find(c => c.id === r.characterId);
    if (target) {
      target.handle = r.newHandle;
    }
  }
  for (const s of result.structuralRepairs) {
    setByPath(next, s.path.replace(/^show\./, ''), s.newValue);
  }
  return next;
}
