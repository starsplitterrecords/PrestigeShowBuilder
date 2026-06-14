import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runIssueGeneration } from '../hooks/production/runIssueGeneration';
import { estimateIssueDirection, estimateIssueImages, estimateShow } from '../vps/estimateRun';
import type { Show } from '../types/show';
import type { ProductionPage } from '../types/production';
import { generateFinalComicPage } from '../ai/imageGeneration/generateFinalComicPage';
import { getImageVersionsForPage, writeImageVersion, updateProductionPage } from '../storage/ProductionStorage';
import { AssetStorage } from '../storage';

vi.mock('../ai/imageGeneration/generateFinalComicPage', () => ({
  generateFinalComicPage: vi.fn(),
}));

vi.mock('../storage/AssetStorage', () => ({
  AssetStorage: {
    getDataUri: vi.fn().mockResolvedValue('data:image/png;base64,mock-existing'),
  }
}));

vi.mock('../storage/ProductionStorage', async (importOriginal) => {
  const original = await importOriginal<typeof import('../storage/ProductionStorage')>();
  return {
    ...original,
    writeImageVersion: vi.fn(),
    updateProductionPage: vi.fn(),
    getImageVersionsForPage: vi.fn().mockResolvedValue([]),
    deleteUnapprovedVersionsForPage: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Cost Estimation helpers', () => {
  const mockIssue = {
    uid: 'issue-abc',
    issueCode: 'TST-I01',
    acts: [
      {
        uid: 'act-1',
        scenes: [
          {
            uid: 'scene-1',
            pageBeats: [
              { uid: 'pb-1', productionPageUid: 'page-1' },
              { uid: 'pb-2', productionPageUid: 'page-2' },
            ]
          }
        ]
      }
    ]
  };

  const mockShow = {
    id: 'show-123',
    issues: [mockIssue]
  } as unknown as Show;

  it('estimateIssueDirection calculates correct call counts', () => {
    const est = estimateIssueDirection(mockIssue as any);
    expect(est.pages).toBe(2);
    expect(est.envCalls).toBe(1);
    expect(est.pageCalls).toBe(2);
    expect(est.imageCalls).toBe(0);
    expect(est.model).toBe('gemini-pro');
  });

  it('estimateIssueImages calculates correct call counts based on lettering option', () => {
    const estNoLetter = estimateIssueImages(mockIssue as any, false);
    expect(estNoLetter.imageCalls).toBe(2);
    expect(estNoLetter.letterCalls).toBe(0);

    const estLetter = estimateIssueImages(mockIssue as any, true);
    expect(estLetter.imageCalls).toBe(2);
    expect(estLetter.letterCalls).toBe(2);
  });

  it('estimateShow sums across multiple issues', () => {
    const showWithTwoIssues = {
      id: 'show-123',
      issues: [mockIssue, mockIssue]
    } as unknown as Show;

    const est = estimateShow(showWithTwoIssues, true);
    expect(est.pages).toBe(4);
    expect(est.envCalls).toBe(2); // 1 per issue
    expect(est.pageCalls).toBe(4);
    expect(est.imageCalls).toBe(4);
    expect(est.letterCalls).toBe(4);
  });
});

describe('runIssueGeneration skipExisting', () => {
  let mockShow: Show;
  let pagesByUid: Record<string, ProductionPage>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockShow = {
      id: 'show-123',
      name: 'Test Show',
      issues: [
        {
          uid: 'issue-abc',
          showId: 'show-123',
          issueCode: 'TST-I01',
          acts: [
            {
              uid: 'act-1',
              scenes: [
                {
                  uid: 'scene-1',
                  pageBeats: [
                    {
                      uid: 'pb-1',
                      address: 'TST-I01-A1-SC01-PB01',
                      productionPageUid: 'page-1',
                    },
                    {
                      uid: 'pb-2',
                      address: 'TST-I01-A1-SC01-PB02',
                      productionPageUid: 'page-2',
                    }
                  ],
                }
              ]
            }
          ]
        }
      ]
    } as unknown as Show;

    pagesByUid = {
      'page-1': {
        uid: 'page-1',
        showId: 'show-123',
        issueUid: 'issue-abc',
        pageBeatUid: 'pb-1',
        source: 'gnds',
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      'page-2': {
        uid: 'page-2',
        showId: 'show-123',
        issueUid: 'issue-abc',
        pageBeatUid: 'pb-2',
        source: 'gnds',
        status: 'planned',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    };

    vi.mocked(generateFinalComicPage).mockResolvedValue({ assetId: 'asset-new' } as any);
  });

  it('skips generating a page if drafts already exist (skipExisting: true)', async () => {
    // page-1 has an existing version
    vi.mocked(getImageVersionsForPage).mockImplementation(async (uid) => {
      if (uid === 'page-1') {
        return [{
          uid: 'version-existing-1',
          productionPageUid: 'page-1',
          assetId: 'asset-already-drawn',
          status: 'draft',
          createdAt: Date.now() - 1000,
        }] as any[];
      }
      return [];
    });

    const progressCalls: any[] = [];
    const res = await runIssueGeneration(
      mockShow,
      'issue-abc',
      ['page-1', 'page-2'],
      pagesByUid,
      {
        skipApproved: true,
        skipExisting: true,
        onProgress: (p) => progressCalls.push(p),
      }
    );

    // page-1 must be skipped, page-2 must be generated
    expect(res).toEqual({
      generated: 1,
      skipped: 1,
      failed: 0,
    });

    expect(generateFinalComicPage).toHaveBeenCalledTimes(1); // Only for page-2
    expect(progressCalls.find(p => p.pageUid === 'page-1' && p.phase === 'skipped')).toBeDefined();
    expect(progressCalls.find(p => p.pageUid === 'page-2' && p.phase === 'generating')).toBeDefined();

    // Verify page-1 draft was fed forward for continuity
    expect(AssetStorage.getDataUri).toHaveBeenCalledWith('asset-already-drawn');
  });
});
