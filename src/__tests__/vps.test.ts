import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { openDB } from '../storage/db';
import {
  createVpsRun,
  getActiveVpsRun,
  updateVpsRunPhase,
  writeVpsRecord,
  getVpsRecord,
  getVpsRecordsByRun,
  markVpsRecordEdited,
  markVpsRecordApplied
} from '../vps/storage';
import { VpsRecordType } from '../vps/types';
import { runVpsPass } from '../vps/executor';
import { callGemini } from '../psb4/console';
import { VaultStorage } from '../storage/VaultStorage';
import type { Show } from '../types/show';
import { applyPageDirection } from '../vps/applyPageDirection';
import { applyEnvironmentDesign } from '../vps/applyEnvironmentDesign';

vi.mock('../psb4/console', async (importOriginal) => {
  const original = await importOriginal<typeof import('../psb4/console')>();
  return {
    ...original,
    callGemini: vi.fn(),
  };
});

vi.mock('../storage/VaultStorage', () => ({
  VaultStorage: {
    getById: vi.fn(),
  }
}));

describe('VPS Storage Operations', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await openDB();
    const tx = db.transaction(['vps_runs', 'vps_records'], 'readwrite');
    tx.objectStore('vps_runs').clear();
    tx.objectStore('vps_records').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  });

  it('can create and fetch an active VPS run', async () => {
    const run = await createVpsRun('show-123', 'issue-abc');
    expect(run.id).toBeDefined();
    expect(run.showId).toBe('show-123');
    expect(run.issueUid).toBe('issue-abc');

    const active = await getActiveVpsRun('show-123', 'issue-abc');
    expect(active).not.toBeNull();
    expect(active?.id).toBe(run.id);
  });

  it('can update run phase progress', async () => {
    const run = await createVpsRun('show-123', 'issue-abc');
    await updateVpsRunPhase(run.id, {
      currentPhase: 'environment',
      phaseProgress: {
        environment: 'running',
        page_direction: 'pending'
      }
    });

    const active = await getActiveVpsRun('show-123', 'issue-abc');
    expect(active?.currentPhase).toBe('environment');
    expect(active?.phaseProgress.environment).toBe('running');
  });

  it('can write, query, edit, and apply records', async () => {
    const run = await createVpsRun('show-123', 'issue-abc');
    const inputPayload = { hello: 'world' };

    const record = await writeVpsRecord({
      runId: run.id,
      showId: 'show-123',
      issueUid: 'issue-abc',
      recordType: VpsRecordType.ENVIRONMENT_DESIGN,
      scopeKey: null,
      payload: inputPayload,
      payloadVersion: 1,
      createdByPass: 'env',
      consoleEntryId: null
    });

    expect(record.id).toBeDefined();
    expect(record.payload).toEqual(inputPayload);
    expect(record.authorEdited).toBe(false);

    // Get single record
    const fetched = await getVpsRecord(run.id, VpsRecordType.ENVIRONMENT_DESIGN, null);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(record.id);

    // Edit record
    const editedPayload = { hello: 'author' };
    const edited = await markVpsRecordEdited(record.id, editedPayload);
    expect(edited.authorEdited).toBe(true);
    expect(edited.payload).toEqual(editedPayload);

    // Fetch lists
    const list = await getVpsRecordsByRun(run.id);
    expect(list).toHaveLength(1);
    expect(list[0].authorEdited).toBe(true);

    // Apply record
    await markVpsRecordApplied(record.id);
    const applied = await getVpsRecord(run.id, VpsRecordType.ENVIRONMENT_DESIGN, null);
    expect(applied?.applied).toBe(true);
    expect(applied?.appliedAt).not.toBeNull();
  });
});

describe('VPS Executor Pipeline', () => {
  let mockShow: Show;

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await openDB();
    const tx = db.transaction(['vps_runs', 'vps_records'], 'readwrite');
    tx.objectStore('vps_runs').clear();
    tx.objectStore('vps_records').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });

    mockShow = {
      id: 'show-123',
      name: 'VPS Test Show',
      characters: [
        { id: 'char-123', handle: '@ech.Arvok', name: 'Arvok', visualAnchor: 'cybernetic arm' }
      ],
      settingAnchors: [
        { id: 'anch-1', name: 'INT. CONTROL ROOM', visualDescription: 'high tech, neon blue' }
      ],
      issues: [
        {
          uid: 'issue-abc',
          showId: 'show-123',
          legacyEpisodeId: 'ep-legacy',
          issueCode: 'TST-I01',
          number: 1,
          title: 'First Venture',
          promotedAt: Date.now(),
          status: 'active',
          gndsArtifactId: 'art-123',
          acts: [
            {
              uid: 'act-1',
              number: 1,
              title: 'First Act',
              scenes: [
                {
                  uid: 'sc-1',
                  number: 1,
                  title: 'The Inception',
                  setting: 'INT. CONTROL ROOM',
                  settingAnchorId: 'anch-1',
                  dramaticWant: 'Secure console',
                  sceneFunction: 'Opening',
                  pageBeats: [
                    {
                      uid: 'pb-1',
                      address: 'TST-I01-A1-SC01-PB01',
                      number: 1,
                      description: 'Arvok logs in.',
                      beatType: 'ACTION',
                      characterIds: ['char-123'],
                      subtext: 'suppressed dread',
                      visualNote: 'glow from screen',
                      direction: 'type carefully',
                      productionPageUid: 'page-1',
                      script: {
                        entries: [
                          { kind: 'line', characterHandle: '@ech.Arvok', text: 'System on.' }
                        ]
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as unknown as Show;

    vi.mocked(VaultStorage.getById).mockResolvedValue(mockShow);
  });

  it('runs environment pass successfully', async () => {
    // Stage mock response from Gemini
    vi.mocked(callGemini).mockResolvedValue({
      text: JSON.stringify({
        environments: [
          {
            settingName: 'INT. CONTROL ROOM',
            settingAnchorId: 'anch-1',
            source: 'reused',
            visualDescription: 'highly realistic tech cockpit',
            mood: 'tense and dark',
            interiorExterior: 'interior'
          }
        ]
      })
    } as any);

    const run = await createVpsRun('show-123', 'issue-abc');
    const result = await runVpsPass(run.id, 'env');

    expect(result.success).toBe(true);
    expect(result.records).toBe(1);

    const rec = await getVpsRecord(run.id, VpsRecordType.ENVIRONMENT_DESIGN, null);
    expect(rec).not.toBeNull();
    expect(rec?.payload.environments[0].settingName).toBe('INT. CONTROL ROOM');
    expect(rec?.payload.environments[0].visualDescription).toBe('highly realistic tech cockpit');
  });

  it('runs page direction pass successfully and utilizes context history', async () => {
    vi.mocked(callGemini).mockResolvedValue({
      text: JSON.stringify({
        pageRegister: {
          lighting: 'blue fluorescent',
          mood: 'paranoid',
          emotionalRegister: 'cold',
          environmentalDetail: 'moderate'
        },
        panels: [
          {
            shotType: 'close-up',
            action: 'typing on console',
            foreground: 'keypad',
            midground: 'finger',
            background: 'screens',
            relationalStaging: '',
            blocking: [
              {
                handle: '@ech.Arvok',
                zone: 'middle-center',
                depth: 'midground',
                facing: 'forward',
                bodyLanguage: 'rapid clicking',
                facialExpression: 'glaring',
                inResponseTo: 'ambient system buzz'
              }
            ],
            dialogueIndices: [0],
            captionIndices: [],
            directAddress: false,
            props: []
          }
        ]
      })
    } as any);

    const run = await createVpsRun('show-123', 'issue-abc');
    const result = await runVpsPass(run.id, 'page');

    expect(result.success).toBe(true);
    expect(result.records).toBe(1);

    const rec = await getVpsRecord(run.id, VpsRecordType.PAGE_DIRECTION, 'page-1');
    expect(rec).not.toBeNull();
    expect(rec?.payload.pageRegister.lighting).toBe('blue fluorescent');
    expect(rec?.payload.panels[0].blocking[0].handle).toBe('@ech.Arvok');

    // Verify history was passed to gemini call
    expect(callGemini).toHaveBeenCalled();
  });

  it('correctly applies page direction payload to show object', async () => {
    const run = await createVpsRun('show-123', 'issue-abc');
    const record = await writeVpsRecord({
      runId: run.id,
      showId: 'show-123',
      issueUid: 'issue-abc',
      recordType: VpsRecordType.PAGE_DIRECTION,
      scopeKey: 'page-1',
      payload: {
        pageRegister: {
          lighting: 'harsh neon yellow',
          mood: 'chaotic',
          emotionalRegister: 'frenzied',
          environmentalDetail: 'rich'
        },
        panels: [
          {
            shotType: 'EXTREME CLOSE-UP',
            action: 'Arvok types rapidly',
            foreground: 'keyboard',
            midground: 'finger',
            background: 'screen overlay',
            relationalStaging: 'centered focus',
            directAddress: true,
            blocking: [
              {
                handle: '@ech.Arvok',
                zone: 'middle-center',
                depth: 'midground',
                facing: 'forward',
                bodyLanguage: 'shaking hands',
                facialExpression: 'sweating fear',
                inResponseTo: 'error notification'
              }
            ],
            dialogueIndices: [0],
            captionIndices: [],
            props: [
              { label: 'Cyberdeck', description: 'sleek silver deck' },
              { label: 'Energy drink', description: 'half-empty can' }
            ]
          },
          {
            shotType: 'WIDE SHOT',
            action: 'He takes a sip of energy drink',
            foreground: 'energy drink',
            midground: 'entire body',
            background: 'control desk',
            relationalStaging: 'right profile',
            directAddress: false,
            blocking: [
              {
                handle: '@ech.Arvok',
                zone: 'middle-right',
                depth: 'midground',
                facing: 'left',
                bodyLanguage: 'relaxed lean',
                facialExpression: 'groggy sighs',
                inResponseTo: 'tasty caffeine'
              }
            ],
            dialogueIndices: [],
            captionIndices: [],
            props: [
              { label: 'Energy drink', description: 'half-empty can' }
            ]
          }
        ]
      },
      payloadVersion: 1,
      createdByPass: 'page',
      consoleEntryId: null
    });

    const updatedShow = await applyPageDirection(record, mockShow);
    const pb = updatedShow.issues![0].acts[0].scenes[0].pageBeats[0];

    expect(pb.panelPlans).toHaveLength(2);
    expect(pb.panelPlans![0].shotType).toBe('EXTREME CLOSE-UP');
    expect(pb.panelPlans![0].directAddress).toBe(true);
    expect(pb.panelPlans![0].foreground).toBe('keyboard');
    expect(pb.panelPlans![0].relationalStaging).toBe('centered focus');
    expect(pb.panelPlans![1].directAddress).toBe(false);

    // Verify characterPosition expressions on panel
    expect(pb.panelPlans![0].characterPositions?.[0]).toEqual({
      characterHandle: '@ech.Arvok',
      zone: 'middle-center',
      depth: 'midground',
      facing: 'forward',
      bodyLanguage: 'shaking hands',
      facialExpression: 'sweating fear',
      inResponseTo: 'error notification'
    });

    // Verify multi-panel prop deduplication
    expect(pb.panelProps).toBeDefined();
    expect(pb.panelProps).toHaveLength(1);
    expect(pb.panelProps![0].label).toBe('Energy drink'); // appears in both panels

    // Verify visual direction page register holds our register values
    expect(pb.visualDirection).toEqual({
      lighting: 'harsh neon yellow',
      mood: 'chaotic',
      emotionalRegister: 'frenzied',
      environmentalDetail: 'rich'
    });
  });

  it('correctly applies environment design payload to show object', async () => {
    const run = await createVpsRun('show-123', 'issue-abc');
    const record = await writeVpsRecord({
      runId: run.id,
      showId: 'show-123',
      issueUid: 'issue-abc',
      recordType: VpsRecordType.ENVIRONMENT_DESIGN,
      scopeKey: null,
      payload: {
        environments: [
          {
            settingName: 'INT. CONTROL ROOM', // anchor exists (anch-1), source is generated
            source: 'generated',
            visualDescription: 'extreme tech noir control room with blue shadows',
            mood: 'dark, cyber',
            interiorExterior: 'interior'
          },
          {
            settingName: 'EXT. WASTELAND DOCKS', // anchor does NOT exist, source is generated
            source: 'generated',
            visualDescription: 'crumbling rust and foggy ship docks',
            mood: 'desolate',
            interiorExterior: 'exterior'
          },
          {
            settingName: 'INT. CORRIDOR', // source is reused, should remain untouched
            source: 'reused',
            visualDescription: 'generic metal corridor',
            mood: 'sterile',
            interiorExterior: 'interior'
          }
        ]
      },
      payloadVersion: 1,
      createdByPass: 'env',
      consoleEntryId: null
    });

    // Let's copy mockShow and add a scene with EXT. WASTELAND DOCKS which doesn't have settingAnchorId yet
    const modifiedMockShow = {
      ...mockShow,
      issues: [
        {
          ...mockShow.issues![0],
          acts: [
            {
              ...mockShow.issues![0].acts[0],
              scenes: [
                ...mockShow.issues![0].acts[0].scenes,
                {
                  uid: 'sc-2',
                  number: 2,
                  title: 'The Great Plains',
                  setting: 'EXT. WASTELAND DOCKS',
                  settingAnchorId: undefined, // needs resolution
                  dramaticWant: 'Flee the zone',
                  sceneFunction: 'Transition',
                  pageBeats: []
                }
              ]
            }
          ]
        }
      ]
    } as unknown as Show;

    const updatedShow = await applyEnvironmentDesign(record, modifiedMockShow);

    // 1. Check existing anchor updated
    const anchors = updatedShow.settingAnchors || [];
    const ctrlRoomAnchor = anchors.find(a => a.id === 'anch-1');
    expect(ctrlRoomAnchor).toBeDefined();
    expect(ctrlRoomAnchor?.visualDescription).toBe('extreme tech noir control room with blue shadows');
    expect(ctrlRoomAnchor?.mood).toBe('dark, cyber');

    // 2. Check new anchor created
    const dockAnchor = anchors.find(a => a.name === 'EXT. WASTELAND DOCKS');
    expect(dockAnchor).toBeDefined();
    expect(dockAnchor?.id).toBeDefined();
    expect(dockAnchor?.visualDescription).toBe('crumbling rust and foggy ship docks');
    expect(dockAnchor?.interiorExterior).toBe('exterior');

    // 3. Check reused setting NOT created/updated
    const corridorAnchor = anchors.find(a => a.name === 'INT. CORRIDOR');
    expect(corridorAnchor).toBeUndefined();

    // 4. Check settingAnchorId resolved on scenes
    const sceneCoch = updatedShow.issues![0].acts[0].scenes.find(s => s.uid === 'sc-2');
    expect(sceneCoch).toBeDefined();
    expect(sceneCoch?.settingAnchorId).toBe(dockAnchor?.id);
  });

  it('skips page direction planning for already applied page records', async () => {
    const run = await createVpsRun('show-123', 'issue-abc');

    // Inject an already-applied page record for 'page-1'
    const rec = await writeVpsRecord({
      runId: run.id,
      showId: 'show-123',
      issueUid: 'issue-abc',
      recordType: VpsRecordType.PAGE_DIRECTION,
      scopeKey: 'page-1',
      payload: {
        panels: [
          { shotType: 'close-up', action: 'typing' }
        ]
      },
      payloadVersion: 1,
      createdByPass: 'page',
      consoleEntryId: null,
    });
    await markVpsRecordApplied(rec.id);

    vi.mocked(callGemini).mockClear();

    const result = await runVpsPass(run.id, 'page');

    expect(result.success).toBe(true);
    expect(result.records).toBe(0); // 0 records written because the only page was skipped
    expect(callGemini).not.toHaveBeenCalled(); // Gemini was never called because it skipped!
  });

  it('does not skip already applied page records if forceRegenerate is true', async () => {
    const run = await createVpsRun('show-123', 'issue-abc');

    // Inject an already-applied page record for 'page-1'
    const rec = await writeVpsRecord({
      runId: run.id,
      showId: 'show-123',
      issueUid: 'issue-abc',
      recordType: VpsRecordType.PAGE_DIRECTION,
      scopeKey: 'page-1',
      payload: {
        panels: [
          { shotType: 'close-up', action: 'typing' }
        ]
      },
      payloadVersion: 1,
      createdByPass: 'page',
      consoleEntryId: null,
    });
    await markVpsRecordApplied(rec.id);

    vi.mocked(callGemini).mockClear();
    vi.mocked(callGemini).mockResolvedValue({
      text: JSON.stringify({
        pageRegister: { lighting: 'neon' },
        panels: [{ shotType: 'wide', action: 'standing' }]
      })
    } as any);

    const result = await runVpsPass(run.id, 'page', { forceRegenerate: true });

    expect(result.success).toBe(true);
    expect(result.records).toBe(1); // 1 record overwritten/written
    expect(callGemini).toHaveBeenCalled(); // Gemini WAS called because of forceRegenerate!
  });
});
