import { ShowStorage } from './ShowStorage';
import { openDB } from './db';
import {
  Issue, ProductionPage, IssueManifest,
  ImageVersion, PromotionRecord
} from '../types/production';

// Write a promoted Issue and all its associated objects to the show.
// Called exclusively by the GNDS promotion bridge (DA-003).
export async function writePromotion(
  showId: string,
  issue: Issue,
  pages: ProductionPage[],
  manifest: IssueManifest,
  record: PromotionRecord,
  archiveEpisodeId: string
): Promise<void> {
  const show = await ShowStorage.getById(showId);
  if (!show) throw new Error(`Show not found: ${showId}`);

  // Archive the old Episode.
  const updatedSeasons = show.seasons.map(s => ({
    ...s,
    episodes: s.episodes.map(ep =>
      ep.id === archiveEpisodeId
        ? { ...ep, gndsArchived: true,
            promotedToIssueUid: issue.uid }
        : ep
    )
  }));

  // Add new model objects.
  const updated = {
    ...show,
    seasons: updatedSeasons,
    issues: [
      ...(show.issues ?? []).filter(i => i.uid !== issue.uid),
      issue
    ],
    productionPages: [
      ...(show.productionPages ?? []).filter(p => p.issueUid !== issue.uid),
      ...pages
    ],
    issueManifests: [
      ...(show.issueManifests ?? []).filter(m => m.issueUid !== issue.uid),
      manifest
    ],
    promotionRecords: [
      ...(show.promotionRecords ?? []).filter(r => r.issueUid !== issue.uid),
      record
    ],
  };

  await ShowStorage.saveOne(updated, false);
}

// Write a new ImageVersion (from workbench upload or generation).
// DA-013: Writes to production_image_versions store, not to show.imageVersions
export async function writeImageVersion(
  _showId: string,
  version: ImageVersion
): Promise<void> {
  const idb = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction('production_image_versions', 'readwrite');
    tx.objectStore('production_image_versions').put(version);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImageVersionsForPage(
  productionPageUid: string
): Promise<ImageVersion[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('production_image_versions', 'readonly');
    const idx = tx.objectStore('production_image_versions')
      .index('by-page');
    const req = idx.getAll(productionPageUid);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImageVersionsForPage(
  productionPageUid: string
): Promise<void> {
  const db = await openDB();
  const versions = await getImageVersionsForPage(productionPageUid);
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('production_image_versions', 'readwrite');
    const store = tx.objectStore('production_image_versions');
    for (const v of versions) {
      store.delete(v.uid);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteUnapprovedVersionsForPage(
  productionPageUid: string
): Promise<void> {
  const db = await openDB();
  const versions = await getImageVersionsForPage(productionPageUid);
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('production_image_versions', 'readwrite');
    const store = tx.objectStore('production_image_versions');
    for (const v of versions) {
      if (v.status !== 'approved') {
        store.delete(v.uid);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImageVersionsForShow(
  showId: string
): Promise<ImageVersion[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('production_image_versions', 'readonly');
    const idx = tx.objectStore('production_image_versions')
      .index('by-show');
    const req = idx.getAll(showId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function updateImageVersionStatus(
  _showId: string,
  uid: string,
  status: ImageVersion['status']
): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('production_image_versions', 'readwrite');
    const store = tx.objectStore('production_image_versions');
    const getReq = store.get(uid);
    getReq.onsuccess = () => {
      if (!getReq.result) { resolve(); return; }
      const updated = { ...getReq.result, status };
      store.put(updated);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Update a ProductionPage's status or approvedImageVersionUid.
export async function updateProductionPage(
  showId: string,
  pageUid: string,
  updates: Partial<ProductionPage>
): Promise<void> {
  const show = await ShowStorage.getById(showId);
  if (!show) return;
  const updated = {
    ...show,
    productionPages: (show.productionPages ?? []).map(pg =>
      pg.uid === pageUid ? { ...pg, ...updates, updatedAt: Date.now() } : pg
    ),
  };
  await ShowStorage.saveOne(updated, false);
}

// Update IssueManifest page order (for drag-reorder in compiler) and optionally coverPageUid.
export async function updateIssueManifest(
  showId: string,
  manifestUid: string,
  pageOrder: string[],
  coverPageUid?: string
): Promise<void> {
  const show = await ShowStorage.getById(showId);
  if (!show) return;
  const updated = {
    ...show,
    issueManifests: (show.issueManifests ?? []).map(m =>
      m.uid === manifestUid
        ? {
            ...m,
            pageOrder,
            ...(coverPageUid !== undefined ? { coverPageUid } : {}),
            updatedAt: Date.now()
          }
        : m
    ),
  };
  await ShowStorage.saveOne(updated, false);
}

export async function getIssueManifest(
  showId: string,
  issueUid: string
): Promise<IssueManifest | null> {
  const show = await ShowStorage.getById(showId);
  if (!show) return null;
  return (show.issueManifests ?? []).find(m => m.issueUid === issueUid) ?? null;
}

export async function getProductionPagesForIssue(
  showId: string,
  issueUid: string
): Promise<ProductionPage[]> {
  const show = await ShowStorage.getById(showId);
  if (!show) return [];
  return (show.productionPages ?? []).filter(p => p.issueUid === issueUid);
}

