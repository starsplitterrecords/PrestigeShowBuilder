import { Show } from "../types/models";
import {
  openDB, buildSummary, SHOW_STORE, SUMMARY_STORE
} from "./db";
import { SummaryStorage } from "./SummaryStorage";
import { migrateShowInPlace } from "./migrations";

export const ShowStorage = {
  async getAll(): Promise<Show[]> {
    const summaries = await SummaryStorage.getSummaries();
    const shows: Show[] = [];
    for (const s of summaries) {
      const full = await this.getById(s.id);
      if (full) shows.push(full);
    }
    return shows;
  },

  async getById(id: string): Promise<Show | null> {
    let localShow: Show | null = null;
    try {
      const dbLocal = await openDB();
      const tx = dbLocal.transaction(SHOW_STORE, "readonly");
      const req = tx.objectStore(SHOW_STORE).get(id);
      localShow = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
    } catch (e) {
      console.warn("[Storage] Local getById failed:", id, e);
    }

    if (localShow) {
      migrateShowInPlace(localShow);
      if (localShow.imageVersions && localShow.imageVersions.length > 0) {
        try {
          const dbLocal = await openDB();
          const tx = dbLocal.transaction('production_image_versions', 'readwrite');
          const store = tx.objectStore('production_image_versions');
          for (const v of localShow.imageVersions) {
            store.put(v);
          }
          await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          // Remove from show document.
          const cleaned = { ...localShow, imageVersions: [] };
          await this.saveOne(cleaned, false);
          localShow = cleaned;
        } catch (err) {
          console.error("[Storage] Failed to migrate imageVersions:", err);
        }
      }

      // Backfill or restore image versions if empty locally
      const { getImageVersionsForShow } = await import("./ProductionStorage");
      const localVersions = await getImageVersionsForShow(localShow.id);
      if (localVersions.length === 0) {
        // No cloud restoration requested
      }

      return localShow;
    }

    return null;
  },

  async saveOne(show: Show, _forceCloud: boolean = false): Promise<boolean> {
    const dbLocal = await openDB();

    try {
      const txCheck = dbLocal.transaction(SHOW_STORE, 'readonly');
      const existing = await new Promise<Show | null>((resolve) => {
        const req = txCheck.objectStore(SHOW_STORE).get(show.id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (existing) {
        const currentScore = (show.characters?.length || 0) + (show.seasons?.length || 0);
        const existingScore = (existing.characters?.length || 0) + (existing.seasons?.length || 0);
        
        if (existingScore > currentScore && currentScore === 0 && existingScore > 0) {
          console.warn(`Safety: Aborting save of empty show ${show.id} to prevent data loss.`);
          return false;
        }
      }
    } catch (e) { /* ignore */ }

    const tx = dbLocal.transaction([SHOW_STORE, SUMMARY_STORE], 'readwrite');
    tx.objectStore(SHOW_STORE).put(show);
    tx.objectStore(SUMMARY_STORE).put(buildSummary(show));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror   = () => reject(tx.error ?? new Error('IndexedDB save failed'));
    });

    return true;
  },

  async deleteOne(id: string): Promise<boolean> {
    const dbLocal = await openDB();
    const tx = dbLocal.transaction([SHOW_STORE, SUMMARY_STORE], "readwrite");
    tx.objectStore(SHOW_STORE).delete(id);
    tx.objectStore(SUMMARY_STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror   = () => reject(tx.error);
    });

    return true;
  },
};
