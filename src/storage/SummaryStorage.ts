import { Show, ShowSummary } from "../types/models";
import {
  openDB, buildSummary, SHOW_STORE, SUMMARY_STORE
} from "./db";

/**
 * Show summaries.
 * Local only.
 */

export const SummaryStorage = {
  async getSummaries(): Promise<ShowSummary[]> {
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
