import { ProductionPage, PageBeat, ImageVersion, PreflightWarning } from '../types/production';

export type ProductionPageStatus = 'APPROVED' | 'GENERATED' | 'BLOCKED' | 'PARTIAL' | 'PLANNED' | 'MISSING';

export interface ProductionPageStatusResult {
  status: ProductionPageStatus;
  reason: string;
}

export function getProductionPageStatus({
  page,
  pageBeat,
  imageVersions,
  preflightWarnings,
  panelPlans
}: {
  page?: ProductionPage | null;
  pageBeat?: PageBeat | null;
  imageVersions?: ImageVersion[] | null;
  preflightWarnings?: PreflightWarning[] | null;
  panelPlans?: any[] | null;
}): ProductionPageStatusResult {
  if (!page || !pageBeat) {
    return {
      status: 'MISSING',
      reason: 'MISSING — page lacks required production/pageBeat data.'
    };
  }

  // Filter image versions for this specific page, ignoring archived ones.
  const pageImageVersions = (imageVersions ?? []).filter(
    v => v.productionPageUid === page.uid && v.status !== 'archived'
  );

  // 1. APPROVED
  // page has an approved/final image/version or explicit approved status
  const approvedVersion = pageImageVersions.find(v => v.status === 'approved');
  if (approvedVersion || page.status === 'approved') {
    const activeUid = approvedVersion?.uid || page.approvedImageVersionUid || 'explicit';
    return {
      status: 'APPROVED',
      reason: `APPROVED — approved image version ${activeUid} exists.`
    };
  }

  // 3. BLOCKED
  // page cannot generate because required current-page preflight blockers exist
  // We check for warnings/blocking preflight warns corresponding to this specific page
  const pageWarnings = (preflightWarnings ?? []).filter(
    w => (w.productionPageUid === page.uid || w.pageBeatUid === page.pageBeatUid) &&
         (w.severity === 'blocking' || w.severity === 'warning')
  );
  if (pageWarnings.length > 0) {
    return {
      status: 'BLOCKED',
      reason: `BLOCKED — ${pageWarnings[0].message}`
    };
  }

  // 2. GENERATED
  // page has at least one generated base/draft image version, and is not approved (and not blocked as checked above)
  if (pageImageVersions.length > 0) {
    return {
      status: 'GENERATED',
      reason: `GENERATED — ${pageImageVersions.length} base image version exists for this page.`
    };
  }

  // 5. PLANNED
  // page has panel/layout/pageBeat planning data, but no generated image version
  const plans = panelPlans ?? pageBeat.panelPlans ?? [];
  if (plans.length > 0) {
    return {
      status: 'PLANNED',
      reason: 'PLANNED — panel plan exists, no image versions found.'
    };
  }

  // 4. PARTIAL
  // page has incomplete panel/layout/image state
  // some required production data exists, but not enough to call generated
  return {
    status: 'PARTIAL',
    reason: 'PARTIAL — page has incomplete panel/layout/image state (no panel plans yet).'
  };
}
