import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runIssueGeneration } from '../hooks/production/runIssueGeneration';
import type { Show } from '../types/show';
import type { ProductionPage } from '../types/production';
import { generateFinalComicPage } from '../ai/imageGeneration/generateFinalComicPage';
import { writeImageVersion, updateProductionPage } from '../storage/ProductionStorage';
import { ShowStorage } from '../storage/ShowStorage';

vi.mock('../ai/imageGeneration/generateFinalComicPage', () => ({
  generateFinalComicPage: vi.fn(),
}));

vi.mock('../storage/ShowStorage', () => ({
  ShowStorage: {
    getAll: vi.fn(),
    getById: vi.fn(),
    pullFromCloud: vi.fn(),
    saveOne: vi.fn(),
    deleteOne: vi.fn(),
  }
}));

vi.mock('../storage/AssetStorage', () => ({
  AssetStorage: {
    getDataUri: vi.fn().mockResolvedValue('data:image/png;base64,mock'),
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

describe('runIssueGeneration', () => {
  let mockShow: Show;
  let pagesByUid: Record<string, ProductionPage>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockShow = {
      id: 'show-123',
      name: 'Test Show',
      seasons: [],
      characters: [
        { id: 'char-1', handle: '@hero', name: 'Hero', role: 'Main', portraitAssetId: 'mock-portrait-asset' }
      ],
      settingAnchors: [],
      comicStyle: {
        artistStyle: 'Classic Lineart',
        colorPalette: 'Muted',
        lineWeight: 'Medium',
        negativePrompt: '',
        compositionPrompt: '',
      },
      issues: [
        {
          uid: 'issue-abc',
          showId: 'show-123',
          legacyEpisodeId: 'ep-1',
          issueCode: 'TST-I01',
          number: 1,
          title: 'The Beginning',
          promotedAt: Date.now(),
          status: 'active',
          gndsArtifactId: 'art-1',
          acts: [
            {
              uid: 'act-1',
              number: 1,
              title: 'Act One',
              scenes: [
                {
                  uid: 'scene-1',
                  number: 1,
                  title: 'Opening Scene',
                  setting: 'Space Station',
                  dramaticWant: 'Survive',
                  sceneFunction: 'Opening',
                  pageBeats: [
                    {
                      uid: 'pb-1',
                      address: 'TST-I01-A1-SC01-PB01',
                      number: 1,
                      description: 'Hero wakes up',
                      beatType: 'ACTION',
                      characterIds: ['char-1'],
                      subtext: '',
                      visualNote: 'dark room with stars',
                      direction: 'wide shot',
                      productionPageUid: 'page-1',
                    },
                    {
                      uid: 'pb-2',
                      address: 'TST-I01-A1-SC01-PB02',
                      number: 2,
                      description: 'Hero steps outside',
                      beatType: 'ACTION',
                      characterIds: ['char-1'],
                      subtext: '',
                      visualNote: 'bright docking bay',
                      direction: 'close up',
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

    vi.mocked(ShowStorage.getById).mockResolvedValue(mockShow);
    vi.mocked(generateFinalComicPage).mockResolvedValue({ assetId: 'asset-new-lettered' } as any);
  });

  it('runs generation sequentially on planned pages', async () => {
    const progressCalls: any[] = [];
    const res = await runIssueGeneration(
      mockShow,
      'issue-abc',
      ['page-1', 'page-2'],
      pagesByUid,
      {
        skipApproved: true,
        onProgress: (p) => progressCalls.push(p),
      }
    );

    expect(res).toEqual({
      generated: 2,
      skipped: 0,
      failed: 0,
    });

    expect(generateFinalComicPage).toHaveBeenCalledTimes(2);
    expect(writeImageVersion).toHaveBeenCalledTimes(2); // 2 lettered pages in single-pass
    expect(updateProductionPage).toHaveBeenCalledTimes(2); // 2 status updates

    // progress callback checks
    expect(progressCalls).toHaveLength(4); // page 1: generating, done, page 2: generating, done
    expect(progressCalls[0]).toEqual({
      index: 0,
      total: 2,
      pageUid: 'page-1',
      address: 'TST-I01-A1-SC01-PB01',
      phase: 'generating',
    });
  });

  it('skips pages with approved/completed status when skipApproved option is active', async () => {
    pagesByUid['page-1'].status = 'approved';

    const res = await runIssueGeneration(
      mockShow,
      'issue-abc',
      ['page-1', 'page-2'],
      pagesByUid,
      {
        skipApproved: true,
      }
    );

    expect(res).toEqual({
      generated: 1, // only page-2 is generated
      skipped: 1,
      failed: 0,
    });

    expect(generateFinalComicPage).toHaveBeenCalledTimes(1);
  });

  it('tolerates individual page errors and continues to the next page', async () => {
    vi.mocked(generateFinalComicPage)
      .mockRejectedValueOnce(new Error('Generation system overload'))
      .mockResolvedValueOnce({ assetId: 'asset-ok' } as any);

    const progressCalls: any[] = [];
    const res = await runIssueGeneration(
      mockShow,
      'issue-abc',
      ['page-1', 'page-2'],
      pagesByUid,
      {
        skipApproved: true,
        onProgress: (p) => progressCalls.push(p),
      }
    );

    expect(res).toEqual({
      generated: 1,
      skipped: 0,
      failed: 1,
    });

    expect(generateFinalComicPage).toHaveBeenCalledTimes(2);
    
    // Check that there is an error event logged in progress
    const errorEvent = progressCalls.find(p => p.phase === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.error).toBe('Generation system overload');
  });

  it('respects cooperative cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    
    const res = await runIssueGeneration(
      mockShow,
      'issue-abc',
      ['page-1', 'page-2'],
      pagesByUid,
      {
        skipApproved: true,
        signal: controller.signal,
        onProgress: (p) => {
          if (p.phase === 'done' && p.index === 0) {
            controller.abort();
          }
        },
      }
    );

    expect(res.generated).toBe(1);
    expect(generateFinalComicPage).toHaveBeenCalledTimes(1); // Second page is aborted
  });
});
