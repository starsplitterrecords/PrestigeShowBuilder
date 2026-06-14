/**
 * Deterministic export hashing utility.
 * Guarantees that identical payloads produce identical 16-character hex hashes synchronously.
 */

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: any = {};
  Object.keys(obj).sort().forEach((key) => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  return sorted;
}

export function computeExportHash(payload: any): string {
  if (!payload) {
    return 'empty_hash_000000';
  }
  const str = typeof payload === 'string' ? payload : JSON.stringify(sortObjectKeys(payload));
  
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 15), 3266489909) ^ Math.imul(h1 ^ (h1 >>> 13), 2246822507);
  
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'));
}
