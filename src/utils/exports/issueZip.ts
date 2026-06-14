import JSZip from "jszip";
import { AssetStorage } from "../../storage";
import { canvasUpscale } from "../canvasUpscale";
import { PUBLICATION_PRESETS } from "../../constants/generation.constants";
import { ComicGalleryEntry } from "../../types/models";

interface IssueZipOptions {
  presetId?: string;     // if provided, upscale each image to the preset.
                         // if omitted, raw asset bytes are zipped as-is.
  filenamePattern?: 'pageNumber' | 'index';
                         // pageNumber: use entry.pageNumber (zero-padded)
                         // index: use sequential 1-based index
                         // default: pageNumber if all entries have one, else index
  includeArchived?: boolean; // D314: if true, include archived entries in archived/ subfolder
  starSplitter?: {                          // D307
    seriesSlug: string;                     // e.g. 'vikings-2026'
    releaseSlug: string;                    // e.g. 'issue-001'
    seriesTitle?: string;                   // for manifest
    releaseTitle?: string;                  // for manifest
  };
}

export async function generateIssueZip(
  entries: ComicGalleryEntry[],
  options: IssueZipOptions = {},
  cover?: ComicGalleryEntry // D306
): Promise<Blob> {
  if (entries.length === 0 && !cover) {
    throw new Error('No pages to export.');
  }

  const zip = new JSZip();
  const ssv = options.starSplitter;

  // Folder prefix inside the zip.
  const prefix = ssv
    ? `${ssv.seriesSlug}/${ssv.releaseSlug}/`
    : '';

  const usePageNumber =
    options.filenamePattern === 'pageNumber' ||
    (options.filenamePattern === undefined &&
     entries.every(e => typeof e.pageNumber === 'number'));

  // Determine zero-pad width based on max number we will see.
  const maxNum = usePageNumber
    ? Math.max(...entries.map(e => e.pageNumber || 0))
    : entries.length;
  const padWidth = Math.max(2, String(maxNum).length);

  const preset = options.presetId
    ? PUBLICATION_PRESETS.find(p => p.id === options.presetId)
    : null;

  // D306: Handle cover if provided
  if (cover) {
    const coverPath = prefix + (ssv ? 'cover.jpg' : '00_cover' + (preset ? '.jpg' : '.png'));
    
    if (ssv) {
      // Star Splitter always uses JPEG (quality 0.85). If preset is active, we upscale BEFORE JPEG conversion.
      const bytes = await getBlobAsJpeg(cover.assetId, 0.85, preset?.targetWidth, preset?.targetHeight);
      if (bytes) zip.file(coverPath, bytes);
    } else if (preset) {
      const blobUrl = await AssetStorage.getBlobUrl(cover.assetId);
      if (blobUrl) {
        try {
          const upscaledDataUri = await canvasUpscale(blobUrl, preset.targetWidth, preset.targetHeight);
          const blob = await dataUriToBlob(upscaledDataUri);
          zip.file(coverPath, blob);
        } finally {
          try { URL.revokeObjectURL(blobUrl); } catch {}
        }
      }
    } else {
      const blob = await AssetStorage.getBlob(cover.assetId);
      if (blob) zip.file(coverPath, blob);
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let filename: string;

    if (ssv) {
      const num = String(i + 1).padStart(3, '0');
      filename = `page-${num}.jpg`;
    } else {
      const num = usePageNumber ? (entry.pageNumber || (i + 1)) : (i + 1);
      filename = String(num).padStart(padWidth, '0') + (preset ? '.jpg' : '.png');
    }

    const filePath = prefix + filename;
    
    // D314: If archived, put in archived subfolder
    const isArchived = entry.status === 'archived';
    const finalPath = isArchived ? (prefix + 'archived/' + filename) : filePath;
    
    if (ssv) {
      const bytes = await getBlobAsJpeg(entry.assetId, 0.85, preset?.targetWidth, preset?.targetHeight);
      if (bytes) zip.file(finalPath, bytes);
    } else if (preset) {
      const blobUrl = await AssetStorage.getBlobUrl(entry.assetId);
      if (!blobUrl) continue;
      
      try {
        const upscaledDataUri = await canvasUpscale(
          blobUrl,
          preset.targetWidth,
          preset.targetHeight
        );
        const blob = await dataUriToBlob(upscaledDataUri);
        zip.file(finalPath, blob);
      } finally {
        try { URL.revokeObjectURL(blobUrl); } catch {}
      }
    } else {
      const blob = await AssetStorage.getBlob(entry.assetId);
      if (!blob) continue;
      zip.file(finalPath, blob);
    }
  }

  // D307: Release manifest.
  if (ssv) {
    const manifest = {
      slug: ssv.releaseSlug,
      seriesSlug: ssv.seriesSlug,
      title: ssv.releaseTitle || ssv.releaseSlug,
      coverImage: cover ? `/images/${ssv.seriesSlug}/${ssv.releaseSlug}/cover.jpg` : null,
      pages: entries.map((_, i) => ({
        seriesSlug: ssv.seriesSlug,
        releaseSlug: ssv.releaseSlug,
        pageNumber: i + 1,
        image: `/images/${ssv.seriesSlug}/${ssv.releaseSlug}/page-${String(i + 1).padStart(3, '0')}.jpg`
      })),
    };
    zip.file(prefix + 'release.json', JSON.stringify(manifest, null, 2));
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Convert a stored asset's blob to a JPEG-encoded Blob at the given quality.
 * Optionally upscales first if dimensions provided.
 * Handles the PNG -> JPEG conversion the SSV spec requires.
 */
async function getBlobAsJpeg(
  assetId: string, 
  quality: number,
  targetWidth?: number,
  targetHeight?: number
): Promise<Blob | null> {
  const blobUrl = await AssetStorage.getBlobUrl(assetId);
  if (!blobUrl) return null;

  try {
    let sourceUrl = blobUrl;
    let upscaled = false;

    if (targetWidth && targetHeight) {
      sourceUrl = await canvasUpscale(blobUrl, targetWidth, targetHeight);
      upscaled = true;
    }

    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Image load failed'));
      img.src = sourceUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White background — JPEGs do not support transparency.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    return new Promise((res) => {
      canvas.toBlob(
        (blob) => res(blob),
        'image/jpeg',
        quality
      );
    });
  } catch (e) {
    console.error("[IssueZip] getBlobAsJpeg failed:", e);
    return null;
  } finally {
    if (blobUrl.startsWith('blob:')) try { URL.revokeObjectURL(blobUrl); } catch {}
  }
}

async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const res = await fetch(dataUri);
  return res.blob();
}
