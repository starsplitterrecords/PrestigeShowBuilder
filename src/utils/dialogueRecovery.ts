import { openDB } from '../storage/db';
import type { Show } from '../types/show';
import type { Character } from '../types/character';
 
// DA-108: Dialogue Speaker Recovery
//
// Background: a number of shows (confirmed first on Backyard Rockets) have
// production dialogue lines stuck on the literal placeholder handle
// "UNKNOWN" — the speaker attribution was lost somewhere between the 0.9W
// (Writing) pass and final promotion into production. Traced and confirmed:
// the 0.9W pass's own output, captured as 'scene_script' artifacts in
// psb4_artifacts, already has 100% correct per-line characterHandle values
// in the form "@<characterId>". The dialogue TEXT itself survived promotion
// unchanged even where the handle didn't — so matching a broken production
// line's text against the original scene_script text recovers the real
// speaker without generating anything new.
//
// This module only finds and proposes matches. It does not write anything —
// the caller (DialogueRecoveryModal) shows the proposal to the user and
// writes only after explicit confirmation.
 
export interface RecoveryMatch {
  pageBeatUid: string;
  pageAddress: string;
  lineFid: string;
  lineText: string;
  currentHandle: string;
  proposedCharacterId: string | null;
  proposedCharacterName: string | null;
  proposedHandle: string | null;
  status: 'matched' | 'ambiguous' | 'no_match';
  ambiguousHandles?: string[];
}
 
const normalizeText = (s: string): string =>
  (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
 
const isUnresolvedHandle = (raw: string | undefined | null): boolean => {
  const h = (raw || '').trim().toLowerCase();
  return !h || h === 'unknown' || h === '@unknown';
};
 
async function fetchSceneScriptArtifacts(showId: string): Promise<any[]> {
  const db = await openDB();
  if (!db.objectStoreNames.contains('psb4_artifacts')) return [];
  const all: any[] = await new Promise((resolve, reject) => {
    const tx = db.transaction('psb4_artifacts', 'readonly');
    const req = tx.objectStore('psb4_artifacts').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  return all.filter(a => a.showId === showId && a.artifactType === 'scene_script');
}
 
// Maps normalized line text -> set of raw characterHandle values ("@<id>")
// seen for that exact text across every captured scene_script artifact.
function buildLineIndex(artifacts: any[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const art of artifacts) {
    const scenes = art.payload?.scenes ?? [];
    for (const sc of scenes) {
      for (const line of sc.script ?? []) {
        if (line.kind !== 'line' || !line.text || !line.characterHandle) continue;
        const key = normalizeText(line.text);
        if (!key) continue;
        if (!index.has(key)) index.set(key, new Set());
        index.get(key)!.add(line.characterHandle);
      }
    }
  }
  return index;
}
 
// 0.9W writes handles as "@<characterId>" — direct ID lookup, not the
// @show.Name convention used elsewhere in the app.
function resolveRawHandleToCharacter(show: Show, rawHandle: string): Character | null {
  const id = rawHandle.replace(/^@/, '').trim();
  return (show.characters ?? []).find(c => c.id === id) ?? null;
}
 
export async function findDialogueRecoveryMatches(show: Show): Promise<RecoveryMatch[]> {
  const artifacts = await fetchSceneScriptArtifacts(show.id);
  const index = buildLineIndex(artifacts);
  const matches: RecoveryMatch[] = [];
 
  for (const iss of show.issues ?? []) {
    for (const act of iss.acts ?? []) {
      for (const sc of act.scenes ?? []) {
        for (const pb of sc.pageBeats ?? []) {
          const script: any = pb.script || {};
          const entries: any[] = script.entries?.length ? script.entries : (script.lines ?? []);
          for (const line of entries) {
            if (line.kind === 'caption') continue;
            if (!isUnresolvedHandle(line.characterHandle)) continue;
 
            const key = normalizeText(line.text);
            const candidates = key ? index.get(key) : undefined;
 
            if (!candidates || candidates.size === 0) {
              matches.push({
                pageBeatUid: pb.uid, pageAddress: pb.address, lineFid: line.fid,
                lineText: line.text, currentHandle: line.characterHandle || '(blank)',
                proposedCharacterId: null, proposedCharacterName: null, proposedHandle: null,
                status: 'no_match',
              });
              continue;
            }
 
            if (candidates.size > 1) {
              matches.push({
                pageBeatUid: pb.uid, pageAddress: pb.address, lineFid: line.fid,
                lineText: line.text, currentHandle: line.characterHandle || '(blank)',
                proposedCharacterId: null, proposedCharacterName: null, proposedHandle: null,
                status: 'ambiguous',
                ambiguousHandles: Array.from(candidates),
              });
              continue;
            }
 
            const rawHandle = Array.from(candidates)[0];
            const char = resolveRawHandleToCharacter(show, rawHandle);
            matches.push({
              pageBeatUid: pb.uid, pageAddress: pb.address, lineFid: line.fid,
              lineText: line.text, currentHandle: line.characterHandle || '(blank)',
              proposedCharacterId: char?.id ?? null,
              proposedCharacterName: char?.name ?? rawHandle,
              proposedHandle: char ? (char.handle || `@${char.id}`) : rawHandle,
              status: char ? 'matched' : 'no_match',
            });
          }
        }
      }
    }
  }
  return matches;
}
