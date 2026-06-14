import JSZip from "jszip";
import { Show, ShowSummary } from "../types/models";
import {
  openDB, SHOW_STORE, SUMMARY_STORE, ASSET_STORE
} from "./db";
import { AssetStorage } from "./AssetStorage";
import { SummaryStorage } from "./SummaryStorage";
import { ShowStorage } from "./ShowStorage";
import { auth } from "../firebase";
import { migrateShow } from "./migrations";

/**
 * Vault I/O — zip-based export/import + diagnostic audit.
 *
 * Extracted from VaultStorage.ts in D284 (F5A pass 4).
 * VaultStorage retains the public surface as thin delegators.
 */

import { safeStringify } from "../utils/safeJson";

export const VaultIO = {
  async exportVault(): Promise<Blob> {
    const db = await openDB();
    const shows = await new Promise<Show[]>((resolve, reject) => {
      const tx = db.transaction(SHOW_STORE, 'readonly');
      const req = tx.objectStore(SHOW_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB export failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB export aborted'));
    });

    const assetIds = new Set<string>();
    shows.forEach(show => {
      // Character portraits — both fields
      show.characters?.forEach(c => {
        if (c.portraitAssetId) assetIds.add(c.portraitAssetId);
        if (c.visualAnchorAssetId) assetIds.add(c.visualAnchorAssetId);
      });
      // Comic and video gallery images are NOT included — 
      // they are too large for reliable browser-based ZIP export.
      show.lockedReferences?.forEach(r => {
        if (r.assetId) assetIds.add(r.assetId);
      });
      // Cover anchor
      if (show.coverAnchorAssetId) assetIds.add(show.coverAnchorAssetId);
    });

    const zip = new JSZip();
    zip.file('shows.json', safeStringify(shows, 2));
    const assetsFolder = zip.folder('assets')!;

    await this._packAssets(assetIds, assetsFolder);

    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  },

  async exportShow(showId: string): Promise<Blob> {
    const show = await ShowStorage.getById(showId);
    if (!show) throw new Error(`Show ${showId} not found.`);

    const assetIds = new Set<string>();
    show.characters?.forEach(c => {
      if (c.portraitAssetId) assetIds.add(c.portraitAssetId);
      if (c.visualAnchorAssetId) assetIds.add(c.visualAnchorAssetId);
    });
    show.lockedReferences?.forEach(r => { if (r.assetId) assetIds.add(r.assetId); });
    if (show.coverAnchorAssetId) assetIds.add(show.coverAnchorAssetId);

    const zip = new JSZip();
    zip.file('shows.json', safeStringify([show], 2));
    const assetsFolder = zip.folder('assets')!;

    await this._packAssets(assetIds, assetsFolder);

    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  },

  async _packAssets(
    assetIds: Set<string>,
    assetsFolder: JSZip
  ): Promise<void> {
    for (const id of assetIds) {
      const record = await new Promise<{ id: string; blob: Blob } | null>((resolve, reject) => {
        openDB().then(db => {
          const tx = db.transaction(ASSET_STORE, 'readonly');
          const req = tx.objectStore(ASSET_STORE).get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror  = () => resolve(null);
          tx.onerror = () => resolve(null);
        }).catch(() => resolve(null));
      });
      if (!record) continue;
      try {
        const buffer = await record.blob.arrayBuffer();
        const ext = record.blob.type === 'image/jpeg' ? 'jpg' : 'png';
        assetsFolder.file(`${id}.${ext}`, buffer);
      } catch (e) {
        console.warn(`Asset ${id} could not be packed:`, e);
      }
    }
  },

  async _getLocalShow(id: string): Promise<Show | null> {
    try {
      const db = await openDB();
      const tx = db.transaction(SHOW_STORE, 'readonly');
      const req = tx.objectStore(SHOW_STORE).get(id);
      return await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async importVault(zipBlob: Blob): Promise<void> {
    const zip = await JSZip.loadAsync(zipBlob);

    // Restore blobs first
    const assetFiles = Object.entries(zip.files).filter(([name]) =>
      name.startsWith('assets/') && !name.endsWith('/')
    );
    
    for (const [name, file] of assetFiles) {
      const buffer = await file.async('arraybuffer');
      const ext = name.split('.').pop();
      const type = ext === 'jpg' ? 'image/jpeg' : 'image/png';
      const blob = new Blob([buffer], { type });
      const id = name.replace('assets/', '').replace(/\.[^.]+$/, '');
      
      await AssetStorage.put(id, blob);
    }

    // Restore shows
    const showsFile = zip.file('shows.json');
    if (!showsFile) throw new Error('Invalid vault bundle: shows.json not found.');
    const shows: Show[] = JSON.parse(await showsFile.async('string'));

    if (!Array.isArray(shows) || !shows.every(s =>
      s && typeof s.id === 'string' && typeof s.name === 'string'
    )) throw new Error('Invalid vault bundle: corrupt show data.');

    for (const rawShow of shows) {
      const show = migrateShow(rawShow);
      const user = auth.currentUser;
      if (user) {
        show.ownerId = user.uid;
      }
      
      // D214: Restore as New if ID exists locally list (direct local query to avoid auto-triggering cloud download)
      const existing = await this._getLocalShow(show.id);
      if (existing) {
        const oldId = show.id;
        const newId = Math.random().toString(36).substring(2, 16);
        show.id = newId;
        show.name = `${show.name} (Restored)`;
        
        const oldCode = (show.showCode || 'SHOW').toUpperCase();
        const base = (show.name || 'SHW').replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'SHW';
        const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
        const newCode = `${base}${rand}`.substring(0, 5);
        show.showCode = newCode;

        const updateFids = (obj: any) => {
          if (typeof obj !== 'object' || obj === null) return;
          if (Array.isArray(obj)) {
            obj.forEach(updateFids);
            return;
          }
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string') {
              if (val.startsWith(`${oldCode}-`)) {
                obj[key] = val.replace(`${oldCode}-`, `${newCode}-`);
              } else if (val.startsWith(oldId)) {
                obj[key] = val.replace(oldId, newId);
              }
            } else if (typeof val === 'object') {
              updateFids(val);
            }
          }
        };
        updateFids(show);
      }

      await this._extractBase64Assets(show);
      await ShowStorage.saveOne(show);
    }
  },

  async _extractBase64Assets(show: Show): Promise<{ extracted: number }> {
    let extractedCount = 0;
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

    for (const char of (show.characters || [])) {
      const anyChar = char as any;
      if (anyChar.portraitUrl?.startsWith('data:')) {
        const blob = dataUriToBlob(anyChar.portraitUrl);
        if (blob) {
          const id = Math.random().toString(36).substring(2, 16);
          await AssetStorage.put(id, blob);
          char.portraitAssetId = id;
          delete anyChar.portraitUrl;
          extractedCount++;
        }
      }
    }

    for (const entry of (show.comicGallery || [])) {
      const anyEntry = entry as any;
      if (anyEntry.imageUrl?.startsWith('data:')) {
        const blob = dataUriToBlob(anyEntry.imageUrl);
        if (blob) {
          const id = Math.random().toString(36).substring(2, 16);
          await AssetStorage.put(id, blob);
          entry.assetId = id;
          delete anyEntry.imageUrl;
          extractedCount++;
        }
      }
    }

    for (const ref of (show.lockedReferences || [])) {
      const anyRef = ref as any;
      if (anyRef.imageUrl?.startsWith('data:')) {
        const blob = dataUriToBlob(anyRef.imageUrl);
        if (blob) {
          const id = Math.random().toString(36).substring(2, 16);
          await AssetStorage.put(id, blob);
          ref.assetId = id;
          delete anyRef.imageUrl;
          extractedCount++;
        }
      }
    }

    for (const season of (show.seasons || [])) {
      for (const episode of (season.episodes || [])) {
        for (const act of (episode.acts || [])) {
          for (const scene of (act.scenes || [])) {
            for (const beat of (scene.cinematicBeats || [])) {
              if (beat.script?.entries) {
                for (const entry of beat.script.entries) {
                  if (entry.text?.startsWith('data:')) {
                    const blob = dataUriToBlob(entry.text);
                    if (blob) {
                      const id = Math.random().toString(36).substring(2, 16);
                      await AssetStorage.put(id, blob);
                      entry.text = `[Image Asset: ${id}]`;
                      extractedCount++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return { extracted: extractedCount };
  },

  async auditStorage(): Promise<{
    shows: { id: string; name: string }[];
    summaries: { id: string; name: string }[];
    assets: { id: string; type: string; size: number }[];
    orphans: string[];
  }> {
    const db = await openDB();
    const shows = await ShowStorage.getAll();
    const summaries = await SummaryStorage.getSummaries();

    const assetRecords = await new Promise<{ id: string; blob: Blob }[]>((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readonly');
      const req = tx.objectStore(ASSET_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });

    const referencedIds = new Set<string>();
    shows.forEach(show => {
      show.characters?.forEach(c => {
        if (c.portraitAssetId) referencedIds.add(c.portraitAssetId);
        if (c.visualAnchorAssetId) referencedIds.add(c.visualAnchorAssetId);
      });
      show.lockedReferences?.forEach(r => {
        if (r.assetId) referencedIds.add(r.assetId);
      });
      if (show.coverAnchorAssetId) referencedIds.add(show.coverAnchorAssetId);
      show.comicGallery?.forEach(g => {
        if (g.assetId) referencedIds.add(g.assetId);
      });
    });

    const assets = assetRecords.map(r => ({
      id: r.id,
      type: r.blob.type,
      size: r.blob.size
    }));

    const orphans = assets
      .filter(a => !referencedIds.has(a.id))
      .map(a => a.id);

    return {
      shows: shows.map(s => ({ id: s.id, name: s.name })),
      summaries: summaries.map(s => ({ id: s.id, name: s.name })),
      assets,
      orphans
    };
  }
};
