// generatePanelImage.ts — DA-077
// This module formerly housed the fid-era page/panel generators
// (generateComicPanel, generateComicPage, generateComicPageFromPlan).
// All page generation now goes through generateFinalComicPage on the
// FinalPageBeat contract. Only the request preflight assert survives,
// because the contract path uses it.

export function assertImageRequestHasRequiredCharacterRefs(args: {
  parts: any[];
  requiredCharacterAssetIds: string[];
  trackedImages: { partIndex: number; assetId?: string; label: string }[];
  context: string;
}): void {
  const { parts, requiredCharacterAssetIds, trackedImages, context } = args;

  for (const assetId of requiredCharacterAssetIds) {
    const track = trackedImages.find(t => t.assetId === assetId);
    if (!track) {
      throw new Error(
        `[PREFLIGHT FAIL] ${context}: Required character asset (${assetId}) is missing from tracked request reference images.`
      );
    }

    const part = parts[track.partIndex];
    if (!part) {
      throw new Error(
        `[PREFLIGHT FAIL] ${context}: Target part index (${track.partIndex}) for character ref (${track.label}) is out of bounds.`
      );
    }

    if (!part.inlineData) {
      throw new Error(
        `[PREFLIGHT FAIL] ${context}: Part at index ${track.partIndex} for character ref (${track.label}) does not contain inlineData.`
      );
    }

    const { mimeType, data } = part.inlineData;
    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
      throw new Error(
        `[PREFLIGHT FAIL] ${context}: Character ref (${track.label}) has invalid mimeType: "${mimeType}". Expected image/png or image/jpeg.`
      );
    }

    if (!data || typeof data !== 'string' || data.trim().length === 0) {
      throw new Error(
        `[PREFLIGHT FAIL] ${context}: Character ref (${track.label}) has empty or invalid base64 data.`
      );
    }
  }
}
