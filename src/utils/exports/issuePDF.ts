import { Show, ComicGalleryEntry } from "../../types/models";
import { jsPDF } from "jspdf";
import { canvasUpscale } from "../canvasUpscale";
import { AssetStorage } from "../../storage";
import { PUBLICATION_PRESETS } from "../../constants/generation.constants";

export async function generateIssuePDF(
  show: Show,
  compiledPages: any[],
  presetId: string = 'globalcomix',
  cover?: ComicGalleryEntry // D306
): Promise<Blob> {
  const enabledPages = (compiledPages || []).filter(p => p.enabled);
  if (enabledPages.length === 0 && !cover) {
    // If no pages are in compiler, try to take all approved from gallery as fallback for mobile "whole show" simplicity
    const approved = (show.comicGallery || [])
      .filter(e => e.status === "approved");
    
    if (approved.length === 0) {
      throw new Error("No approved pages found to export.");
    }
    
    enabledPages.push(...approved.map(e => ({
      assetId: e.assetId,
      enabled: true
    })));
  }

  let preset = PUBLICATION_PRESETS.find(p => p.id === presetId) ?? PUBLICATION_PRESETS[0];
  if (preset.id === 'raw') {
    preset = PUBLICATION_PRESETS.find(p => p.id === 'globalcomix') || PUBLICATION_PRESETS[1];
  }
  const { targetWidth, targetHeight, dpi } = preset;
  const pageWidthIn = targetWidth / dpi;
  const pageHeightIn = targetHeight / dpi;

  const pdf = new jsPDF({ unit: 'in', format: [pageWidthIn, pageHeightIn] });
  pdf.deletePage(1);

  // D306: Cover renders first
  const entriesToExport = cover 
    ? [{ assetId: cover.assetId, enabled: true }, ...enabledPages]
    : enabledPages;

  for (let i = 0; i < entriesToExport.length; i++) {
    const page = entriesToExport[i];
    let url = (page as any).flattenedUrl;
    if (!url) {
      url = await AssetStorage.getBlobUrl(page.assetId);
    }
    
    if (!url) continue;

    const upscaledUri = await canvasUpscale(url, targetWidth, targetHeight);
    pdf.addPage([pageWidthIn, pageHeightIn], 'p');
    pdf.addImage(upscaledUri, 'JPEG', 0, 0, pageWidthIn, pageHeightIn);
  }

  return pdf.output('blob');
}
