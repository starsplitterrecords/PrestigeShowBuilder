import { openDB, ASSET_STORE, isStorageLocal } from './db';
import { db, auth, storage } from '../firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export const AssetStorage = {
  STORE_NAME: ASSET_STORE,
  /**
   * Store a blob. Returns the asset ID.
   */
  async put(id: string, blob: Blob): Promise<string> {
    // 1. Local write ALWAYS happens first and immediately.
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, "readwrite");
    tx.objectStore(ASSET_STORE).put({ id, blob });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    // 2. Firebase upload happens in background.
    // Never awaited. Never blocks the caller.
    // Failure is logged only.
    const user = auth.currentUser;
    if (user && !isStorageLocal()) {
      this.pushToCloud(id, blob).catch((e) => {
        console.warn("[Firebase] Background asset upload failed:", id, e);
      });
    }

    return id;
  },

  /**
   * Explicitly pushes an asset to the cloud, awaiting completion.
   */
  async pushToCloud(id: string, blob: Blob): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const storagePath = `users/${user.uid}/assets/${id}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);
      await setDoc(doc(db, ASSET_STORE, id), {
        id, type: blob.type, storagePath,
        ownerId: user.uid, createdAt: Date.now()
      });
    } catch (e: any) {
      // Log specific storage errors to help diagnose permission issues
      if (e.code === 'storage/unauthorized') {
        console.error(`[Firebase] Asset permission denied: users/${user.uid}/assets/${id}. Verify Storage Rules in Firebase Console.`, e);
      } else {
        console.warn("[Firebase] Asset upload failed:", id, e);
      }
      throw e;
    }
  },

  /**
   * Resolve an asset ID to a blob URL for display.
   * IMPORTANT: caller must call URL.revokeObjectURL(url) when done.
   */
  async getBlobUrl(id: string): Promise<string | null> {
    // 1. Always try local IndexedDB first.
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, "readonly");
    const request = tx.objectStore(ASSET_STORE).get(id);
    const record = await new Promise<any>((resolve) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror   = () => resolve(null);
    });

    if (record?.blob) {
      try {
        const raw    = record.blob;
        const type   = raw.type || "image/jpeg";
        const buffer = await raw.arrayBuffer();
        const blob   = new Blob([buffer], { type });
        return URL.createObjectURL(blob);
      } catch {
        // Fall through to Firebase
      }
    }

    // 2. Not in local cache. Try Firebase (e.g. first load on new device).
    const user = auth.currentUser;
    if (user) {
      try {
        const docSnap = await getDoc(doc(db, ASSET_STORE, id));
        if (docSnap.exists()) {
          const metadata = docSnap.data();
          if (metadata.ownerId === user.uid) {
            const url = await getDownloadURL(
              ref(storage, metadata.storagePath)
            );
            // Cache locally for next time
            const resp  = await fetch(url);
            const blob  = await resp.blob();
            await this.put(id, blob);  // stores locally
            return url;
          }
        }
      } catch (e) {
        console.warn("[Firebase] getBlobUrl fallback failed:", id, e);
      }
    }

    return null;
  },

  /**
   * Resolve an asset ID to a data URI.
   * Used only when a data URI is specifically needed (e.g. passing to the AI API).
   */
  async getDataUri(id: string): Promise<string | null> {
    // Single path for all users.
    // getBlobUrl is now local-first, so this is always fast.
    const url = await this.getBlobUrl(id);
    if (!url) return null;

    // For object URLs (local): fetch then btoa.
    // For https URLs (Firebase fallback): fetch then btoa.
    // Same path either way -- no FileReader anywhere.
    try {
      const resp  = await fetch(url);
      const ab    = await resp.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const type  = resp.headers.get("content-type")
        || "image/jpeg";
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(
          ...bytes.subarray(i, i + chunk)
        );
      }
      return `data:${type};base64,${btoa(binary)}`;
    } catch (e) {
      console.warn("[Storage] getDataUri failed:", id, e);
      return null;
    } finally {
      // Revoke object URLs only (not https URLs)
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
  },

  async delete(id: string): Promise<void> {
    const user = auth.currentUser;
    if (user && !isStorageLocal()) {
      const path = `${ASSET_STORE}/${id}`;
      try {
        const docRef = doc(db, ASSET_STORE, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const metadata = docSnap.data();
          if (metadata.ownerId === user.uid) {
            const storageRef = ref(storage, metadata.storagePath);
            await deleteObject(storageRef);
            await deleteDoc(docRef);
          }
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    }
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, 'readwrite');
    tx.objectStore(ASSET_STORE).delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Asset delete failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Asset delete aborted'));
    });
  },

  /**
   * Returns all asset IDs. Used by the zip exporter in Directive 3.
   */
  async listIds(): Promise<string[]> {
    const db = await openDB();
    const tx = db.transaction(ASSET_STORE, 'readonly');
    const request = tx.objectStore(ASSET_STORE).getAllKeys();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => resolve([]);
    });
  },

  /**
   * Retrieve a raw Blob by ID.
   */
  async getBlob(id: string): Promise<Blob | null> {
    // try local
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, "readonly");
    const request = tx.objectStore(ASSET_STORE).get(id);
    const record = await new Promise<any>((resolve) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror   = () => resolve(null);
    });

    if (record?.blob) return record.blob as Blob;

    // fallback to getBlobUrl + fetch if not in IDB
    const url = await this.getBlobUrl(id);
    if (!url) return null;
    try {
      const resp = await fetch(url);
      return await resp.blob();
    } catch {
      return null;
    } finally {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  },

  /**
   * Check if an asset exists in local IndexedDB or Firebase metadata.
   */
  async exists(id: string): Promise<boolean> {
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, "readonly");
    const request = tx.objectStore(ASSET_STORE).getKey(id);
    const key = await new Promise<any>((resolve) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror   = () => resolve(null);
    });
    if (key !== null && key !== undefined) {
      return true;
    }

    const user = auth.currentUser;
    if (user) {
      try {
        const docSnap = await getDoc(doc(db, ASSET_STORE, id));
        if (docSnap.exists()) {
          const metadata = docSnap.data();
          return metadata.ownerId === user.uid;
        }
      } catch (e) {
        console.warn("[Firebase] exists check failed:", id, e);
      }
    }
    return false;
  },
};