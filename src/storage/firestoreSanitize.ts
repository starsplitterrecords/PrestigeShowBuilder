/**
 * Recursively strip undefined fields from an object so it
 * can be safely written to Firestore. Firestore rejects
 * undefined field values; null and omitted are both fine.
 *
 * - Object: drops keys whose values are undefined
 * - Array: maps over items recursively
 * - Primitive: returns as-is
 * - null: preserved
 * - Date: preserved (Firestore handles Dates natively)
 *
 * Note: this returns a new object; does not mutate input.
 */
export function stripUndefined<T>(value: T, seen: Set<any> = new Set()): T {
  if (value === undefined) return undefined as any;
  if (value === null) return null as any;
  
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]" as any;
    seen.add(value);
    return value.map(v => stripUndefined(v, seen)) as any;
  }
  
  if (typeof value === 'object') {
    // Preserve Date instances
    if (value instanceof Date) return value;
    
    if (seen.has(value)) return "[Circular]" as any;
    seen.add(value);
    
    const out: any = {};
    const obj = value as Record<string, any>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === undefined) continue;
      out[k] = stripUndefined(v, seen);
    }
    return out;
  }
  
  return value;
}
