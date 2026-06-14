import { listRuns, getConsoleEntriesNotInRuns, deleteConsoleEntry } from './storage';

/**
 * Retains console entries for:
 *  - the currently active run
 *  - all runs marked as preserved (preserved === true)
 *  - the 10 most recent closed-state (completed, abandoned, or failed) runs
 * Deletes any console entries whose runId is not in the retained set.
 */
export async function pruneConsoleEntries(showId: string): Promise<{ pruned: number }> {
  try {
    const allRuns = await listRuns(showId);
    if (allRuns.length === 0) {
      return { pruned: 0 };
    }

    const retained = new Set<string>();

    // 1. All active runs and preserved runs are always retained
    for (const run of allRuns) {
      if (run.status === 'active' || run.preserved) {
        retained.add(run.id);
      }
    }

    // 2. Most recent 10 closed runs
    const closed = allRuns
      .filter((run) => run.status !== 'active' && !run.preserved)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    for (const run of closed) {
      retained.add(run.id);
    }

    // 3. Delete console entries for runs not inside retained
    const orphans = await getConsoleEntriesNotInRuns(showId, retained);
    for (const entry of orphans) {
      await deleteConsoleEntry(entry.id);
    }

    console.log(`[PSB4 Console Pruner] Pruned ${orphans.length} orphaned console entries for show ${showId}.`);
    return { pruned: orphans.length };
  } catch (err) {
    console.warn(`[PSB4 Console Pruner] Error running pruning for show ${showId}:`, err);
    return { pruned: 0 };
  }
}
