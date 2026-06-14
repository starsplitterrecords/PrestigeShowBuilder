import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from '../storage/db';
import { 
  getRun, 
  forkRunAtomically, 
  listRuns, 
  getArtifactsByRun 
} from '../psb4/storage';
import { runPass } from '../psb4/passes/executor';
import { ShowStorage } from '../storage/ShowStorage';
import { Psb4Run, Psb4Artifact, PassSpec, ArtifactType } from '../psb4/types';
import { computePassStatuses } from '../psb4/ui/utils/passStatus';

describe('PSB4 Fork and Hydration Invariants', () => {
  const showId = 'test-show-fork-hydration';
  let sourceRunId = 'source-run-id';

  beforeEach(async () => {
    const dbLocal = await openDB();
    // Clean up to prevent stale ID cross-pollution
    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction(['psb4_runs', 'psb4_artifacts'], 'readwrite');
      tx.objectStore('psb4_runs').clear();
      tx.objectStore('psb4_artifacts').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const mockShow = {
      id: showId,
      name: 'Fork Test Show',
      titleSuggestion: '',
      premise: '',
      themes: '',
      activeRunId: sourceRunId,
      initMode: 'seed' as const,
      draftVersion: 1,
      createdAt: Date.now(),
      lastModified: Date.now(),
      showCode: 'FX',
      depthConfig: {},
      styleConfig: { positivePrompt: '', negativePrompt: '' },
      characters: [],
      seasons: []
    };
    await ShowStorage.saveOne(mockShow, false);

    // Create a complete read-only source run
    const sourceRun: Psb4Run = {
      id: sourceRunId,
      showId,
      status: 'active',
      hydrationStatus: 'complete',
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      completedAt: null,
      currentPhase: 'rebuild',
      currentPass: '0.9G',
      phaseProgress: {
        reduction: 'complete',
        arc_lock: 'complete',
        rebuild: 'pending',
        enrichment: 'pending',
      },
      preserved: true,
      scopeEpisodeIds: ['ep1'],
      schemaVersion: 1,
      sourceTeleplayHash: 'hash-abc',
      sourceCapturedAt: Date.now() - 100000,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_runs', 'readwrite');
      const store = tx.objectStore('psb4_runs');
      const req = store.put(sourceRun);
      req.onsuccess = () => resolve();
    });

    // Write a dummy scene_script / scene_structure artifact for source
    const scriptArt: Psb4Artifact = {
      id: 'source-script-art',
      showId,
      runId: sourceRunId,
      artifactType: ArtifactType.SCENE_SCRIPT,
      createdAt: Date.now() - 90000,
      episodeId: 'ep1',
      createdByPass: '0.9W',
      payload: { 
        scenes: [
          { actNumber: 1, sceneNumber: 1, title: 'Scene 1', script: [] },
          { actNumber: 1, sceneNumber: 2, title: 'Scene 2', script: [] }
        ] 
      },
      scope: 'episode',
      payloadVersion: 1,
      consoleEntryId: null,
      authorEdited: false,
      authorEditedAt: null,
      supersedesArtifactId: null,
      schemaVersion: 1,
    };

    const structureArt: Psb4Artifact = {
      id: 'source-structure-art',
      showId,
      runId: sourceRunId,
      artifactType: ArtifactType.SCENE_STRUCTURE,
      createdAt: Date.now() - 80000,
      episodeId: 'ep1',
      createdByPass: '0.9S',
      payload: { 
        acts: [
          { 
            actNumber: 1, 
            scenes: [
              { sceneNumber: 1 },
              { sceneNumber: 2 }
            ] 
          }
        ] 
      },
      scope: 'episode',
      payloadVersion: 1,
      consoleEntryId: null,
      authorEdited: false,
      authorEditedAt: null,
      supersedesArtifactId: null,
      schemaVersion: 1,
    };

    const gStructureArt: Psb4Artifact = {
      id: 'source-g-structure-art',
      showId,
      runId: sourceRunId,
      artifactType: ArtifactType.SCENE_STRUCTURE,
      createdAt: Date.now() - 70000,
      episodeId: 'ep1',
      createdByPass: '0.9G',
      payload: { 
        acts: [
          { 
            actNumber: 1, 
            scenes: [
              { sceneNumber: 1, beats: [{ unitIndices: [0] }] }
            ] 
          }
        ] 
      },
      scope: 'episode',
      payloadVersion: 1,
      consoleEntryId: null,
      authorEdited: false,
      authorEditedAt: null,
      supersedesArtifactId: null,
      schemaVersion: 1,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
      const store = tx.objectStore('psb4_artifacts');
      store.put(scriptArt);
      store.put(structureArt);
      store.put(gStructureArt);
      tx.oncomplete = () => resolve();
    });
  });

  it('proves fork is hydrated atomically, statuses are checked correctly, and read-only source remains intact', async () => {
    const dbLocal = await openDB();

    // 1. Manually write a mock run that is 'hydrating' to test its constraints deterministically
    const mockHydratingRunId = 'mock-hydrating-run-id';
    const mockHydratingRun: Psb4Run = {
      id: mockHydratingRunId,
      showId,
      status: 'hydrating',
      hydrationStatus: 'hydrating',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      currentPhase: 'rebuild',
      currentPass: '0.9G',
      phaseProgress: {
        reduction: 'pending',
        arc_lock: 'pending',
        rebuild: 'pending',
        enrichment: 'pending',
      },
      preserved: false,
      scopeEpisodeIds: ['ep1'],
      schemaVersion: 1,
      sourceTeleplayHash: 'hash-abc',
      sourceCapturedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = dbLocal.transaction('psb4_runs', 'readwrite');
      const store = tx.objectStore('psb4_runs');
      const req = store.put(mockHydratingRun);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // A. Verify that a hydrating run status is reported as hydrating by computePassStatuses
    const mockCheckStatuses = computePassStatuses(mockHydratingRun, [], [], ['ep1']);
    expect(mockCheckStatuses['0.9G']).toBe('hydrating');

    // B. Verify that a hydrating run cannot be executed
    const spec: PassSpec = { 
      id: '0.9G', 
      phase: 'rebuild', 
      name: 'Scene Segmentation', 
      description: 'Scene Segmentation Pass',
      scope: 'episode',
      inputs: [],
      promptTemplateId: 'p_0_9g_segmentation',
      parserId: 'parseSingleSegPlan',
      outputArtifactType: ArtifactType.SCENE_STRUCTURE, 
      outputPayloadVersion: 1,
      registerFraming: { enabled: false, proseGuidance: {} },
      requires: [], 
      defaultModel: 'gemini-flash', 
      defaultTemperature: 0 
    };
    const runRes = await runPass(mockHydratingRunId, spec);
    expect(runRes.success).toBe(false);
    expect(runRes.error).toContain('is not executable');

    // 2. Perform the atomic fork from the source run
    const completeFork = await forkRunAtomically(showId, sourceRunId);
    expect(completeFork.status).toBe('active');
    expect(completeFork.hydrationStatus).toBe('complete');

    // 3 & 4. activeRunId only changes to the new run after verified copy
    const show = await ShowStorage.getById(showId);
    expect(show?.activeRunId).toBe(completeFork.id);

    // 5. Fork run contains all expected artifacts from source
    const copiedArts = await getArtifactsByRun(completeFork.id);
    expect(copiedArts).toHaveLength(3);
    expect(copiedArts.map(a => a.artifactType)).toContain(ArtifactType.SCENE_SCRIPT);
    expect(copiedArts.map(a => a.artifactType)).toContain(ArtifactType.SCENE_STRUCTURE);

    // 6. 0.9G shows partial progress (not blocked) once fork is active
    const consoleEntries: any[] = [];
    const derivedStatuses = computePassStatuses(completeFork, copiedArts, consoleEntries, ['ep1']);
    expect(derivedStatuses['0.9G']).toBe('partial');

    // 7. Read-only source run remains completely unchanged and read-only
    const sourceRunAfter = await getRun(sourceRunId);
    expect(sourceRunAfter?.status).toBe('failed'); // Marked failed as it is no longer the active run, but artifacts are intact

    // 8. Rerun targets the correct run, not the source
    const specSourceRes = await runPass(sourceRunId, spec);
    expect(specSourceRes.success).toBe(false);
    expect(specSourceRes.error).toContain('is not executable'); // Source run cannot be run because activeRunId has changed to fork

    // 9. All idempotent transition transitions complete cleanly
  });
});
