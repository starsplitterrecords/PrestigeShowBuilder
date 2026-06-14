import { 
  capturePrompt, 
  captureAssembly, 
  captureSynthesis 
} from '../console';
import { 
  writeArtifact, 
  writeCorpus, 
  createRun, 
  completeRun, 
  abandonRun, 
  preserveRun, 
  getConsoleEntry, 
  listConsoleEntries, 
  getConsoleEntriesNotInRuns 
} from '../storage';
import { pruneConsoleEntries } from '../console_pruner';
import { ArtifactType } from '../types';
import { GoogleGenAI } from '@google/genai';

// ----------------------------------------------------------------------------
// GLOBAL MOCK FOR GEMINI API
// ----------------------------------------------------------------------------

let mockCallCount = 0;
let mockPromptSent = '';
let mockResponseText = 'Default Mocked Reply from Gemini';
let shouldFailGemini = false;

// Dynamic override of the GoogleGenAI SDK prototype for safe local execution
Object.defineProperty(GoogleGenAI.prototype, 'models', {
  get() {
    return {
      generateContent: async (params: any) => {
        mockCallCount++;
        mockPromptSent = typeof params.contents === 'string' ? params.contents : JSON.stringify(params.contents);
        if (shouldFailGemini) {
          throw new Error('Simulated Gemini API failure');
        }
        return {
          text: mockResponseText,
          usage: { inputTokens: 42, outputTokens: 84 },
          candidates: [{ finishReason: 'STOP' }]
        };
      }
    };
  },
  set(val) {
    // No-op setter to handle class construction
  },
  configurable: true
});

// Mock domain utils getApiKey
jestMockGetApiKey();
function jestMockGetApiKey() {
  (globalThis as any)._api_key = 'mock-api-key';
}

// ----------------------------------------------------------------------------
// FULL INDEXEDDB IN-MEMORY MOCK FOR RUNS, ARTIFACTS AND CONSOLE ENTRIES
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

  delete(key: string): MockIDBRequest {
    const req = new MockIDBRequest();
    setTimeout(() => {
      this.data.delete(key);
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }

  _getMatching(keyPath: string | string[], value: any): any[] {
    const matches: any[] = [];

    // Handle IDBKeyRange specifically for our bound query on [showId, createdAt]
    if (value && typeof value === 'object' && value.__isBound) {
      const showId = value.lower[0];
      for (const record of this.data.values()) {
        if (record.showId === showId) {
          matches.push({ ...record });
        }
      }
      return matches;
    }

    for (const record of this.data.values()) {
      if (Array.isArray(keyPath)) {
        let match = true;
        for (let i = 0; i < keyPath.length; i++) {
          const recVal = record[keyPath[i]];
          // Support Set check in retained ids or direct match
          const queryVal = value && typeof value === 'object' && 'has' in value ? value : value[i];
          if (value && typeof value === 'object' && 'has' in value) {
            // Special pruning check
            if (keyPath[i] === 'runId' && value.has(recVal)) {
              // we filter NOT in, so we want to skip matching if it is in retained
              match = false;
            }
          } else if (recVal !== queryVal) {
            match = false;
            break;
          }
        }
        if (match) matches.push({ ...record });
      } else {
        if (value instanceof Set) {
          if (!value.has(record[keyPath])) {
            matches.push({ ...record });
          }
        } else if (record[keyPath] === value) {
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
  psb4_corpus: new MockIDBObjectStore('psb4_corpus'),
  psb4_console_entries: new MockIDBObjectStore('psb4_console_entries')
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

databaseStores.psb4_console_entries.createIndex('by-run', 'runId');
databaseStores.psb4_console_entries.createIndex('by-run-phase', ['runId', 'phase']);
databaseStores.psb4_console_entries.createIndex('by-run-pass', ['runId', 'pass']);
databaseStores.psb4_console_entries.createIndex('by-show-created', ['showId', 'createdAt']);
databaseStores.psb4_console_entries.createIndex('by-parent', 'parentEntryId');

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

if (typeof globalThis.indexedDB === 'undefined' || !(globalThis as any).indexedDB.__isMock) {
  const mockDBInstance = new MockIndexedDB();
  (mockDBInstance as any).__isMock = true;
  (globalThis as any).indexedDB = mockDBInstance;
}

if (typeof (globalThis as any).IDBKeyRange === 'undefined') {
  (globalThis as any).IDBKeyRange = {
    bound: (lower: any, upper: any) => {
      return { lower, upper, __isBound: true };
    }
  };
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

async function runTests() {
  console.log('--- STARTING PSB4 CONSOLE & REPLAY INTEGRITY TESTS ---');

  const showId = 'show_console_test_778';
  const teleplayHash = 'abc778hash';

  // Clear mock databases
  for (const store of Object.values(databaseStores)) {
    store.data.clear();
  }

  // 1. Create a run first
  console.log('\n[1] Creating active run in mock IndexedDB...');
  const run = await createRun(showId, teleplayHash);
  assert(run.status === 'active', 'Run is initially active.');

  // 2. Test capturePrompt SUCCESS
  console.log('\n[2] Testing capturePrompt SUCCESS wrapper...');
  mockCallCount = 0;
  mockResponseText = '{"theme": "cyberpunk"}';
  
  const parseJson = (text: string) => JSON.parse(text);
  const { result, entryId } = await capturePrompt<any>({
    runId: run.id,
    phase: 'reduction',
    pass: '0.1',
    step: 'theme_synthesis',
    model: 'gemini-3.5-flash',
    temperature: 0.2,
    prompt: 'Synthesize the show theme into JSON',
    parser: parseJson,
  });

  assert(mockCallCount === 1, 'Gemini API was called exactly once.');
  assert(result.theme === 'cyberpunk', 'Parsed json payload correctly.');
  assert(typeof entryId === 'string' && entryId.length === 26, 'Generated valid 26-char ULID.');

  // Fetch from IndexedDB and verify envelope constraints
  const entry = await getConsoleEntry(entryId);
  assert(entry !== null, 'Console entry exists in IndexedDB.');
  assert(entry?.eventType === 'prompt', 'Event type matches "prompt".');
  assert(entry?.output?.raw === '{"theme": "cyberpunk"}', 'Saved raw model response.');
  assert(entry?.output?.parsed?.theme === 'cyberpunk', 'Saved parsed model response.');
  assert(entry?.metadata?.tokensIn === 42, 'Tokens in correctly logged.');
  assert(entry?.metadata?.tokensOut === 84, 'Tokens out correctly logged.');
  assert(entry?.metadata?.finishReason === 'STOP', 'Finish reason correctly logged.');
  assert(typeof entry?.metadata?.durationMs === 'number' && entry.metadata.durationMs >= 0, 'Duration was recorded.');

  // 3. Test capturePrompt FAILURE
  console.log('\n[3] Testing capturePrompt FAILURE scenario...');
  shouldFailGemini = true;

  try {
    await capturePrompt({
      runId: run.id,
      phase: 'reduction',
      pass: '0.1',
      model: 'gemini-3.5-flash',
      prompt: 'This call will fail'
    });
    assert(false, 'Should have thrown Gemini error but succeeded.');
  } catch (err) {
    assert(true, 'Correctly caught thrown error when callGemini fails.');
  }

  // Find the failed prompt entry (should be the last created console entry)
  const entries = await listConsoleEntries(run.id);
  assert(entries.length === 2, 'Two entries in run timeline.');
  const failedEntry = entries[1];
  assert(failedEntry.error !== null && failedEntry.error.includes('Simulated Gemini API failure'), 'Error message saved inside IndexedDB record.');
  assert(typeof failedEntry.metadata?.durationMs === 'number', 'Duration still successfully logged on error.');

  // Reset Gemini stub
  shouldFailGemini = false;

  // 4. Test captureAssembly and captureSynthesis
  console.log('\n[4] Testing captureAssembly and captureSynthesis...');
  const { entryId: assemblyId } = await captureAssembly({
    runId: run.id,
    phase: 'reduction',
    pass: '0.2',
    inputs: {
      fragments: [{ name: 'rules.txt', content: 'Act 1 Rule' }]
    },
    output: 'Assembled rules content.'
  });

  const assemblyEntry = await getConsoleEntry(assemblyId);
  assert(assemblyEntry !== null && assemblyEntry.eventType === 'assembly', 'Assembly entry created.');
  assert(assemblyEntry?.output?.assembled === 'Assembled rules content.', 'Output assembled text captured.');

  const { entryId: synthesisId } = await captureSynthesis({
    runId: run.id,
    phase: 'reduction',
    pass: '0.2',
    parentEntryId: failedEntry.id, // linked to prompt parent
    input: 'raw models text output',
    synthesized: { parsed: true }
  });

  const synthesisEntry = await getConsoleEntry(synthesisId);
  assert(synthesisEntry !== null && synthesisEntry.eventType === 'synthesis', 'Synthesis entry created.');
  assert(synthesisEntry?.parentEntryId === failedEntry.id, 'Parent linkage is correctly populated.');

  // 5. Product linkage & automatic backfilling
  console.log('\n[5] Testing automatic producedArtifactId / producedCorpusId back-filling during writes...');
  const artInput = {
    runId: run.id,
    showId,
    artifactType: ArtifactType.ARC_LADDER,
    episodeId: null,
    scope: 'arc' as const,
    payload: { timeline: [] },
    payloadVersion: 1,
    createdByPass: '0.2',
    consoleEntryId: synthesisId // link to the synthesis entry
  };

  const artifact = await writeArtifact(artInput);
  const updatedSynthesisEntry = await getConsoleEntry(synthesisId);
  assert(updatedSynthesisEntry?.producedArtifactId === artifact.id, 'producedArtifactId was backfilled correctly on the synthesis console entry.');

  // 6. Test rolling cap pruner policy
  console.log('\n[6] Testing rolling cap pruner limits...');
  // Let's create more than 10 completed/failed runs and verify that the pruner retains:
  // - Currently active run
  // - Preserved runs
  // - 10 most recent closed-state runs

  // Let's add 15 closed runs
  // Format: runId, createdAt, status
  const baseTime = Date.now();
  for (let i = 1; i <= 15; i++) {
    const runId = `closed_run_${i}`;
    databaseStores.psb4_runs.data.set(runId, {
      id: runId,
      showId,
      status: 'completed',
      createdAt: baseTime + i * 1000,
      updatedAt: baseTime + i * 1000,
      completedAt: baseTime + i * 1000,
      preserved: i === 3, // mark #3 as preserved
      schemaVersion: 1
    });

    // Write a console entry for every run so we can test pruning
    databaseStores.psb4_console_entries.data.set(`entry_${runId}`, {
      id: `entry_${runId}`,
      runId,
      showId,
      createdAt: baseTime + i * 1000,
      schemaVersion: 1
    });
  }

  // Active run also has console entries
  databaseStores.psb4_console_entries.data.set(`entry_active`, {
    id: `entry_active`,
    runId: run.id,
    showId,
    createdAt: baseTime,
    schemaVersion: 1
  });

  // Run the pruner
  console.log('Triggering console pruner...');
  const resultPruning = await pruneConsoleEntries(showId);
  
  // Checking retention logic:
  // Total runs = 1 active (retained) + 15 completed
  // completed runs ranked desc by createdAt: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6] are the 10 most recent (retained).
  // completed run 3 is marked preserved (retained).
  // completed runs 1, 2, 4, 5 are pruned.
  // This means console entries for runs 1, 2, 4, 5 should be deleted.
  // There were 4 pruned console records (entry_closed_run_1, entry_closed_run_2, entry_closed_run_4, entry_closed_run_5).
  assert(resultPruning.pruned === 4, `Successfully pruned exactly ${resultPruning.pruned} orphaned console records. (Expected: 4)`);

  // Verify that active run entry still exists
  const activeEntry = await getConsoleEntry('entry_active');
  assert(activeEntry !== null, 'Active run console entry is retained.');

  // Verify that preserved completed run still exists
  const preservedClosedEntry = await getConsoleEntry('entry_closed_run_3');
  assert(preservedClosedEntry !== null, 'Completed run with preserved=true is exempt from pruning.');

  // Verify that most recent closed run (i=15) is retained
  const recentClosedEntry = await getConsoleEntry('entry_closed_run_15');
  assert(recentClosedEntry !== null, 'Most recent completed run console entry is retained.');

  // Verify that older closed run (i=1) was indeed pruned
  const olderClosedEntry = await getConsoleEntry('entry_closed_run_1');
  assert(olderClosedEntry === null, 'Older completed run console entry outside of 10 limit was pruned.');

  console.log('\n-----------------------------------------------------');
  if (testSuccess) {
    console.log('🎉 ALL PSB4 CONSOLE & REPLAY INTEGRITY TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME CONSOLE UNIT TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('CRITICAL CONSOLE TEST RUNNER FAILURE:', err);
  process.exit(1);
});
