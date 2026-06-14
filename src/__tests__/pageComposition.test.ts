import { describe, it, expect, vi } from 'vitest';
import { page_direction } from '../vps/parsers/page_direction';
import { applyPageDirection } from '../vps/applyPageDirection';
import { buildFinalPageBeat } from '../ai/imageGeneration/finalPageContract';
import type { Show } from '../types/show';
import type { VpsRecord } from '../vps/types';
import { VpsRecordType } from '../vps/types';

vi.mock('../vps/storage', () => ({
  markVpsRecordApplied: vi.fn().mockResolvedValue(undefined),
}));

describe('Page Composition & Layout Direction (DA-047)', () => {
  it('correctly parses pageComposition from model JSON response', () => {
    const rawJson = JSON.stringify({
      pageRegister: {
        lighting: 'Dappled, cold window light',
        mood: 'pensive',
        emotionalRegister: 'tension',
        environmentalDetail: 'rich'
      },
      pageComposition: {
        layoutName: 'FEATURE_DETAIL',
        focalPanelIndex: 1,
        isSplash: false,
        compositionNote: 'Highlighting the listener\'s reactive expression'
      },
      panels: [
        { shotType: 'wide', action: 'Luzia enters the control room.' },
        { shotType: 'close-up', action: 'Arvok looks up sharply.' },
        { shotType: 'medium', action: 'No speech, heavy eye contact.' }
      ]
    });

    const result = page_direction.parse(rawJson);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.pageComposition).toBeDefined();
      expect(result.payload.pageComposition.layoutName).toBe('FEATURE_DETAIL');
      expect(result.payload.pageComposition.focalPanelIndex).toBe(1);
      expect(result.payload.pageComposition.isSplash).toBe(false);
      expect(result.payload.pageComposition.compositionNote).toContain('listener');
    }
  });

  it('safely falls back during parsing when layoutName is out-of-set or mismatched', () => {
    const rawJson = JSON.stringify({
      pageRegister: { lighting: 'flat' },
      pageComposition: {
        layoutName: 'INVALID_OR_UNKNOWN',
        focalPanelIndex: 5, // out of range for 2 panels
        isSplash: false,
        compositionNote: 'unknown'
      },
      panels: [
        { shotType: 'wide', action: 'Action A' },
        { shotType: 'medium', action: 'Action B' }
      ]
    });

    const result = page_direction.parse(rawJson);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.pageComposition.layoutName).toBe('EQUAL_CONFRONTATION'); // default for 2 panels
      expect(result.payload.pageComposition.focalPanelIndex).toBe(1); // clamped to panelCount - 1 (1)
    }
  });

  it('maps pageComposition attributes onto the target PageBeat in applyPageDirection', async () => {
    const mockRecord: VpsRecord = {
      id: 'rec-001',
      runId: 'run-001',
      showId: 'show-001',
      issueUid: 'issue-001',
      recordType: VpsRecordType.PAGE_DIRECTION,
      scopeKey: 'page-001',
      payload: {
        pageRegister: {
          lighting: 'Cold white directional spotlight',
          mood: 'high tension',
          emotionalRegister: 'intense',
          environmentalDetail: 'sparse'
        },
        pageComposition: {
          layoutName: 'ESCALATION',
          focalPanelIndex: 2,
          isSplash: false,
          compositionNote: 'Rising dread splits frame sizes'
        },
        panels: [
          { shotType: 'wide', action: 'Character A steps forward' },
          { shotType: 'medium', action: 'Character B looks down' },
          { shotType: 'close-up', action: 'Staring into void' }
        ]
      },
      payloadVersion: 1,
      createdAt: Date.now(),
      createdByPass: 'pass-1',
      consoleEntryId: null,
      authorEdited: false,
      authorEditedAt: null,
      applied: false,
      appliedAt: null,
      supersedesRecordId: null,
      stale: false,
      staleReason: null,
      schemaVersion: 1
    };

    const mockShow: Show = {
      id: 'show-001',
      name: 'Test Show',
      register: 'drama',
      issues: [
        {
          uid: 'issue-001',
          issueCode: 'ISS-01',
          name: 'Episode 1',
          acts: [
            {
              scenes: [
                {
                  setting: 'Control Room',
                  dramaticWant: 'Secure target',
                  sceneFunction: 'Conflict',
                  pageBeats: [
                    {
                      uid: 'beat-001',
                      address: 'PB-01',
                      number: 1,
                      description: 'The confrontation happens',
                      beatType: 'CONFRONTATION',
                      characterIds: [],
                      subtext: 'unsaid trust is broken',
                      visualNote: 'Cold environment',
                      direction: 'Dramatic shot',
                      productionPageUid: 'page-001' // Matches scopeKey
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    } as any;

    const nextShow = await applyPageDirection(mockRecord, mockShow);
    const updatedBeat = nextShow.issues![0].acts[0].scenes[0].pageBeats[0];

    expect(updatedBeat.layoutName).toBe('ESCALATION');
    expect(updatedBeat.focalPanelIndex).toBe(2);
    expect(updatedBeat.isSplash).toBe(false);
  });

  it('honours the applied layout and flags the focal panel in the FinalPageBeat contract', () => {
    // Simulated PageBeat with VPS composition options applied directly
    const shimBeat = {
      uid: 'beat-001',
      address: 'PB-01',
      description: 'He raises the laser pistol with hesitation.',
      characterIds: [],
      layoutName: 'ESCALATION',
      focalPanelIndex: 2,
      isSplash: false,
      panelPlans: [
        { shotType: 'medium', action: 'He pulls the latch open.' },
        { shotType: 'two-shot', action: 'They exchange looks.' },
        { shotType: 'extreme close-up', action: 'A hand hesitating on the trigger.' }
      ]
    } as any;

    const mockShow: Show = {
      characters: [],
      comicStyle: {
        artistStyle: 'gritty noir comic art',
        negativePrompt: 'blurry, out of focus'
      }
    } as any;

    const { contract } = buildFinalPageBeat(mockShow, shimBeat, 'issue-1', 'scene-1');

    // Verify correct layoutName carried from VPS choice
    expect(contract.layoutName).toBe('ESCALATION');

    // Focal panel index carried into the contract (the generator emits the
    // 'FOCAL PANEL: this panel dominates the page' line for this index)
    expect(contract.focalPanelIndex).toBe(2);

    // Panel structure honours the VPS plans
    expect(contract.panelCount).toBe(3);
    expect(contract.panels[2].shotType).toBe('extreme close-up');
    expect(contract.panels[2].action).toBe('A hand hesitating on the trigger.');
  });
});
