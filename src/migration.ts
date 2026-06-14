import { AssetStorage } from './storage/AssetStorage';
import { openDB, SHOW_STORE, SUMMARY_STORE, buildSummary } from './storage/db';

export const migrateToAssetStorage = async (): Promise<void> => {
  const FLAG = 'prestige_migration_v3_complete';
  if (localStorage.getItem(FLAG) === 'true') return;

  const db = await openDB();
  const shows = await new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(SHOW_STORE, 'readonly');
    const req = tx.objectStore(SHOW_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });

  const dataUriToBlob = (dataUri: string): Blob | null => {
    try {
      const parts = dataUri.split(',');
      if (parts.length < 2) return null;
      const header = parts[0];
      const base64 = parts[1];
      const mime = (header.match(/:(.*?);/) || [])[1] || 'image/png';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch (e) {
      console.warn("Failed to convert data URI to blob:", e);
      return null;
    }
  };

  for (const show of shows) {
    let modified = false;

    // Collect all assets to put in one transaction per show
    const assetsToPut: { id: string; blob: Blob }[] = [];

    for (const char of (show.characters || [])) {
      if (char.portraitUrl?.startsWith('data:') && !char.portraitAssetId) {
        const blob = dataUriToBlob(char.portraitUrl);
        if (blob) {
          const id = Math.random().toString(36).substring(2, 16);
          assetsToPut.push({ id, blob });
          char.portraitAssetId = id;
          char._legacyPortraitUrl = char.portraitUrl;
          delete char.portraitUrl;
          modified = true;
        }
      }
    }

    for (const asset of (show.comicGallery || [])) {
      if (asset.imageUrl?.startsWith('data:') && !asset.assetId) {
        const blob = dataUriToBlob(asset.imageUrl);
        if (blob) {
          const id = Math.random().toString(36).substring(2, 16);
          assetsToPut.push({ id, blob });
          asset.assetId = id;
          asset._legacyImageUrl = asset.imageUrl;
          delete asset.imageUrl;
          modified = true;
        }
      }
    }

    if (!modified) continue;

    // Batch put assets for this show
    if (assetsToPut.length > 0) {
      const assetTx = db.transaction(AssetStorage.STORE_NAME || 'assets', 'readwrite');
      const assetStore = assetTx.objectStore(AssetStorage.STORE_NAME || 'assets');
      assetsToPut.forEach(a => assetStore.put(a));
      await new Promise<void>((resolve, reject) => {
        assetTx.oncomplete = () => resolve();
        assetTx.onerror = () => reject(assetTx.error);
      });
    }

    // First write — show saved with assetIds + legacy fields
    const tx1 = db.transaction([SHOW_STORE, SUMMARY_STORE], 'readwrite');
    tx1.objectStore(SHOW_STORE).put(show);
    tx1.objectStore(SUMMARY_STORE).put(buildSummary(show));
    await new Promise<void>((resolve, reject) => {
      tx1.oncomplete = () => resolve();
      tx1.onerror = () => reject(tx1.error ?? new Error('Migration save failed'));
      tx1.onabort = () => reject(tx1.error ?? new Error('Migration save aborted'));
    });

    // Second write — strip legacy fields
    (show.characters || []).forEach((c: any) => delete c._legacyPortraitUrl);
    (show.comicGallery || []).forEach((a: any) => delete a._legacyImageUrl);
    const tx2 = db.transaction(SHOW_STORE, 'readwrite');
    tx2.objectStore(SHOW_STORE).put(show);
    await new Promise<void>((resolve, reject) => {
      tx2.oncomplete = () => resolve();
      tx2.onerror = () => reject(tx2.error ?? new Error('Migration cleanup failed'));
      tx2.onabort = () => reject(tx2.error ?? new Error('Migration cleanup aborted'));
    });
  }

  localStorage.setItem(FLAG, 'true');
};
