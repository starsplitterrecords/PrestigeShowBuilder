import JSZip from 'jszip';
import { AssetStorage } from '../../storage/AssetStorage';
import { Show } from '../../types/show';
import { toSlug } from '../slug';

export interface AssetLibraryOptions {
  includeArchived?: boolean;
}

export async function generateShowAssetLibrary(
  show: Show,
  options: AssetLibraryOptions = {}
): Promise<Blob> {
  const zip = new JSZip();
  const idsInVault = await AssetStorage.listIds();
  const manifest: any[] = [];
  const reverseMap = new Map<string, { role: string; filename: string; meta: any }>();

  // 1. Character Portraits & Visual Anchors
  for (const c of show.characters || []) {
    const slug = toSlug(c.name || c.handle || c.id);
    if (c.portraitAssetId) {
      reverseMap.set(c.portraitAssetId, {
        role: 'character.portrait',
        filename: `characters/${slug}_portrait.png`,
        meta: { characterHandle: c.handle, characterName: c.name }
      });
    }
    if (c.visualAnchorAssetId) {
      reverseMap.set(c.visualAnchorAssetId, {
        role: 'character.visualAnchor',
        filename: `characters/${slug}_visual-anchor.png`,
        meta: { characterHandle: c.handle, characterName: c.name }
      });
    }
  }

  // 2. Setting Anchors
  for (const s of show.settingAnchors || []) {
    if (s.assetId) {
      const slug = toSlug(s.name || s.id);
      reverseMap.set(s.assetId, {
        role: 'settingAnchor',
        filename: `settings/${slug}.png`,
        meta: { settingName: s.name, interiorExterior: s.interiorExterior }
      });
    }
  }

  // 3. Locked References
  for (const lr of show.lockedReferences || []) {
    if (lr.assetId) {
      const slug = toSlug(lr.label || lr.id);
      reverseMap.set(lr.assetId, {
        role: `lockedReference.${lr.type}`,
        filename: `references/${slug}_${lr.type}.png`,
        meta: { label: lr.label, type: lr.type }
      });
    }
  }

  // 4. Cover Anchor
  if (show.coverAnchorAssetId) {
    reverseMap.set(show.coverAnchorAssetId, {
      role: 'coverAnchor',
      filename: 'covers/coverAnchor.png',
      meta: {}
    });
  }

  // 5. Comic Gallery
  for (const e of show.comicGallery || []) {
    if (!options.includeArchived && e.status === 'archived') continue;
    
    // An asset ID can have multiple references; the first match wins (specified in prompts)
    // Actually, chars/settings are likely more specific roles, so we process gallery later.
    if (reverseMap.has(e.assetId)) continue;

    if (e.isCover) {
      const slug = e.issueId ? toSlug(e.issueId) : 'unassigned-cover';
      const suffix = e.issueId ? '' : `_${e.assetId.slice(0, 8)}`;
      reverseMap.set(e.assetId, {
        role: 'gallery.cover',
        filename: `covers/${slug}_cover${suffix}.png`,
        meta: { issueId: e.issueId, beatFid: e.beatFid }
      });
      continue;
    }

    if (e.issueId && typeof e.pageNumber === 'number') {
      const pageNum = String(e.pageNumber).padStart(3, '0');
      const beatFid = e.beatFid || 'no-beat';
      const isArchived = e.status === 'archived';
      const folder = isArchived ? `pages/${toSlug(e.issueId)}/archived` : `pages/${toSlug(e.issueId)}`;
      
      reverseMap.set(e.assetId, {
        role: 'gallery.page',
        filename: `${folder}/page-${pageNum}_${beatFid}.png`,
        meta: { beatFid, issueId: e.issueId, pageNumber: e.pageNumber, variantType: e.variantType, status: e.status }
      });
      continue;
    }

    // approved/draft but unassigned
    const beatFid = e.beatFid || 'no-beat';
    const suffix = `_${e.assetId.slice(0, 8)}`;
    const variant = e.variantType ? `_${e.variantType}` : '';
    const isArchived = e.status === 'archived';
    const folder = isArchived ? 'pages/unassigned/archived' : 'pages/unassigned';
    
    reverseMap.set(e.assetId, {
      role: isArchived ? 'gallery.archived' : 'gallery.unassigned',
      filename: `${folder}/${beatFid}${variant}${suffix}.png`,
      meta: { beatFid, variantType: e.variantType, status: e.status }
    });
  }

  // 6. Process all assets in IDB
  for (const id of idsInVault) {
    const ref = reverseMap.get(id);
    const blob = await AssetStorage.getBlob(id);
    if (!blob) continue;

    if (ref) {
      zip.file(ref.filename, blob);
      manifest.push({
        assetId: id,
        role: ref.role,
        filename: ref.filename,
        ...ref.meta
      });
    } else {
      // Orphan
      const filename = `orphans/${id.slice(0, 8)}.png`;
      zip.file(filename, blob);
      manifest.push({
        assetId: id,
        role: 'orphan',
        filename
      });
    }
  }

  // 7. Generate manifest.json
  zip.file('manifest.json', JSON.stringify({
    showName: show.name,
    showCode: show.showCode,
    exportedAt: new Date().toISOString(),
    totalAssets: manifest.length,
    assets: manifest
  }, null, 2));

  return zip.generateAsync({ type: 'blob' });
}
