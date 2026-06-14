import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProductionIssuePDF } from '../utils/exports/issuePDFProduction';
import { Show } from '../types/show';
import { ImageVersion } from '../types/production';

// Mock generateIssuePDF
const mockGenerateIssuePDF = vi.fn(async (_show: any, _pages: any, _presetId?: any, _cover?: any) => new Blob(['pdf-content'], { type: 'application/pdf' }));
vi.mock('../utils/exports/issuePDF', () => ({
  generateIssuePDF: (show: any, pages: any, presetId?: any, cover?: any) => mockGenerateIssuePDF(show, pages, presetId, cover),
}));

// Mock ProductionStorage
let mockVersionsByPage: Record<string, ImageVersion[]> = {};
vi.mock('../storage/ProductionStorage', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getImageVersionsForPage: vi.fn(async (pageUid: string) => {
      return mockVersionsByPage[pageUid] || [];
    }),
  };
});

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
      acts: [],
      gndsArtifactId: 'gnds-art-1',
      promotedAt: Date.now(),
      status: 'active',
    }
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
    }
  ],
} as unknown as Show);

describe('issuePDFProduction.test.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVersionsByPage = {};
  });

  it('successfully generates PDF with approved pages', async () => {
    const show = makeTestShow();
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v1',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1',
        variantType: 'base',
        status: 'approved',
        createdAt: 1000,
      }
    ];
    mockVersionsByPage['page-uid-2'] = [
      {
        uid: 'v2',
        showId: 'show-123',
        productionPageUid: 'page-uid-2',
        assetId: 'asset-2',
        variantType: 'lettered',
        status: 'approved',
        createdAt: 1100,
      }
    ];

    const blob = await generateProductionIssuePDF(show, 'issue-1', 'globalcomix');
    expect(blob).toBeDefined();
    expect(mockGenerateIssuePDF).toHaveBeenCalledTimes(1);

    const [calledShow, pages, presetId, cover] = (mockGenerateIssuePDF.mock.calls as any)[0];
    expect(calledShow).toBe(show);
    expect(presetId).toBe('globalcomix');
    expect(pages).toEqual([
      { assetId: 'asset-1', enabled: true },
      { assetId: 'asset-2', enabled: true },
    ]);
    expect(cover).toBeUndefined();
  });

  it('prefers lettered over base variant when both approved', async () => {
    const show = makeTestShow();
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v1-base',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1-base',
        variantType: 'base',
        status: 'approved',
        createdAt: 1000,
      },
      {
        uid: 'v1-lettered',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1-lettered',
        variantType: 'lettered',
        status: 'approved',
        createdAt: 1200,
      }
    ];
    mockVersionsByPage['page-uid-2'] = [
      {
        uid: 'v2-base',
        showId: 'show-123',
        productionPageUid: 'page-uid-2',
        assetId: 'asset-2-base',
        variantType: 'base',
        status: 'approved',
        createdAt: 1100,
      }
    ];

    await generateProductionIssuePDF(show, 'issue-1', 'globalcomix');
    const [, pages] = (mockGenerateIssuePDF.mock.calls as any)[0];
    expect(pages).toEqual([
      { assetId: 'asset-1-lettered', enabled: true },
      { assetId: 'asset-2-base', enabled: true },
    ]);
  });

  it('includes cover page when coverPageUid is set', async () => {
    const show = makeTestShow();
    show.issueManifests![0].coverPageUid = 'page-cover';

    mockVersionsByPage['page-cover'] = [
      {
        uid: 'vc',
        showId: 'show-123',
        productionPageUid: 'page-cover',
        assetId: 'asset-cover-img',
        variantType: 'base',
        status: 'approved',
        createdAt: 500,
      }
    ];
    mockVersionsByPage['page-uid-1'] = [
      {
        uid: 'v1',
        showId: 'show-123',
        productionPageUid: 'page-uid-1',
        assetId: 'asset-1',
        variantType: 'base',
        status: 'approved',
        createdAt: 1000,
      }
    ];
    mockVersionsByPage['page-uid-2'] = [
      {
        uid: 'v2',
        showId: 'show-123',
        productionPageUid: 'page-uid-2',
        assetId: 'asset-2',
        variantType: 'base',
        status: 'approved',
        createdAt: 1100,
      }
    ];

    await generateProductionIssuePDF(show, 'issue-1', 'globalcomix');
    const [, , , cover] = (mockGenerateIssuePDF.mock.calls as any)[0];
    expect(cover).toEqual({ assetId: 'asset-cover-img' });
  });

  it('throws error when no manifest exists for issue', async () => {
    const show = makeTestShow();
    await expect(generateProductionIssuePDF(show, 'non-existent-issue'))
      .rejects.toThrow('No manifest for issue non-existent-issue');
  });

  it('throws error when no pages contain valid images', async () => {
    const show = makeTestShow();
    // mockVersionsByPage is empty
    await expect(generateProductionIssuePDF(show, 'issue-1'))
      .rejects.toThrow('No pages with images to export as PDF.');
  });
});
