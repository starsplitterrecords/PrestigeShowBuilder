import { readSource } from '../reader';
import { getRun, createRun, getSourceByRun, listConsoleEntries, writeSource, completeRun } from '../storage';
import { FlagCode, NormalizedSource } from '../types';
import { ShowStorage } from '../../storage/ShowStorage';
import { Psb4InvariantError } from '../errors';
import { computeExportHash } from '../reader/hash';

// ----------------------------------------------------------------------------
// FULL INDEXEDDB IN-MEMORY MOCK FOR PSB4 READER TESTS
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
  psb4_console_entries: new MockIDBObjectStore('psb4_console_entries'),
  psb4_source: new MockIDBObjectStore('psb4_source')
};

// Index setups
databaseStores.psb4_runs.createIndex('by-show-status', ['showId', 'status']);
databaseStores.psb4_runs.createIndex('by-show', 'showId');
databaseStores.psb4_console_entries.createIndex('by-run', 'runId');
databaseStores.psb4_console_entries.createIndex('by-show-created', ['showId', 'createdAt']);
databaseStores.psb4_source.createIndex('by-run', 'runId');
databaseStores.psb4_source.createIndex('by-show-hash', ['showId', 'exportSourceHash']);

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
if (typeof (globalThis as any).IDBKeyRange === 'undefined') {
  (globalThis as any).IDBKeyRange = class {
    static bound() { return {}; }
    static lowerBound() { return {}; }
    static upperBound() { return {}; }
    static only() { return {}; }
  };
}

// ----------------------------------------------------------------------------
// TEST ROSTER & FIXTURES
// ----------------------------------------------------------------------------

const mockShows = new Map<string, any>();
ShowStorage.getById = async (id: string) => {
  return mockShows.get(id) || null;
};

// Canonical characters roster for reconciliation tests
const sampleRoster = [
  { id: '@ech.theo', name: 'Theo', role: 'Lead', voiceProfile: 'Speaks calmly.' },
  { id: '@ech.lin', name: 'Lin', role: 'Support', voiceProfile: 'Analytical and sharp.' },
  { id: '@ech.stargazer', name: 'Stargazer', role: 'Antagonist', voiceProfile: 'Raspy whisper.' }
];

// Band A Rich Export
const bandA_export = {
  season: {
    title: 'Season 1: Deep Tech',
    arcSummary: 'An intense sci-fi corporate infiltration arc.',
    structureConfig: { targetBeats: 12 },
    briefGrid: { ep1Brief: 'Theoretical models of quantum keys.' }
  },
  episodes: [
    {
      id: 'ep_101',
      title: 'Quantum Resonance',
      summary: 'The crew tries to decode the cipher key.',
      scenes: [
        {
          id: 'sc_01',
          heading: 'INT. CODE LAB - NIGHT',
          beats: [
            {
              id: 'bt_01',
              characterIds: ['@ech.theo', '@ech.lin'],
              description: 'Lin looks up at the terminal.',
              lines: [
                { characterId: '@ech.lin', text: 'Nothing makes sense here.', type: 'dialogue' },
                { characterId: '@ech.theo', text: 'Give it time.', type: 'dialogue' }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Band B Stale Export
const bandB_export = {
  season: {
    title: 'Season 1: Deep Tech',
    arcSummary: 'An intense sci-fi corporate infiltration arc.'
  },
  episodes: [
    {
      id: 'ep_102',
      title: 'Stale Signals',
      scenes: [
        {
          id: 'sc_02',
          heading: 'EXT. ABANDONED STATION - DAWN',
          beats: [
            {
              id: 'bt_02',
              characterIds: ['@starsplit.theo', '@unrecognized.one'], // @starsplit.theo should reconcile to @ech.theo
              description: 'Stale ID verification test.',
              lines: [
                { characterId: '@starsplit.theo', text: 'I am here.', type: 'dialogue' }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Band C Loose Prose Export
const bandC_export = {
  season: {
    title: 'Season 1: Deep Tech'
  },
  episodes: [
    {
      id: 'ep_103',
      title: 'Loose Strings',
      rawProse: `
INT. KITCHEN - MORNING
Theo looks exhausted. He pours coffee.
LIN: Did you sleep?
THEO (Quietly): Not a chance.
"Well, you should have," Lin says.
      `
    }
  ]
};

// Band D Prose Only Export
const bandD_export = {
  episodes: [
    {
      id: 'ep_104',
      rawProse: `
Theo sits on the rooftop, gazing at the distant neon skyline.
A cold rain begins to fall, washing away his hopes of returning home.
      `
    }
  ]
};


// ----------------------------------------------------------------------------
// TEST SUITE EVALUATION
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
  console.log('--- STARTING PSB4 TELEPLAY READER PIPELINE TESTS ---');

  const showId = 'show_wave1_tests';
  mockShows.set(showId, {
    id: showId,
    name: 'Wave 1 Cosmic Show',
    characters: sampleRoster
  });

  // Test 1: Format & Band A Detection and Extraction
  console.log('\n[1] Testing Band A (Rich) Export...');
  const run1 = await createRun(showId, computeExportHash(bandA_export));
  const sourceA = await readSource(run1.id, bandA_export);
  
  assert(sourceA.detectedBand === 'A', 'Band A correctly classified.');
  assert(sourceA.exportFormat === 'psb3-internal-v1', 'Format matched to internal structured');
  assert(sourceA.episodes.length === 1, 'Extracted 1 episode.');
  assert(sourceA.episodes[0].scenes[0].beats[0].characterIds.includes('@ech.theo'), 'Extracted correct characterIds.');
  assert(sourceA.flags.length === 0, 'No warning flags on valid Band A export.');

  // Check console tracing
  const logsA = await listConsoleEntries(run1.id);
  assert(logsA.some(l => l.pass === 'read.detect'), 'Trace includes detect stage.');
  assert(logsA.some(l => l.pass === 'read.show'), 'Trace includes snapshot stage.');
  assert(logsA.some(l => l.pass === 'read.extract'), 'Trace includes extract stage.');
  assert(logsA.some(l => l.pass === 'read.finalize'), 'Trace includes finalize stage.');

  await completeRun(run1.id);

  // Test 2: Band B (Reconciliation & Warnings)
  console.log('\n[2] Testing Band B (Alias Match & Unrecognized Warnings)...');
  const run2 = await createRun(showId, computeExportHash(bandB_export));
  const sourceB = await readSource(run2.id, bandB_export);

  assert(sourceB.detectedBand === 'B', 'Band B correctly classified.');
  assert(sourceB.flags.some(f => f.code === FlagCode.STALE_CHARACTER_ID_RECONCILED), 'Flags contains stale reconciliation flag.');
  assert(sourceB.flags.some(f => f.code === FlagCode.UNRECOGNIZED_CHARACTER_ID), 'Flags contains unrecognized character flag.');
  
  const theoNC = sourceB.show.characters.find(c => c.id === '@ech.theo');
  assert(theoNC?.aliases.includes('@starsplit.theo') === true, 'Aliases tracked stale handle on normalized character.');

  await completeRun(run2.id);

  // Test 3: Band C (Loose Prose with Scene Boundaries)
  console.log('\n[3] Testing Band C (Prose Segmentation)...');
  const run3 = await createRun(showId, computeExportHash(bandC_export));
  const sourceC = await readSource(run3.id, bandC_export);

  assert(sourceC.detectedBand === 'C', 'Band C correctly classified.');
  assert(sourceC.episodes[0].scenes.length === 1, 'Split scene by INT. boundary.');
  assert(sourceC.episodes[0].scenes[0].heading === 'INT. KITCHEN - MORNING', 'Extracted scene heading.');
  
  const scBeats = sourceC.episodes[0].scenes[0].beats[0];
  assert(scBeats.characterIds.includes('@ech.theo') && scBeats.characterIds.includes('@ech.lin'), 'Parsed speaker names from prose dialog cues.');
  assert(sourceC.flags.some(f => f.code === FlagCode.UNATTRIBUTED_DIALOGUE), 'Flags captures unattributed quotes.');

  await completeRun(run3.id);

  // Test 4: Band D (Pure Prose with no markers)
  console.log('\n[4] Testing Band D (Pure prose)...');
  const run4 = await createRun(showId, computeExportHash(bandD_export));
  const sourceD = await readSource(run4.id, bandD_export);

  assert(sourceD.detectedBand === 'D', 'Band D correctly classified.');
  assert(sourceD.flags.some(f => f.code === FlagCode.BAND_D_LOW_STRUCTURE), 'Info flag tells down-chain models that low structure is present.');
  assert(sourceD.episodes[0].scenes[0].heading === null, 'Left heading as null under ambiguous prose.');

  await completeRun(run4.id);

  // Test 5: Idempotency & Immutability Violation
  console.log('\n[5] Testing Idempotency & Run Immutability Invariant...');
  const sourceA_reRead = await readSource(run1.id, bandA_export);
  assert(sourceA_reRead.id === sourceA.id, 'Subsequent read returns identical record synchronously.');

  try {
    // Attempt reading different teleplay hash for same run
    await readSource(run1.id, bandB_export);
    console.error('❌ Expected readSource with mutated hash to fail, but it succeeded.');
    testSuccess = false;
  } catch (err: any) {
    if (err instanceof Psb4InvariantError && err.code === 'HASH_MISMATCH') {
      console.log('✅ Correctly refused to overwrite immutable run source hash.');
    } else {
      console.error('❌ Threw wrong error on hash mismatch:');
      console.error(err);
      testSuccess = false;
    }
  }

  console.log('\n--- TEST SUMMARY ---');
  if (testSuccess) {
    console.log('💚 ALL PSB4 READER PIPELINE TESTS PASSED SUCCESSFULY');
    process.exit(0);
  } else {
    console.error('🔴 SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('CRITICAL UNHANDLED ERROR RUNNING TESTS:', err);
  process.exit(1);
});
