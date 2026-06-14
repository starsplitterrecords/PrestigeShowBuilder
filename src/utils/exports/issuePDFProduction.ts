import { Show } from '../../types/show';
import { generateIssuePDF } from './issuePDF';
import { ImageVersion } from '../../types/production';

async function resolveVersions(
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

export async function generateProductionIssuePDF(
  show: Show,
  issueUid: string,
  presetId: string = 'globalcomix'
): Promise<Blob> {
  const manifest = (show.issueManifests ?? [])
    .find(m => m.issueUid === issueUid);
  if (!manifest) {
    throw new Error(`No manifest for issue ${issueUid}`);
  }

  const pages: { assetId: string; enabled: boolean }[] = [];
  let coverAssetId: string | undefined;

  // Cover
  if (manifest.coverPageUid) {
    const cvs = await resolveVersions(manifest.coverPageUid, show);
    const activeCvs = cvs.filter(v => v.status !== 'archived');
    const best = activeCvs.find(v => v.status === 'approved')
      ?? activeCvs.sort((a, b) => b.createdAt - a.createdAt)[0]
      ?? null;
    if (best) {
      coverAssetId = best.assetId;
    }
  }

  for (const pageUid of manifest.pageOrder) {
    const versions = await resolveVersions(pageUid, show);
    const active = versions.filter(v => v.status !== 'archived');
    const best = active.find(
      v => v.status === 'approved' && v.variantType === 'lettered'
    ) ?? active.find(
      v => v.status === 'approved' && v.variantType === 'base'
    ) ?? active.find(v => v.status === 'approved')
      ?? active.sort((a, b) => b.createdAt - a.createdAt)[0]
      ?? null;
    
    if (best) {
      pages.push({ assetId: best.assetId, enabled: true });
    }
  }

  if (pages.length === 0) {
    throw new Error('No pages with images to export as PDF.');
  }

  // Re-use existing PDF engine.
  const coverEntry = coverAssetId
    ? { assetId: coverAssetId } as any
    : undefined;
  return generateIssuePDF(show, pages, presetId, coverEntry);
}
