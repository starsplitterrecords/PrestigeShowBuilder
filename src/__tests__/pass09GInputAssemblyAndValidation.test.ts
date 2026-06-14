import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from '../storage/db';
import { runPass } from '../psb4/passes/executor';
import { getPassSpec } from '../psb4/passes/registry';
import { createRun, writeSource, writeArtifact, getArtifactsByRun, supersedeArtifact } from '../psb4/storage';
import { ArtifactType} from '../psb4/types';

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

describe('0.9G Pass Input Assembly and Pre-flight Validations', () => {
  let runId: string;
  const showId = 'test-show-09g';
  const episodeId = 'episode-e2';

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbLocal = await openDB();
    const tx = dbLocal.transaction(['psb4_runs', 'psb4_artifacts', 'psb4_corpus', 'psb4_source'], 'readwrite');
    tx.objectStore('psb4_runs').clear();
    tx.objectStore('psb4_artifacts').clear();
    tx.objectStore('psb4_corpus').clear();
    tx.objectStore('psb4_source').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });

    const run = await createRun(showId, 'hash-09g');
    runId = run.id;

    await writeSource({
      id: 'source-1234',
      runId,
      showId,
      capturedAt: Date.now(),
      exportSourceHash: 'hash-09g',
      exportFormat: 'psb3-internal-v1',
      detectedBand: 'A',
      show: {
        id: showId,
        title: 'Mock Show 0.9G Specs',
        register: null,
        characters: [{ id: '@lucia', name: 'Lucia', role: 'Hero', voiceProfile: 'Brave', aliases: [] }]
      },
      season: { title: 'Season 1', arcSummary: null, structureConfig: null, briefGrid: null },
      episodes: [{ id: episodeId, title: 'Episode 1', index: 1, summary: null, brief: null, scenes: [], rawProse: null }],
      flags: [],
      schemaVersion: 1
    });

    // Save SCENE_STRUCTURE from 0.9S
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
              }
            ]
          }
        ]
      }
    });
  });

  it('fails pre-model execution with a clear error when screenplay is empty and script is empty', async () => {
    // Save 0.9W SCENE_SCRIPT artifact with EMPTY screenplay and EMPTY script
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
            screenplay: '',
            script: []
          }
        ]
      }
    });

    const spec = getPassSpec('0.9G')!;
    const result = await runPass(runId, spec);

    expect(result.success).toBe(false);
    expect(result.error).toContain('0.9G cannot segment');
  });

  it('successfully generates inputs from screenplay-only field when script array is empty', async () => {
    // Save 0.9W SCENE_SCRIPT artifact with screenplay-only
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
            screenplay: 'INT. KITCHEN - DAY\nLucia searches the drawer.\n\nLUCIA\nNo luck.',
          }
        ]
      }
    });

    const spec = getPassSpec('0.9G')!;
    const capturePromptSpy = vi.mocked(runPass); // actually spying on capturePrompt

    // Let's run and catch error if LLM isn't fully mocked for 0.9G parser, but verifying it doesn't fail pre-flight formatting
    const r = await runPass(runId, spec);
    // Since we didn't mock a success result for capturePrompt, it might fail after 3 attempts or succeed if parsedPayload is mocked
    // What matters is that it proceeded past formatting without throwing the pre-flight "no script units derived from screenplay" error.
    expect(r.success).toBe(true);
    expect(r.error || '').not.toContain('no script units derived from screenplay');
  });

  it('successfully skips LLM execution of 0.9G and reuses existing artifact if the episode is already fully completed', async () => {
    // 1. Save 0.9W SCENE_SCRIPT artifact
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
            screenplay: 'INT. KITCHEN - DAY\nLucia searches the drawer.\n\nLUCIA\nNo luck.',
            script: [
              { index: 0, type: 'action', text: 'Lucia searches pantry.', character: '' },
              { index: 1, type: 'dialogue', text: 'No luck.', character: 'LUCIA' }
            ]
          }
        ]
      }
    });

    const arts = await getArtifactsByRun(runId);
    const existingSArt = arts.find(a => a.artifactType === ArtifactType.SCENE_STRUCTURE)!;

    // 2. Supersede the existing 0.9S SCENE_STRUCTURE with our complete 0.9G SCENE_STRUCTURE artifact
    const existingGArt = await supersedeArtifact(
      existingSArt.id,
      {
        runId,
        showId,
        artifactType: ArtifactType.SCENE_STRUCTURE,
        episodeId,
        scope: 'episode',
        payloadVersion: 1,
        createdByPass: '0.9G',
        payload: {
          acts: [
            {
              actNumber: 1,
              scenes: [
                {
                  sceneNumber: 1,
                  title: 'Beginning Scene',
                  setting: 'Kitchen',
                  pageBeats: [
                    { unitIndices: [0, 1], beatType: 'DIALOGUE', description: 'Lucia searches, then says no luck.' }
                  ]
                }
              ]
            }
          ]
        }
      },
      { force: true }
    );

    const spec = getPassSpec('0.9G')!;
    const r = await runPass(runId, spec);

    // Verify it succeeded
    expect(r.success).toBe(true);
    expect(r.artifacts.length).toBe(1);
    expect(r.artifacts[0].id).toBe(existingGArt.id);
  });
});
