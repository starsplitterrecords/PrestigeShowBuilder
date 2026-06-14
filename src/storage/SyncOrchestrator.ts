import { Show } from "../types/models";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  openDB, buildSummary, SHOW_STORE, SUMMARY_STORE, ASSET_STORE, isStorageLocal
} from "./db";
import { SummaryStorage } from "./SummaryStorage";
import { ShowStorage } from "./ShowStorage";
import { AssetStorage } from "./AssetStorage";

/**
 * Sync orchestration. Sits above SummaryStorage and ShowStorage;
 * compares states and orchestrates bulk sync.
 *
 * Extracted from VaultStorage.ts in D285 (F5A pass 5).
 * VaultStorage retains the public surface as thin delegators.
 */

export const SyncOrchestrator = {
  async getSyncStatus(
    show: Show
  ): Promise<'synced' | 'local-newer' | 'cloud-newer' | 'conflict' | 'error'> {
    try {
      const meta = await SummaryStorage.getLocalSyncMeta(show.id);
      const localSync = meta?.localLastSyncedAt ?? 0;
      const cloudMod = (show as any).cloudLastModified ?? 0;
      const localMod = show.lastModified ?? 0;

      console.log("[Sync] status check", {
        showId: show.id,
        localSync, cloudMod, localMod,
        cloudVsSync: cloudMod - localSync,
        localVsSync: localMod - localSync,
      });

      if (cloudMod > localSync && localMod > localSync)
        return 'conflict';
      if (cloudMod > localSync) return 'cloud-newer';
      if (localMod > localSync) return 'local-newer';
      return 'synced';
    } catch (e) {
      console.error("[Sync] Status check failed:", e);
      return 'error';
    }
  },

  async syncLocalToCloud(
    onProgress?: (status: string, current: number, total: number) => void,
    force: boolean = false
  ): Promise<void> {
    if (isStorageLocal()) {
      console.log("[Sync] Sync bypassed in local storage mode");
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    const dbLocal = await openDB();

    // 1. Sync Shows (Delta)
    const summaries = await SummaryStorage.getSummaries();
    const showsToSync = summaries.filter(s =>
      force
      || !s.localLastSyncedAt
      || s.lastModified > (s.localLastSyncedAt || 0)
    );

    for (let i = 0; i < showsToSync.length; i++) {
      const summary = showsToSync[i];
      if (onProgress)
        onProgress(
          `Syncing show: ${summary.name || summary.id}`,
          i + 1, showsToSync.length
        );

      const show = await ShowStorage.getById(summary.id);
      if (show) {
        try {
          await ShowStorage.writeShowToFirestore(show, user.uid);

          const now = Date.now();
          (show as any).localLastSyncedAt = now;
          const tx = dbLocal.transaction(
            [SHOW_STORE, SUMMARY_STORE], 'readwrite');
          tx.objectStore(SHOW_STORE).put(show);
          tx.objectStore(SUMMARY_STORE).put(buildSummary(show));
          await new Promise(r => tx.oncomplete = r);
        } catch (err) {
          console.warn(`[Sync] Failed to sync show ${show.id} to cloud:`, err);
        }
      }
    }

    // 2. Sync Assets (Delta)
    const assets = await new Promise<{ id: string; blob: Blob; lastSyncedAt?: number }[]>((resolve, reject) => {
      const tx = dbLocal.transaction(ASSET_STORE, 'readonly');
      const req = tx.objectStore(ASSET_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const assetsToSync = assets.filter(a => force || !a.lastSyncedAt);

    for (let i = 0; i < assetsToSync.length; i++) {
      const asset = assetsToSync[i];
      if (onProgress)
        onProgress(`Syncing asset: ${asset.id}`, i + 1, assetsToSync.length);

      // Check if asset exists in cloud first to save writes
      const docRef = doc(db, ASSET_STORE, asset.id);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        await AssetStorage.pushToCloud(asset.id, asset.blob);
      }
      
      // Mark as synced locally
      const tx = dbLocal.transaction(ASSET_STORE, 'readwrite');
      tx.objectStore(ASSET_STORE).put({ ...asset, lastSyncedAt: Date.now() });
      await new Promise(r => tx.oncomplete = r);
    }
  },
};
