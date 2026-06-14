import { openDB } from '../storage/db';
import { 
  Psb4Run, 
  Psb4Artifact, 
  Psb4Corpus, 
  ArtifactType, 
  ArtifactInput, 
  CorpusInput, 
  Psb4Phase, 
  Psb4ProgressStatus,
  Psb4ConsoleEntry,
  NormalizedSource,
  ConversationTurn
} from './types';
import { Psb4InvariantError } from './errors';
import { migrateIfNeeded } from './migrations';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { stripUndefined as firestoreSanitize } from '../storage/firestoreSanitize';

type Psb4Source = NormalizedSource;

// Helper to generate a unique string ID
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function enforceRunInvariants(run: Psb4Run): Psb4Run {
  if (run.status === 'hydrating') {
    return run;
  }

  if (run.currentPhase === 'done') {
    run.status = 'completed';
  }

  if (run.status === 'completed') {
    if (!run.completedAt) {
      run.completedAt = run.updatedAt || Date.now();
    }
  }

  if (run.status === 'active') {
    if (run.currentPhase === 'done') {
      run.status = 'completed';
      if (!run.completedAt) {
        run.completedAt = run.updatedAt || Date.now();
      }
    } else if (run.currentPass) {
      const passId = run.currentPass;
      if (['0.0', '0.1', '0.2', '0.3', '0.4', '0.5'].includes(passId)) {
        run.currentPhase = 'reduction';
      } else if (['0.8A', '0.8RA', '0.8R'].includes(passId)) {
        run.currentPhase = 'arc_lock';
      } else if (['0.9S', '0.9W', '0.9G', '12D'].includes(passId)) {
        run.currentPhase = 'rebuild';
      } else if (['9', '12L'].includes(passId)) {
        run.currentPhase = 'enrichment';
      }
    } else {
      if (!run.currentPhase) {
        run.currentPhase = 'reduction';
      }
    }
  }

  if (run.status === 'failed') {
    if (!(run as any).failureReason) {
      (run as any).failureReason = 'Run execution failed due to a pipeline pass error.';
    }
  }

  return run;
}

// ----------------------------------------------------------------------------
// STORAGE MODE & QUOTA STATE ACCESSORS
// ----------------------------------------------------------------------------

export type StorageMode = 'cloud' | 'local';

export function getStorageMode(): StorageMode {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('psb4_storage_mode');
    return (saved === 'local') ? 'local' : 'cloud';
  }
  return 'cloud';
}

export function setStorageMode(mode: StorageMode) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('psb4_storage_mode', mode);
    window.dispatchEvent(new Event('psb4_storage_mode_changed'));
  }
}

export function isFirestoreQuotaExhausted(): boolean {
  if (typeof window !== 'undefined') {
    return !!(window as any).__firestore_write_quota_exhausted__;
  }
  return false;
}

export function setFirestoreQuotaExhausted(val: boolean) {
  if (typeof window !== 'undefined') {
    (window as any).__firestore_write_quota_exhausted__ = val;
    window.dispatchEvent(new Event('psb4_firestore_quota_exhausted_changed'));
  }
}

// In-memory caches to deduplicate writes
const prevSyncRuns = new Map<string, string>();
const prevSyncArtifacts = new Map<string, string>();
const prevSyncCorpus = new Map<string, string>();
const prevSyncConsoleEntries = new Map<string, string>();
const prevSyncSources = new Map<string, string>();

// Throttling maps
const lastSyncTimes = new Map<string, number>();
const lastSyncStatus = new Map<string, string>();

// Flame-and-forget dummy Firebase sync stubs (implementations added in later directives)
async function syncRunToCloud(
  run: Psb4Run
): Promise<void> {
  if (getStorageMode() === 'local') return;
  if (isFirestoreQuotaExhausted()) return;

  const runKey = run.id;
  const serialized = JSON.stringify(firestoreSanitize(run));
  if (prevSyncRuns.get(runKey) === serialized) {
    return;
  }
  prevSyncRuns.set(runKey, serialized);

  // Throttling non-critical updates (heartbeat, updatedAt) to 10 seconds minimum
  const now = Date.now();
  const lastTime = lastSyncTimes.get(`run:${run.id}`) || 0;
  const statusChanged = run.status !== lastSyncStatus.get(run.id);

  if (statusChanged) {
    lastSyncStatus.set(run.id, run.status);
  } else {
    if (now - lastTime < 10000) {
      return;
    }
  }
  lastSyncTimes.set(`run:${run.id}`, now);

  const ref = doc(db, 'psb4', run.showId,
    'runs', run.id);
  await setDoc(ref, firestoreSanitize(run), { merge: true }).catch((err) => {
    handleFirestoreError(err, OperationType.WRITE, `psb4/${run.showId}/runs/${run.id}`);
  });
}

async function syncArtifactToCloud(
  artifact: Psb4Artifact
): Promise<void> {
  if (getStorageMode() === 'local') return;
  if (isFirestoreQuotaExhausted()) return;

  const artKey = artifact.id;
  const serialized = JSON.stringify(firestoreSanitize(artifact));
  if (prevSyncArtifacts.get(artKey) === serialized) {
    return;
  }
  prevSyncArtifacts.set(artKey, serialized);

  const ref = doc(db, 'psb4', artifact.showId,
    'artifacts', artifact.id);
  await setDoc(ref, firestoreSanitize(artifact), { merge: true }).catch((err) => {
    handleFirestoreError(err, OperationType.WRITE, `psb4/${artifact.showId}/artifacts/${artifact.id}`);
  });
}

async function syncCorpusToCloud(
  corpus: Psb4Corpus
): Promise<void> {
  if (getStorageMode() === 'local') return;
  if (isFirestoreQuotaExhausted()) return;

  const corpKey = corpus.id;
  const serialized = JSON.stringify(firestoreSanitize(corpus));
  if (prevSyncCorpus.get(corpKey) === serialized) {
    return;
  }
  prevSyncCorpus.set(corpKey, serialized);

  const ref = doc(db, 'psb4', corpus.showId,
    'corpus', corpus.id);
  await setDoc(ref, firestoreSanitize(corpus), { merge: true }).catch((err) => {
    handleFirestoreError(err, OperationType.WRITE, `psb4/${corpus.showId}/corpus/${corpus.id}`);
  });
}

async function syncConsoleEntryToCloud(
  entry: Psb4ConsoleEntry
): Promise<void> {
  // Disable Firestore-backed debug logging by default.
  // Console/debug entries are saved locally via IDB.
  if (getStorageMode() === 'local' || !localStorage.getItem('psb4_enable_cloud_console_logging')) {
    return;
  }
  if (isFirestoreQuotaExhausted()) return;

  const entryKey = entry.id;
  const serialized = JSON.stringify(firestoreSanitize(entry));
  if (prevSyncConsoleEntries.get(entryKey) === serialized) {
    return;
  }
  prevSyncConsoleEntries.set(entryKey, serialized);

  const ref = doc(db, 'psb4', entry.showId,
    'console', entry.id);
  await setDoc(ref, firestoreSanitize(entry), { merge: true }).catch((err) => {
    handleFirestoreError(err, OperationType.WRITE, `psb4/${entry.showId}/console/${entry.id}`);
  });
}

async function syncSourceToCloud(
  source: Psb4Source
): Promise<void> {
  if (getStorageMode() === 'local') return;
  if (isFirestoreQuotaExhausted()) return;

  const srcKey = source.id;
  const serialized = JSON.stringify(firestoreSanitize(source));
  if (prevSyncSources.get(srcKey) === serialized) {
    return;
  }
  prevSyncSources.set(srcKey, serialized);

  const ref = doc(db, 'psb4', source.showId,
    'sources', source.id);
  await setDoc(ref, firestoreSanitize(source), { merge: mergeChecked(source) }).catch((err) => {
    handleFirestoreError(err, OperationType.WRITE, `psb4/${source.showId}/sources/${source.id}`);
  });
}

function mergeChecked(source: Psb4Source): any {
  return true;
}

async function writeRunToIDB(run: Psb4Run): Promise<void> {
  const dbLocal = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const req = store.put(run);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function writeArtifactToIDB(artifact: Psb4Artifact): Promise<void> {
  const dbLocal = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
    const store = tx.objectStore('psb4_artifacts');
    const req = store.put(artifact);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function restorePsb4FromCloud(
  showId: string
): Promise<void> {
  if (getStorageMode() === 'local') return;
  const localRuns = await listRuns(showId);
  if (localRuns.length > 0) return; // local data wins

  try {
    // Restore runs
    const runsSnap = await getDocs(
      collection(db, 'psb4', showId, 'runs')
    );
    for (const d of runsSnap.docs) {
      const run = d.data() as Psb4Run;
      await writeRunToIDB(run); // write directly, skip cloud sync
    }
    // Restore artifacts
    const artSnap = await getDocs(
      collection(db, 'psb4', showId, 'artifacts')
    );
    for (const d of artSnap.docs) {
      await writeArtifactToIDB(d.data() as Psb4Artifact);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET,
      `psb4/${showId}`);
  }
}

// ----------------------------------------------------------------------------
// RUNS ACCESSORS
// ----------------------------------------------------------------------------

export async function createRun(
  showId: string,
  sourceTeleplayHash: string,
  scopeIssueCount?: 4 | 6 | 8,
  scopeEpisodeIds?: string[]
): Promise<Psb4Run> {
  const dbLocal = await openDB();
  const RUN_STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  return new Promise<Psb4Run>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const index = store.index('by-show-status');
    const getReq = index.get([showId, 'active']);

    getReq.onsuccess = () => {
      const activeCheck = getReq.result;
      if (activeCheck) {
        const now = Date.now();
        const isStale = (now - activeCheck.updatedAt) > RUN_STALE_TIMEOUT_MS;

        console.log(
          `[ActiveRunCheck] showId: ${showId}, ` +
          `existing active run id: ${activeCheck.id}, ` +
          `existing run status: ${activeCheck.status}, ` +
          `updatedAt / heartbeat timestamp: ${activeCheck.updatedAt}, ` +
          `whether the run was blocked or recovered as stale: ${isStale ? 'recovered as stale' : 'blocked'}`
        );

        if (isStale) {
          // Recover: transition old run to 'failed'
          activeCheck.status = 'failed';
          activeCheck.updatedAt = now;
          if (!(activeCheck as any).failureReason) {
            (activeCheck as any).failureReason = 'Stale active run timeout: Recovered as failed.';
          }
          const putReq = store.put(activeCheck);
          putReq.onsuccess = () => {
            syncRunToCloud(activeCheck).catch((err) => {
              handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${activeCheck.id}`);
            });
            // Proceed with adding the new active run
            createNewActiveRun(now);
          };
          putReq.onerror = () => reject(putReq.error);
          return;
        } else {
          reject(
            new Psb4InvariantError(
              'DUPLICATE_ACTIVE_RUN',
              `An active run already exists for showId ${showId}.`
            )
          );
          return;
        }
      }

      createNewActiveRun(Date.now());

      function createNewActiveRun(nowMs: number) {
        const run: Psb4Run = {
          id: generateId(),
          showId,
          status: 'active',
          createdAt: nowMs,
          updatedAt: nowMs,
          completedAt: null,
          currentPhase: 'reduction',
          currentPass: '0.0',
          phaseProgress: {
            reduction: 'pending',
            arc_lock: 'pending',
            rebuild: 'pending',
            enrichment: 'pending',
          },
          sourceTeleplayHash,
          sourceCapturedAt: nowMs,
          preserved: false,
          overrides: {},
          scopeIssueCount,
          scopeEpisodeIds,
          schemaVersion: 1,
          hydrationStatus: 'complete',
        };

        const addReq = store.add(run);
        addReq.onsuccess = () => {
          // Fire-and-forget cloud replication
          syncRunToCloud(run).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
          });
          resolve(run);
        };
        addReq.onerror = () => reject(addReq.error);
      }
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getActiveRun(showId: string): Promise<Psb4Run | null> {
  const dbLocal = await openDB();
  const RUN_STALE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  return new Promise<Psb4Run | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readonly');
    const store = tx.objectStore('psb4_runs');
    const index = store.index('by-show-status');
    const getReq = index.get([showId, 'active']);

    getReq.onsuccess = () => {
      if (getReq.result) {
        const run = migrateIfNeeded(getReq.result, 1);
        if (run.status === 'abandoned') {
          resolve(null);
          return;
        }

        const now = Date.now();
        const isStale = (now - run.updatedAt) > RUN_STALE_TIMEOUT_MS;

        console.log(
          `[ActiveRunCheck getActiveRun] showId: ${showId}, ` +
          `existing active run id: ${run.id}, ` +
          `existing run status: ${run.status}, ` +
          `updatedAt / heartbeat timestamp: ${run.updatedAt}, ` +
          `whether the run was blocked or recovered as stale: ${isStale ? 'recovered as stale' : 'blocked'}`
        );

        if (isStale) {
          // Recover background
          resolve(null);
          failRun(run.id).catch((err) => {
            console.error('Failed to mark stale run as failed in background:', err);
          });
          return;
        }

        resolve(enforceRunInvariants(run));
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getRun(runId: string): Promise<Psb4Run | null> {
  const dbLocal = await openDB();

  return new Promise<Psb4Run | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readonly');
    const store = tx.objectStore('psb4_runs');
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve(enforceRunInvariants(migrateIfNeeded(getReq.result, 1)));
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function listRuns(showId: string): Promise<Psb4Run[]> {
  const dbLocal = await openDB();

  return new Promise<Psb4Run[]>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readonly');
    const store = tx.objectStore('psb4_runs');
    const index = store.index('by-show');
    const getAllReq = index.getAll(showId);

    getAllReq.onsuccess = () => {
      const results = (getAllReq.result || [])
        .map((r) => enforceRunInvariants(migrateIfNeeded(r, 1)));
      // order by createdAt desc
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function updateRunPhase(
  runId: string,
  phase: Psb4Phase,
  pass: string | null,
  status: Psb4ProgressStatus
): Promise<void> {
  const dbLocal = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run: Psb4Run | undefined = getReq.result;
      if (!run) {
        reject(new Error(`Run ${runId} not found`));
        return;
      }

      run.currentPhase = phase;
      run.currentPass = pass;
      run.updatedAt = Date.now();

      if (phase && phase !== 'done') {
        run.phaseProgress[phase] = status;
      }

      const putReq = store.put(run);
      putReq.onsuccess = () => {
        syncRunToCloud(run).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
        });
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function copyRunInputs(sourceRunId: string, forkId: string): Promise<void> {
  const sourceSource = await getSourceByRun(sourceRunId);
  if (sourceSource) {
    const newSource: NormalizedSource = {
      ...sourceSource,
      id: generateId(),
      runId: forkId,
      capturedAt: Date.now(),
    };
    await writeSource(newSource);
  }
}

export async function copyRunArtifacts(sourceRunId: string, forkId: string): Promise<void> {
  const dbLocal = await openDB();
  const artifacts = await getArtifactsByRun(sourceRunId);
  const now = Date.now();
  for (const art of artifacts) {
    const newArt: Psb4Artifact = {
      ...art,
      id: generateId(),
      runId: forkId,
      createdAt: now,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
      const store = tx.objectStore('psb4_artifacts');
      const req = store.put(newArt);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await syncArtifactToCloud(newArt);
  }
}

export async function copyRunConsoleContext(sourceRunId: string, forkId: string): Promise<void> {
  const dbLocal = await openDB();
  const entries = await listConsoleEntries(sourceRunId);
  const now = Date.now();
  for (const entry of entries) {
    const newEntry: Psb4ConsoleEntry = {
      ...entry,
      id: generateId(),
      runId: forkId,
      createdAt: now,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_console_entries', 'readwrite');
      const store = tx.objectStore('psb4_console_entries');
      const req = store.put(newEntry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await syncConsoleEntryToCloud(newEntry);
  }
}

export async function copyRunCheckpoints(sourceRunId: string, forkId: string): Promise<void> {
  const dbLocal = await openDB();
  const corpusList = await getCorpusByRun(sourceRunId);
  const now = Date.now();
  for (const corp of corpusList) {
    const newCorp: Psb4Corpus = {
      ...corp,
      id: generateId(),
      runId: forkId,
      createdAt: now,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_corpus', 'readwrite');
      const store = tx.objectStore('psb4_corpus');
      const req = store.put(newCorp);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await syncCorpusToCloud(newCorp);
  }
}

export async function verifyForkHydration(
  sourceRunId: string,
  forkId: string
): Promise<{ ok: boolean; missing: string[] }> {
  const sourceArtifacts = await getArtifactsByRun(sourceRunId);
  const forkArtifacts = await getArtifactsByRun(forkId);

  const sourceKeys = new Set(sourceArtifacts.map(a => `${a.artifactType}:${a.episodeId || 'null'}`));
  const forkKeys = new Set(forkArtifacts.map(a => `${a.artifactType}:${a.episodeId || 'null'}`));

  const missing: string[] = [];
  for (const key of sourceKeys) {
    if (!forkKeys.has(key)) {
      missing.push(key);
    }
  }

  const criticalTypes = [
    'regrounding_brief',
    'engine_read',
    'working_inventory',
    'repetition_diagnosis',
    'form_function_audit',
    'character_function_audit',
    'premise_cashout',
    'keep_cut_orders',
    'clean_spine',
    'arc_ladder',
    'issue_draft',
    'scene_structure',
    'scene_script',
  ];

  for (const type of criticalTypes) {
    const inSource = sourceArtifacts.some(a => a.artifactType === type);
    if (inSource) {
      const inFork = forkArtifacts.some(a => a.artifactType === type);
      if (!inFork) {
        missing.push(type);
      }
    }
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}

export async function markRunFailed(
  runId: string,
  details: { reason: string; missing?: string[] }
): Promise<void> {
  const dbLocal = await openDB();
  const run = await getRun(runId);
  if (run) {
    run.status = 'failed';
    (run as any).failureReason = `${details.reason}. Missing: ${details.missing ? details.missing.join(', ') : 'unknown'}`;
    run.updatedAt = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_runs', 'readwrite');
      const store = tx.objectStore('psb4_runs');
      const req = store.put(run);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await syncRunToCloud(run);
  }
}

export async function markRunActive(runId: string): Promise<void> {
  const dbLocal = await openDB();
  const run = await getRun(runId);
  if (run) {
    run.status = 'active';
    run.hydrationStatus = 'complete';
    run.updatedAt = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_runs', 'readwrite');
      const store = tx.objectStore('psb4_runs');
      const req = store.put(run);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await syncRunToCloud(run);
  }
}

export async function setShowActiveRunId(showId: string, runId: string): Promise<void> {
  const { ShowStorage } = await import('../storage/ShowStorage');
  const show = await ShowStorage.getById(showId);
  if (show) {
    show.activeRunId = runId;
    await ShowStorage.saveOne(show, true);
  }
}

export async function forkRunAtomically(showId: string, sourceRunId: string): Promise<Psb4Run> {
  const source = await getRun(sourceRunId);
  if (!source) {
    throw new Error(`Source run ${sourceRunId} not found`);
  }

  // 1. Clear any existing active run for the same show (transition to failed)
  const dbLocal = await openDB();
  const runs = await listRuns(showId);
  const activeRuns = runs.filter(r => r.status === 'active');
  const now = Date.now();

  for (const activeRun of activeRuns) {
    activeRun.status = 'failed';
    activeRun.updatedAt = now;
    if (!(activeRun as any).failureReason) {
      (activeRun as any).failureReason = 'Forked a new run: Recovered previous active run as failed.';
    }
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_runs', 'readwrite');
      const store = tx.objectStore('psb4_runs');
      const req = store.put(activeRun);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await syncRunToCloud(activeRun);
  }

  // 2. Create the fork in hydrating status
  const fork: Psb4Run = {
    id: generateId(),
    showId,
    status: 'hydrating',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    currentPhase: source.currentPhase || 'reduction',
    currentPass: source.currentPass || '0.0',
    phaseProgress: {
      reduction: source.phaseProgress.reduction || 'pending',
      arc_lock: source.phaseProgress.arc_lock || 'pending',
      rebuild: source.phaseProgress.rebuild || 'pending',
      enrichment: source.phaseProgress.enrichment || 'pending',
    },
    sourceTeleplayHash: source.sourceTeleplayHash,
    sourceCapturedAt: source.sourceCapturedAt || now,
    preserved: false,
    overrides: source.overrides ? { ...source.overrides } : {},
    scopeIssueCount: source.scopeIssueCount,
    scopeEpisodeIds: source.scopeEpisodeIds ? [...source.scopeEpisodeIds] : [],
    arcLockNotes: source.arcLockNotes,
    schemaVersion: 1,
    hydrationStatus: 'hydrating',
  };

  await new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const req = store.add(fork);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  await syncRunToCloud(fork);

  // 3. Copy components with progress reporting and batching/concurrency caps (Directive D185)
  const sourceSource = await getSourceByRun(sourceRunId);
  const artifacts = await getArtifactsByRun(sourceRunId);
  const entries = await listConsoleEntries(sourceRunId);
  const corpusList = await getCorpusByRun(sourceRunId);

  const total = (sourceSource ? 1 : 0) + artifacts.length + entries.length + corpusList.length;
  let copied = 0;

  const updateProgress = async (stage: string, stepCopied: number) => {
    copied += stepCopied;
    fork.hydrationProgress = {
      copied,
      total,
      stage
    };
    fork.updatedAt = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_runs', 'readwrite');
      const store = tx.objectStore('psb4_runs');
      const req = store.put(fork);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  };

  // Initialize progress
  await updateProgress('Initializing assets...', 0);

  // A. Copy inputs (source)
  if (sourceSource) {
    const newSource: NormalizedSource = {
      ...sourceSource,
      id: generateId(),
      runId: fork.id,
      capturedAt: Date.now(),
    };
    await writeSource(newSource);
    await updateProgress('Copying source teleplay...', 1);
  }

  // Batch processor to respect concurrency limits and backpressure rules (Directive D185)
  const batchSize = 10;
  const concurrentLimit = 5;

  async function processInBatches<T>(
    items: T[],
    stage: string,
    transformer: (item: T) => T,
    localSaver: (item: T) => Promise<void>,
    cloudSync: (item: T) => Promise<void>
  ) {
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const activePromises: Promise<void>[] = [];
      
      for (const item of chunk) {
        const newItem = transformer(item);
        const p = (async () => {
          await localSaver(newItem);
          await cloudSync(newItem);
        })();
        activePromises.push(p);

        if (activePromises.length >= concurrentLimit) {
          await Promise.all(activePromises);
          activePromises.length = 0;
        }
      }

      if (activePromises.length > 0) {
        await Promise.all(activePromises);
      }

      await updateProgress(stage, chunk.length);
      // Wait between chunks to let database operations breathe (backpressure)
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }

  // B. Copy artifacts
  await processInBatches(
    artifacts,
    'Copying pipeline artifacts...',
    (art) => ({
      ...art,
      id: generateId(),
      runId: fork.id,
      createdAt: now,
    }),
    async (newItem) => {
      await new Promise<void>((resolve, reject) => {
        const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
        const store = tx.objectStore('psb4_artifacts');
        const req = store.put(newItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async (newItem) => {
      await syncArtifactToCloud(newItem);
    }
  );

  // C. Copy debug console entries
  await processInBatches(
    entries,
    'Copying console entries...',
    (entry) => ({
      ...entry,
      id: generateId(),
      runId: fork.id,
      createdAt: now,
    }),
    async (newItem) => {
      await new Promise<void>((resolve, reject) => {
        const tx = dbLocal.transaction('psb4_console_entries', 'readwrite');
        const store = tx.objectStore('psb4_console_entries');
        const req = store.put(newItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async (newItem) => {
      await syncConsoleEntryToCloud(newItem);
    }
  );

  // D. Copy checkpoints (corpus)
  await processInBatches(
    corpusList,
    'Copying scene checkpoints...',
    (corp) => ({
      ...corp,
      id: generateId(),
      runId: fork.id,
      createdAt: now,
    }),
    async (newItem) => {
      await new Promise<void>((resolve, reject) => {
        const tx = dbLocal.transaction('psb4_corpus', 'readwrite');
        const store = tx.objectStore('psb4_corpus');
        const req = store.put(newItem);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async (newItem) => {
      await syncCorpusToCloud(newItem);
    }
  );

  // 4. Verify hydration manifest
  const manifest = await verifyForkHydration(sourceRunId, fork.id);
  if (!manifest.ok) {
    await markRunFailed(fork.id, {
      reason: 'Fork hydration failed',
      missing: manifest.missing
    });
    throw new Error(`Fork hydration failed: ${manifest.missing.join(', ')}`);
  }

  // 5. Upgrade status
  await markRunActive(fork.id);

  // 6. Set show's active run ID
  await setShowActiveRunId(showId, fork.id);

  const finalFork = await getRun(fork.id);
  return finalFork || {
    ...fork,
    status: 'active',
    hydrationStatus: 'complete'
  };
}

export async function forkRun(sourceRunId: string): Promise<Psb4Run> {
  const source = await getRun(sourceRunId);
  if (!source) {
    throw new Error(`Source run ${sourceRunId} not found`);
  }
  return forkRunAtomically(source.showId, sourceRunId);
}

export async function setArcLockNotes(
  runId: string,
  notes: string
): Promise<void> {
  const dbLocal = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const getReq = store.get(runId);
    getReq.onsuccess = () => {
      const run = getReq.result;
      if (!run) { reject(new Error('Run not found')); return; }
      const updated = { ...run, arcLockNotes: notes, updatedAt: Date.now() };
      const putReq = store.put(updated);
      putReq.onsuccess = () => {
        syncRunToCloud(updated).catch(err =>
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${runId}`)
        );
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function autoApproveBlankNotes(runId: string): Promise<void> {
  const artifacts = await getArtifactsByRun(runId);
  
  // Find the latest Clean Spine artifact
  const spineArt = artifacts
    .filter(a => a.artifactType === ArtifactType.CLEAN_SPINE)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
    
  // Find the latest Arc Ladder artifact
  const ladderArt = artifacts
    .filter(a => a.artifactType === ArtifactType.ARC_LADDER)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  // If there is no Clean Spine for 0.8R, create one as a copy
  const has08R = artifacts.some(a => a.createdByPass === '0.8R');
  if (!has08R && spineArt) {
    try {
      await writeArtifact({
        runId,
        showId: spineArt.showId,
        artifactType: ArtifactType.CLEAN_SPINE,
        episodeId: null,
        scope: 'arc',
        payload: spineArt.payload,
        payloadVersion: spineArt.payloadVersion,
        createdByPass: '0.8R'
      });
    } catch (e: any) {
      if (e.name !== 'Psb4InvariantError' && e.code !== 'ARTIFACT_EXISTS') {
        throw e;
      }
    }
  }

  // If there is no Arc Ladder for 0.8RA, create one as a copy
  const has08RA = artifacts.some(a => a.createdByPass === '0.8RA');
  if (!has08RA && ladderArt) {
    try {
      await writeArtifact({
        runId,
        showId: ladderArt.showId,
        artifactType: ArtifactType.ARC_LADDER,
        episodeId: null,
        scope: 'arc',
        payload: ladderArt.payload,
        payloadVersion: ladderArt.payloadVersion,
        createdByPass: '0.8RA'
      });
    } catch (e: any) {
      if (e.name !== 'Psb4InvariantError' && e.code !== 'ARTIFACT_EXISTS') {
        throw e;
      }
    }
  }

  // Set arc lock notes to be non-empty (this meets standard validations)
  await setArcLockNotes(runId, "(Skipped / Auto-approved blank notes)");
}

// transition helper
async function transitionRunStatus(
  runId: string,
  targetStatus: 'completed' | 'abandoned' | 'failed'
): Promise<void> {
  const dbLocal = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run: Psb4Run | undefined = getReq.result;
      if (!run) {
        reject(new Error(`Run ${runId} not found`));
        return;
      }

      if (run.status === targetStatus) {
        resolve();
        return;
      }

      if (run.status !== 'active' && run.status !== 'hydrating') {
        reject(
          new Psb4InvariantError(
            'INVALID_STATUS_TRANSITION',
            `Cannot transition run ${runId} from status "${run.status}" to "${targetStatus}".`
          )
        );
        return;
      }

      const now = Date.now();
      run.status = targetStatus;
      run.updatedAt = now;
      if (targetStatus === 'completed') {
        run.completedAt = now;
      }

      const putReq = store.put(run);
      putReq.onsuccess = () => {
        syncRunToCloud(run).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
        });
        import('./console_pruner').then(({ pruneConsoleEntries }) => {
          pruneConsoleEntries(run.showId).catch((err) => {
            console.error('Failed to prune console entries:', err);
          });
        }).catch((err) => {
          console.error('Failed to load pruner module:', err);
        });
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function completeRun(runId: string): Promise<void> {
  return transitionRunStatus(runId, 'completed');
}

export async function abandonRun(runId: string): Promise<void> {
  return transitionRunStatus(runId, 'abandoned');
}

export async function failRun(runId: string): Promise<void> {
  return transitionRunStatus(runId, 'failed');
}

export async function clearStaleActiveRuns(showId: string): Promise<void> {
  const dbLocal = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const index = store.index('by-show-status');
    const getReq = index.getAll([showId, 'active']);

    getReq.onsuccess = async () => {
      const activeRuns: Psb4Run[] = getReq.result || [];
      if (activeRuns.length === 0) {
        resolve();
        return;
      }

      console.log(`[ManualClearStale] Found ${activeRuns.length} active runs to clear for showId ${showId}.`);
      
      const now = Date.now();
      for (const run of activeRuns) {
        run.status = 'failed';
        run.updatedAt = now;
        if (!(run as any).failureReason) {
          (run as any).failureReason = 'Manually cleared as stale/failed by developer cleanup action.';
        }
        
        store.put(run);
        
        await syncRunToCloud(run).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
        });
      }
      resolve();
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function unabandonRun(runId: string): Promise<Psb4Run> {
  const dbLocal = await openDB();

  return new Promise<Psb4Run>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run: Psb4Run | undefined = getReq.result;
      if (!run) {
        reject(new Error(`Run ${runId} not found`));
        return;
      }

      if (run.status !== 'abandoned') {
        reject(
          new Error(`Run is ${run.status}, not abandoned — nothing to unabandon`)
        );
        return;
      }

      // BLOCK (option a): refuse if this show already has an active run.
      const index = store.index('by-show-status');
      const activeCheckReq = index.get([run.showId, 'active']);

      activeCheckReq.onsuccess = () => {
        const existingActive: Psb4Run | undefined = activeCheckReq.result;
        if (existingActive && existingActive.id !== runId) {
          reject(
            new Error(
              `"${(existingActive as any).label ?? existingActive.id}" is already the active run ` +
              `for this show. Abandon it first, then unabandon this one.`
            )
          );
          return;
        }

        const now = Date.now();
        run.status = 'active';
        run.updatedAt = now;

        const putReq = store.put(run);
        putReq.onsuccess = () => {
          syncRunToCloud(run).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
          });
          resolve(migrateIfNeeded(run, 1));
        };
        putReq.onerror = () => reject(putReq.error);
      };
      activeCheckReq.onerror = () => reject(activeCheckReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function preserveRun(runId: string, preserved: boolean): Promise<void> {
  const dbLocal = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run: Psb4Run | undefined = getReq.result;
      if (!run) {
        reject(new Error(`Run ${runId} not found`));
        return;
      }

      run.preserved = preserved;
      run.updatedAt = Date.now();

      const putReq = store.put(run);
      putReq.onsuccess = () => {
        syncRunToCloud(run).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
        });
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function updateRunModelOverride(
  runId: string,
  passId: string,
  model: 'gemini-pro' | 'gemini-flash'
): Promise<void> {
  const dbLocal = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_runs', 'readwrite');
    const store = tx.objectStore('psb4_runs');
    const getReq = store.get(runId);

    getReq.onsuccess = () => {
      const run: Psb4Run | undefined = getReq.result;
      if (!run) {
        reject(new Error(`Run ${runId} not found`));
        return;
      }

      const overrides = run.overrides || {};
      overrides[passId] = model;
      run.overrides = overrides;
      run.updatedAt = Date.now();

      const putReq = store.put(run);
      putReq.onsuccess = () => {
        syncRunToCloud(run).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
        });
        resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

// ----------------------------------------------------------------------------
// ARTIFACTS ACCESSORS
// ----------------------------------------------------------------------------

export async function writeArtifact(input: ArtifactInput): Promise<Psb4Artifact> {
  if (!Number.isInteger(input.payloadVersion) || input.payloadVersion <= 0) {
    throw new Error('payloadVersion must be a positive integer');
  }

  const dbLocal = await openDB();

  return new Promise<Psb4Artifact>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
    const store = tx.objectStore('psb4_artifacts');
    const index = store.index('by-run-type');
    const getReq = index.getAll([input.runId, input.artifactType]);

    getReq.onsuccess = () => {
      const results: Psb4Artifact[] = getReq.result || [];
      const match = results.find((art) => art.episodeId === input.episodeId);

      if (match) {
        reject(
          new Psb4InvariantError(
            'ARTIFACT_EXISTS',
            `An artifact of type "${input.artifactType}" and scope "${input.scope}" with episodeId ${input.episodeId} already exists in run ${input.runId}.`
          )
        );
        return;
      }

      const now = Date.now();
      const artifact: Psb4Artifact = {
        id: generateId(),
        runId: input.runId,
        showId: input.showId,
        artifactType: input.artifactType,
        episodeId: input.episodeId,
        scope: input.scope,
        payload: input.payload,
        payloadVersion: input.payloadVersion,
        createdAt: now,
        createdByPass: input.createdByPass,
        consoleEntryId: input.consoleEntryId || null,
        authorEdited: input.authorEdited ?? false,
        authorEditedAt: null,
        supersedesArtifactId: null,
        schemaVersion: 1,
      };

      const addReq = store.add(artifact);
      addReq.onsuccess = async () => {
        syncArtifactToCloud(artifact).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_artifacts/${artifact.id}`);
        });
        if (artifact.consoleEntryId) {
          try {
            await linkEntryToArtifact(artifact.consoleEntryId, artifact.id);
          } catch (err) {
            console.error('Failed to link console entry to artifact:', err);
          }
        }
        resolve(artifact);
      };
      addReq.onerror = () => reject(addReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getArtifact(artifactId: string): Promise<Psb4Artifact | null> {
  const dbLocal = await openDB();

  return new Promise<Psb4Artifact | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readonly');
    const store = tx.objectStore('psb4_artifacts');
    const getReq = store.get(artifactId);

    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve(migrateIfNeeded(getReq.result, 1));
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getArtifactsByRun(runId: string): Promise<Psb4Artifact[]> {
  const dbLocal = await openDB();

  return new Promise<Psb4Artifact[]>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readonly');
    const store = tx.objectStore('psb4_artifacts');
    const index = store.index('by-run');
    const getAllReq = index.getAll(runId);

    getAllReq.onsuccess = () => {
      const results = (getAllReq.result || []).map((art) => migrateIfNeeded(art, 1));
      resolve(results);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function getArtifactsByType(runId: string, type: ArtifactType): Promise<Psb4Artifact[]> {
  const dbLocal = await openDB();

  return new Promise<Psb4Artifact[]>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readonly');
    const store = tx.objectStore('psb4_artifacts');
    const index = store.index('by-run-type');
    const getAllReq = index.getAll([runId, type]);

    getAllReq.onsuccess = () => {
      const results = (getAllReq.result || []).map((art) => migrateIfNeeded(art, 1));
      resolve(results);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function getArtifactsByEpisode(runId: string, episodeId: string): Promise<Psb4Artifact[]> {
  const dbLocal = await openDB();

  return new Promise<Psb4Artifact[]>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readonly');
    const store = tx.objectStore('psb4_artifacts');
    const index = store.index('by-run-episode');
    const getAllReq = index.getAll([runId, episodeId]);

    getAllReq.onsuccess = () => {
      const results = (getAllReq.result || []).map((art) => migrateIfNeeded(art, 1));
      resolve(results);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function getLatestArtifactByShow(
  showId: string,
  type: ArtifactType,
  episodeId?: string
): Promise<Psb4Artifact | null> {
  const dbLocal = await openDB();

  return new Promise<Psb4Artifact | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readonly');
    const store = tx.objectStore('psb4_artifacts');
    const index = store.index('by-show-type');
    const getAllReq = index.getAll([showId, type]);

    getAllReq.onsuccess = () => {
      const results: Psb4Artifact[] = getAllReq.result || [];
      const filtered = results.filter((art) => {
        if (episodeId !== undefined) {
          return art.episodeId === episodeId;
        } else {
          return art.episodeId === null;
        }
      });

      if (filtered.length === 0) {
        resolve(null);
        return;
      }

      // sort by createdAt desc
      filtered.sort((a, b) => b.createdAt - a.createdAt);
      resolve(migrateIfNeeded(filtered[0], 1));
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function markArtifactAuthorEdited(artifactId: string, newPayload: object): Promise<Psb4Artifact> {
  const dbLocal = await openDB();

  return new Promise<Psb4Artifact>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
    const store = tx.objectStore('psb4_artifacts');
    const getReq = store.get(artifactId);

    getReq.onsuccess = () => {
      const artifact: Psb4Artifact | undefined = getReq.result;
      if (!artifact) {
        reject(new Error(`Artifact ${artifactId} not found`));
        return;
      }

      artifact.payload = newPayload;
      artifact.authorEdited = true;
      artifact.authorEditedAt = Date.now();

      const putReq = store.put(artifact);
      putReq.onsuccess = () => {
        syncArtifactToCloud(artifact).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_artifacts/${artifact.id}`);
        });
        resolve(artifact);
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function supersedeArtifact(
  oldId: string,
  newInput: ArtifactInput,
  options?: { force?: boolean }
): Promise<Psb4Artifact> {
  const dbLocal = await openDB();

  return new Promise<Psb4Artifact>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
    const store = tx.objectStore('psb4_artifacts');
    const getReq = store.get(oldId);

    getReq.onsuccess = () => {
      const oldArtifact: Psb4Artifact | undefined = getReq.result;
      if (!oldArtifact) {
        reject(new Error(`Old artifact ${oldId} not found`));
        return;
      }

      if (oldArtifact.authorEdited && options?.force !== true) {
        reject(
          new Psb4InvariantError(
            'CANNOT_OVERWRITE_AUTHOR_EDIT',
            `Cannot supersede artifact ${oldId} because it was edited by the author.`
          )
        );
        return;
      }

      const now = Date.now();
      const newArtifact: Psb4Artifact = {
        id: generateId(),
        runId: newInput.runId,
        showId: newInput.showId,
        artifactType: newInput.artifactType,
        episodeId: newInput.episodeId,
        scope: newInput.scope,
        payload: newInput.payload,
        payloadVersion: newInput.payloadVersion,
        createdAt: now,
        createdByPass: newInput.createdByPass,
        consoleEntryId: newInput.consoleEntryId || null,
        authorEdited: false,
        authorEditedAt: null,
        supersedesArtifactId: oldId,
        schemaVersion: 1,
      };

      const addReq = store.add(newArtifact);
      addReq.onsuccess = async () => {
        syncArtifactToCloud(newArtifact).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_artifacts/${newArtifact.id}`);
        });
        if (newArtifact.consoleEntryId) {
          try {
            await linkEntryToArtifact(newArtifact.consoleEntryId, newArtifact.id);
          } catch (err) {
            console.error('Failed to link console entry to artifact:', err);
          }
        }
        resolve(newArtifact);
      };
      addReq.onerror = () => reject(addReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

// ----------------------------------------------------------------------------
// CORPUS ACCESSORS
// ----------------------------------------------------------------------------

export async function writeCorpus(input: CorpusInput): Promise<Psb4Corpus> {
  const dbLocal = await openDB();

  return new Promise<Psb4Corpus>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_corpus', 'readwrite');
    const store = tx.objectStore('psb4_corpus');

    const now = Date.now();
    const corpus: Psb4Corpus = {
      id: generateId(),
      runId: input.runId,
      showId: input.showId,
      episodeId: input.episodeId,
      episodeIndex: input.episodeIndex,
      title: input.title,
      function: input.function,
      beatSpine: input.beatSpine,
      cleanDraft: input.cleanDraft,
      startingCondition: input.startingCondition,
      characterTurns: input.characterTurns,
      oppositionEscalation: input.oppositionEscalation,
      preservedFromSource: input.preservedFromSource,
      consolidatedFromSource: input.consolidatedFromSource,
      addedConnective: input.addedConnective,
      locked: input.locked ?? false,
      lockedAt: input.locked ? now : null,
      createdAt: now,
      createdByPass: input.createdByPass,
      consoleEntryId: input.consoleEntryId || null,
      schemaVersion: 1,
    };

    const addReq = store.add(corpus);
    addReq.onsuccess = async () => {
      syncCorpusToCloud(corpus).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `psb4_corpus/${corpus.id}`);
      });
      if (corpus.consoleEntryId) {
        try {
          await linkEntryToCorpus(corpus.consoleEntryId, corpus.id);
        } catch (err) {
          console.error('Failed to link console entry to corpus:', err);
        }
      }
      resolve(corpus);
    };
    addReq.onerror = () => reject(addReq.error);
  });
}

export async function getCorpusByRun(runId: string): Promise<Psb4Corpus[]> {
  const dbLocal = await openDB();

  return new Promise<Psb4Corpus[]>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_corpus', 'readonly');
    const store = tx.objectStore('psb4_corpus');
    const index = store.index('by-run');
    const getAllReq = index.getAll(runId);

    getAllReq.onsuccess = () => {
      const results = (getAllReq.result || []).map((cor) => migrateIfNeeded(cor, 1));
      // Sort by episodeIndex ascending
      results.sort((a, b) => a.episodeIndex - b.episodeIndex);
      resolve(results);
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
}

export async function getLockedCorpusEpisode(showId: string, episodeId: string): Promise<Psb4Corpus | null> {
  const dbLocal = await openDB();

  return new Promise<Psb4Corpus | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_corpus', 'readonly');
    const store = tx.objectStore('psb4_corpus');
    const index = store.index('by-show-episode-locked');
    const getReq = index.get([showId, episodeId, true] as any);

    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve(migrateIfNeeded(getReq.result, 1));
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function lockCorpusEpisode(corpusId: string): Promise<Psb4Corpus> {
  const dbLocal = await openDB();

  return new Promise<Psb4Corpus>((resolve, reject) => {
    // We open a transaction on corpus to find previously locked ones and set them to unlocked
    const tx = dbLocal.transaction('psb4_corpus', 'readwrite');
    const store = tx.objectStore('psb4_corpus');

    const getReq = store.get(corpusId);
    getReq.onsuccess = () => {
      const targetCorpus: Psb4Corpus | undefined = getReq.result;
      if (!targetCorpus) {
        reject(new Error(`Corpus record ${corpusId} not found`));
        return;
      }

      if (targetCorpus.locked) {
        resolve(targetCorpus);
        return;
      }

      const showId = targetCorpus.showId;
      const episodeId = targetCorpus.episodeId;

      // Find any previously locked records for this (showId, episodeId)
      const index = store.index('by-show-episode-locked');
      const getAllLockedReq = index.getAll([showId, episodeId, true] as any);

      getAllLockedReq.onsuccess = () => {
        const lockedRecords: Psb4Corpus[] = getAllLockedReq.result || [];
        
        // Unlock existing locked records
        for (const record of lockedRecords) {
          if (record.id !== corpusId) {
            record.locked = false;
            record.lockedAt = null;
            store.put(record);
            syncCorpusToCloud(record).catch((err) => {
              handleFirestoreError(err, OperationType.WRITE, `psb4_corpus/${record.id}`);
            });
          }
        }

        // Lock target record
        const now = Date.now();
        targetCorpus.locked = true;
        targetCorpus.lockedAt = now;
        
        const putReq = store.put(targetCorpus);
        putReq.onsuccess = () => {
          syncCorpusToCloud(targetCorpus).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, `psb4_corpus/${targetCorpus.id}`);
          });
          resolve(targetCorpus);
        };
        putReq.onerror = () => reject(putReq.error);
      };

      getAllLockedReq.onerror = () => reject(getAllLockedReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

// ----------------------------------------------------------------------------
// CONSOLE ENTRIES ACCESSORS
// ----------------------------------------------------------------------------

export async function writeConsoleEntry(entry: Psb4ConsoleEntry): Promise<Psb4ConsoleEntry> {
  const dbLocal = await openDB();
  return new Promise<Psb4ConsoleEntry>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_console_entries', 'readwrite');
    const store = tx.objectStore('psb4_console_entries');
    const addReq = store.add(entry);
    addReq.onsuccess = () => {
      syncConsoleEntryToCloud(entry).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `psb4_console_entries/${entry.id}`);
      });
      resolve(entry);
    };
    addReq.onerror = () => reject(addReq.error);
  });
}

export async function updateConsoleEntry(
  id: string, 
  updates: Partial<Psb4ConsoleEntry>
): Promise<Psb4ConsoleEntry> {
  const dbLocal = await openDB();
  return new Promise<Psb4ConsoleEntry>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_console_entries', 'readwrite');
    const store = tx.objectStore('psb4_console_entries');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing: Psb4ConsoleEntry | undefined = getReq.result;
      if (!existing) {
        reject(new Error(`Console entry ${id} not found`));
        return;
      }

      const updated = {
        ...existing,
        ...updates,
        metadata: {
          ...existing.metadata,
          ...(updates.metadata || {}),
        },
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => {
        syncConsoleEntryToCloud(updated).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_console_entries/${updated.id}`);
        });
        resolve(updated);
      };
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getConsoleEntry(id: string): Promise<Psb4ConsoleEntry | null> {
  const dbLocal = await openDB();
  return new Promise<Psb4ConsoleEntry | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_console_entries', 'readonly');
    const store = tx.objectStore('psb4_console_entries');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve(migrateIfNeeded(getReq.result, 1));
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function listConsoleEntries(runId: string): Promise<Psb4ConsoleEntry[]> {
  const dbLocal = await openDB();
  return new Promise<Psb4ConsoleEntry[]>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_console_entries', 'readonly');
    const store = tx.objectStore('psb4_console_entries');
    const index = store.index('by-run');
    const getReq = index.getAll(runId);
    getReq.onsuccess = () => {
      const results = (getReq.result || []).map((e) => migrateIfNeeded(e, 1));
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export const PASS_ORDER = [
  '0.0','0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.8A',
  '0.8R','0.8RA',   // authorial revision — manual only
  '0.9','0.9S','0.9W','0.9G','0.9A','0.10','0.11','0.12','0.13','0.14',
  '1','2','3','4','5','6','7','8','9','10','11','12','12D'
];

const PASS_SUPERSEDES: Record<string, string> = {
  '0.9G': '0.9S',  // 0.9G's SCENE_STRUCTURE supersedes 0.9S's
  '12D':  '0.9G',
};

const hasSupersedingEntryForStep = (step: string | null, startPass: string, entries: any[]): boolean => {
  if (!step) return false;
  let current = startPass;
  while (true) {
    const laterPasses = Object.keys(PASS_SUPERSEDES).filter(k => PASS_SUPERSEDES[k] === current);
    if (laterPasses.length === 0) return false;
    for (const lp of laterPasses) {
      if (entries.some(e => e.pass === lp && e.step === step)) {
        return true;
      }
      if (hasSupersedingEntryForStep(step, lp, entries)) {
        return true;
      }
    }
    return false;
  }
};

export async function buildConversationHistory(
  runId: string,
  upToPassId: string,
  upToEpisodeId?: string | null
): Promise<ConversationTurn[]> {
  const allEntries = await listConsoleEntries(runId);

  // Keep only successful prompt entries (output.raw exists, no error)
  const promptEntries = allEntries.filter(e =>
    e.eventType === 'prompt' &&
    e.error === null &&
    e.output?.raw
  );

  // Sort by pass order first, then by executionSequence, then by createdAt within same pass
  promptEntries.sort((a, b) => {
    const ai = PASS_ORDER.indexOf(a.pass);
    const bi = PASS_ORDER.indexOf(b.pass);
    if (ai !== bi) return ai - bi;
    const seqA = a.metadata?.executionSequence ?? 0;
    const seqB = b.metadata?.executionSequence ?? 0;
    if (seqA !== seqB) return seqA - seqB;
    return a.createdAt - b.createdAt;
  });

  // Filter out superseded entries (transitively)
  const supersededEntries = new Set<string>();
  for (const entry of promptEntries) {
    if (entry.step && hasSupersedingEntryForStep(entry.step, entry.pass, promptEntries)) {
      supersededEntries.add(entry.id);
    }
  }
  const filteredPromptEntries = promptEntries.filter(e => !supersededEntries.has(e.id));

  // Truncate: include only passes before upToPassId
  const upToIdx = PASS_ORDER.indexOf(upToPassId);
  const relevant = filteredPromptEntries.filter(e => {
    const eIdx = PASS_ORDER.indexOf(e.pass);
    if (eIdx < upToIdx) return true;
    if (eIdx === upToIdx && upToEpisodeId && e.step) {
      // Include prior episodes of the same pass
      return false; // handled by the incremental loop in executor
    }
    return false;
  });

  // Build [user, model] turn pairs
  const turns: ConversationTurn[] = [];
  for (const entry of relevant) {
    turns.push({ role: 'user', parts: [{ text: entry.input?.prompt || '' }] });
    turns.push({ role: 'model', parts: [{ text: entry.output.raw }] });
  }
  return turns;
}

export async function deleteConsoleEntry(id: string): Promise<void> {
  const dbLocal = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_console_entries', 'readwrite');
    const store = tx.objectStore('psb4_console_entries');
    const delReq = store.delete(id);
    delReq.onsuccess = () => resolve();
    delReq.onerror = () => reject(delReq.error);
  });
}

export async function getConsoleEntriesNotInRuns(
  showId: string,
  retainedRunIds: Set<string>
): Promise<Psb4ConsoleEntry[]> {
  const dbLocal = await openDB();
  return new Promise<Psb4ConsoleEntry[]>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_console_entries', 'readonly');
    const store = tx.objectStore('psb4_console_entries');
    const index = store.index('by-show-created');
    const range = IDBKeyRange.bound([showId, 0], [showId, Infinity]);
    const getReq = index.getAll(range);

    getReq.onsuccess = () => {
      const results: Psb4ConsoleEntry[] = (getReq.result || []).map((e) => migrateIfNeeded(e, 1));
      const filtered = results.filter((e) => !retainedRunIds.has(e.runId));
      resolve(filtered);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function linkEntryToArtifact(entryId: string, artifactId: string): Promise<void> {
  await updateConsoleEntry(entryId, { producedArtifactId: artifactId });
}

export async function linkEntryToCorpus(entryId: string, corpusId: string): Promise<void> {
  await updateConsoleEntry(entryId, { producedCorpusId: corpusId });
}

// ----------------------------------------------------------------------------
// SOURCE ACCESSORS
// ----------------------------------------------------------------------------

export async function writeSource(source: NormalizedSource): Promise<NormalizedSource> {
  const dbLocal = await openDB();
  return new Promise<NormalizedSource>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_source', 'readwrite');
    const store = tx.objectStore('psb4_source');
    const addReq = store.add(source);
    addReq.onsuccess = () => {
      syncSourceToCloud(source).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `psb4_source/${source.id}`);
      });
      resolve(source);
    };
    addReq.onerror = () => reject(addReq.error);
  });
}

export async function getSourceByRun(runId: string): Promise<NormalizedSource | null> {
  const dbLocal = await openDB();
  return new Promise<NormalizedSource | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_source', 'readonly');
    const store = tx.objectStore('psb4_source');
    const index = store.index('by-run');
    const getReq = index.get(runId);
    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve(migrateIfNeeded(getReq.result, 1));
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getSourceByHash(showId: string, hash: string): Promise<NormalizedSource | null> {
  const dbLocal = await openDB();
  return new Promise<NormalizedSource | null>((resolve, reject) => {
    const tx = dbLocal.transaction('psb4_source', 'readonly');
    const store = tx.objectStore('psb4_source');
    const index = store.index('by-show-hash');
    const getReq = index.get([showId, hash]);
    getReq.onsuccess = () => {
      if (getReq.result) {
        resolve(migrateIfNeeded(getReq.result, 1));
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteRunCascade(runId: string): Promise<void> {
  const dbLocal = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction(
      ['psb4_runs', 'psb4_artifacts', 'psb4_corpus', 'psb4_console_entries', 'psb4_source'],
      'readwrite'
    );

    const runsStore = tx.objectStore('psb4_runs');
    runsStore.delete(runId);

    const deleteByRunIndex = (storeName: string) => {
      const store = tx.objectStore(storeName);
      const index = store.index('by-run');
      index.openCursor(IDBKeyRange.only(runId)).onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    };

    deleteByRunIndex('psb4_artifacts');
    deleteByRunIndex('psb4_corpus');
    deleteByRunIndex('psb4_console_entries');
    deleteByRunIndex('psb4_source');

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function resetPass09W(runId: string): Promise<void> {
  const dbLocal = await openDB();

  // 1. Gather IDB artifacts and console entries to delete
  const artifactsToDelete: Psb4Artifact[] = [];
  const consoleEntriesToDelete: Psb4ConsoleEntry[] = [];

  await new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction(['psb4_artifacts', 'psb4_console_entries'], 'readonly');

    const artStore = tx.objectStore('psb4_artifacts');
    const artIndex = artStore.index('by-run');
    artIndex.getAll(runId).onsuccess = (event: any) => {
      const allArts = event.target.result || [];
      for (const art of allArts) {
        if (art.createdByPass === '0.9W' || art.createdByPass === '0.9G') {
          artifactsToDelete.push(art);
        }
      }
    };

    const conStore = tx.objectStore('psb4_console_entries');
    const conIndex = conStore.index('by-run');
    conIndex.getAll(runId).onsuccess = (event: any) => {
      const allCons = event.target.result || [];
      for (const con of allCons) {
        if (con.pass === '0.9W' || con.pass === '0.9G') {
          consoleEntriesToDelete.push(con);
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 2. Perform deletions and reset run status in a write transaction
  await new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction(['psb4_runs', 'psb4_artifacts', 'psb4_console_entries'], 'readwrite');

    const artStore = tx.objectStore('psb4_artifacts');
    for (const art of artifactsToDelete) {
      artStore.delete(art.id);
    }

    const conStore = tx.objectStore('psb4_console_entries');
    for (const con of consoleEntriesToDelete) {
      conStore.delete(con.id);
    }

    const runStore = tx.objectStore('psb4_runs');
    const getReq = runStore.get(runId);
    getReq.onsuccess = () => {
      const run: Psb4Run | undefined = getReq.result;
      if (run) {
        run.status = 'active';
        run.completedAt = null;
        run.updatedAt = Date.now();
        if (run.phaseProgress) {
          run.phaseProgress.rebuild = 'pending';
        }
        runStore.put(run);
        
        syncRunToCloud(run).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 3. Reconcile with cloud Firestore
  for (const art of artifactsToDelete) {
    const ref = doc(db, 'psb4', art.showId, 'artifacts', art.id);
    await deleteDoc(ref).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `psb4/${art.showId}/artifacts/${art.id}`);
    });
  }

  for (const con of consoleEntriesToDelete) {
    const ref = doc(db, 'psb4', con.showId, 'console', con.id);
    await deleteDoc(ref).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `psb4/${con.showId}/console/${con.id}`);
    });
  }
}

export async function resetPass09G(runId: string): Promise<void> {
  const dbLocal = await openDB();

  // 1. Gather IDB artifacts and console entries to delete
  const artifactsToDelete: Psb4Artifact[] = [];
  const consoleEntriesToDelete: Psb4ConsoleEntry[] = [];

  await new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction(['psb4_artifacts', 'psb4_console_entries'], 'readonly');

    const artStore = tx.objectStore('psb4_artifacts');
    const artIndex = artStore.index('by-run');
    artIndex.getAll(runId).onsuccess = (event: any) => {
      const allArts = event.target.result || [];
      for (const art of allArts) {
        if (art.createdByPass === '0.9G') {
          artifactsToDelete.push(art);
        }
      }
    };

    const conStore = tx.objectStore('psb4_console_entries');
    const conIndex = conStore.index('by-run');
    conIndex.getAll(runId).onsuccess = (event: any) => {
      const allCons = event.target.result || [];
      for (const con of allCons) {
        if (con.pass === '0.9G') {
          consoleEntriesToDelete.push(con);
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 2. Perform deletions and reset run status in a write transaction
  await new Promise<void>((resolve, reject) => {
    const tx = dbLocal.transaction(['psb4_runs', 'psb4_artifacts', 'psb4_console_entries'], 'readwrite');

    const artStore = tx.objectStore('psb4_artifacts');
    for (const art of artifactsToDelete) {
      artStore.delete(art.id);
    }

    const conStore = tx.objectStore('psb4_console_entries');
    for (const con of consoleEntriesToDelete) {
      conStore.delete(con.id);
    }

    const runStore = tx.objectStore('psb4_runs');
    const getReq = runStore.get(runId);
    getReq.onsuccess = () => {
      const run: Psb4Run | undefined = getReq.result;
      if (run) {
        run.status = 'active';
        run.completedAt = null;
        run.updatedAt = Date.now();
        if (run.phaseProgress) {
          run.phaseProgress.rebuild = 'pending';
        }
        runStore.put(run);
        
        syncRunToCloud(run).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `psb4_runs/${run.id}`);
        });
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 3. Reconcile with cloud Firestore
  for (const art of artifactsToDelete) {
    const ref = doc(db, 'psb4', art.showId, 'artifacts', art.id);
    await deleteDoc(ref).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `psb4/${art.showId}/artifacts/${art.id}`);
    });
  }

  for (const con of consoleEntriesToDelete) {
    const ref = doc(db, 'psb4', con.showId, 'console', con.id);
    await deleteDoc(ref).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `psb4/${con.showId}/console/${con.id}`);
    });
  }
}


