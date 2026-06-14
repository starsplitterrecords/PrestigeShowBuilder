import { describe, it, expect, vi } from 'vitest';
import { validatePanelIndices } from '../vps/validatePanelIndices';
import { applyPageDirection } from '../vps/applyPageDirection';
import { useProductionPageActions } from '../hooks/production/useProductionPageActions';
import type { PageBeat } from '../types/production';
import type { VpsRecord } from '../vps/types';
import { VpsRecordType } from '../vps/types';
import type { Show } from '../types/show';

vi.mock('../vps/storage', () => ({
  markVpsRecordApplied: vi.fn(),
}));

describe('Dialogue-Index Integrity & Fingerprint Mismatch Warning (DA-048)', () => {
  it('correctly reports out of range, wrong kind, and fingerprint matching details', () => {
    const pb: PageBeat = {
      uid: 'pb-01',
      address: 'PB-01',
      number: 1,
      description: 'Test beat',
      beatType: 'CONFRONTATION',
      characterIds: [],
      scriptFingerprint: 'correct-fingerprint',
      panelPlans: [
        {
          shotType: 'medium',
          action: 'Arvok speaks',
          dialogueIndices: [0, 99], // 99 is out of range
          captionIndices: [1], // pointing to dialogue entry instead of caption
          characterPositions: [],
        },
      ],
      script: {
        entries: [
          { kind: 'dialogue', characterHandle: 'Arvok', text: 'Listen' },
          { kind: 'dialogue', characterHandle: 'Luzia', text: 'I am' },
          { kind: 'caption', text: 'Later...' }
        ] as any
      }
    } as any;

    const res = validatePanelIndices(pb);
    expect(res.ok).toBe(false);
    expect(res.fingerprintMatches).toBe(false); // since correct-fingerprint doesn't match computed fingerprint
    expect(res.outOfRange).toContain(99);
    expect(res.wrongKind).toContain(1); // indices[1] has kind 'dialogue' not 'caption'
  });

  it('applyPageDirection clamps and filters out-of-range dialogue/caption indices defensively', async () => {
    const mockRecord: VpsRecord = {
      id: 'rec-101',
      runId: 'run-101',
      showId: 'show-101',
      issueUid: 'issue-101',
      recordType: VpsRecordType.PAGE_DIRECTION,
      scopeKey: 'page-101',
      payload: {
        pageRegister: { lighting: 'dim', mood: 'quiet', emotionalRegister: 'tension', environmentalDetail: 'sparse' },
        pageComposition: { layoutName: 'EQUAL_CONFRONTATION', focalPanelIndex: 0, isSplash: false, compositionNote: '' },
        panels: [
          {
            shotType: 'close-up',
            action: 'Reaction shot',
            dialogueIndices: [-1, 0, 1, 5], // -1 and 5 are out of bounds
            captionIndices: [2, 10], // 10 is out of bounds
            blocking: [],
          },
        ],
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
      id: 'show-101',
      name: 'Show Name',
      register: 'drama',
      issues: [
        {
          uid: 'issue-101',
          issueCode: 'ISS-101',
          name: 'Issue Name',
          acts: [
            {
              scenes: [
                {
                  setting: 'Hallway',
                  dramaticWant: 'Want',
                  sceneFunction: 'Function',
                  pageBeats: [
                    {
                      uid: 'beat-101',
                      address: 'PB-101',
                      number: 1,
                      description: 'Beat description',
                      beatType: 'CONFRONTATION',
                      characterIds: [],
                      productionPageUid: 'page-101',
                      script: {
                        entries: [
                          { kind: 'dialogue', characterHandle: 'A', text: 'Hey' },
                          { kind: 'dialogue', characterHandle: 'B', text: 'Hi' },
                          { kind: 'caption', text: 'Outside' }
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
    } as any;

    const updatedShow = await applyPageDirection(mockRecord, mockShow);
    const updatedBeat = updatedShow.issues![0].acts[0].scenes[0].pageBeats[0];

    const plan = updatedBeat.panelPlans![0];
    expect(plan.dialogueIndices).toEqual([0, 1]); // -1 and 5 dropped
    expect(plan.captionIndices).toEqual([2]); // 10 dropped
    expect(updatedBeat.scriptFingerprint).toBeDefined();
  });
});
