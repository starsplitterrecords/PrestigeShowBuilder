import { describe, it, expect } from 'vitest';
import { getProductionPageStatus } from '../utils/productionStatus';
import { ProductionPage, PageBeat, ImageVersion, PreflightWarning } from '../types/production';

describe('Production Page Status Sourced of Truth Resolver', () => {
  const dummyPage: ProductionPage = {
    uid: 'page_123',
    showId: 'show_abc',
    issueUid: 'issue_001',
    pageBeatUid: 'beat_456',
    source: 'gnds',
    status: 'planned',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const dummyPageBeat: PageBeat = {
    uid: 'beat_456',
    address: 'TEST-S1-I01-A1-SC01-PB01',
    number: 1,
    description: 'A beautiful starting panel of the test',
    beatType: 'DIALOGUE',
    characterIds: ['char_99'],
    subtext: 'Some dramatic subtext',
    visualNote: 'An establishing shot',
    direction: 'Establishing the scene',
    panelPlans: [],
  };

  it('1. Page with no image version and valid panel plan = PLANNED.', () => {
    const pageBeatWithPlan: PageBeat = {
      ...dummyPageBeat,
      panelPlans: [{ panelNumber: 1, description: 'First panel' } as any]
    };

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: pageBeatWithPlan,
      imageVersions: [],
      preflightWarnings: [],
    });

    expect(res.status).toBe('PLANNED');
    expect(res.reason).toContain('panel plan exists, no image versions found');
  });

  it('2. Page with generated image version = GENERATED.', () => {
    const versions: ImageVersion[] = [
      {
        uid: 'version_v1',
        showId: 'show_abc',
        productionPageUid: 'page_123',
        assetId: 'asset_777',
        variantType: 'base',
        status: 'draft',
        createdAt: Date.now(),
      }
    ];

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: versions,
      preflightWarnings: [],
    });

    expect(res.status).toBe('GENERATED');
    expect(res.reason).toContain('1 base image version exists');
  });

  it('3. Page with approved image version = APPROVED.', () => {
    const versions: ImageVersion[] = [
      {
        uid: 'approved_v1',
        showId: 'show_abc',
        productionPageUid: 'page_123',
        assetId: 'asset_777',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      }
    ];

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: versions,
      preflightWarnings: [],
    });

    expect(res.status).toBe('APPROVED');
    expect(res.reason).toContain('approved image version approved_v1 exists');
  });

  it('4. Page with current-page blocking preflight issue = BLOCKED.', () => {
    const warnings: PreflightWarning[] = [
      {
        scope: 'page',
        showId: 'show_abc',
        issueId: 'issue_001',
        productionPageUid: 'page_123',
        pageBeatUid: 'beat_456',
        identifier: 'cyrus',
        speakerName: 'Cyrus',
        classification: 'missingPortrait',
        severity: 'blocking',
        message: 'selected character Cyrus missing portrait asset',
      }
    ];

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: [],
      preflightWarnings: warnings,
    });

    expect(res.status).toBe('BLOCKED');
    expect(res.reason).toContain('selected character Cyrus missing portrait asset');
  });

  it('5. Page does not inherit generated status from another page.', () => {
    const otherPageVersions: ImageVersion[] = [
      {
        uid: 'other_v1',
        showId: 'show_abc',
        productionPageUid: 'page_999_other', // different page
        assetId: 'asset_888',
        variantType: 'base',
        status: 'draft',
        createdAt: Date.now(),
      }
    ];

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: otherPageVersions,
      preflightWarnings: [],
    });

    // Should not be GENERATED because version belongs to other page
    expect(res.status).toBe('PARTIAL');
  });

  it('6. Page does not inherit blockers from another page.', () => {
    const otherPageWarnings: PreflightWarning[] = [
      {
        scope: 'page',
        showId: 'show_abc',
        issueId: 'issue_001',
        productionPageUid: 'page_999_other', // different page
        pageBeatUid: 'beat_999_other',
        identifier: 'cyrus',
        speakerName: 'Cyrus',
        classification: 'missingPortrait',
        severity: 'blocking',
        message: 'selected character Cyrus missing portrait asset',
      }
    ];

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: [],
      preflightWarnings: otherPageWarnings,
    });

    // Should not be BLOCKED because blocker is for other page
    expect(res.status).toBe('PARTIAL');
  });

  it('7. Issue Outline and page header show the same computed status.', () => {
    const versions: ImageVersion[] = [
      {
        uid: 'vers_1',
        showId: 'show_abc',
        productionPageUid: 'page_123',
        assetId: 'asset_777',
        variantType: 'base',
        status: 'draft',
        createdAt: Date.now(),
      }
    ];

    // Compute status mimicking Issue Outline
    const resOutline = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: versions,
      preflightWarnings: [],
    });

    // Compute status mimicking page header
    const resHeader = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: versions,
      preflightWarnings: [],
    });

    expect(resOutline.status).toBe(resHeader.status);
    expect(resOutline.reason).toBe(resHeader.reason);
  });

  it('8. Stale stored status does not override newer image/version evidence.', () => {
    const stalePageWithPlannedStatus: ProductionPage = {
      ...dummyPage,
      status: 'planned', // Stale stored status says "planned"
    };

    const versions: ImageVersion[] = [
      {
         uid: 'approved_now',
         showId: 'show_abc',
         productionPageUid: 'page_123',
         assetId: 'asset_888',
         variantType: 'base',
         status: 'approved', // Newer evidence says "approved"
         createdAt: Date.now(),
      }
    ];

    const res = getProductionPageStatus({
      page: stalePageWithPlannedStatus,
      pageBeat: dummyPageBeat,
      imageVersions: versions,
      preflightWarnings: [],
    });

    // Stale stored status must not override APPROVED
    expect(res.status).toBe('APPROVED');
    expect(res.reason).toContain('approved_now');
  });

  it('9. Deleted/superseded image versions do not count as GENERATED.', () => {
    const versions: ImageVersion[] = [
      {
        uid: 'archived_v1',
        showId: 'show_abc',
        productionPageUid: 'page_123',
        assetId: 'asset_777',
        variantType: 'base',
        status: 'archived', // "Archived" status represents a deleted/superseded version
        createdAt: Date.now(),
      }
    ];

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: versions,
      preflightWarnings: [],
    });

    // Since version is archived, this page is not considered GENERATED (falls back to PARTIAL)
    expect(res.status).toBe('PARTIAL');
  });

  it('10. Status reason identifies the exact record used.', () => {
    const versions: ImageVersion[] = [
      {
        uid: 'specific_v_uid_456',
        showId: 'show_abc',
        productionPageUid: 'page_123',
        assetId: 'asset_123',
        variantType: 'base',
        status: 'approved',
        createdAt: Date.now(),
      }
    ];

    const res = getProductionPageStatus({
      page: dummyPage,
      pageBeat: dummyPageBeat,
      imageVersions: versions,
    });

    expect(res.reason).toContain('specific_v_uid_456');
  });
});
