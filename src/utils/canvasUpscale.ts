/**
 * Aspect-preserving canvas upscale with white letterbox.
 *
 * Scales the source image to fit within targetWidth x targetHeight
 * while preserving the source aspect ratio. Centers the result on
 * a white canvas at the exact target dimensions.
 *
 * When source and target have the same ratio (e.g. GlobalComix 3:4
 * with 3:4 source pages) the image fills the canvas exactly -- no bars.
 *
 * When ratios differ (e.g. KDP 0.647 vs source 0.75) white bars
 * appear at top and bottom. The art is never distorted.
 *
 * @param sourceDataUri  full data URI of the source image
 * @param targetWidth    target canvas width in pixels
 * @param targetHeight   target canvas height in pixels
 * @param quality        JPEG quality 0-1 (default 0.92)
 * @returns              JPEG data URI at target dimensions
 */
export const canvasUpscale = (
  sourceDataUri: string,
  targetWidth:   number,
  targetHeight:  number,
  quality:       number = 0.92
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }

      // White background -- letterbox bars will be white.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Scale to fit: find the largest scale that fits
      // the source entirely within the target dimensions.
      const scaleX = targetWidth  / img.naturalWidth;
      const scaleY = targetHeight / img.naturalHeight;
      const scale  = Math.min(scaleX, scaleY);

      const drawW = Math.round(img.naturalWidth  * scale);
      const drawH = Math.round(img.naturalHeight * scale);

      // Center the scaled image on the canvas.
      const offsetX = Math.round((targetWidth  - drawW) / 2);
      const offsetY = Math.round((targetHeight - drawH) / 2);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () =>
      reject(new Error("Image load failed during canvas upscale"));
    img.src = sourceDataUri;
  });
};
