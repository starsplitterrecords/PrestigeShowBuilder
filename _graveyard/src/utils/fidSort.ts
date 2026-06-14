/**
 * Parse a FID string into sortable numeric components.
 * Handles both beat FIDs (S-E-A-Sc-B) and scene FIDs (S-E-A-Sc).
 * Returns [0,0,0,0,0] for unparseable strings.
 */
export function parseFidParts(fid: string): number[] {
  const m = fid?.match(/-S(\d+)-E(\d+)-A(\d+)-Sc(\d+)(?:-B(\d+))?/);
  if (!m) return [0, 0, 0, 0, 0];
  return [+m[1], +m[2], +m[3], +m[4], +(m[5] ?? 0)];
}

export function compareFids(a: string, b: string): number {
  const pa = parseFidParts(a), pb = parseFidParts(b);
  for (let i = 0; i < pa.length; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}
