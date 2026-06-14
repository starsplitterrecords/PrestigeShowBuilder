import { Show, ShowSummary } from '../types/models';

/**
 * IndexedDB schema history:
 *   v1: initial — productions, summaries
 *   v2: added assets
 *   v3: ...
 *   v4: ...
 *   v5: D253 — added showSyncMeta (rolled back; do not reuse)
 *   v6: D253.6 — added showSyncMeta cleanly
 * 
 * IMPORTANT: never decrease DB_VERSION. Forward-only. 
 * To revert a schema change, increase the version and undo in onupgradeneeded.
 */

export const DB_NAME = 'PrestigeVault_v2';
export const SHOW_STORE = 'productions';
export const SUMMARY_STORE = 'summaries';
export const ASSET_STORE = 'assets';
export const SHOW_SYNC_META = 'showSyncMeta';
export const DB_VERSION = 12;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onblocked = () => {
      console.error('IndexedDB blocked by another connection. Close other tabs and reload.');
      reject(new Error('IndexedDB blocked: close other tabs and reload the page.'));
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHOW_STORE)) {
        db.createObjectStore(SHOW_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {
        db.createObjectStore(SUMMARY_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SHOW_SYNC_META)) {
        db.createObjectStore(SHOW_SYNC_META, { keyPath: 'showId' });
      }
      if (!db.objectStoreNames.contains('psb4_runs')) {
        const runs = db.createObjectStore('psb4_runs', { keyPath: 'id' });
        runs.createIndex('by-show', 'showId', { unique: false });
        runs.createIndex('by-show-status', ['showId', 'status'], { unique: false });
      }
      if (!db.objectStoreNames.contains('psb4_artifacts')) {
        const artifacts = db.createObjectStore('psb4_artifacts', { keyPath: 'id' });
        artifacts.createIndex('by-run', 'runId', { unique: false });
        artifacts.createIndex('by-run-type', ['runId', 'artifactType'], { unique: false });
        artifacts.createIndex('by-run-episode', ['runId', 'episodeId'], { unique: false });
        artifacts.createIndex('by-show-type', ['showId', 'artifactType'], { unique: false });
      }
      if (!db.objectStoreNames.contains('psb4_corpus')) {
        const corpus = db.createObjectStore('psb4_corpus', { keyPath: 'id' });
        corpus.createIndex('by-run', 'runId', { unique: false });
        corpus.createIndex('by-run-index', ['runId', 'episodeIndex'], { unique: false });
        corpus.createIndex('by-show-episode-locked', ['showId', 'episodeId', 'locked'], { unique: false });
      }
      if (!db.objectStoreNames.contains('psb4_console_entries')) {
        const consoleEntries = db.createObjectStore('psb4_console_entries', { keyPath: 'id' });
        consoleEntries.createIndex('by-run', 'runId', { unique: false });
        consoleEntries.createIndex('by-run-phase', ['runId', 'phase'], { unique: false });
        consoleEntries.createIndex('by-run-pass', ['runId', 'pass'], { unique: false });
        consoleEntries.createIndex('by-show-created', ['showId', 'createdAt'], { unique: false });
        consoleEntries.createIndex('by-parent', 'parentEntryId', { unique: false });
      }
      if (!db.objectStoreNames.contains('psb4_source')) {
        const sourceStore = db.createObjectStore('psb4_source', { keyPath: 'id' });
        sourceStore.createIndex('by-run', 'runId', { unique: false });
        sourceStore.createIndex('by-show-hash', ['showId', 'exportSourceHash'], { unique: false });
      }
      if (!db.objectStoreNames.contains('production_image_versions')) {
        const ivStore = db.createObjectStore(
          'production_image_versions', { keyPath: 'uid' }
        );
        ivStore.createIndex('by-show',
          'showId', { unique: false });
        ivStore.createIndex('by-page',
          'productionPageUid', { unique: false });
        ivStore.createIndex('by-show-page',
          ['showId', 'productionPageUid'], { unique: false });
      }
      if (!db.objectStoreNames.contains('vps_runs')) {
        const runs = db.createObjectStore('vps_runs', { keyPath: 'id' });
        runs.createIndex('by-show', 'showId', { unique: false });
        runs.createIndex('by-issue', 'issueUid', { unique: false });
      }
      if (!db.objectStoreNames.contains('vps_records')) {
        const recs = db.createObjectStore('vps_records', { keyPath: 'id' });
        recs.createIndex('by-run', 'runId', { unique: false });
        recs.createIndex('by-issue', 'issueUid', { unique: false });
        recs.createIndex('by-type', 'recordType', { unique: false });
        recs.createIndex('by-run-type', ['runId', 'recordType'], { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      
      // Handle connection loss (common on iOS when app goes to background)
      db.onversionchange = () => {
        db.close();
        console.warn('Database version changed. Connection closed.');
      };
      
      db.onclose = () => {
        console.warn('Database connection closed unexpectedly.');
      };

      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Request persistent storage from the browser.
 * On iOS Safari, this is most effective when the app is added to the Home Screen.
 */
export const requestPersistence = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }
  try {
    const isPersisted = await navigator.storage.persist();
    console.log(`Storage persistence ${isPersisted ? 'granted' : 'denied'}.`);
    return isPersisted;
  } catch (err) {
    console.error('Failed to request persistence:', err);
    return false;
  }
};

export const buildSummary = (show: Show): ShowSummary => {
  let sceneCount = 0;
  try {
    sceneCount = (show.seasons ?? []).reduce((total, season) => {
      return total + (season.episodes ?? []).reduce((epTotal, ep) => {
        return epTotal + (ep.acts ?? []).reduce((actTotal, act) => {
          return actTotal + (act.scenes ?? []).length;
        }, 0);
      }, 0);
    }, 0);
  } catch (e) { /* ignore */ }

  return {
    id: show.id,
    name: show.name || 'Untitled',
    titleSuggestion: show.titleSuggestion || '',
    premise: show.premise || '',
    initMode: show.initMode || 'seed',
    draftVersion: show.draftVersion || 1,
    createdAt: show.createdAt || Date.now(),
    lastModified: show.lastModified || show.createdAt || Date.now(),
    characterCount: show.characters?.length ?? 0,
    episodeCount: show.seasons?.[0]?.episodes?.length ?? 0,
    sceneCount,
    localLastSyncedAt: (show as any).localLastSyncedAt || (show as any).lastSyncedAt || null,
    cloudLastModified: (show as any).cloudLastModified || null,
  };
};

export const isStorageLocal = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('psb4_storage_mode') === 'local';
  }
  return false;
};

