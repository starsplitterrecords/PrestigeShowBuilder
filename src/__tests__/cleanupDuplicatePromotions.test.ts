import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// State mock for ShowStorage
let storeShow: any = null;

vi.mock('../storage/ShowStorage', () => {
  return {
    ShowStorage: {
      getById: vi.fn(async (id: string) => storeShow),
      saveOne: vi.fn(async (show: any, sync: boolean) => {
        storeShow = show;
        return true;
      })
    }
  };
});

vi.mock('../firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

import { writePromotion } from '../storage/ProductionStorage';
import { dedupePromotions, runPromotionCleanup } from '../storage/cleanupDuplicatePromotions';

const makeBaseShow = (): any => ({
  id: 'show-123',
  name: 'Test Show',
  seasons: [
    {
      id: 'season-1',
      number: 1,
      title: 'Season 1',
      episodes: [
        {
          id: 'ep-001',
          number: 1,
          title: 'Episode 1',
          gndsArchived: false,
          oneLiner: '',
          summary: '',
          acts: []
        }
      ]
    }
  ],
  issues: [],
  productionPages: [],
  issueManifests: [],
  promotionRecords: [],
  imageVersions: []
});

describe('Promotion Duplication and Cleanup Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeShow = makeBaseShow();
  });

  afterEach(() => {
    storeShow = null;
  });

  describe('Fix 1 — writePromotion replaces instead of appends', () => {
    it('does not duplicate issue, manifest, record and pages when promoting the same episode/issue twice', async () => {
      const issue: any = {
        uid: 'issue-abc',
        showId: 'show-123',
        legacyEpisodeId: 'ep-001',
        issueCode: 'ECH-I01',
        number: 1,
        title: 'Issue 1',
        gndsArtifactId: 'art-1',
        promotedAt: 100,
        status: 'active',
        acts: [
          {
            actNumber: 1,
            scenes: [
              {
                sceneNumber: 1,
                pageBeats: [
                  {
                    uid: 'pb-1',
                    address: 'addr-1',
                    number: 1,
                    description: 'Beat 1',
                    beatType: 'DIALOGUE',
                    characterIds: [],
                    subtext: '',
                    visualNote: '',
                    direction: '',
                    productionPageUid: 'page-1'
                  }
                ]
              }
            ]
          }
        ]
      };

      const pages: any[] = [
        {
          uid: 'page-1',
          showId: 'show-123',
          issueUid: 'issue-abc',
          pageBeatUid: 'pb-1',
          source: 'gnds',
          status: 'planned',
          createdAt: 100,
          updatedAt: 100
        }
      ];

      const manifest: any = {
        uid: 'manifest-abc',
        showId: 'show-123',
        issueUid: 'issue-abc',
        pageOrder: ['page-1'],
        updatedAt: 100
      };

      const record: any = {
        uid: 'record-abc',
        showId: 'show-123',
        legacyEpisodeId: 'ep-001',
        issueUid: 'issue-abc',
        gndsArtifactId: 'art-1',
        promotedAt: 100,
        beatFidToPageBeatUid: {}
      };

      // 1. First write of promotion
      await writePromotion('show-123', issue, pages, manifest, record, 'ep-001');

      expect(storeShow.issues).toHaveLength(1);
      expect(storeShow.productionPages).toHaveLength(1);
      expect(storeShow.issueManifests).toHaveLength(1);
      expect(storeShow.promotionRecords).toHaveLength(1);

      // 2. Second write (re-promotion) with updated timestamp
      const issue2 = { ...issue, promotedAt: 150 };
      const pages2 = pages.map(p => ({ ...p, updatedAt: 150 }));
      const manifest2 = { ...manifest, updatedAt: 150 };
      const record2 = { ...record, promotedAt: 150 };

      await writePromotion('show-123', issue2, pages2, manifest2, record2, 'ep-001');

      // Should still have exactly ONE entry of each, not appended!
      expect(storeShow.issues).toHaveLength(1);
      expect(storeShow.issues[0].promotedAt).toBe(150);

      expect(storeShow.productionPages).toHaveLength(1);
      expect(storeShow.productionPages[0].updatedAt).toBe(150);

      expect(storeShow.issueManifests).toHaveLength(1);
      expect(storeShow.issueManifests[0].updatedAt).toBe(150);

      expect(storeShow.promotionRecords).toHaveLength(1);
      expect(storeShow.promotionRecords[0].promotedAt).toBe(150);
    });
  });

  describe('Fix 2 — dedupePromotions/runPromotionCleanup utility', () => {
    it('collapses existing duplicates in a show, keeping the newest', () => {
      const show: any = makeBaseShow();

      // Setup pre-existing duplicated state
      show.issues = [
        {
          uid: 'issue-abc',
          showId: 'show-123',
          legacyEpisodeId: 'ep-001',
          issueCode: 'ECH-I01',
          number: 1,
          title: 'Issue 1',
          gndsArtifactId: 'art-1',
          promotedAt: 100,
          status: 'active',
          acts: [
            {
              actNumber: 1,
              scenes: [
                {
                  sceneNumber: 1,
                  pageBeats: [
                    {
                      uid: 'pb-1',
                      address: 'addr-1',
                      number: 1,
                      description: 'B1',
                      beatType: 'DIALOGUE',
                      characterIds: [],
                      subtext: '',
                      visualNote: '',
                      direction: '',
                      productionPageUid: 'page-1'
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          uid: 'issue-abc',
          showId: 'show-123',
          legacyEpisodeId: 'ep-001',
          issueCode: 'ECH-I01',
          number: 1,
          title: 'Issue 1',
          gndsArtifactId: 'art-1',
          promotedAt: 200,
          status: 'active',
          acts: [
            {
              actNumber: 1,
              scenes: [
                {
                  sceneNumber: 1,
                  pageBeats: [
                    {
                      uid: 'pb-1',
                      address: 'addr-1',
                      number: 1,
                      description: 'B1-v2',
                      beatType: 'DIALOGUE',
                      characterIds: [],
                      subtext: '',
                      visualNote: '',
                      direction: '',
                      productionPageUid: 'page-1'
                    }
                  ]
                }
              ]
            }
          ]
        } // Newer
      ];

      show.productionPages = [
        { uid: 'page-1', showId: 'show-123', issueUid: 'issue-abc', pageBeatUid: 'pb-1', source: 'gnds', status: 'planned', createdAt: 100, updatedAt: 100 },
        { uid: 'page-1', showId: 'show-123', issueUid: 'issue-abc', pageBeatUid: 'pb-1', source: 'gnds', status: 'planned', createdAt: 100, updatedAt: 200 }, // Newer
        { uid: 'page-orphan', showId: 'show-123', issueUid: 'issue-abc', pageBeatUid: 'pb-orphan', source: 'gnds', status: 'planned', createdAt: 100, updatedAt: 250 } // Orphaned (not referenced by pageBeats)
      ];

      show.issueManifests = [
        { uid: 'manifest-abc', showId: 'show-123', issueUid: 'issue-abc', pageOrder: ['page-1'], updatedAt: 100 },
        { uid: 'manifest-abc', showId: 'show-123', issueUid: 'issue-abc', pageOrder: ['page-1'], updatedAt: 200 } // Newer
      ];

      show.promotionRecords = [
        { uid: 'record-abc', showId: 'show-123', legacyEpisodeId: 'ep-001', issueUid: 'issue-abc', gndsArtifactId: 'art-1', promotedAt: 100, beatFidToPageBeatUid: {} },
        { uid: 'record-abc', showId: 'show-123', legacyEpisodeId: 'ep-001', issueUid: 'issue-abc', gndsArtifactId: 'art-1', promotedAt: 200, beatFidToPageBeatUid: {} } // Newer
      ];

      show.imageVersions = [
        { uid: 'iv-live', showId: 'show-123', productionPageUid: 'page-1', assetId: 'a1', variantType: 'base', status: 'approved', createdAt: 100 },
        { uid: 'iv-orphan', showId: 'show-123', productionPageUid: 'page-orphan', assetId: 'a2', variantType: 'base', status: 'approved', createdAt: 100 }
      ];

      const { show: cleaned, report } = dedupePromotions(show as any);

      // Verify report count correctness
      expect(report.issuesBefore).toBe(2);
      expect(report.issuesAfter).toBe(1);
      expect(report.pagesBefore).toBe(3);
      expect(report.pagesAfter).toBe(1); // keeps 'page-1' and discards 'page-orphan' and duplicate 'page-1'
      expect(report.manifestsRemoved).toBe(1);
      expect(report.recordsRemoved).toBe(1);
      expect(report.imageVersionsBefore).toBe(2);
      expect(report.imageVersionsAfter).toBe(1); // drops 'iv-orphan' since 'page-orphan' was removed

      // Verify surviving records are the newest ones
      expect(cleaned.issues).toHaveLength(1);
      expect(cleaned.issues![0].promotedAt).toBe(200);

      expect(cleaned.productionPages).toHaveLength(1);
      expect(cleaned.productionPages![0].uid).toBe('page-1');
      expect(cleaned.productionPages![0].updatedAt).toBe(200);

      expect(cleaned.issueManifests).toHaveLength(1);
      expect(cleaned.issueManifests![0].updatedAt).toBe(200);

      expect(cleaned.promotionRecords).toHaveLength(1);
      expect(cleaned.promotionRecords![0].promotedAt).toBe(200);

      expect(cleaned.imageVersions).toHaveLength(1);
      expect(cleaned.imageVersions![0].uid).toBe('iv-live');
    });

    it('runPromotionCleanup successfully loads, dedupes, and persists', async () => {
      // Mock the pre-existing duplicated state
      const show = makeBaseShow();
      show.issues = [
        { uid: 'issue-abc', showId: 'show-123', legacyEpisodeId: 'ep-001', issueCode: 'ECH-I01', number: 1, title: 'Issue 1', gndsArtifactId: 'art-1', promotedAt: 100, status: 'active', acts: [] },
        { uid: 'issue-abc', showId: 'show-123', legacyEpisodeId: 'ep-001', issueCode: 'ECH-I01', number: 1, title: 'Issue 1', gndsArtifactId: 'art-1', promotedAt: 200, status: 'active', acts: [] }
      ];
      storeShow = show;

      const report = await runPromotionCleanup('show-123');

      expect(report.issuesBefore).toBe(2);
      expect(report.issuesAfter).toBe(1);
      expect(storeShow.issues).toHaveLength(1);
    });
  });
});
