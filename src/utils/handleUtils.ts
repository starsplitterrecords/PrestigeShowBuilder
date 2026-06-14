import { Show, Character } from "../types/models";

/**
 * Case-insensitive handle equality.
 * Both inputs are normalized to lowercase before comparison.
 * Undefined / empty handles never match.
 */
export function compareHandles(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Find a character by handle (case-insensitive) or by id.
 * Returns undefined if not found.
 */
export function findCharacterByHandle(
  show: Show,
  handleOrId: string
): Character | undefined {
  if (!handleOrId) return undefined;
  const target = handleOrId.toLowerCase();
  return (show.characters || []).find(
    c => c.id === handleOrId || (c.handle && c.handle.toLowerCase() === target)
  );
}

/**
 * Return the canonical-cased version of a handle by looking it up in
 * the show's character roster. If found, returns the stored handle
 * (canonical form). If not found, returns the input unchanged.
 *
 * Useful when normalizing a handle for storage / output without
 * forcing a particular case convention.
 */
export function normalizeHandle(handle: string, show: Show): string {
  const char = findCharacterByHandle(show, handle);
  return char?.handle ?? handle;
}
