import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runProductionAudit, AuditReport } from '../utils/audit/productionIntegrityAudit';
import { Show } from '../types/show';
import { ImageVersion } from '../types/production';

// Mock AssetStorage
vi.mock('../storage/AssetStorage', () => ({
  AssetStorage: {
    exists: vi.fn(async (assetId: string) => {
      // Mock assets starting with "exists-" as present
      return assetId.startsWith('exists-');
    }),
  }
}));

// Mock ProductionStorage
let mockVersionsByShow: Record<string, ImageVersion[]> = {};
vi.mock('../storage/ProductionStorage', () => ({
  getImageVersionsForShow: vi.fn(async (showId: string) => {
    return mockVersionsByShow[showId] || [];
  }),
}));

const makeCleanShow = (): Show => ({
  id: 'clean-show-123',
  name: 'Clean Show',
  issues: [
    {
      uid: 'issue-1',
      showId: 'clean-show-123',
      legacyEpisodeId: 'ep-1',
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
              setting: 'INT. COMMAND DECK',
              dramaticWant: 'Control',
              sceneFunction: 'Action',
              pageBeats: [
                {
                  uid: 'pb-uid-1',
                  address: 'TST-I01-A1-SC01-PB01',
                  number: 1,
                  description: 'Arvok stands at the console.',
                  beatType: 'ACTION',
                  characterIds: [],
                  subtext: '',
                  visualNote: '',
                  direction: '',
                  productionPageUid: 'prod-page-1',
                }
              ]
            }
          ]
        }
      ],
      gndsArtifactId: 'art-1',
      promotedAt: Date.now(),
      status: 'active',
    }
  ],
  productionPages: [
    {
      uid: 'prod-page-1',
      showId: 'clean-show-123',
      issueUid: 'issue-1',
      pageBeatUid: 'pb-uid-1',
      source: 'gnds',
      status: 'approved',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  ],
  issueManifests: [
    {
      uid: 'manifest-1',
      showId: 'clean-show-123',
      issueUid: 'issue-1',
      pageOrder: ['prod-page-1'],
      updatedAt: Date.now(),
    }
  ],
  promotionRecords: [],
  comicGallery: [],
} as unknown as Show);

describe('productionIntegrityAudit.test.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVersionsByShow = {};
  });

  it('Clean promoted show: 0 errors, 0 warnings', async () => {
    const show = makeCleanShow();
    mockVersionsByShow[show.id] = [
      {
        uid: 'iv-1',
        showId: show.id,
        productionPageUid: 'prod-page-1',
        assetId: 'exists-asset-1', // matches startsWith('exists-')
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      }
    ];

    const report = await runProductionAudit(show);

    expect(report.issues).toHaveLength(0);
    expect(report.summary.errorCount).toBe(0);
    expect(report.summary.warningCount).toBe(0);
    expect(report.summary.totalProductionPages).toBe(1);
    expect(report.summary.totalImageVersions).toBe(1);
  });

  it('ProductionPage with missing pageBeatUid: 1 error reported', async () => {
    const show = makeCleanShow();
    // Intentionally mismatch the pageBeatUid
    show.productionPages![0].pageBeatUid = 'non-existent-beat-uid';

    const report = await runProductionAudit(show);

    const error = report.issues.find(i => i.severity === 'error' && i.category === 'ProductionPage');
    expect(error).toBeDefined();
    expect(error?.description).toContain('references missing PageBeat');
    expect(report.summary.errorCount).toBe(1);
  });

  it('Duplicate pageUid in manifest: 1 error reported', async () => {
    const show = makeCleanShow();
    // Add page twice in order
    show.issueManifests![0].pageOrder = ['prod-page-1', 'prod-page-1'];

    const report = await runProductionAudit(show);

    const error = report.issues.find(i => i.severity === 'error' && i.category === 'IssueManifest');
    expect(error).toBeDefined();
    expect(error?.description).toContain('Duplicate page');
    expect(report.summary.errorCount).toBe(1);
  });

  it('comicGallery entry with PromotionRecord mapping: counted in migratedGalleryEntries', async () => {
    const show = makeCleanShow();
    
    // Add a gallery entry
    show.comicGallery = [
      {
        beatFid: 'legacy-beat-fid',
        assetId: 'exists-gallery-asset',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      } as any
    ];

    // Add a mapping for legacy-beat-fid
    show.promotionRecords = [
      {
        uid: 'promo-rec-1',
        showId: show.id,
        legacyEpisodeId: 'ep-1',
        issueUid: 'issue-1',
        gndsArtifactId: 'art-1',
        promotedAt: Date.now(),
        beatFidToPageBeatUid: {
          'legacy-beat-fid': 'pb-uid-1'
        }
      } as any
    ];

    const report = await runProductionAudit(show);

    expect(report.summary.migratedGalleryEntries).toBe(1);
    expect(report.summary.orphanedGalleryEntries).toBe(0);
    expect(report.summary.warningCount).toBe(0);
  });

  it('comicGallery entry without mapping: counted in orphanedGalleryEntries, 1 warning', async () => {
    const show = makeCleanShow();
    // Add a gallery entry with no promotional mapping
    show.comicGallery = [
      {
        beatFid: 'unmapped-legacy-beat-fid',
        assetId: 'exists-gallery-asset',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      } as any
    ];

    const report = await runProductionAudit(show);

    expect(report.summary.migratedGalleryEntries).toBe(0);
    expect(report.summary.orphanedGalleryEntries).toBe(1);
    expect(report.summary.warningCount).toBe(1);
    
    const warning = report.issues.find(i => i.severity === 'warning' && i.category === 'ComicGallery');
    expect(warning).toBeDefined();
    expect(warning?.description).toContain('has no PromotionRecord mapping');
  });

  it('Summary counts match issues array', async () => {
    const show = makeCleanShow();
    
    // Create multiple problems:
    // 1) Page with mismatched heartbeat
    show.productionPages![0].pageBeatUid = 'non-existent-pb-uid';
    // 2) Unmapped gallery item (warning)
    show.comicGallery = [
      {
        beatFid: 'unmapped-fid',
        assetId: 'exists-gallery-asset',
      } as any
    ];

    const report = await runProductionAudit(show);

    const calcErrors = report.issues.filter(i => i.severity === 'error').length;
    const calcWarnings = report.issues.filter(i => i.severity === 'warning').length;
    const calcInfos = report.issues.filter(i => i.severity === 'info').length;

    expect(report.summary.errorCount).toBe(calcErrors);
    expect(report.summary.warningCount).toBe(calcWarnings);
    expect(report.summary.infoCount).toBe(calcInfos);
  });
});
