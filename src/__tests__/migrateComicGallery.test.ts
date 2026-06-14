import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  migrateComicGalleryToImageVersions,
  clearComicGallery,
} from '../utils/migration/migrateComicGallery';
import { Show } from '../types/show';
import { ImageVersion } from '../types/production';

// Mock ProductionStorage and ShowStorage
let writtenVersions: ImageVersion[] = [];
let savedShows: Show[] = [];

vi.mock('../storage/ProductionStorage', () => ({
  writeImageVersion: vi.fn(async (showId: string, version: ImageVersion) => {
    writtenVersions.push(version);
  }),
}));

vi.mock('../storage/ShowStorage', () => ({
  ShowStorage: {
    saveOne: vi.fn(async (show: Show, sync: boolean) => {
      savedShows.push(show);
    }),
  },
}));

describe('migrateComicGallery.test.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writtenVersions = [];
    savedShows = [];
  });

  const makeBaseShow = (): Show => ({
    id: 'show-123',
    name: 'Test Show',
    comicGallery: [],
    productionPages: [],
    promotionRecords: [],
  } as unknown as Show);

  it('Resolved entry creates ImageVersion with correct productionPageUid', async () => {
    const show = makeBaseShow();
    show.comicGallery = [
      {
        beatFid: 'old-beat-1',
        assetId: 'asset-1',
        variantType: 'base',
        status: 'approved',
        createdAt: 1000,
      } as any,
    ];

    // Build matching promotion records
    show.promotionRecords = [
      {
        uid: 'promo-1',
        showId: 'show-123',
        legacyEpisodeId: 'ep-001',
        issueUid: 'issue-1',
        gndsArtifactId: 'art-1',
        promotedAt: 2000,
        beatFidToPageBeatUid: {
          'old-beat-1': 'new-pagebeat-1',
        },
      } as any,
    ];

    // Build production pages matching pageBeatUid
    show.productionPages = [
      {
        uid: 'production-page-1',
        showId: 'show-123',
        issueUid: 'issue-1',
        pageBeatUid: 'new-pagebeat-1',
        source: 'gnds',
        status: 'planned',
      } as any,
    ];

    const result = await migrateComicGalleryToImageVersions(show);

    expect(result.migrated).toBe(1);
    expect(result.recovered).toBe(0);
    expect(writtenVersions).toHaveLength(1);
    expect(writtenVersions[0].productionPageUid).toBe('production-page-1');
    expect(writtenVersions[0].assetId).toBe('asset-1');
  });

  it('Unresolved entry creates recovery ProductionPage + ImageVersion', async () => {
    const show = makeBaseShow();
    show.comicGallery = [
      {
        beatFid: 'unresolved-old-beat',
        assetId: 'asset-unresolved',
        variantType: 'refined',
        status: 'draft',
        createdAt: 3000,
      } as any,
    ];

    const result = await migrateComicGalleryToImageVersions(show);

    expect(result.migrated).toBe(0);
    expect(result.recovered).toBe(1);
    expect(writtenVersions).toHaveLength(1);

    // Should create a recovery ProductionPage
    expect(savedShows).toHaveLength(1);
    const updatedShow = savedShows[0];
    const productionPages = updatedShow.productionPages!;
    expect(productionPages).toHaveLength(1);
    expect(productionPages[0].uid).toBe(writtenVersions[0].productionPageUid);
    expect(productionPages[0].issueUid).toBe('recovered');
    expect(productionPages[0].pageBeatUid).toBe('recovered');
  });

  it('approved gallery entry maps to approved ImageVersion', async () => {
    const show = makeBaseShow();
    show.comicGallery = [
      {
        beatFid: 'beat-1',
        assetId: 'asset-1',
        status: 'approved',
      } as any,
    ];

    await migrateComicGalleryToImageVersions(show);

    expect(writtenVersions).toHaveLength(1);
    expect(writtenVersions[0].status).toBe('approved');
  });

  it('archived gallery entry maps to archived ImageVersion', async () => {
    const show = makeBaseShow();
    show.comicGallery = [
      {
        beatFid: 'beat-1',
        assetId: 'asset-1',
        status: 'archived',
      } as any,
    ];

    await migrateComicGalleryToImageVersions(show);

    expect(writtenVersions).toHaveLength(1);
    expect(writtenVersions[0].status).toBe('archived');
  });

  it('migration result counts are accurate', async () => {
    const show = makeBaseShow();
    show.comicGallery = [
      { beatFid: 'resolved-1', assetId: 'a1', status: 'approved' } as any,
      { beatFid: 'unresolved-1', assetId: 'a2', status: 'draft' } as any,
    ];

    show.promotionRecords = [
      {
        beatFidToPageBeatUid: { 'resolved-1': 'new-pb-1' },
      } as any,
    ];
    show.productionPages = [
      { uid: 'prod-pg-1', pageBeatUid: 'new-pb-1' } as any,
    ];

    const result = await migrateComicGalleryToImageVersions(show);

    expect(result.migrated).toBe(1);
    expect(result.recovered).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.details).toHaveLength(2);
    expect(result.details[0].outcome).toBe('migrated');
    expect(result.details[1].outcome).toBe('recovered');
  });

  it('clearComicGallery sets show.comicGallery to []', async () => {
    const show = makeBaseShow();
    show.comicGallery = [
      { beatFid: 'b1', assetId: 'a1', status: 'approved' } as any,
    ];

    await clearComicGallery(show);

    expect(savedShows).toHaveLength(1);
    expect(savedShows[0].comicGallery).toEqual([]);
  });
});
