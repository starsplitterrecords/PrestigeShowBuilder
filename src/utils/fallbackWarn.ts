/**
 * D91 — fallbackWarn
 * Use instead of bare || when falling back to a lower-quality value.
 * Warns in console so fallbacks are never silent.
 * Returns the fallback value for inline use.
 *
 * @param preferred  The value to use if present and non-empty.
 * @param fallback   The degraded value to use if preferred is absent.
 * @param context    Label identifying which field and which beat/character.
 * @param severity   "warn" (quality loss) | "info" (expected migration path).
 */
export function fallbackWarn<T extends string | undefined>(
  preferred: T | undefined | null,
  fallback: T,
  context: string,
  severity: 'warn' | 'info' = 'warn'
): T {
  if (!preferred || (typeof preferred === 'string' && preferred.trim() === '')) {
    const msg = `[D91 fallback] ${context}`;
    if (severity === 'warn') {
      console.warn(msg);
    } else {
      console.info(msg);
    }
    return fallback;
  }
  return preferred;
}

/**
 * Collect fallback keys that fired during a single generation call.
 * Pass the returned array to GenerationLogEntry.fallbacks.
 *
 * Usage:
 *   const fb = createFallbackCollector();
 *   const visual = fb.get(beat.visualDescription, beat.description, 'visualDescription');
 *   // ... then log: { ...entry, fallbacks: fb.keys() }
 */
export function createFallbackCollector() {
  const fired: string[] = [];
  return {
    get<T extends string | undefined>(
      preferred: T | undefined | null,
      fallback: T,
      key: string
    ): T {
      if (!preferred || (typeof preferred === 'string' && preferred.trim() === '')) {
        fired.push(key);
        console.warn(`[D91 fallback] ${key}`);
        return fallback;
      }
      return preferred;
    },
    keys: () => [...fired],
    any: () => fired.length > 0,
  };
}
