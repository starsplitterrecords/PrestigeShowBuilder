import { Show, ShowSummary } from "../types/models";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  openDB, buildSummary, SHOW_STORE, SUMMARY_STORE
} from "./db";

/**
 * Show summaries + sync metadata.
 *
 * Extracted from VaultStorage.ts in D282 (F5A pass 2).
 * VaultStorage retains the public surface as thin delegators.
 */

export const SummaryStorage = {
  async getSummaries(): Promise<ShowSummary[]> {
    // Local only during normal operation.
    try {
      const dbLocal = await openDB();
      const tx = dbLocal.transaction(SUMMARY_STORE, "readonly");
      const req = tx.objectStore(SUMMARY_STORE).getAll();
      return await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  },

  async getCloudSummaries(): Promise<ShowSummary[]> {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      const q = query(
        collection(db, SUMMARY_STORE),
        where("ownerId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => d.data() as ShowSummary);
    } catch (e) {
      console.warn("[Firebase] getCloudSummaries failed:", e);
      return [];
    }
  },

  async rehydrateSummariesFromCloud(): Promise<{
    restored: number;
    summaries: ShowSummary[];
  }> {
    const cloudSummaries = await this.getCloudSummaries();
    if (cloudSummaries.length === 0)
      return { restored: 0, summaries: [] };

    const dbLocal = await openDB();
    const tx = dbLocal.transaction(SUMMARY_STORE, 'readwrite');
    const store = tx.objectStore(SUMMARY_STORE);

    for (const summary of cloudSummaries) {
      store.put(summary);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return { restored: cloudSummaries.length, summaries: cloudSummaries };
  },

  async getCloudSummaryStatus(): Promise<{
    signedIn: boolean;
    count: number;
  }> {
    const user = auth.currentUser;
    if (!user) return { signedIn: false, count: 0 };
    const summaries = await this.getCloudSummaries();
    return { signedIn: true, count: summaries.length };
  },

  async setLocalSyncMeta(
    showId: string, timestamp: number
  ): Promise<void> {
    const dbLocal = await openDB();
    const tx = dbLocal.transaction('showSyncMeta', 'readwrite');
    tx.objectStore('showSyncMeta').put({ showId, localLastSyncedAt: timestamp });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getLocalSyncMeta(
    showId: string
  ): Promise<{ showId: string; localLastSyncedAt: number } | null> {
    try {
      const dbLocal = await openDB();
      const tx = dbLocal.transaction('showSyncMeta', 'readonly');
      const req = tx.objectStore('showSyncMeta').get(showId);
      return await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  },

  async getAllSyncMeta(): Promise<Record<string, number>> {
    try {
      const dbLocal = await openDB();
      const tx = dbLocal.transaction('showSyncMeta', 'readonly');
      const req = tx.objectStore('showSyncMeta').getAll();
      const results = await new Promise<any[]>((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      const map: Record<string, number> = {};
      results.forEach(r => {
        map[r.showId] = r.localLastSyncedAt;
      });
      return map;
    } catch (e) {
      return {};
    }
  },

  async backfillSummaries(): Promise<void> {
    const db = await openDB();
    const existing = await new Promise<ShowSummary[]>((resolve, reject) => {
      const tx = db.transaction(SUMMARY_STORE, 'readonly');
      const req = tx.objectStore(SUMMARY_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    const existingIds = new Set(existing.map(s => s.id));

    const shows = await new Promise<Show[]>((resolve, reject) => {
      const tx = db.transaction(SHOW_STORE, 'readonly');
      const req = tx.objectStore(SHOW_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });

    const missing = shows.filter(s => !existingIds.has(s.id));
    if (missing.length === 0) return;

    const tx = db.transaction(SUMMARY_STORE, 'readwrite');
    missing.forEach(show => tx.objectStore(SUMMARY_STORE).put(buildSummary(show)));
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB backfill failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB backfill aborted'));
    });
  },
};
