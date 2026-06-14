import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB } from '../storage/db';
import { getPassSpec } from '../psb4/passes/registry';
import { runPass } from '../psb4/passes/executor';
import { createRun, writeSource, writeArtifact } from '../psb4/storage';
import { ArtifactType, NormalizedSource } from '../psb4/types';
import { capturePrompt } from '../psb4/console';

// We mock firebase/firestore to intercept the calls and verify the exact paths and data being persisted
const mockDocsWritten: { path: string; data: any }[] = [];

vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...original,
    doc: vi.fn((_firestore, ...pathSegments) => {
      // Return a mock reference containing the path
      const path = pathSegments.join('/');
      return { path, id: pathSegments[pathSegments.length - 1] };
    }),
    setDoc: vi.fn(async (ref: any, data: any, _options?: any) => {
      mockDocsWritten.push({ path: ref.path, data });
      return Promise.resolve();
    }),
  };
});

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

describe('0.9W Firestore Persistence Verification', () => {
  const showId = 'sdnrvphhy';
  const episodeId = 'episode-e1';
  let runId: string;

  beforeEach(async () => {
    mockDocsWritten.length = 0;
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
        characters: [],
      },
      season: {
        title: 'Season 1',
        arcSummary: null,
        structureConfig: null,
        briefGrid: null,
      },
      episodes: [
        {
          id: episodeId,
          index: 1,
          title: 'Episode 1',
          summary: 'Episode 1 summary',
          brief: null,
          rawProse: null,
          scenes: [
            {
              id: 'scene-1',
              index: 1,
              heading: 'INT. KITCHEN - DAY',
              beats: [
                {
                  id: 'beat-1',
                  index: 1,
                  characterIds: [],
                  description: 'Kitchen establishing shot.',
                  direction: null,
                  continuityAnchor: null,
                  panelPlans: null,
                  lines: [],
                }
              ]
            }
          ]
        }
      ],
      flags: [],
      schemaVersion: 1,
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
              }
            ]
          }
        ]
      }
    });
  });

  it('proves that pass 0.9W successful run persists a SCENE_SCRIPT artifact and run record to Firestore paths', async () => {
    // 1. Mock 0.9W JSON parser output
    vi.mocked(capturePrompt).mockImplementation(async ({ parser }) => {
      const resp = JSON.stringify({
        actNumber: 1,
        sceneNumber: 1,
        title: 'Beginning Scene',
        setting: 'Kitchen',
        screenplay: 'INT. KITCHEN - DAY\nLucia reaches for the cup.\n\nLUCIA\nWhere is the coffee?\n\n[CAPTION: It is truly empty.]',
        script: [
          { kind: 'action', text: 'INT. KITCHEN - DAY', coversBeat: 1 },
          { kind: 'action', text: 'Lucia reaches for the cup.', coversBeat: 1 },
          { kind: 'line', characterHandle: '@lucia', text: 'Where is the coffee?', coversBeat: 1 },
          { kind: 'caption', text: 'It is truly empty.', coversBeat: 1 }
        ]
      });
      if (parser) {
        const result = parser(resp);
        return {
          result,
          entryId: 'prompt-1',
          responseText: resp
        };
      }
      throw new Error('parser must be specified');
    });

    const spec = getPassSpec('0.9W');
    expect(spec).not.toBeNull();
    if (!spec) return;

    // 2. Execute pass 0.9W
    const result = await runPass(runId, spec);
    expect(result.success).toBe(true);

    // 3. Verify that Firestore writes are sent to the correct paths
    // Verify run record path
    const runDoc = mockDocsWritten.find(d => d.path.includes(`psb4/${showId}/runs/`));
    expect(runDoc).toBeDefined();
    expect(runDoc?.data.status).toBe('active');

    // Verify artifact path and content
    const artDoc = mockDocsWritten.find(d => d.path.includes(`psb4/${showId}/artifacts/`) && d.data.artifactType === ArtifactType.SCENE_SCRIPT);
    expect(artDoc).toBeDefined();
    expect(artDoc?.data.artifactType).toBe(ArtifactType.SCENE_SCRIPT);
    expect(artDoc?.data.payload.scenes[0].title).toBe('Beginning Scene');
  });
});
