
import { AssetStorage } from '../storage';
import { COMPRESS_QUALITY_PANEL } from '../constants/generation.constants';

/**
 * Compresses an image encoded as a Data URI to a JPEG format payload to optimize storage overhead,
 * and uploads the resulting compressed binary blob directly into the persistent asset storage drawer.
 *
 * @param {string} dataUri - The source Base64 or Object URL string representation of the image
 * @param {number} quality - The target compression scale from 0.0 to 1.0 (defaults to COMPRESS_QUALITY_PANEL)
 * @returns {Promise<string>} Resolves with the unique alphanumeric reference of the saved storage asset
 */
export const compressAndStore = (
  dataUri: string,
  quality: number = COMPRESS_QUALITY_PANEL
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) { reject(new Error('Compression failed')); return; }
        const assetId = Math.random().toString(36).substring(2, 16);
        await AssetStorage.put(assetId, blob);
        resolve(assetId);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUri;
  });
};

/**
 * Wraps asynchronous AI operations with an automatic delay backoff and retry retry strategy.
 * Integrates error safety handlers, intercepts model credential issues to trigger re-authentication dialogs,
 * and extracts user quota exhaustion delays to supply explanatory user-facing alerts.
 *
 * @template T
 * @param {() => Promise<T>} fn - The target asynchronous function to retry on transit failure
 * @param {number} retries - Maximum retry count (defaults to 4 attempts)
 * @param {number} delay - Base backoff duration in milliseconds (defaults to 1500ms, doubling on each attempt)
 * @returns {Promise<T>} Resolves with the expected functional generic outcome
 */
export const withRetry = async <T>(fn: () => Promise<T>, retries = 4, delay = 1500): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const status = error.status ?? error.code;
    const message = error.message ?? '';
    
    // D1: If the key is invalid or not found, reset the selection state
    if (message.includes('Requested entity was not found') || status === 404 || status === 403) {
      console.error(`Gemini API Key error (${status}): ${message}. Check platform configuration.`);
      if (error.details) {
        console.error('Error details:', JSON.stringify(error.details));
      }
      
      // Prompt for a new key if in AI Studio environment
      if (typeof window !== 'undefined' && window.aistudio?.openSelectKey) {
        window.aistudio.openSelectKey();
      }
      
      throw error;
    }

    // --- Daily quota exhaustion: fail immediately, do not retry ---
    // retryDelay is 21+ hours — backoff is useless.
    const details = error.details ?? [];
    const isQuotaExhausted =
      (status === 429 || message.includes('429')) &&
      (message.includes('generate_requests_per_model_per_day') ||
         message.includes('RESOURCE_EXHAUSTED') ||
         details.some((d: any) =>
           typeof d.quotaMetric === 'string' &&
           d.quotaMetric.includes('per_day')
         ) ||
         details.some((d: any) =>
           Array.isArray(d.violations) &&
           d.violations.some((v: any) =>
             typeof v.quotaMetric === 'string' &&
             v.quotaMetric.includes('per_day')
           )
         ));

    if (isQuotaExhausted) {
      // Extract retry delay from response if present
      const retryInfo = details.find((d: any) => d.retryDelay);
      const retryDelay = retryInfo?.retryDelay ?? '~21 hours';
      throw new Error(
        `Daily quota exhausted for model ${error.model ?? 'gemini-pro'}. ` +
        `Retry in ${retryDelay}. ` +
        'Switch to a different API key or wait until tomorrow.'
      );
    }

    const isRetryable =
      status === 429 ||
      status === 500 ||
      status === 503 ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('overloaded') ||
      message.includes('temporarily unavailable');

    if (retries > 0 && isRetryable) {
      console.warn(`AI transient error (${status}): retrying in ${delay}ms. (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};
