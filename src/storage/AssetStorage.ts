import { openDB, ASSET_STORE } from './db';

export const AssetStorage = {
  STORE_NAME: ASSET_STORE,
  /**
   * Store a blob. Returns the asset ID.
   */
  async put(id: string, blob: Blob): Promise<string> {
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, "readwrite");
    tx.objectStore(ASSET_STORE).put({ id, blob });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    return id;
  },

  /**
   * Resolve an asset ID to a blob URL for display.
   * IMPORTANT: caller must call URL.revokeObjectURL(url) when done.
   */
  async getBlobUrl(id: string): Promise<string | null> {
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
        return null;
      }
    }

    return null;
  },

  /**
   * Resolve an asset ID to a data URI.
   * Used only when a data URI is specifically needed (e.g. passing to the AI API).
   */
  async getDataUri(id: string): Promise<string | null> {
    const url = await this.getBlobUrl(id);
    if (!url) return null;

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
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
  },

  async delete(id: string): Promise<void> {
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
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, "readonly");
    const request = tx.objectStore(ASSET_STORE).get(id);
    const record = await new Promise<any>((resolve) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror   = () => resolve(null);
    });

    if (record?.blob) return record.blob as Blob;
    return null;
  },

  /**
   * Check if an asset exists in local IndexedDB.
   */
  async exists(id: string): Promise<boolean> {
    const dbLocal = await openDB();
    const tx = dbLocal.transaction(ASSET_STORE, "readonly");
    const request = tx.objectStore(ASSET_STORE).getKey(id);
    const key = await new Promise<any>((resolve) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror   = () => resolve(null);
    });
    return (key !== null && key !== undefined);
  },
};