
/**
 * Safe JSON utility to prevent circular reference errors.
 * Used at critical serialization boundaries (storage, logging, proxy).
 */

export function safeStringify(obj: any, indent?: number): string {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return `[Circular ${key}]`;
      }
      cache.add(value);
    }
    // D324: Handle potential DOM elements that might leak into state
    if (typeof Node !== 'undefined' && value instanceof Node) {
      return `[DOM Node: ${value.nodeName}]`;
    }
    return value;
  }, indent);
}

export function safeParse<T = any>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn("[SafeJSON] Parse failed:", e);
    return fallback;
  }
}
