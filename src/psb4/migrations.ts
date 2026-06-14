/**
 * Migrations helper for PSB4 data structures.
 * 
 * At present (schemaVersion: 1), only version 1 exists, 
 * so migrateIfNeeded acts as a no-op pass-through.
 */
export function migrateIfNeeded<T extends { schemaVersion: number }>(record: T, targetVersion: number): T {
  // Scaffolding for forward-migration:
  // if (record.schemaVersion < targetVersion) {
  //   // apply migrators here sequentially
  // }
  return record;
}
