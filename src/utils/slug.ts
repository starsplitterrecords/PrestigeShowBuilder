/**
 * D307: Convert a string to a kebab-case slug suitable for URL paths
 * and filesystem-safe folder names.
 *
 * Examples:
 *   toSlug('Vikings 2026!')       -> 'vikings-2026'
 *   toSlug('VIK_S1_E1_COVER')     -> 'vik-s1-e1-cover'
 *   toSlug('Issue #3 -- Origins') -> 'issue-3-origins'
 */
export function toSlug(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')         // any non-alphanum becomes hyphen
    .replace(/^-+|-+$/g, '')             // trim leading/trailing hyphens
    .replace(/-{2,}/g, '-');             // collapse repeated hyphens
}
