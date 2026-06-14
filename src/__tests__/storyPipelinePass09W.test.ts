import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from '../storage/db';
import { getPassSpec } from '../psb4/passes/registry';
import { runPass } from '../psb4/passes/executor';
import { 
  createRun, 
  writeSource, 
  writeArtifact, 
  getArtifactsByType 
} from '../psb4/storage';
import { ArtifactType, NormalizedSource } from '../psb4/types';
import { capturePrompt } from '../psb4/console';

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

describe('0.9W Resumable Pipeline Pass Invariants', () => {
  let runId: string;
  const showId = 'test-show-09w';
  const episodeId = 'episode-e1';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset local database stores
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(['psb4_runs', 'psb4_artifacts', 'psb4_corpus', 'psb4_source'], 'readwrite');
    tx.objectStore('psb4_runs').clear();
    tx.objectStore('psb4_artifacts').clear();
    tx.objectStore('psb4_corpus').clear();
    tx.objectStore('psb4_source').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });

    // Create active run
    const run = await createRun(showId, 'hash-09w');
    runId = run.id;

    // Save mock source
    const mockSource: NormalizedSource = {
      id: 'source-123',
      runId,
      showId,
      capturedAt: Date.now(),
      exportSourceHash: 'hash-09w',
      exportFormat: 'psb3-internal-v1',
      detectedBand: 'A',
      show: {
        id: showId,
        title: 'Mock Show 0.9W',
        register: null,
        characters: [
          { id: '@lucia', name: 'Lucia', role: 'Hero', voiceProfile: 'Brave', aliases: [] }
        ]
      },
      season: {
        title: 'Season 1',
        arcSummary: null,
        structureConfig: null,
        briefGrid: null
      },
      episodes: [
        {
          id: episodeId,
          title: 'Episode 1',
          index: 1,
          summary: null,
          brief: null,
          scenes: [],
          rawProse: null
        }
      ],
      flags: [],
      schemaVersion: 1
    };
    await writeSource(mockSource);

    // Write primary SCENE_STRUCTURE artifact
    await writeArtifact({
      runId,
      showId,
      artifactType: ArtifactType.SCENE_STRUCTURE,
      episodeId,
      scope: 'episode',
      payloadVersion: 1,
      createdByPass: '0.9S',
      payload: {
        acts: [
          {
            actNumber: 1,
            scenes: [
              {
                sceneNumber: 1,
                title: 'Beginning Scene',
                setting: 'Kitchen',
                dramaticWant: 'Search for coffee',
                beats: [
                  { beatType: 'ACTION', description: 'Lucia searches pantry.', characterHandles: ['@lucia'] }
                ]
              },
              {
                sceneNumber: 2,
                title: 'Dramatic Conundrum',
                setting: 'Living Room',
                dramaticWant: 'Confess',
                beats: [
                  { beatType: 'DIALOGUE', description: 'Lucia sighs heavily.', characterHandles: ['@lucia'] }
                ]
              }
            ]
          }
        ]
      }
    });
  });

  it('successful full pipeline run produces correct output shape expected by 0.9G', async () => {
    // Mock the prompt response for both scenes
    vi.mocked(capturePrompt).mockImplementation(async ({ parser, step }) => {
      const isScene1 = String(step || '').includes('scene1');
      const rawScene = JSON.stringify({
        actNumber: 1,
        sceneNumber: isScene1 ? 1 : 2,
        title: isScene1 ? 'Beginning Scene' : 'Dramatic Conundrum',
        setting: isScene1 ? 'Kitchen' : 'Living Room',
        screenplay: isScene1 ? 'Scene 1 full prose' : 'Scene 2 full prose',
        script: []
      });
      if (parser) {
        const result = parser(rawScene);
        return {
          result,
          entryId: 'prompt-e-1',
          responseText: rawScene
        };
      }
      throw new Error('parser must be specified');
    });

    const spec = getPassSpec('0.9W');
    expect(spec).not.toBeNull();
    if (!spec) return;

    const result = await runPass(runId, spec);
    expect(result.success).toBe(true);

    // Retrieve SCENE_SCRIPT artifact
    const arts = await getArtifactsByType(runId, ArtifactType.SCENE_SCRIPT);
    arts.sort((a, b) => b.createdAt - a.createdAt);
    expect(arts.length).toBeGreaterThan(0);
    const scriptPayload = arts[0].payload as any;

    // Check payload structure compatibility
    expect(scriptPayload).toHaveProperty('scenes');
    expect(scriptPayload.scenes).toHaveLength(2);
    expect(scriptPayload.scenes[0].sceneNumber).toBe(1);
    expect(scriptPayload.scenes[1].sceneNumber).toBe(2);
    expect(scriptPayload.scenes[0].screenplay).toBe('Scene 1 full prose');
  });

  it('existing completed scenes are skipped and reuse past artifacts', async () => {
    // Write prior SCENE_SCRIPT with scene 1 already completed
    await writeArtifact({
      runId,
      showId,
      artifactType: ArtifactType.SCENE_SCRIPT,
      episodeId,
      scope: 'episode',
      payloadVersion: 1,
      createdByPass: '0.9W',
      payload: {
        scenes: [
          {
            actNumber: 1,
            sceneNumber: 1,
            title: 'Beginning Scene',
            setting: 'Kitchen',
            screenplay: 'Already done scene 1 prose',
            script: []
          }
        ]
      }
    });

    // Mock only scene 2 generation
    vi.mocked(capturePrompt).mockImplementation(async ({ parser }) => {
      const rawScene = JSON.stringify({
        actNumber: 1,
        sceneNumber: 2,
        title: 'Dramatic Conundrum',
        setting: 'Living Room',
        screenplay: 'Scene 2 generated prose',
        script: []
      });
      if (parser) {
        const result = parser(rawScene);
        return {
          result,
          entryId: 'prompt-e-2',
          responseText: rawScene
        };
      }
      throw new Error('parser must be specified');
    });

    const spec = getPassSpec('0.9W');
    if (!spec) return;

    const result = await runPass(runId, spec);
    expect(result.success).toBe(true);

    // Inspect that capturePrompt was called exactly once (because scene 1 was skipped)
    expect(capturePrompt).toHaveBeenCalledTimes(1);

    // Verify both scenes now exist in output
    const arts = await getArtifactsByType(runId, ArtifactType.SCENE_SCRIPT);
    arts.sort((a, b) => b.createdAt - a.createdAt);
    const payload = arts[0].payload as any;
    expect(payload.scenes).toHaveLength(2);
    expect(payload.scenes[0].screenplay).toBe('Already done scene 1 prose'); // preserved!
    expect(payload.scenes[1].screenplay).toBe('Scene 2 generated prose');
  });

  it('a failed later scene preserves earlier scenes in the database', async () => {
    // Mock capturePrompt to succeed on scene 1 but throw on scene 2
    vi.mocked(capturePrompt).mockImplementation(async ({ parser, step }) => {
      if (String(step || '').includes('scene2')) {
        throw new Error('Scene 2 hard transient error');
      }
      const rawScene = JSON.stringify({
        actNumber: 1,
        sceneNumber: 1,
        title: 'Beginning Scene',
        setting: 'Kitchen',
        screenplay: 'Scene 1 prose successfully completed',
        script: []
      });
      if (parser) {
        const result = parser(rawScene);
        return {
          result,
          entryId: 'prompt-e-1',
          responseText: rawScene
        };
      }
      throw new Error('parser must be specified');
    });

    const spec = getPassSpec('0.9W');
    if (!spec) return;

    const result = await runPass(runId, spec);
    expect(result.success).toBe(false);
    expect(result.error).toContain('failed (Act 1, Scene 2)');

    // Verify that the SCENE_SCRIPT artifact exists and preserves Scene 1
    const arts = await getArtifactsByType(runId, ArtifactType.SCENE_SCRIPT);
    arts.sort((a, b) => b.createdAt - a.createdAt);
    expect(arts.length).toBeGreaterThan(0);
    const payload = arts[0].payload as any;
    expect(payload.scenes).toHaveLength(1);
    expect(payload.scenes[0].sceneNumber).toBe(1);
    expect(payload.scenes[0].screenplay).toBe('Scene 1 prose successfully completed');
  });

  it('rerun resumes from the missing scene and successfully completes', async () => {
    // Initialize with scene 1 already in place
    await writeArtifact({
      runId,
      showId,
      artifactType: ArtifactType.SCENE_SCRIPT,
      episodeId,
      scope: 'episode',
      payloadVersion: 1,
      createdByPass: '0.9W',
      payload: {
        scenes: [
          {
            actNumber: 1,
            sceneNumber: 1,
            title: 'Beginning Scene',
            setting: 'Kitchen',
            screenplay: 'Scene 1 prose successfully completed',
            script: []
          }
        ]
      }
    });

    // Mock capturePrompt to succeed for any scene requested
    vi.mocked(capturePrompt).mockImplementation(async ({ parser }) => {
      const rawScene = JSON.stringify({
        actNumber: 1,
        sceneNumber: 2,
        title: 'Dramatic Conundrum',
        setting: 'Living Room',
        screenplay: 'Scene 2 prose generated in rerun',
        script: []
      });
      if (parser) {
        const result = parser(rawScene);
        return {
          result,
          entryId: 'prompt-e-2',
          responseText: rawScene
        };
      }
      throw new Error('parser must be specified');
    });

    const spec = getPassSpec('0.9W');
    if (!spec) return;

    const result = await runPass(runId, spec);
    expect(result.success).toBe(true);

    // Verify that model was only prompted for the missing scene 2
    expect(capturePrompt).toHaveBeenCalledTimes(1);

    // Verify combined database payload
    const arts = await getArtifactsByType(runId, ArtifactType.SCENE_SCRIPT);
    arts.sort((a, b) => b.createdAt - a.createdAt);
    const payload = arts[0].payload as any;
    expect(payload.scenes).toHaveLength(2);
    expect(payload.scenes[0].screenplay).toBe('Scene 1 prose successfully completed');
    expect(payload.scenes[1].screenplay).toBe('Scene 2 prose generated in rerun');
  });

  it('0.9G prompt assembly fallback correctly processes scenes with populated screenplay and empty script array', async () => {
    // Write SCENE_SCRIPT artifact with screenplay populated and empty script array
    await writeArtifact({
      runId,
      showId,
      artifactType: ArtifactType.SCENE_SCRIPT,
      episodeId,
      scope: 'episode',
      payloadVersion: 1,
      createdByPass: '0.9W',
      payload: {
        scenes: [
          {
            actNumber: 1,
            sceneNumber: 1,
            title: 'Beginning Scene',
            setting: 'Kitchen',
            screenplay: 'INT. KITCHEN - DAY\nLucia reaches for the cup.\n\nLUCIA\nWhere is the coffee?\n\n[CAPTION: It is truly empty.]',
            script: []
          }
        ]
      }
    });

    // Mock 0.9G segmentation prompt response
    vi.mocked(capturePrompt).mockImplementation(async ({ parser }) => {
      const resp = JSON.stringify({
        scenes: [
          {
            actNumber: 1,
            sceneNumber: 1,
            pageBeats: [
              {
                unitIndices: [0, 1, 2, 3],
                beatType: 'DIALOGUE',
                description: 'Lucia seeks coffee.'
              }
            ]
          }
        ]
      });
      if (parser) {
        const result = parser(resp);
        return {
          result,
          entryId: 'prompt-g-1',
          responseText: resp
        };
      }
      throw new Error('parser must be specified');
    });

    const spec = getPassSpec('0.9G');
    expect(spec).not.toBeNull();
    if (!spec) return;

    const result = await runPass(runId, spec);
    expect(result.success).toBe(true);

    const targetStructureArts = await getArtifactsByType(runId, ArtifactType.SCENE_STRUCTURE);
    targetStructureArts.sort((a, b) => b.createdAt - a.createdAt);
    expect(targetStructureArts.length).toBeGreaterThan(0);
    const finalStructure = targetStructureArts[0].payload as any;
    expect(finalStructure.acts[0].scenes[0].beats).toHaveLength(1);
    expect(finalStructure.acts[0].scenes[0].beats[0].description).toBe('Scene continuation');
  });
});

