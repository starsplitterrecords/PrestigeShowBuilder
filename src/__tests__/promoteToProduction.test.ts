import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the storage layer — promoteToProduction calls writePromotion via VaultStorage.
vi.mock('../storage/VaultStorage', () => ({
  VaultStorage: {
    writePromotion: vi.fn().mockResolvedValue(undefined),
  }
}));

vi.mock('../vps/storage', () => ({
  getActiveVpsRun: vi.fn().mockResolvedValue(null),
  markVpsRecordsStale: vi.fn().mockResolvedValue(undefined),
}));

import { promoteToProduction } from '../psb4/bridge/promoteToProduction';
import { VaultStorage } from '../storage/VaultStorage';
import type { Show } from '../types/show';
import type { Psb4Artifact } from '../psb4/types';

const makeShow = (): Show => ({
  id: 'show1', showCode: 'TST', name: 'Test',
  characters: [
    { id: 'arvok-id', handle: '@ARVOK', name: 'Arvok' }
  ], issues: [], productionPages: [],
  issueManifests: [], imageVersions: [], promotionRecords: [],
  seasons: [{ id: 'season1', number: 1, title: 'Season 1',
    episodes: [{ id: 'ep1', number: 1, title: 'Issue 1',
      acts: [], scenes: [] }] }],
} as unknown as Show);

const makeArtifact = (): Psb4Artifact => ({
  id: 'art1', episodeId: 'ep1',
  payload: {
    acts: [{
      actNumber: 1, title: 'Act 1',
      scenes: [{
        sceneNumber: 1, title: 'Scene 1',
        setting: 'INT. WORKSHOP', dramaticWant: 'Launch',
        function: 'Setup', beats: [
          { description: 'Beat 1', beatType: 'DIALOGUE',
            characterHandles: ['@ARVOK'], subtext: '',
            visualNote: '', direction: '', source: 'new',
            sourceBeatNumbers: [1], script: [
              { kind: 'line', characterHandle: '@ARVOK',
                text: 'Launch.' }
            ] },
        ]
      }]
    }]
  },
} as unknown as Psb4Artifact);

describe('promoteToProduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces an Issue with correct issueCode', async () => {
    const { issue } = await promoteToProduction(
      makeShow(), makeArtifact()
    );
    expect(issue.issueCode).toBe('TST-I01');
    expect(issue.legacyEpisodeId).toBe('ep1');
  });

  it('produces one ProductionPage per PageBeat', async () => {
    const { pages, issue } = await promoteToProduction(
      makeShow(), makeArtifact()
    );
    const beatCount = issue.acts
      .flatMap(a => a.scenes.flatMap(s => s.pageBeats)).length;
    expect(pages).toHaveLength(beatCount);
  });

  it('IssueManifest.pageOrder length matches page count', async () => {
    const { pages, manifest } = await promoteToProduction(
      makeShow(), makeArtifact()
    );
    expect(manifest.pageOrder).toHaveLength(pages.length);
  });

  it('PageBeat.productionPageUid is set after promotion', async () => {
    const { issue } = await promoteToProduction(
      makeShow(), makeArtifact()
    );
    const beats = issue.acts
      .flatMap(a => a.scenes.flatMap(s => s.pageBeats));
    expect(beats.every(pb => pb.productionPageUid)).toBe(true);
  });

  it('script entries are populated from artifact', async () => {
    const { issue } = await promoteToProduction(
      makeShow(), makeArtifact()
    );
    const beat = issue.acts[0].scenes[0].pageBeats[0];
    expect(beat.script?.entries?.length).toBeGreaterThan(0);
  });

  it('calls writePromotion once', async () => {
    await promoteToProduction(makeShow(), makeArtifact());
    expect(VaultStorage.writePromotion).toHaveBeenCalledTimes(1);
  });

  it('prompts without visual direction and panel plan safely leaving fields undefined', async () => {
    const { issue } = await promoteToProduction(
      makeShow(), makeArtifact()
    );
    const beat = issue.acts[0].scenes[0].pageBeats[0];
    expect(beat.visualDirection).toBeUndefined();
    expect(beat.panelPlans).toBeUndefined();
    expect(beat.panelProps).toBeUndefined();
  });

  it('DA-069: seeds empty-characterIds beats with the scene character union', async () => {
    const artifactWithSilentBeat = {
      id: 'art-silent-special',
      episodeId: 'ep1',
      payload: {
        acts: [{
          actNumber: 1,
          title: 'Act 1',
          scenes: [{
            sceneNumber: 1,
            title: 'Scene 1',
            setting: 'INT. WORKSHOP',
            dramaticWant: 'Launch',
            function: 'Setup',
            beats: [
              {
                description: 'Beat 1 (Speaking)',
                beatType: 'DIALOGUE',
                characterHandles: ['@ARVOK'],
                subtext: '',
                visualNote: '',
                direction: '',
                source: 'new',
                sourceBeatNumbers: [1],
                script: []
              },
              {
                description: 'Beat 2 (Silent Tableau)',
                beatType: 'TABLEAU',
                characterHandles: [],
                subtext: '',
                visualNote: '',
                direction: '',
                source: 'new',
                sourceBeatNumbers: [2],
                script: []
              }
            ]
          }]
        }]
      }
    } as unknown as Psb4Artifact;

    const { issue } = await promoteToProduction(makeShow(), artifactWithSilentBeat);
    const scene = issue.acts[0].scenes[0];
    const pb1 = scene.pageBeats[0];
    const pb2 = scene.pageBeats[1];

    // Beat 1 should have 'arvok-id'
    expect(pb1.characterIds).toContain('arvok-id');
    // Beat 2 should fallback to 'arvok-id' (the scene character union)
    expect(pb2.characterIds).toContain('arvok-id');
  });
});
