import { Show, ShowSummary } from "../types/models";
import { db, auth } from "../firebase";
import {
  doc, setDoc, getDoc, deleteDoc,
  collection, getDocs, query, where,
  writeBatch, WriteBatch, CollectionReference, orderBy, deleteField
} from "firebase/firestore";
import {
  openDB, buildSummary, SHOW_STORE, SUMMARY_STORE, isStorageLocal
} from "./db";
import { stripUndefined } from "./firestoreSanitize";
import { SyncBlockedError } from "./SyncBlockedError";
import { SummaryStorage } from "./SummaryStorage";
import { migrateShowInPlace } from "./migrations";
import { AssetStorage } from "./AssetStorage";
import { VaultIO } from "./VaultIO";
import { handleFirestoreError, OperationType } from "../lib/firestoreUtils";

/**
 * Show CRUD. The read-modify-write path for full Show records.
 * Local-first; cloud is best-effort.
 *
 * Extracted from VaultStorage.ts in D283 (F5A pass 3).
 * VaultStorage retains the public surface as thin delegators.
 */

interface ReconciliationResult {
  deleteCount: number;
  cloudDocs: Map<string, any>;
}

// Helper used internally by _writeShowToFirestore.
async function reconcileSubcollection(
  batch: WriteBatch,
  colRef: CollectionReference,
  localIds: Set<string>,
  uid: string
): Promise<ReconciliationResult> {
  const snap = await getDocs(query(colRef, where('ownerId', '==', uid)));
  let deleteCount = 0;
  const cloudDocs = new Map<string, any>();
  for (const d of snap.docs) {
    cloudDocs.set(d.id, d.data());
    if (!localIds.has(d.id)) {
      batch.delete(d.ref);
      deleteCount++;
    }
  }
  return { deleteCount, cloudDocs };
}

function isDataEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDataEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;

  const keysA = Object.keys(a).filter(k => a[k] !== undefined && k !== 'cloudLastModified');
  const keysB = Object.keys(b).filter(k => b[k] !== undefined && k !== 'cloudLastModified');

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    const valA = a[key];
    const valB = b[key];
    if (typeof valA === 'object' && typeof valB === 'object') {
      if (!isDataEqual(valA, valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
}

// D309: Cloud save locking to prevent "Write stream exhausted" errors
const cloudSaveLock = new Set<string>();

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
    // 1. Always try local first.
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

      // Backfill or restore image versions if empty locally and online
      const { getImageVersionsForShow, restoreImageVersionsFromCloud } = await import("./ProductionStorage");
      const localVersions = await getImageVersionsForShow(localShow.id);
      if (localVersions.length === 0 && navigator.onLine) {
        restoreImageVersionsFromCloud(localShow.id).catch(() => {});
      }

      return localShow;
    }

    // 2. Not in local storage. Try Firebase (new device / cleared storage).
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const cloudShow = await this._fetchFromFirestore(id, user.uid);
      if (cloudShow) {
        migrateShowInPlace(cloudShow);
        // Seed local storage so next load is instant.
        await this.saveOne(cloudShow);
        return cloudShow;
      }
    } catch (e) {
      console.warn("[Firebase] getById fallback failed:", id, e);
    }

    return null;
  },

  async pullFromCloud(id: string): Promise<Show | null> {
    const user = auth.currentUser;
    if (!user) {
      console.warn("[Sync] pullFromCloud: not authenticated");
      return null;
    }

    try {
      const cloudShow = await this._fetchFromFirestore(id, user.uid);
      if (!cloudShow) {
        console.warn("[Sync] pullFromCloud: cloud returned null", { id });
        return null;
      }

      migrateShowInPlace(cloudShow);
      await this.saveOne(cloudShow, false);
      return cloudShow;
    } catch (e) {
      console.error("[Sync] pullFromCloud failed:", e);
      throw e;
    }
  },

  async _fetchFromFirestore(id: string, uid: string): Promise<Show | null> {
    const path = `${SHOW_STORE}/${id}`;
    try {
      const docRef = doc(db, SHOW_STORE, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Show;
        if (data.ownerId === uid || data.ownerId === 'public') {
          const logsRef = collection(db, SHOW_STORE, id, 'logs');
          const galleryRef = collection(db, SHOW_STORE, id, 'gallery');
          const seasonsRef = collection(db, SHOW_STORE, id, 'seasons');
          const charactersRef = collection(db, SHOW_STORE, id, 'characters');
          const settingsRef = collection(db, SHOW_STORE, id, 'settingAnchors');
          
          const ownerId = data.ownerId || uid;
          
          const logsSnap = await getDocs(query(logsRef, where('ownerId', '==', ownerId), orderBy('timestamp', 'desc')));
          const gallerySnap = await getDocs(query(galleryRef, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc')));
          const seasonsSnap = await getDocs(query(seasonsRef, where('ownerId', '==', ownerId)));
          const charsSnap = await getDocs(query(charactersRef, where('ownerId', '==', ownerId)));
          const settingsSnap = await getDocs(query(settingsRef, where('ownerId', '==', ownerId)));
          
          data.generationLog = logsSnap.docs.map(d => d.data() as any);
          data.comicGallery = gallerySnap.docs.map(d => d.data() as any);
          
          const seasons = await Promise.all(seasonsSnap.docs.map(async (d) => {
            const s = d.data() as any;
            const episodesRef = collection(db, SHOW_STORE, id, 'seasons', d.id, 'episodes');
            const episodesSnap = await getDocs(query(episodesRef, where('ownerId', '==', ownerId)));
            if (!episodesSnap.empty) {
              s.episodes = episodesSnap.docs.map(ed => ed.data() as any).sort((a, b) => (a.number || 0) - (b.number || 0));
            } else if (!s.episodes) {
              s.episodes = [];
            }
            return s;
          }));
          data.seasons = seasons.sort((a, b) => (a.number || 0) - (b.number || 0));
          
          data.characters = charsSnap.docs.map(d => d.data() as any);
          data.settingAnchors = settingsSnap.docs.map(d => d.data() as any);
          
          const cloudMod = (data as any).cloudLastModified ?? Date.now();
          await SummaryStorage.setLocalSyncMeta(id, cloudMod);

          return data;
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
    return null;
  },

  async saveOne(show: Show, forceCloud: boolean = false): Promise<boolean> {
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

    if (forceCloud && show.ownerId && !isStorageLocal()) {
      if (cloudSaveLock.has(show.id)) {
        console.warn(`[Storage] Cloud save already in progress for ${show.id}. Skipping concurrent push.`);
        return true;
      }
      
      cloudSaveLock.add(show.id);
      try {
        await this.writeShowToFirestore(show, show.ownerId);
      } finally {
        cloudSaveLock.delete(show.id);
      }
    }

    return true;
  },

  async writeShowToFirestore(show: Show, uid: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new SyncBlockedError("[Sync] Not signed in at write time", "auth");
    }
    if (user.uid !== uid) {
      throw new SyncBlockedError(`[Sync] UID mismatch: param=${uid} actual=${user.uid}`, "uid-mismatch");
    }

    const path = `${SHOW_STORE}/${show.id}`;
    try {
      await VaultIO._extractBase64Assets(show);
      const { generationLog, comicGallery, seasons, characters, settingAnchors, ...showBase } = show;
      
      const cloudTime = Date.now();
      const productionPayload = {
        issues:           show.issues ?? [],
        productionPages:  show.productionPages ?? [],
        issueManifests:   show.issueManifests ?? [],
        imageVersions:    show.imageVersions ?? [],
        promotionRecords: show.promotionRecords ?? [],
      };
      const showWithOwner = { 
        ...showBase, 
        ownerId: uid,
        cloudLastModified: cloudTime,
        ...productionPayload
      };
      const summary = buildSummary(show);
      const summaryWithOwner = { 
        ...summary, 
        ownerId: uid,
        cloudLastModified: cloudTime
      };
      
      let batch = writeBatch(db);
      let count = 0;

      const commitIfNeeded = async () => {
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      };

      batch.set(doc(db, SHOW_STORE, show.id), stripUndefined(showWithOwner), { merge: true });
      count++;

      batch.set(doc(db, SUMMARY_STORE, show.id), stripUndefined(summaryWithOwner), { merge: true });
      count++;

      if (generationLog) {
        const logsRef = collection(db, SHOW_STORE, show.id, 'logs');
        const localLogIds = new Set(generationLog.map(e => e.id));
        const { deleteCount, cloudDocs } = await reconcileSubcollection(batch, logsRef, localLogIds, uid);
        count += deleteCount;
        await commitIfNeeded();
        for (const entry of generationLog) {
          const strippedEntry = stripUndefined({ ...entry, ownerId: uid });
          const cloudVal = cloudDocs.get(entry.id);
          if (!cloudVal || !isDataEqual(strippedEntry, cloudVal)) {
            batch.set(doc(logsRef, entry.id), strippedEntry, { merge: true });
            count++;
            await commitIfNeeded();
          }
        }
      }

      if (comicGallery) {
        const galleryRef = collection(db, SHOW_STORE, show.id, 'gallery');
        const localGalleryIds = new Set(comicGallery.map(e => e.assetId));
        const { deleteCount, cloudDocs } = await reconcileSubcollection(batch, galleryRef, localGalleryIds, uid);
        count += deleteCount;
        await commitIfNeeded();
        for (const entry of comicGallery) {
          const strippedEntry = stripUndefined({ ...entry, ownerId: uid });
          const cloudVal = cloudDocs.get(entry.assetId);
          if (!cloudVal || !isDataEqual(strippedEntry, cloudVal)) {
            batch.set(doc(galleryRef, entry.assetId), strippedEntry, { merge: true });
            count++;
            await commitIfNeeded();
          }
        }
      }

      if (seasons) {
        const seasonsRef = collection(db, SHOW_STORE, show.id, 'seasons');
        const localSeasonIds = new Set(seasons.map(e => e.id));
        const { deleteCount, cloudDocs: cloudSeasons } = await reconcileSubcollection(batch, seasonsRef, localSeasonIds, uid);
        count += deleteCount;
        await commitIfNeeded();
        for (const season of seasons) {
          const { episodes, ...seasonBase } = season;
          const strippedSeason = stripUndefined({ ...seasonBase, ownerId: uid, episodes: deleteField() });
          const cloudSeason = cloudSeasons.get(season.id);
          if (!cloudSeason || !isDataEqual(strippedSeason, cloudSeason)) {
            batch.set(doc(seasonsRef, season.id), strippedSeason, { merge: true });
            count++;
            await commitIfNeeded();
          }

          if (episodes) {
            const episodesRef = collection(db, SHOW_STORE, show.id, 'seasons', season.id, 'episodes');
            const localEpisodeIds = new Set(episodes.map(e => e.id));
            const { deleteCount: delEpCount, cloudDocs: cloudEpisodes } = await reconcileSubcollection(batch, episodesRef, localEpisodeIds, uid);
            count += delEpCount;
            await commitIfNeeded();
            for (const episode of episodes) {
              const strippedEpisode = stripUndefined({ ...episode, ownerId: uid });
              const cloudEpisode = cloudEpisodes.get(episode.id);
              if (!cloudEpisode || !isDataEqual(strippedEpisode, cloudEpisode)) {
                batch.set(doc(episodesRef, episode.id), strippedEpisode, { merge: true });
                count++;
                await commitIfNeeded();
              }
            }
          }
        }
      }

      if (characters) {
        const charactersRef = collection(db, SHOW_STORE, show.id, 'characters');
        const localCharacterIds = new Set(characters.map(e => e.id));
        const { deleteCount, cloudDocs } = await reconcileSubcollection(batch, charactersRef, localCharacterIds, uid);
        count += deleteCount;
        await commitIfNeeded();
        for (const char of characters) {
          const strippedChar = stripUndefined({ ...char, ownerId: uid });
          const cloudVal = cloudDocs.get(char.id);
          if (!cloudVal || !isDataEqual(strippedChar, cloudVal)) {
            batch.set(doc(charactersRef, char.id), strippedChar, { merge: true });
            count++;
            await commitIfNeeded();
          }
        }
      }

      if (settingAnchors) {
        const settingsRef = collection(db, SHOW_STORE, show.id, 'settingAnchors');
        const localAnchorIds = new Set(settingAnchors.map(e => e.id));
        const { deleteCount, cloudDocs } = await reconcileSubcollection(batch, settingsRef, localAnchorIds, uid);
        count += deleteCount;
        await commitIfNeeded();
        for (const anchor of settingAnchors) {
          const strippedAnchor = stripUndefined({ ...anchor, ownerId: uid });
          const cloudVal = cloudDocs.get(anchor.id);
          if (!cloudVal || !isDataEqual(strippedAnchor, cloudVal)) {
            batch.set(doc(settingsRef, anchor.id), strippedAnchor, { merge: true });
            count++;
            await commitIfNeeded();
          }
        }
      }

      if (count > 0) await batch.commit();

      await SummaryStorage.setLocalSyncMeta(show.id, cloudTime);

    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      throw e;
    }
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

    const user = auth.currentUser;
    if (user && !isStorageLocal()) {
      (async () => {
        try {
          const subcollections = ['logs', 'gallery', 'characters', 'settingAnchors'];
          let batch = writeBatch(db);
          let count = 0;

          const commitIfNeeded = async () => {
            if (count >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          };

          for (const sub of subcollections) {
            const ref = collection(db, SHOW_STORE, id, sub);
            const snap = await getDocs(ref);
            for (const d of snap.docs) {
              batch.delete(d.ref);
              count++;
              await commitIfNeeded();
            }
          }

          const seasonsRef = collection(db, SHOW_STORE, id, 'seasons');
          const seasonsSnap = await getDocs(seasonsRef);
          for (const seasonDoc of seasonsSnap.docs) {
            const episodesRef = collection(db, SHOW_STORE, id, 'seasons', seasonDoc.id, 'episodes');
            const episodesSnap = await getDocs(episodesRef);
            for (const epDoc of episodesSnap.docs) {
              batch.delete(epDoc.ref);
              count++;
              await commitIfNeeded();
            }
            batch.delete(seasonDoc.ref);
            count++;
            await commitIfNeeded();
          }

          batch.delete(doc(db, SHOW_STORE, id));
          batch.delete(doc(db, SUMMARY_STORE, id));
          count += 2;

          if (count > 0) await batch.commit();
        } catch (e) {
          console.warn('[Firebase] deleteOne cloud failed:', id, e);
        }
      })();
    }

    return true;
  },
};
