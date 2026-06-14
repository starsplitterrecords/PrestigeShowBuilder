import JSZip from 'jszip';
import { Show } from '../../types/show';
import { AssetStorage } from '../../storage';
import { PUBLICATION_PRESETS } from '../../constants/generation.constants';
import { canvasUpscale } from '../canvasUpscale';
import { ImageVersion } from '../../types/production';

// Try DA-013 store first; fall back to show.imageVersions.
async function resolveVersionsForPage(
  pageUid: string,
  show: Show
): Promise<ImageVersion[]> {
  try {
    const { getImageVersionsForPage } = await import(
      '../../storage/ProductionStorage'
    );
    return await getImageVersionsForPage(pageUid);
  } catch {
    return ((show as any).imageVersions ?? [])
      .filter((v: ImageVersion) => v.productionPageUid === pageUid);
  }
}

function pickBestVersion(
  versions: ImageVersion[]
): ImageVersion | null {
  const active = versions.filter(v => v.status !== 'archived');
  return active.find(v => v.status === 'approved'
    && v.variantType === 'lettered')
    ?? active.find(v => v.status === 'approved'
    && v.variantType === 'base')
    ?? active.find(v => v.status === 'approved')
    ?? active.sort((a, b) => b.createdAt - a.createdAt)[0]
    ?? null;
}

export interface ProductionExportOptions {
  presetId?: string;
  approvedOnly?: boolean;   // skip pages with no approved version
  includeManifest?: boolean; // add manifest.json listing page beat info
}

export async function generateProductionIssueZip(
  show: Show,
  issueUid: string,
  options: ProductionExportOptions = {}
): Promise<Blob> {
  const issue = (show.issues ?? []).find(i => i.uid === issueUid);
  if (!issue) throw new Error(`Issue not found: ${issueUid}`);

  const manifest = (show.issueManifests ?? [])
    .find(m => m.issueUid === issueUid);
  if (!manifest) throw new Error(`No manifest for issue: ${issueUid}`);

  const pages = show.productionPages ?? [];
  const zip = new JSZip();
  const preset = options.presetId
    ? PUBLICATION_PRESETS.find(p => p.id === options.presetId)
    : null;

  // Build pageBeat lookup for manifest entries.
  const pageBeatLookup: Record<string, { description: string; beatType: string }> = {};
  for (const act of issue.acts) {
    for (const scene of act.scenes) {
      for (const pb of scene.pageBeats) {
        if (pb.productionPageUid) {
          pageBeatLookup[pb.productionPageUid] = {
            description: pb.description,
            beatType: pb.beatType,
          };
        }
      }
    }
  }

  const manifestEntries: object[] = [];
  let exportedCount = 0;

  // Cover page
  if (manifest.coverPageUid) {
    const versions = await resolveVersionsForPage(
      manifest.coverPageUid, show
    );
    const best = pickBestVersion(versions);
    if (best) {
      const blob = await getExportBlob(best.assetId, preset);
      if (blob) zip.file('00_cover.png', blob);
    }
  }

  for (let i = 0; i < manifest.pageOrder.length; i++) {
    const pageUid = manifest.pageOrder[i];
    const page = pages.find(pg => pg.uid === pageUid);
    if (!page) continue;

    let versions = await resolveVersionsForPage(pageUid, show);
    if (options.approvedOnly) {
      versions = versions.filter(v => v.status === 'approved');
    }
    const best = pickBestVersion(versions);

    if (!best) {
      if (options.approvedOnly) continue;
      // Include a placeholder entry in manifest only.
      manifestEntries.push({
        page: i + 1,
        status: 'missing',
        pageUid,
        ...pageBeatLookup[pageUid],
      });
      continue;
    }

    const blob = await getExportBlob(best.assetId, preset);
    if (!blob) continue;

    const num = String(i + 1).padStart(3, '0');
    const filename = `${num}_p${i + 1}.png`;
    zip.file(filename, blob);
    exportedCount++;

    manifestEntries.push({
      page: i + 1,
      filename,
      status: best.status,
      variantType: best.variantType,
      pageUid,
      ...pageBeatLookup[pageUid],
    });
  }

  if (exportedCount === 0) {
    throw new Error('No pages with images found in this issue.');
  }

  if (options.includeManifest !== false) {
    zip.file('manifest.json', JSON.stringify({
      issueCode: issue.issueCode,
      title: issue.title,
      exportedAt: new Date().toISOString(),
      pageCount: manifest.pageOrder.length,
      exportedPages: exportedCount,
      pages: manifestEntries,
    }, null, 2));
  }

  return zip.generateAsync({ type: 'blob' });
}

async function getExportBlob(
  assetId: string,
  preset: typeof PUBLICATION_PRESETS[number] | null | undefined
): Promise<Blob | null> {
  if (preset) {
    const blobUrl = await AssetStorage.getBlobUrl(assetId);
    if (!blobUrl) return null;
    try {
      const dataUri = await canvasUpscale(
        blobUrl, preset.targetWidth, preset.targetHeight
      );
      const res = await fetch(dataUri);
      return res.blob();
    } finally {
      try { URL.revokeObjectURL(blobUrl); } catch {}
    }
  }
  return AssetStorage.getBlob(assetId);
}
