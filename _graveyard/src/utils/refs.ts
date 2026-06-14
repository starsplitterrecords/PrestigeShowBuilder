/**
 * Reference-name resolver. PSB has two ref shapes in flight:
 *   - Portrait refs carry `.name` (character display name)
 *   - Locked refs carry `.label` (author-assigned label)
 *
 * Callers that need a single string to pass downstream should
 * use getRefName(ref) rather than coercing one field into the
 * other.
 */
export function getRefName(
  ref: { name?: string; label?: string }
): string {
  return ref.name ?? ref.label ?? '';
}
