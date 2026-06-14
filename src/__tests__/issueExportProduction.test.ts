import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProductionIssueZip } from '../utils/exports/issueExportProduction';
import { Show } from '../types/show';
import { ImageVersion } from '../types/production';

// Mock AssetStorage
vi.mock('../storage', () => ({
  AssetStorage: {
    getBlobUrl: vi.fn(async (id: string) => `blob:${id}`),
    getBlob: vi.fn(async (id: string) => new Uint8Array([1, 2, 3]) as any),
  }
}));

// Mock ProductionStorage
let mockVersionsByPage: Record<string, ImageVersion[]> = {};
vi.mock('../storage/ProductionStorage', () => ({
  getImageVersionsForPage: vi.fn(async (pageUid: string) => {
    return mockVersionsByPage[pageUid] || [];
  }),
}));

const makeTestShow = (): Show => ({
  id: 'show-123',
  name: 'Test Show',
  issues: [
    {
      uid: 'issue-1',
      showId: 'show-123',
      legacyEpisodeId: 'ep-001',
      issueCode: 'TST-I01',
      number: 1,
      title: 'Issue 1',
      acts: [
        {
          uid: 'act-1',
          number: 1,
          title: 'Act 1',
          scenes: [
            {
              uid: 'scene-1',
              number: 1,
              title: 'Scene 1',
              setting: 'INT. COZY APARTMENT',
              dramaticWant: 'Comfort',
              sceneFunction: 'Opening',
              pageBeats: [
                {
                  uid: 'beat-1',
                  address: 'TST-I01-A1-SC01-PB01',
                  number: 1,
                  description: 'A cozy coffee conversation',
                  beatType: 'DIALOGUE',
                  characterIds: [],
                  subtext: '',
                  visualNote: '',
                  direction: '',
                  productionPageUid: 'page-uid-1',
                },
                {
                  uid: 'beat-2',
                  address: 'TST-I01-A1-SC01-PB02',
                  number: 2,
                  description: 'Staring out of the rain-streaked window',
                  beatType: 'ACTION',
                  characterIds: [],
                  subtext: '',
                  visualNote: '',
                  direction: '',
                  productionPageUid: 'page-uid-2',
                },
              ],
            },
          ],
        },
      ],
      gndsArtifactId: 'gnds-art-1',
      promotedAt: Date.now(),
      status: 'active',
    },
  ],
  productionPages: [
    {
      uid: 'page-uid-1',
      showId: 'show-123',
      issueUid: 'issue-1',
      pageBeatUid: 'beat-1',
      source: 'gnds',
      status: 'planned',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      uid: 'page-uid-2',
      showId: 'show-123',
      issueUid: 'issue-1',
      pageBeatUid: 'beat-2',
      source: 'gnds',
      status: 'planned',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  issueManifests: [
    {
      uid: 'manifest-1',
      showId: 'show-123',
      issueUid: 'issue-1',
      pageOrder: ['page-uid-1', 'page-uid-2'],
      updatedAt: Date.now(),
    },
  ],
  promotionRecords: [],
} as unknown as Show);

describe('issueExportProduction.test.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVersionsByPage = {};
  });

  it('Export with no images throws "No pages with images found in this issue."', async () => {
    const show = makeTestShow();
    await expect(generateProductionIssueZip(show, 'issue-1')).rejects.toThrow(
      'No pages with images found in this issue.'
    );
  });

  it('Export with approved images produces ZIP with correct file count', async () => {
    const show = makeTestShow();
    
    // Set approved image versions
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v-1',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];
    mockVersionsByPage['page-uid-2'] = [
      {
        uid: 'v-2',
        showId: 'show-123',
        productionPageUid: 'page-uid-2',
        assetId: 'asset-2',
        variantType: 'refined',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];

    const zipBlob = await generateProductionIssueZip(show, 'issue-1', { includeManifest: true });
    expect(zipBlob).toBeInstanceOf(Blob);

    // Let's unzip to verify details using JSZip
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());

    // Expect files in zip: 001_p1.png, 002_p2.png, manifest.json
    expect(zip.files['001_p1.png']).toBeDefined();
    expect(zip.files['002_p2.png']).toBeDefined();
    expect(zip.files['manifest.json']).toBeDefined();

    const manifestContent = JSON.parse(await zip.files['manifest.json'].async('string'));
    expect(manifestContent.pageCount).toBe(2);
    expect(manifestContent.exportedPages).toBe(2);
  });

  it('Cover page included as 00_cover.png when manifest.coverPageUid set', async () => {
    const show = makeTestShow();
    const manifest = show.issueManifests![0];
    manifest.coverPageUid = 'page-cover-uid';

    mockVersionsByPage['page-cover-uid'] = [
      {
        uid: 'v-cov',
        showId: 'show-123',
        productionPageUid: 'page-cover-uid',
        assetId: 'cover-asset',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];
    // Add page-uid-1 to have at least 1 image so it doesn't throw
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v-1',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];

    const zipBlob = await generateProductionIssueZip(show, 'issue-1');
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());

    expect(zip.files['00_cover.png']).toBeDefined();
    expect(zip.files['001_p1.png']).toBeDefined();
  });

  it('manifest.json included with correct page count', async () => {
    const show = makeTestShow();
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v-1',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1',
        variantType: 'lettered',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];

    const zipBlob = await generateProductionIssueZip(show, 'issue-1');
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());

    const manifestContent = JSON.parse(await zip.files['manifest.json'].async('string'));
    expect(manifestContent.pageCount).toBe(2);
    expect(manifestContent.exportedPages).toBe(1);
    expect(manifestContent.pages[1].status).toBe('missing');
  });

  it('approvedOnly: true skips pages with no approved version', async () => {
    const show = makeTestShow();
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v-1',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];
    // Page 2 has only a draft (not approved)
    mockVersionsByPage['page-uid-2'] = [
      {
        uid: 'v-2',
        showId: 'show-123',
        productionPageUid: 'page-uid-2',
        assetId: 'asset-2',
        variantType: 'base',
        status: 'draft',
        createdAt: Date.now(),
      },
    ];

    const zipBlob = await generateProductionIssueZip(show, 'issue-1', { approvedOnly: true });
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());

    expect(zip.files['001_p1.png']).toBeDefined();
    expect(zip.files['002_p2.png']).toBeUndefined();

    const manifestContent = JSON.parse(await zip.files['manifest.json'].async('string'));
    expect(manifestContent.exportedPages).toBe(1);
    expect(manifestContent.pages).toHaveLength(1); // approvedOnly trims elements from JSON page array list as well
  });

  it('Pages numbered sequentially from 001', async () => {
    const show = makeTestShow();
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v-1',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];
    mockVersionsByPage['page-uid-2'] = [
      {
        uid: 'v-2',
        showId: 'show-123',
        productionPageUid: 'page-uid-2',
        assetId: 'asset-2',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      },
    ];

    const zipBlob = await generateProductionIssueZip(show, 'issue-1');
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());

    expect(zip.files['001_p1.png']).toBeDefined();
    expect(zip.files['002_p2.png']).toBeDefined();
  });
});
