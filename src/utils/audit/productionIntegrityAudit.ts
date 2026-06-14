import { Show } from '../../types/show';
import { AssetStorage } from '../../storage/AssetStorage';

export interface AuditIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  uid?: string;
  recoverable: boolean;
}

export interface AuditReport {
  showId: string;
  runAt: number;
  issues: AuditIssue[];
  summary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    totalProductionPages: number;
    totalImageVersions: number;
    totalComicGalleryEntries: number;
    promotedIssueCount: number;
    migratedGalleryEntries: number;
    orphanedGalleryEntries: number;
  };
}

export async function runProductionAudit(
  show: Show
): Promise<AuditReport> {
  const issues: AuditIssue[] = [];

  // 1. ProductionPages with no matching PageBeat
  const allPageBeats = (show.issues ?? []).flatMap(
    i => i.acts.flatMap(
      a => a.scenes.flatMap(s => s.pageBeats)
    )
  );
  const pageBeatUids = new Set(
    allPageBeats.map(pb => pb.uid)
  );
  for (const pg of show.productionPages ?? []) {
    if (!pageBeatUids.has(pg.pageBeatUid)) {
      issues.push({
        severity: 'error',
        category: 'ProductionPage',
        description: `ProductionPage ${pg.uid} references missing PageBeat ${pg.pageBeatUid}`,
        uid: pg.uid,
        recoverable: false
      });
    }
  }

  // 2. IssueManifest gaps and duplicates
  for (const mfst of show.issueManifests ?? []) {
    const seen = new Set<string>();
    for (const uid of mfst.pageOrder) {
      if (seen.has(uid)) {
        issues.push({
          severity: 'error',
          category: 'IssueManifest',
          description: `Duplicate page ${uid} in manifest ${mfst.uid}`,
          uid: mfst.uid,
          recoverable: true
        });
      }
      seen.add(uid);
      if (!(show.productionPages ?? []).find(pg => pg.uid === uid)) {
        issues.push({
          severity: 'error',
          category: 'IssueManifest',
          description: `Manifest ${mfst.uid} references missing page ${uid}`,
          uid: mfst.uid,
          recoverable: false
        });
      }
    }
  }

  // 3. ImageVersions with missing assetIds in AssetStorage
  const { getImageVersionsForShow } = await import(
    '../../storage/ProductionStorage'
  );
  const allVersions = await getImageVersionsForShow(show.id);
  let missingAssets = 0;
  for (const v of allVersions) {
    const exists = await AssetStorage.exists(v.assetId);
    if (!exists) {
      missingAssets++;
      issues.push({
        severity: 'error',
        category: 'ImageVersion',
        description: `ImageVersion ${v.uid} references missing asset ${v.assetId}`,
        uid: v.uid,
        recoverable: false
      });
    }
  }

  // 4. comicGallery entries — resolved vs orphaned
  let migratedCount = 0;
  let orphanedCount = 0;
  const allBeatFidMaps = (show.promotionRecords ?? []).reduce(
    (acc, r) => ({ ...acc, ...r.beatFidToPageBeatUid }),
    {}
  ) as Record<string, string>;

  for (const entry of show.comicGallery ?? []) {
    if (entry.beatFid && allBeatFidMaps[entry.beatFid]) {
      migratedCount++;
    } else {
      orphanedCount++;
      issues.push({
        severity: 'warning',
        category: 'ComicGallery',
        description: `Gallery entry for beat ${entry.beatFid ?? 'unknown'} has no PromotionRecord mapping`,
        recoverable: true
      });
    }
  }

  const gallery = show.comicGallery ?? [];
  return {
    showId: show.id,
    runAt: Date.now(),
    issues,
    summary: {
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      infoCount: issues.filter(i => i.severity === 'info').length,
      totalProductionPages: (show.productionPages ?? []).length,
      totalImageVersions: allVersions.length,
      totalComicGalleryEntries: gallery.length,
      promotedIssueCount: (show.issues ?? []).length,
      migratedGalleryEntries: migratedCount,
      orphanedGalleryEntries: orphanedCount,
    }
  };
}
