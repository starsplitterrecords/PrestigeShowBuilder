import { Show } from '../../types/show';
import { ProductionPage, ImageVersion } from '../../types/production';
import { generateUID } from '../../domainUtils';
import { writeImageVersion } from '../../storage/ProductionStorage';
import { ShowStorage } from '../../storage/ShowStorage';

export interface MigrationResult {
  migrated: number;
  recovered: number;
  failed: number;
  details: Array<{
    beatFid: string;
    outcome: 'migrated' | 'recovered' | 'failed';
    reason?: string;
  }>;
}

export async function migrateComicGalleryToImageVersions(
  show: Show
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    recovered: 0,
    failed: 0,
    details: []
  };

  // Build reverse lookup: beatFid → PageBeat uid → ProductionPage uid
  const beatFidToProductionPageUid: Record<string, string> = {};
  const beatFidToPageBeatUid = (show.promotionRecords ?? []).reduce(
    (acc, r) => ({ ...acc, ...r.beatFidToPageBeatUid }),
    {} as Record<string, string>
  );
  
  const pbUidToProductionPageUid: Record<string, string> = {};
  for (const pg of show.productionPages ?? []) {
    pbUidToProductionPageUid[pg.pageBeatUid] = pg.uid;
  }
  
  for (const [fid, pbUid] of Object.entries(beatFidToPageBeatUid)) {
    const pgUid = pbUidToProductionPageUid[pbUid];
    if (pgUid) {
      beatFidToProductionPageUid[fid] = pgUid;
    }
  }

  const newPages: ProductionPage[] = [];
  const newVersions: ImageVersion[] = [];

  for (const entry of show.comicGallery ?? []) {
    const fid = entry.beatFid ?? '';
    let productionPageUid = beatFidToProductionPageUid[fid];

    // Not resolved — create a recovery page.
    if (!productionPageUid) {
      const recoveryPage: ProductionPage = {
        uid: generateUID(),
        showId: show.id,
        issueUid: 'recovered',
        pageBeatUid: 'recovered',
        source: 'uploaded',
        status: 'generated',
        createdAt: entry.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      newPages.push(recoveryPage);
      productionPageUid = recoveryPage.uid;
      result.recovered++;
      result.details.push({
        beatFid: fid,
        outcome: 'recovered',
        reason: 'No PromotionRecord mapping found'
      });
    } else {
      result.migrated++;
      result.details.push({
        beatFid: fid,
        outcome: 'migrated'
      });
    }

    const version: ImageVersion = {
      uid: generateUID(),
      showId: show.id,
      productionPageUid,
      assetId: entry.assetId,
      variantType: (entry.variantType as any) ?? 'base',
      status: entry.status === 'approved' ? 'approved'
        : entry.status === 'archived' ? 'archived'
        : 'draft',
      createdAt: entry.createdAt ?? Date.now(),
    };
    newVersions.push(version);
  }

  // Write all new records.
  for (const v of newVersions) {
    await writeImageVersion(show.id, v);
  }

  // Persist new recovery pages on the show document.
  if (newPages.length > 0) {
    const updated = {
      ...show,
      productionPages: [
        ...(show.productionPages ?? []),
        ...newPages
      ],
    };
    await ShowStorage.saveOne(updated, false);
  }

  return result;
}

// Call this AFTER confirming migration result.
// Clears comicGallery from the show document.
export async function clearComicGallery(
  show: Show
): Promise<void> {
  const cleared = { ...show, comicGallery: [] };
  await ShowStorage.saveOne(cleared, false);
}
