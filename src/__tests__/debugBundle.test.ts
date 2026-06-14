import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePsb4DebugBundle } from '../utils/exports/debugBundle';
import { openDB } from '../storage/db';
import { ShowStorage } from '../storage/ShowStorage';
import { AssetStorage } from '../storage/AssetStorage';
import { ArtifactType } from '../psb4/types';
import JSZip from 'jszip';

// Setup Mock for ShowStorage and AssetStorage
vi.mock('../storage/ShowStorage', () => ({
  ShowStorage: {
    getById: vi.fn()
  }
}));

vi.mock('../storage/AssetStorage', () => ({
  AssetStorage: {
    exists: vi.fn(),
    getBlob: vi.fn()
  }
}));

// Setup Mock for IndexedDB retrieval helpers
vi.mock('../storage/db', () => ({
  openDB: vi.fn(),
  ASSET_STORE: 'assets'
}));

// Mock pass specs
vi.mock('../psb4/passes/registry', () => ({
  getAllPassSpecs: () => [
    {
      id: '0.9W',
      outputArtifactType: 'scene_script',
      requires: []
    },
    {
      id: '0.9G',
      outputArtifactType: 'segmentation_plan',
      requires: ['scene_script']
    }
  ]
}));

describe('generatePsb4DebugBundle unit tests', () => {
  const showId = 'test-show-123';
  const mockShow = {
    id: showId,
    name: 'Test Show Name',
    titleSuggestion: 'Test Show Title',
    showCode: 'TST',
    characters: [
      {
        id: 'char-1',
        handle: 'HERO',
        name: 'The Hero',
        portraitAssetId: 'asset-portrait-ok',
        visualAnchorAssetId: 'asset-anchor-missing'
      },
      {
        id: 'char-2',
        handle: 'VILLAIN',
        name: 'The Villain',
        portraitAssetId: null,
        visualAnchorAssetId: null
      }
    ],
    issues: [
      {
        uid: 'issue-1',
        issueCode: 'TST-I01',
        acts: [
          {
            uid: 'act-1',
            scenes: [
              {
                uid: 'scene-1',
                pageBeats: [
                  {
                    uid: 'pb-1',
                    beatType: 'DIALOGUE',
                    characterIds: ['char-1'],
                    productionPageUid: 'page-1',
                    address: 'TST-S1-I01-A1-SC1-PB1',
                    script: {
                      entries: [] // Missing dialogue/script linkage!
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const mockRuns = [
    {
      id: 'run-1',
      showId: showId,
      status: 'active',
      currentPass: '0.9G',
      createdAt: 1000,
      updatedAt: 1050
    },
    {
      id: 'run-other-show',
      showId: 'other-show-999',
      status: 'completed',
      createdAt: 900
    }
  ];

  // 0.9W has screenplay script with 2 units. 
  // 0.9G plan has invalid/dead unitIndex (index 5)
  const mockArtifacts = [
    {
      id: 'art-0.9w',
      runId: 'run-1',
      showId: showId,
      artifactType: ArtifactType.SCENE_SCRIPT,
      createdByPass: '0.9W',
      createdAt: 1010,
      payload: {
        scenes: [
          {
            actNumber: 1,
            sceneNumber: 1,
            title: 'An introductory meeting',
            setting: 'INT. CAFETERIA - DAY',
            screenplay: 'HERO walks in. VILLAIN looks at HERO.',
            script: [
              { kind: 'action', text: 'HERO walks in.', coversBeat: 1 },
              { kind: 'action', text: 'VILLAIN looks at HERO.', coversBeat: 1 }
            ]
          }
        ]
      }
    },
    {
      id: 'art-0.9g',
      runId: 'run-1',
      showId: showId,
      artifactType: ArtifactType.SEGMENTATION_PLAN,
      createdByPass: '0.9G',
      createdAt: 1020,
      payload: {
        scenes: [
          {
            actNumber: 1,
            sceneNumber: 1,
            pageBeats: [
              {
                unitIndices: [0, 5], // 5 is dead since length is 2!
                beatType: 'DIALOGUE',
                description: 'Dialogue beat with dead index'
              }
            ]
          }
        ]
      }
    }
  ];

  const mockConsoleEntries = [
    {
      id: 'console-error-stale',
      runId: 'run-1',
      showId: showId,
      eventType: 'error',
      phase: 'reduction',
      pass: '0.9W',
      error: 'Simulated Parse Connection Timeout',
      createdAt: 1011,
      output: null
    },
    {
      id: 'console-success-fresh',
      runId: 'run-1',
      showId: showId,
      eventType: 'assembly',
      phase: 'reduction',
      pass: '0.9W',
      error: null,
      createdAt: 1012,
      input: { prompt: 'Translate this script' },
      output: { 
        text: 'Clean parsed scene output Response JSON',
        warning: 'Character unresolved warning'
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(ShowStorage, 'getById').mockResolvedValue(mockShow as any);
    vi.spyOn(AssetStorage, 'exists').mockImplementation(async (id: string) => {
      return id === 'asset-portrait-ok';
    });
    vi.spyOn(AssetStorage, 'getBlob').mockImplementation(async (id: string) => {
      if (id === 'asset-portrait-ok') {
        const text = 'fake binary data for ok asset portrait representation';
        return new Blob([text], { type: 'image/png' });
      }
      return null;
    });

    // Mock IndexedDB fetchAllFromStore routing
    vi.mocked(openDB).mockResolvedValue({
      objectStoreNames: {
        contains: (name: string) => {
          return [
            'psb4_runs', 'psb4_artifacts', 'psb4_console_entries', 
            'psb4_source', 'psb4_corpus', 'production_image_versions', 
            'vps_runs', 'vps_records'
          ].includes(name);
        }
      },
      transaction: (storeName: string) => ({
        objectStore: () => ({
          getAll: () => ({
            onsuccess: null as any,
            onerror: null as any,
            get result() {
              if (storeName === 'psb4_runs') return mockRuns;
              if (storeName === 'psb4_artifacts') return mockArtifacts;
              if (storeName === 'psb4_console_entries') return mockConsoleEntries;
              return [];
            }
          })
        })
      })
    } as any);

    // Patch fetchAll to immediately fire onsuccess callback
    vi.mocked(openDB).mockImplementation(async () => {
      const dbMock = {
        objectStoreNames: {
          contains: () => true
        },
        transaction: (storeName: string) => {
          const reqMock = {
            onsuccess: null as any,
            result: [] as any
          };
          if (storeName === 'psb4_runs') reqMock.result = mockRuns;
          else if (storeName === 'psb4_artifacts') reqMock.result = mockArtifacts;
          else if (storeName === 'psb4_console_entries') reqMock.result = mockConsoleEntries;

          // Execute trigger
          setTimeout(() => {
            if (reqMock.onsuccess) reqMock.onsuccess();
          }, 0);

          return {
            objectStore: () => ({
              getAll: () => reqMock
            })
          };
        }
      };
      return dbMock as any;
    });
  });

  const loadZip = async (blob: Blob) => {
    const buffer = await blob.arrayBuffer();
    return JSZip.loadAsync(buffer);
  };

  it('1. Debug export includes psb4_runs, psb4_artifacts, and psb4_console_entries arrays', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    expect(zipBlob).toBeInstanceOf(Blob);

    const zip = await loadZip(zipBlob);
    
    // Verify file existence in the generated ZIP
    expect(zip.file('manifest.json')).not.toBeNull();
    expect(zip.file('show.json')).not.toBeNull();
    expect(zip.file('psb4/runs.json')).not.toBeNull();
    expect(zip.file('psb4/artifacts.json')).not.toBeNull();
    expect(zip.file('psb4/console-entries.json')).not.toBeNull();

    // Verify manifest contents schema
    const manifestContent = JSON.parse(await zip.file('manifest.json')!.async('text'));
    expect(manifestContent.exportType).toBe('psb4-debug-bundle');
    expect(manifestContent.recordCounts.psb4_runs).toBe(1); // Filtered by showId
    expect(manifestContent.recordCounts.psb4_artifacts).toBe(2);
    expect(manifestContent.recordCounts.psb4_console_entries).toBe(2);
  });

  it('2. Debug export includes replay console prompt and raw response fields', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);
    
    const consoleJson = JSON.parse(await zip.file('psb4/console-entries.json')!.async('text'));
    expect(consoleJson.length).toBe(2);

    const successEntry = consoleJson.find((e: any) => e.eventType === 'assembly');
    expect(successEntry.input.prompt).toBe('Translate this script');
    expect(successEntry.output.text).toBe('Clean parsed scene output Response JSON');
  });

  it('3. Debug export includes SCENE_SCRIPT and SCENE_STRUCTURE artifact payloads', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);

    const artifactsJson = JSON.parse(await zip.file('psb4/artifacts.json')!.async('text'));
    const wArt = artifactsJson.find((a: any) => a.artifactType === ArtifactType.SCENE_SCRIPT);
    expect(wArt).toBeDefined();
    expect(wArt.payload.scenes[0].screenplay).toContain('HERO walks in');
  });

  it('4. Character reference manifest correctly reports existing portrait/anchor assets', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);

    const charManifest = JSON.parse(await zip.file('character-reference-manifest.json')!.async('text'));
    const char1 = charManifest.find((c: any) => c.characterId === 'char-1');
    expect(char1.hasUsableReference).toBe(true); // portion asset exists
    expect(char1.portraitAssetId).toBe('asset-portrait-ok');
  });

  it('5. Character reference manifest reports missing visual refs', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);

    const charManifest = JSON.parse(await zip.file('character-reference-manifest.json')!.async('text'));
    
    const char2 = charManifest.find((c: any) => c.characterId === 'char-2');
    expect(char2.hasUsableReference).toBe(false); // No portrait/anchor assets
    
    const char1 = charManifest.find((c: any) => c.characterId === 'char-1');
    expect(char1.warnings).toContain('Visual anchor asset asset-anchor-missing is missing from db');
  });

  it('6. Story pipeline health detects a 0.9G pageBeat with invalid unitIndices', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);

    const healthJson = JSON.parse(await zip.file('health/story-pipeline-health.json')!.async('text'));
    expect(healthJson.diagnostics_0_9G.allUnitIndicesResolveCorrectly).toBe(false); // detects dead index 5
  });

  it('7. Story pipeline health detects pageBeats with missing dialogue/script linkage', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);

    const healthJson = JSON.parse(await zip.file('health/story-pipeline-health.json')!.async('text'));
    expect(healthJson.diagnostics_0_9G.pageBeatScriptPopulated).toBe(false); 
    expect(healthJson.diagnostics_0_9G.failedActiveDialogueBeatsCount).toBe(1);
  });

  it('8. Status summary identifies stale historical error versus latest success', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);

    const healthJson = JSON.parse(await zip.file('health/story-pipeline-health.json')!.async('text'));
    const wPassHealth = healthJson.passHealth.find((p: any) => p.passId === '0.9W');
    
    expect(wPassHealth.historicalErrorsExist).toBe(true);
    expect(wPassHealth.successExistsAfterError).toBe(true); // error at 1011, success at 1012
  });

  it('9. Export is scoped to the current show/project', async () => {
    const zipBlob = await generatePsb4DebugBundle(showId);
    const zip = await loadZip(zipBlob);

    const runsJson = JSON.parse(await zip.file('psb4/runs.json')!.async('text'));
    expect(runsJson.every((r: any) => r.showId === showId)).toBe(true);
    expect(runsJson.some((r: any) => r.id === 'run-other-show')).toBe(false); // other show's run filtered out
  });
});
