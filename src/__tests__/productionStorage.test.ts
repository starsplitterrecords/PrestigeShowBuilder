import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create internal mocked show store data
let storeShow: any = null;

// Mock the ShowStorage layer so we do not hit Firebase Firestore or trigger its initialization.
vi.mock('../storage/ShowStorage', () => {
  return {
    ShowStorage: {
      getById: vi.fn(async (id: string) => storeShow),
      saveOne: vi.fn(async (show: any, sync: boolean) => {
        storeShow = show;
      })
    }
  };
});

// Mock the other firebase imports so we don't initialize the Firestore client
vi.mock('../firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

import {
  writeImageVersion,
  getImageVersionsForPage,
  updateImageVersionStatus,
  writePromotion,
} from '../storage/ProductionStorage';
import { ShowStorage } from '../storage/ShowStorage';
import { ImageVersion, Issue, ProductionPage, IssueManifest, PromotionRecord } from '../types/production';

const makeBaseShow = () => ({
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
        }
      ]
    }
  ],
  issues: [],
  productionPages: [],
  issueManifests: [],
  promotionRecords: []
});

describe('productionStorage.test.ts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storeShow = makeBaseShow();

    // Clear fake IndexedDB for each test run to ensure isolation
    const db = await import('../storage/db').then((m) => m.openDB());
    const tx = db.transaction('production_image_versions', 'readwrite');
    tx.objectStore('production_image_versions').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  });

  afterEach(() => {
    storeShow = null;
  });

  it('writeImageVersion creates record in IDB', async () => {
    const version: ImageVersion = {
      uid: 'v-1',
      showId: 'show-123',
      productionPageUid: 'page-1',
      assetId: 'asset-1',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now()
    };

    await writeImageVersion('show-123', version);

    const retrieved = await getImageVersionsForPage('page-1');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].uid).toBe('v-1');
  });

  it('getImageVersionsForPage returns only matching page versions', async () => {
    const version1: ImageVersion = {
      uid: 'v-1',
      showId: 'show-123',
      productionPageUid: 'page-1',
      assetId: 'asset-1',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now()
    };

    const version2: ImageVersion = {
      uid: 'v-2',
      showId: 'show-123',
      productionPageUid: 'page-2',
      assetId: 'asset-2',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now()
    };

    await writeImageVersion('show-123', version1);
    await writeImageVersion('show-123', version2);

    const retrieved1 = await getImageVersionsForPage('page-1');
    expect(retrieved1).toHaveLength(1);
    expect(retrieved1[0].uid).toBe('v-1');

    const retrieved2 = await getImageVersionsForPage('page-2');
    expect(retrieved2).toHaveLength(1);
    expect(retrieved2[0].uid).toBe('v-2');
  });

  it('getImageVersionsForPage returns empty for unknown page', async () => {
    const retrieved = await getImageVersionsForPage('unknown-page');
    expect(retrieved).toEqual([]);
  });

  it('updateImageVersionStatus changes status field', async () => {
    const version: ImageVersion = {
      uid: 'v-1',
      showId: 'show-123',
      productionPageUid: 'page-1',
      assetId: 'asset-1',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now()
    };

    await writeImageVersion('show-123', version);
    await updateImageVersionStatus('show-123', 'v-1', 'approved');

    const retrieved = await getImageVersionsForPage('page-1');
    expect(retrieved[0].status).toBe('approved');
  });

  it('updateImageVersionStatus does not affect other versions', async () => {
    const version1: ImageVersion = {
      uid: 'v-1',
      showId: 'show-123',
      productionPageUid: 'page-1',
      assetId: 'asset-1',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now()
    };

    const version2: ImageVersion = {
      uid: 'v-2',
      showId: 'show-123',
      productionPageUid: 'page-1',
      assetId: 'asset-2',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now()
    };

    await writeImageVersion('show-123', version1);
    await writeImageVersion('show-123', version2);

    await updateImageVersionStatus('show-123', 'v-1', 'approved');

    const retrieved = await getImageVersionsForPage('page-1');
    const v1 = retrieved.find((v) => v.uid === 'v-1');
    const v2 = retrieved.find((v) => v.uid === 'v-2');

    expect(v1?.status).toBe('approved');
    expect(v2?.status).toBe('draft');
  });

  it('writePromotion archives Episode and adds Issue to show', async () => {
    const issue: Issue = {
      uid: 'issue-1',
      showId: 'show-123',
      legacyEpisodeId: 'ep-001',
      issueCode: 'TST-I01',
      number: 1,
      title: 'Promoted Issue 1',
      acts: [],
      gndsArtifactId: 'gnds-art-1',
      promotedAt: Date.now(),
      status: 'active'
    };

    const pages: ProductionPage[] = [
      {
        uid: 'page-uid-1',
        showId: 'show-123',
        issueUid: 'issue-1',
        pageBeatUid: 'beat-1',
        source: 'gnds',
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    const manifest: IssueManifest = {
      uid: 'manifest-1',
      showId: 'show-123',
      issueUid: 'issue-1',
      pageOrder: ['page-uid-1'],
      updatedAt: Date.now()
    };

    const record: PromotionRecord = {
      uid: 'prom-rec-1',
      showId: 'show-123',
      legacyEpisodeId: 'ep-001',
      issueUid: 'issue-1',
      gndsArtifactId: 'gnds-art-1',
      promotedAt: Date.now(),
      beatFidToPageBeatUid: {}
    };

    await writePromotion('show-123', issue, pages, manifest, record, 'ep-001');

    expect(storeShow).not.toBeNull();
    // Episode should be archived
    const episode = storeShow.seasons[0].episodes[0];
    expect(episode.gndsArchived).toBe(true);
    expect(episode.promotedToIssueUid).toBe('issue-1');

    // Issue added to issues
    expect(storeShow.issues).toHaveLength(1);
    expect(storeShow.issues[0].uid).toBe('issue-1');
  });

  it('writePromotion creates all ProductionPage records', async () => {
    const issue: Issue = {
      uid: 'issue-1',
      showId: 'show-123',
      legacyEpisodeId: 'ep-001',
      issueCode: 'TST-I01',
      number: 1,
      title: 'Issue 1',
      acts: [],
      gndsArtifactId: 'gnds-art-1',
      promotedAt: Date.now(),
      status: 'active'
    };

    const pages: ProductionPage[] = [
      {
        uid: 'p-1',
        showId: 'show-123',
        issueUid: 'issue-1',
        pageBeatUid: 'beat-1',
        source: 'gnds',
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        uid: 'p-2',
        showId: 'show-123',
        issueUid: 'issue-1',
        pageBeatUid: 'beat-2',
        source: 'gnds',
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    const manifest: IssueManifest = {
      uid: 'manifest-1',
      showId: 'show-123',
      issueUid: 'issue-1',
      pageOrder: ['p-1', 'p-2'],
      updatedAt: Date.now()
    };

    const record: PromotionRecord = {
      uid: 'rec-1',
      showId: 'show-123',
      legacyEpisodeId: 'ep-001',
      issueUid: 'issue-1',
      gndsArtifactId: 'art-1',
      promotedAt: Date.now(),
      beatFidToPageBeatUid: {}
    };

    await writePromotion('show-123', issue, pages, manifest, record, 'ep-001');

    expect(storeShow.productionPages).toHaveLength(2);
    expect(storeShow.productionPages[0].uid).toBe('p-1');
    expect(storeShow.productionPages[1].uid).toBe('p-2');
  });

  it('writePromotion creates IssueManifest with correct pageOrder length', async () => {
    const issue: Issue = {
      uid: 'issue-1',
      showId: 'show-123',
      legacyEpisodeId: 'ep-001',
      issueCode: 'TST-I01',
      number: 1,
      title: 'Issue 1',
      acts: [],
      gndsArtifactId: 'gnds-art-1',
      promotedAt: Date.now(),
      status: 'active'
    };

    const pages: ProductionPage[] = [
      {
        uid: 'p-1',
        showId: 'show-123',
        issueUid: 'issue-1',
        pageBeatUid: 'beat-1',
        source: 'gnds',
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        uid: 'p-2',
        showId: 'show-123',
        issueUid: 'issue-1',
        pageBeatUid: 'beat-2',
        source: 'gnds',
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    const manifest: IssueManifest = {
      uid: 'manifest-1',
      showId: 'show-123',
      issueUid: 'issue-1',
      pageOrder: ['p-1', 'p-2'],
      updatedAt: Date.now()
    };

    const record: PromotionRecord = {
      uid: 'rec-1',
      showId: 'show-123',
      legacyEpisodeId: 'ep-001',
      issueUid: 'issue-1',
      gndsArtifactId: 'art-1',
      promotedAt: Date.now(),
      beatFidToPageBeatUid: {}
    };

    await writePromotion('show-123', issue, pages, manifest, record, 'ep-001');

    expect(storeShow.issueManifests).toHaveLength(1);
    expect(storeShow.issueManifests[0].pageOrder).toHaveLength(2);
    expect(storeShow.issueManifests[0].pageOrder).toEqual(['p-1', 'p-2']);
  });
});
