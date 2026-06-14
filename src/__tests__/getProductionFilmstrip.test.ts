import { describe, it, expect } from 'vitest';
import { getProductionFilmstrip } from '../components/workbench/useWorkbenchSelection';
import type { Show } from '../types/show';
import type { ImageVersion } from '../types/production';

const makeShow = (overrides: Partial<Show> = {}): Show => ({
  id: 'show1', name: 'Test Show', showCode: 'TST',
  seasons: [], characters: [], comicGallery: [],
  issues: [], productionPages: [], issueManifests: [],
  imageVersions: [], promotionRecords: [],
  ...overrides,
} as unknown as Show);

describe('getProductionFilmstrip', () => {
  it('returns empty array when no manifest', () => {
    const result = getProductionFilmstrip(
      makeShow(), 'no-issue', new Map()
    );
    expect(result).toHaveLength(0);
  });

  it('returns one FilmstripItem per manifest page', () => {
    const pbUid = 'pb1';
    const pageUid = 'pg1';
    const show = makeShow({
      issues: [{ uid: 'iss1', showId: 'show1',
        legacyEpisodeId: 'ep1', issueCode: 'TST-I01',
        number: 1, title: 'Test', acts: [{ uid: 'act1',
        number: 1, title: 'Act 1', scenes: [{ uid: 'sc1',
        number: 1, title: 'Scene 1', setting: '', dramaticWant: '',
        sceneFunction: '', pageBeats: [{ uid: pbUid,
          address: 'TST-S1-I01-A1-SC01-PB01', number: 1,
          description: 'Beat', beatType: 'DIALOGUE',
          characterIds: [], subtext: '', visualNote: '', direction: '',
          productionPageUid: pageUid }] }] }],
        gndsArtifactId: 'art1', promotedAt: 0, status: 'active'
      }],
      productionPages: [{ uid: pageUid, showId: 'show1',
        issueUid: 'iss1', pageBeatUid: pbUid,
        source: 'gnds', status: 'planned',
        createdAt: 0, updatedAt: 0 }],
      issueManifests: [{ uid: 'mfst1', showId: 'show1',
        issueUid: 'iss1', pageOrder: [pageUid], updatedAt: 0 }],
    });
    const result = getProductionFilmstrip(
      show, 'iss1', new Map()
    );
    expect(result).toHaveLength(1);
    expect(result[0].pageNumber).toBe(1);
    expect(result[0].pageBeat.uid).toBe(pbUid);
  });

  it('sets activeImageVersion to approved version', () => {
    const pbUid = 'pb2';
    const pageUid = 'pg2';
    const show = makeShow({
      issues: [{ uid: 'iss1', showId: 'show1',
        legacyEpisodeId: 'ep1', issueCode: 'TST-I01',
        number: 1, title: 'Test', acts: [{ uid: 'act1',
        number: 1, title: 'Act 1', scenes: [{ uid: 'sc1',
        number: 1, title: 'Scene 1', setting: '', dramaticWant: '',
        sceneFunction: '', pageBeats: [{ uid: pbUid,
          address: 'TST-S1-I01-A1-SC01-PB02', number: 1,
          description: 'Beat 2', beatType: 'DIALOGUE',
          characterIds: [], subtext: '', visualNote: '', direction: '',
          productionPageUid: pageUid }] }] }],
        gndsArtifactId: 'art1', promotedAt: 0, status: 'active'
      }],
      productionPages: [{ uid: pageUid, showId: 'show1',
        issueUid: 'iss1', pageBeatUid: pbUid,
        source: 'gnds', status: 'planned',
        createdAt: 0, updatedAt: 0 }],
      issueManifests: [{ uid: 'mfst1', showId: 'show1',
        issueUid: 'iss1', pageOrder: [pageUid], updatedAt: 0 }],
    });

    const v1: ImageVersion = {
      uid: 'v1', productionPageUid: pageUid, assetId: 'a1',
      variantType: 'base', status: 'draft', createdAt: 100,
    } as any;
    const v2: ImageVersion = {
      uid: 'v2', productionPageUid: pageUid, assetId: 'a2',
      variantType: 'base', status: 'approved', createdAt: 200,
    } as any;

    const map = new Map<string, ImageVersion[]>();
    map.set(pageUid, [v1, v2]);

    const result = getProductionFilmstrip(show, 'iss1', map);
    expect(result).toHaveLength(1);
    expect(result[0].activeImageVersion).not.toBeNull();
    expect(result[0].activeImageVersion?.uid).toBe('v2');
  });
});
