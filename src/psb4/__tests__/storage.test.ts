import { 
  createRun, 
  getActiveRun, 
  getRun, 
  listRuns, 
  updateRunPhase, 
  completeRun, 
  abandonRun, 
  failRun,
  preserveRun, 
  writeArtifact, 
  getArtifact, 
  getArtifactsByRun, 
  getArtifactsByType, 
  getArtifactsByEpisode, 
  getLatestArtifactByShow, 
  markArtifactAuthorEdited, 
  supersedeArtifact, 
  writeCorpus, 
  getCorpusByRun, 
  getLockedCorpusEpisode, 
  lockCorpusEpisode 
} from '../storage';
import { ArtifactType, Psb4Run, Psb4Artifact, Psb4Corpus } from '../types';
import { Psb4InvariantError } from '../errors';

// ----------------------------------------------------------------------------
// FULL INDEXEDDB IN-MEMORY MOCK FOR RUNS, ARTIFACTS AND CORPUS
// Enables running these unit tests in a Node environment without browser IDB.
// ----------------------------------------------------------------------------

class MockIDBRequest {
  result: any;
  error: any;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class MockIDBIndex {
  name: string;
  keyPath: string | string[];
  store: MockIDBObjectStore;

  constructor(name: string, keyPath: string | string[], store: MockIDBObjectStore) {
    this.name = name;
    this.keyPath = keyPath;
    this.store = store;
  }

  get(query: any): MockIDBRequest {
    const req = new MockIDBRequest();
    setTimeout(() => {
      const results = this.store._getMatching(this.keyPath, query);
      req.result = results[0] || null;
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }

  getAll(query: any): MockIDBRequest {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = this.store._getMatching(this.keyPath, query);
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }
}

class MockIDBObjectStore {
  name: string;
  data: Map<string, any> = new Map();
  indices: Map<string, MockIDBIndex> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  createIndex(name: string, keyPath: string | string[], options?: any): MockIDBIndex {
    const index = new MockIDBIndex(name, keyPath, this);
    this.indices.set(name, index);
    return index;
  }

  index(name: string): MockIDBIndex {
    const idx = this.indices.get(name);
    if (!idx) throw new Error(`Index ${name} not found`);
    return idx;
  }

  get(key: string): MockIDBRequest {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = this.data.get(key) || null;
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }

  add(value: any): MockIDBRequest {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.data.set(value.id, { ...value });
      req.result = value.id;
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }

  put(value: any): MockIDBRequest {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.data.set(value.id, { ...value });
      req.result = value.id;
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }

  _getMatching(keyPath: string | string[], value: any): any[] {
    const matches: any[] = [];
    for (const record of this.data.values()) {
      if (Array.isArray(keyPath)) {
        let match = true;
        for (let i = 0; i < keyPath.length; i++) {
          const recVal = record[keyPath[i]];
          const queryVal = value[i];
          if (recVal !== queryVal) {
            match = false;
            break;
          }
        }
        if (match) matches.push({ ...record });
      } else {
        if (record[keyPath] === value) {
          matches.push({ ...record });
        }
      }
    }
    return matches;
  }
}

const databaseStores: Record<string, MockIDBObjectStore> = {
  psb4_runs: new MockIDBObjectStore('psb4_runs'),
  psb4_artifacts: new MockIDBObjectStore('psb4_artifacts'),
  psb4_corpus: new MockIDBObjectStore('psb4_corpus')
};

// Seed indices
databaseStores.psb4_runs.createIndex('by-show', 'showId');
databaseStores.psb4_runs.createIndex('by-show-status', ['showId', 'status']);

databaseStores.psb4_artifacts.createIndex('by-run', 'runId');
databaseStores.psb4_artifacts.createIndex('by-run-type', ['runId', 'artifactType']);
databaseStores.psb4_artifacts.createIndex('by-run-episode', ['runId', 'episodeId']);
databaseStores.psb4_artifacts.createIndex('by-show-type', ['showId', 'artifactType']);

databaseStores.psb4_corpus.createIndex('by-run', 'runId');
databaseStores.psb4_corpus.createIndex('by-run-index', ['runId', 'episodeIndex']);
databaseStores.psb4_corpus.createIndex('by-show-episode-locked', ['showId', 'episodeId', 'locked']);

class MockIDBDatabase {
  objectStoreNames = {
    contains: (name: string) => name in databaseStores
  };
  transaction(storeNames: string | string[], mode: string) {
    const tx = {
      objectStore: (name: string) => {
        const store = databaseStores[name];
        if (!store) throw new Error(`Mock store ${name} not found`);
        return store;
      },
      oncomplete: null as any,
      onerror: null as any
    };
    setTimeout(() => {
      if (tx.oncomplete) tx.oncomplete();
    }, 0);
    return tx;
  }
  close() {}
}

class MockIndexedDB {
  open(name: string, version: number) {
    const req = new MockIDBRequest();
    setTimeout(() => {
      req.result = new MockIDBDatabase();
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }
}

if (typeof globalThis.indexedDB === 'undefined') {
  (globalThis as any).indexedDB = new MockIndexedDB();
}

// ----------------------------------------------------------------------------
// TEST RUNNER UTILS & ASSERTIONS
// ----------------------------------------------------------------------------

let testSuccess = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    testSuccess = false;
  } else {
    console.log(`✅ ${message}`);
  }
}

async function assertThrows(
  promise: Promise<any>,
  expectedCode: string,
  message: string
) {
  try {
    await promise;
    console.error(`❌ ASSERTION FAILED: Expected function to throw, but it succeeded: ${message}`);
    testSuccess = false;
  } catch (err: any) {
    if (err instanceof Psb4InvariantError && err.code === expectedCode) {
      console.log(`✅ Correctly threw Psb4InvariantError with code "${expectedCode}": ${message}`);
    } else {
      console.error(
        `❌ ASSERTION FAILED: Threw wrong error (got name="${err?.name}", code="${err?.code}", expectedCode="${expectedCode}"): ${message}`
      );
      testSuccess = false;
    }
  }
}

// ----------------------------------------------------------------------------
// THE TEST SUITE
// ----------------------------------------------------------------------------

async function runTests() {
  console.log('--- STARTING PSB4 STORAGE INVARIANTS UNIT TESTS ---');

  const showId = 'test_show_123';
  const teleplayHash = 'abc123hash';

  // 1. Initial State
  console.log('\n[1] Verifying no initial active runs exist...');
  const initActive = await getActiveRun(showId);
  assert(initActive === null, 'No active run exists initially.');

  // 2. Create Run
  console.log('\n[2] Creating an active run...');
  const run1 = await createRun(showId, teleplayHash);
  assert(run1.status === 'active', 'Created run status is "active".');
  assert(run1.showId === showId, 'Show ID matches.');
  assert(run1.sourceTeleplayHash === teleplayHash, 'Teleplay hash matches.');
  assert(run1.preserved === false, 'Run initially not preserved.');

  const dbActive = await getActiveRun(showId);
  assert(dbActive !== null && dbActive.id === run1.id, 'getActiveRun returns the newly created run.');

  // 3. Prevent duplicate active runs
  console.log('\n[3] Verification of active run uniqueness invariants...');
  await assertThrows(
    createRun(showId, teleplayHash),
    'DUPLICATE_ACTIVE_RUN',
    'Cannot create a second active run for the same showId.'
  );

  // 4. listRuns sorted by createdAt desc
  console.log('\n[4] Listing runs and sorting...');
  // Force a second completed run to test listing
  databaseStores.psb4_runs.data.set('past_run', {
    id: 'past_run',
    showId,
    status: 'completed',
    createdAt: run1.createdAt - 10000,
    updatedAt: run1.createdAt - 10000,
    completedAt: run1.createdAt - 10000,
    schemaVersion: 1
  });
  const runs = await listRuns(showId);
  assert(runs.length === 2, 'Listed two runs.');
  assert(runs[0].id === run1.id && runs[1].id === 'past_run', 'Runs are sorted desc by createdAt.');

  // 5. Update Run Phases
  console.log('\n[5] Updating phase progress...');
  await updateRunPhase(run1.id, 'reduction', '0.2', 'running');
  const run1_updated = await getRun(run1.id);
  assert(run1_updated !== null && run1_updated.currentPass === '0.2', 'currentPass updated to 0.2');
  assert(run1_updated?.phaseProgress.reduction === 'running', 'phaseProgress.reduction updated to "running"');

  // 6. Complete Run and check invalid transitions
  console.log('\n[6] Testing status transitions...');
  await completeRun(run1.id);
  const run1_completed = await getRun(run1.id);
  assert(run1_completed?.status === 'completed', 'Run status transitioned to "completed".');
  assert(run1_completed?.completedAt !== null, 'completedAt populated.');

  await assertThrows(
    completeRun(run1.id),
    'INVALID_STATUS_TRANSITION',
    'Cannot complete an already completed run.'
  );
  await assertThrows(
    abandonRun(run1.id),
    'INVALID_STATUS_TRANSITION',
    'Cannot abandon a completed run.'
  );

  // 6.1 Completed run does not block a new run
  console.log('\n[6.1] Checking that completed run does not block new run...');
  const run2 = await createRun(showId, teleplayHash);
  assert(run2.status === 'active', 'Created run 2 successfully after run 1 completed.');

  // 6.2 Cancelled (abandoned) run does not block a new run
  console.log('\n[6.2] Checking that cancelled (abandoned) run does not block new run...');
  await abandonRun(run2.id);
  const run2_abandoned = await getRun(run2.id);
  assert(run2_abandoned?.status === 'abandoned', 'Run 2 status successfully updated to "abandoned".');

  const run3 = await createRun(showId, teleplayHash);
  assert(run3.status === 'active', 'Created run 3 successfully after run 2 abandoned.');

  // 6.3 Failed run does not block a new run
  console.log('\n[6.3] Checking that failed run does not block new run...');
  await failRun(run3.id);
  const run3_failed = await getRun(run3.id);
  assert(run3_failed?.status === 'failed', 'Run 3 status successfully updated to "failed".');

  const run4 = await createRun(showId, teleplayHash);
  assert(run4.status === 'active', 'Created run 4 successfully after run 3 failed.');

  // 6.4 Stale active run is recovered
  console.log('\n[6.4] Checking that stale active run is recovered...');
  // Force simulate a stale run by resetting updatedAt back by more than 10 minutes
  const RUN_STALE_TIMEOUT_MS = 10 * 60 * 1000;
  run4.updatedAt = Date.now() - (RUN_STALE_TIMEOUT_MS + 5000);
  
  // Directly set back to simulated store
  databaseStores.psb4_runs.data.set(run4.id, run4);

  const run5 = await createRun(showId, teleplayHash);
  assert(run5.status === 'active', 'Created run 5 successfully by recovering the stale active run 4.');

  const run4_recovered = await getRun(run4.id);
  assert(run4_recovered?.status === 'failed', 'Run 4 status was transitioned to "failed" after being recovered.');

  // 6.5 Genuine active run still blocks duplicate start
  console.log('\n[6.5] Checking that genuinely active run still blocks duplicate start...');
  await assertThrows(
    createRun(showId, teleplayHash),
    'DUPLICATE_ACTIVE_RUN',
    'Cannot create a second active run when a genuinely active run exists.'
  );

  // Clean transition to ensure run 1 is referenced cleanly
  await abandonRun(run5.id);

  // 7. Verify preserve run
  console.log('\n[7] Testing preserve run...');
  await preserveRun(run1.id, true);
  const run1_preserved = await getRun(run1.id);
  assert(run1_preserved?.preserved === true, 'Run.preserved updated to true.');

  // 8. Artifact validation & creation
  console.log('\n[8] Testing artifact creation and constraints...');
  const artInput = {
    runId: run1.id,
    showId,
    artifactType: ArtifactType.ENGINE_READ,
    episodeId: null,
    scope: 'arc' as const,
    payload: { premise: 'Test Premise' },
    payloadVersion: 1,
    createdByPass: '0.1'
  };

  const artifact = await writeArtifact(artInput);
  assert(artifact.artifactType === ArtifactType.ENGINE_READ, 'Artifact type saved.');
  assert(artifact.authorEdited === false, 'authorEdited of new artifact is false.');

  const retrievedArt = await getArtifact(artifact.id);
  assert(retrievedArt !== null && retrievedArt.payload.premise === 'Test Premise', 'getArtifact matches.');

  // Duplicate check
  await assertThrows(
    writeArtifact(artInput),
    'ARTIFACT_EXISTS',
    'Prevent writing duplicate artifact of type + episodeId inside same run.'
  );

  // 9. Mark artifact as edited
  console.log('\n[9] Testing mark author edited...');
  await markArtifactAuthorEdited(artifact.id, { premise: 'Author Edited Premise' });
  const editedArt = await getArtifact(artifact.id);
  assert(editedArt?.authorEdited === true, 'authorEdited mapped to true.');
  assert(editedArt?.payload.premise === 'Author Edited Premise', 'Payload updated correctly.');

  // 10. Supersede checks
  console.log('\n[10] Testing supersede constraints...');
  const supersedeInput = {
    runId: run1.id,
    showId,
    artifactType: ArtifactType.ENGINE_READ,
    episodeId: null,
    scope: 'arc' as const,
    payload: { premise: 'Super New Premise' },
    payloadVersion: 1,
    createdByPass: '0.1'
  };

  await assertThrows(
    supersedeArtifact(artifact.id, supersedeInput),
    'CANNOT_OVERWRITE_AUTHOR_EDIT',
    'Fail to supersede an authorEdited artifact without force flag'
  );

  const superseded = await supersedeArtifact(artifact.id, supersedeInput, { force: true });
  assert(superseded.supersedesArtifactId === artifact.id, 'Superseded artifact successfully with force: true');
  assert(superseded.payload.premise === 'Super New Premise', 'New payload preserved.');

  // Latest artifact lookup
  const latestArt = await getLatestArtifactByShow(showId, ArtifactType.ENGINE_READ);
  assert(latestArt !== null && latestArt.id === superseded.id, 'getLatestArtifactByShow returns the latest.');

  // 11. Corpus locking and unlocks
  console.log('\n[11] Testing corpus locking invariants...');
  const corpusInput1 = {
    runId: run1.id,
    showId,
    episodeId: 'episode_1',
    episodeIndex: 1,
    title: 'Ep 1 Title',
    function: 'Introduce world',
    beatSpine: [],
    cleanDraft: 'Draft content...',
    startingCondition: '',
    characterTurns: [],
    oppositionEscalation: '',
    preservedFromSource: [],
    consolidatedFromSource: [],
    addedConnective: [],
    createdByPass: '0.11'
  };

  const corpusInput2 = {
    ...corpusInput1,
    runId: 'another_run_id'
  };

  const corpus1 = await writeCorpus(corpusInput1);
  const corpus2 = await writeCorpus(corpusInput2);

  assert(corpus1.locked === false, 'Corpus 1 initially unlocked.');
  assert(corpus2.locked === false, 'Corpus 2 initially unlocked.');

  console.log('Locking Corpus 1...');
  await lockCorpusEpisode(corpus1.id);
  const lockedC1 = await getLockedCorpusEpisode(showId, 'episode_1');
  assert(lockedC1 !== null && lockedC1.id === corpus1.id, 'Corpus 1 locked and returned.');

  console.log('Locking Corpus 2 (should unlock Corpus 1 for the same episode)...');
  await lockCorpusEpisode(corpus2.id);

  const lockedC2 = await getLockedCorpusEpisode(showId, 'episode_1');
  assert(lockedC2 !== null && lockedC2.id === corpus2.id, 'Corpus 2 is now the locked one.');

  const oldC1 = await getLockedCorpusEpisode(showId, corpus1.id);
  // Corpus 1 should now be unlocked (locked === false), so getLockedCorpusEpisode should return null or Corpus 2
  const reGetC1 = await getLockedCorpusEpisode(showId, 'episode_1');
  assert(reGetC1?.id !== corpus1.id, 'Corpus 1 successfully unlocked across runs.');

  console.log('\n-----------------------------------------------------');
  if (testSuccess) {
    console.log('🎉 ALL PSB4 STORAGE INvariantS TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME UNIT TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('CRITICAL TEST FAILURE:', err);
  process.exit(1);
});
