import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from '../storage/db';
import { runPass } from '../psb4/passes/executor';
import { getPassSpec } from '../psb4/passes/registry';
import { 
  createRun, 
  writeSource, 
  writeArtifact, 
  getArtifactsByRun, 
  resetPass09G,
  supersedeArtifact
} from '../psb4/storage';
import { ArtifactType } from '../psb4/types';
import { computePassStatuses } from '../psb4/ui/utils/passStatus';
import { capturePrompt } from '../psb4/console';

vi.mock('../firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_firestore, ...pathSegments) => {
    const path = pathSegments.join('/');
    return { path, id: pathSegments[pathSegments.length - 1] };
  }),
  setDoc: vi.fn(async () => Promise.resolve()),
  deleteDoc: vi.fn(async () => Promise.resolve()),
  collection: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ docs: [] }))
}));

vi.mock('../psb4/console', async (importOriginal) => {
  const original = await importOriginal<typeof import('../psb4/console')>();
  return {
    ...original,
    capturePrompt: vi.fn(),
    captureAssembly: vi.fn().mockResolvedValue({ entryId: 'assembly-1' }),
    captureSynthesis: vi.fn().mockResolvedValue({ entryId: 'synth-1' }),
    captureError: vi.fn().mockResolvedValue({ entryId: 'err-1' }),
  };
});

describe('0.9G Resume, Idempotency, and Multi-Episode Status Regression Suite', () => {
  let runId: string;
  const showId = 'test-show-09g-resume';
  const episode1 = 'ep-1';
  const episode2 = 'ep-2';

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbLocal = await openDB();
    const tx = dbLocal.transaction(['psb4_runs', 'psb4_artifacts', 'psb4_corpus', 'psb4_source', 'psb4_console_entries'], 'readwrite');
    tx.objectStore('psb4_runs').clear();
    tx.objectStore('psb4_artifacts').clear();
    tx.objectStore('psb4_corpus').clear();
    tx.objectStore('psb4_source').clear();
    tx.objectStore('psb4_console_entries').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });

    // Create target run with ep-1 and ep-2 in scope
    const run = await createRun(showId, 'hash-resume-09g', undefined, [episode1, episode2]);
    runId = run.id;

    // Save source structure indicating both episodes
    await writeSource({
      id: 'source-resume-1',
      runId,
      showId,
      capturedAt: Date.now(),
      exportSourceHash: 'hash-resume-09g',
      exportFormat: 'psb3-internal-v1',
      detectedBand: 'A',
      show: {
        id: showId,
        title: 'Mock Show',
        register: null,
        characters: [{ id: '@lucia', name: 'Lucia', role: 'Hero', voiceProfile: 'Brave', aliases: [] }]
      },
      season: { title: 'Season 1', arcSummary: null, structureConfig: null, briefGrid: null },
      episodes: [
        { id: episode1, title: 'Episode 1', index: 1, summary: null, brief: null, scenes: [], rawProse: null },
        { id: episode2, title: 'Episode 2', index: 2, summary: null, brief: null, scenes: [], rawProse: null }
      ],
      flags: [],
      schemaVersion: 1
    });

    // Write base 0.9S artifacts for BOTH episodes
    for (const epId of [episode1, episode2]) {
      await writeArtifact({
        runId,
        showId,
        artifactType: ArtifactType.SCENE_STRUCTURE,
        episodeId: epId,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9S',
        payload: {
          acts: [
            {
              actNumber: 1,
              scenes: [
                { sceneNumber: 1, title: 'Scene 1', setting: 'Kitchen' },
                { sceneNumber: 2, title: 'Scene 2', setting: 'Garden' }
              ]
            }
          ]
        }
      });

      // Write 0.9W scripts for BOTH episodes
      await writeArtifact({
        runId,
        showId,
        artifactType: ArtifactType.SCENE_SCRIPT,
        episodeId: epId,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9W',
        payload: {
          scenes: [
            {
              actNumber: 1,
              sceneNumber: 1,
              title: 'Scene 1',
              setting: 'Kitchen',
              screenplay: 'INT. KITCHEN - DAY\nLUCIA\nHi.',
              script: [{ index: 0, type: 'dialogue', text: 'Hi.', character: 'LUCIA' }]
            },
            {
              actNumber: 1,
              sceneNumber: 2,
              title: 'Scene 2',
              setting: 'Garden',
              screenplay: 'EXT. GARDEN - DAY\nLUCIA\nBye.',
              script: [{ index: 0, type: 'dialogue', text: 'Bye.', character: 'LUCIA' }]
            }
          ]
        }
      });
    }
  });

  // Test 1: resetPass09G deletes only 0.9G artifacts and console entries
  it('resetPass09G() deletes only 0.9G output', async () => {
    // Write 0.9G scene structure artifact by superseding the existing S-structure
    const artsBefore = await getArtifactsByRun(runId);
    const existingSArt = artsBefore.find(a => a.artifactType === ArtifactType.SCENE_STRUCTURE && a.episodeId === episode1)!;

    const gArt = await supersedeArtifact(
      existingSArt.id,
      {
        runId,
        showId,
        artifactType: ArtifactType.SCENE_STRUCTURE,
        episodeId: episode1,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9G',
        payload: { acts: [] }
      },
      { force: true }
    );

    // Write a console entry for 0.9G
    const dbLocal = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_console_entries', 'readwrite');
      tx.objectStore('psb4_console_entries').add({
        id: 'con-09g',
        runId,
        showId,
        pass: '0.9G',
        eventType: 'synthesis',
        createdAt: Date.now()
      });
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });

    // Reset 0.9G
    await resetPass09G(runId);

    // Verify 0.9G artifact was deleted
    const arts = await getArtifactsByRun(runId);
    expect(arts.some(a => a.id === gArt.id)).toBe(false);

    // Verify 0.9W and 0.9S artifacts were preserved
    expect(arts.some(a => a.createdByPass === '0.9W')).toBe(true);
    expect(arts.some(a => a.createdByPass === '0.9S')).toBe(true);

    // Verify console entries for 0.9G were deleted
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_console_entries', 'readonly');
      const req = tx.objectStore('psb4_console_entries').get('con-09g');
      req.onsuccess = () => {
        expect(req.result).toBeUndefined();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Test 2: computePassStatuses aggregates across scoped episodes
  it('aggregates status of 0.9G across multiple scoped episodes', async () => {
    const dbLocal = await openDB();
    
    // Initial run: no 0.9G artifacts -> status is pending
    const runReq = dbLocal.transaction('psb4_runs', 'readonly').objectStore('psb4_runs').get(runId);
    await new Promise<void>((resolve) => {
      runReq.onsuccess = () => resolve();
    });
    const run = runReq.result;

    const artsInitial = await getArtifactsByRun(runId);
    const initialStatuses = computePassStatuses(run, artsInitial, [], [episode1, episode2]);
    expect(initialStatuses['0.9G']).toBe('pending');

    // 1 episode has completed 0.9G, the other has none -> status must be partial
    const existingArts = await getArtifactsByRun(runId);
    const ep1SArt = existingArts.find(a => a.artifactType === ArtifactType.SCENE_STRUCTURE && a.episodeId === episode1 && a.createdByPass === '0.9S')!;

    await supersedeArtifact(
      ep1SArt.id,
      {
        runId,
        showId,
        artifactType: ArtifactType.SCENE_STRUCTURE,
        episodeId: episode1,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9G',
        payload: {
          metadata: { completedSceneKeys: ['A1S1', 'A1S2'] },
          acts: [
            {
              actNumber: 1,
              scenes: [
                { sceneNumber: 1, pageBeats: [{ unitIndices: [0] }] },
                { sceneNumber: 2, pageBeats: [{ unitIndices: [0] }] }
              ]
            }
          ]
        }
      },
      { force: true }
    );

    const artsPartial = await getArtifactsByRun(runId);
    const partialStatuses = computePassStatuses(run, artsPartial, [], [episode1, episode2]);
    expect(partialStatuses['0.9G']).toBe('partial');

    // Both episodes complete 0.9G -> status must be complete
    const ep2SArt = existingArts.find(a => a.artifactType === ArtifactType.SCENE_STRUCTURE && a.episodeId === episode2 && a.createdByPass === '0.9S')!;

    await supersedeArtifact(
      ep2SArt.id,
      {
        runId,
        showId,
        artifactType: ArtifactType.SCENE_STRUCTURE,
        episodeId: episode2,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9G',
        payload: {
          metadata: { completedSceneKeys: ['A1S1', 'A1S2'] },
          acts: [
            {
              actNumber: 1,
              scenes: [
                { sceneNumber: 1, pageBeats: [{ unitIndices: [0] }] },
                { sceneNumber: 2, pageBeats: [{ unitIndices: [0] }] }
              ]
            }
          ]
        }
      },
      { force: true }
    );

    const artsFull = await getArtifactsByRun(runId);
    const fullStatuses = computePassStatuses(run, artsFull, [], [episode1, episode2]);
    expect(fullStatuses['0.9G']).toBe('complete');
  });

  // Test 3: duplicates of historical scene_script are allowed because no cloning happens
  it('ignores historical scene_script duplicates on resume', async () => {
    // Write historical/duplicate scene_script artifacts by superseding the original
    const arts = await getArtifactsByRun(runId);
    const oldScript = arts.find(a => a.artifactType === ArtifactType.SCENE_SCRIPT && a.episodeId === episode1)!;

    await supersedeArtifact(
      oldScript.id,
      {
        runId,
        showId,
        artifactType: ArtifactType.SCENE_SCRIPT,
        episodeId: episode1,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9W',
        payload: { scenes: [] }
      },
      { force: true }
    );

    const artsDupe = await getArtifactsByRun(runId);
    const scriptArts = artsDupe.filter(a => a.artifactType === ArtifactType.SCENE_SCRIPT && a.episodeId === episode1);
    expect(scriptArts.length).toBeGreaterThan(1); // Real duplicates are stored in history

    // Ensure running pass on the active run succeeds without "duplicates" blocking errors
    const spec = getPassSpec('0.9G')!;
    const loader = runPass(runId, spec, { forceRegenerate: false });
    await expect(loader).resolves.toBeDefined();
  });

  // Test 4: 0.9G resume skips completed scenes
  it('0.9G resume skips already completed scenes', async () => {
    // Make 0.9G run with one scene completed by superseding the 0.9S scene structure
    const arts = await getArtifactsByRun(runId);
    const existingSArt = arts.find(a => a.artifactType === ArtifactType.SCENE_STRUCTURE && a.episodeId === episode1 && a.createdByPass === '0.9S')!;

    await supersedeArtifact(
      existingSArt.id,
      {
        runId,
        showId,
        artifactType: ArtifactType.SCENE_STRUCTURE,
        episodeId: episode1,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9G',
        payload: {
          metadata: { completedSceneKeys: ['A1S1'] },
          acts: [
            {
              actNumber: 1,
              scenes: [
                { sceneNumber: 1, pageBeats: [{ unitIndices: [0], beatType: 'DIALOGUE', description: 'existing' }] }
              ]
            }
          ]
        }
      },
      { force: true }
    );

    const spec = getPassSpec('0.9G')!;
    const res = await runPass(runId, spec, { forceRegenerate: false });

    expect(res.success).toBe(true);

    // Retrieve the newly written or superseded 0.9G SCENE_STRUCTURE artifact
    const finalArts = await getArtifactsByRun(runId);
    finalArts.sort((a, b) => b.createdAt - a.createdAt);
    const finalGArt = finalArts.find(a => a.artifactType === ArtifactType.SCENE_STRUCTURE && a.episodeId === episode1 && a.createdByPass === '0.9G')!;
    const payload = finalGArt.payload as any;

    const s1 = payload.acts[0].scenes.find((s: any) => s.sceneNumber === 1);
    const s2 = payload.acts[0].scenes.find((s: any) => s.sceneNumber === 2);

    expect(s1).toBeDefined();
    // Scene 1 was already completed, so its manually tailored pages should be preserved!
    expect(s1.beats[0].description).toBe('existing');

    expect(s2).toBeDefined();
    // Scene 2 was not complete, so it is split deterministically.
    expect(s2.beats[0].description).toBe('Scene continuation');
  });

  // Test 5: Verify 0.9G status calculation for complete vs partial
  it('correctly calculates 0.9G status and compiles correct blocker message', async () => {
    // Initially, let's write or mock some artifacts.
    // ep-1 has 2 scenes expected (A1S1, A1S2). ep-2 has 2 scenes expected (A1S1, A1S2).
    // Let's write a partial 0.9G artifact for ep-1 that only covers A1S1.
    const run = { id: runId, showId, scopeEpisodeIds: [episode1, episode2] } as any;

    const arts = await getArtifactsByRun(runId);
    const supersededIds = new Set(arts.map(a => a.supersedesArtifactId).filter(Boolean));
    const activeStructure = arts.find(a => a.artifactType === ArtifactType.SCENE_STRUCTURE && a.episodeId === episode1 && !supersededIds.has(a.id));
    if (activeStructure) {
      await supersedeArtifact(activeStructure.id, {
        runId,
        showId,
        artifactType: ArtifactType.SCENE_STRUCTURE,
        episodeId: episode1,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9G',
        payload: {
          metadata: { completedSceneKeys: ['A1S1'] },
          acts: [
            {
              actNumber: 1,
              scenes: [
                { sceneNumber: 1, pageBeats: [{ unitIndices: [0], beatType: 'DIALOGUE', description: 'desc' }] }
              ]
            }
          ]
        }
      }, { force: true });
    }

    const currentArts = await getArtifactsByRun(runId);
    const statuses = computePassStatuses(run, currentArts, [], [episode1, episode2], null, { id: showId, title: 'Mock Show' });

    expect(statuses['0.9G']).toBe('partial');
    const details = (statuses as any)._details?.['0.9G'];
    expect(details.reason).toContain('0.9G PARTIAL');
    expect(details.reason).toContain('Missing:');
    // It should explicitly state which scenes are missing from ep-1 and ep-2 (e.g. A1S2 for ep-1, whole ep-2 scenes)
    expect(details.reason).toContain('A1S2');
  });
});
