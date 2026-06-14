import { useEffect } from 'react';
import { migrateToAssetStorage } from '../migration';
import { VaultStorage } from '../storage/VaultStorage';
import type { ShowSummary } from '../types/models';

export function useStorageInit(
  isReady: boolean,
  userId: string | undefined,
  onLoaded: (summaries: ShowSummary[]) => void
) {
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) onLoaded([]);
    }, 15000);
    (async () => {
      try {
        await migrateToAssetStorage();
        await VaultStorage.backfillSummaries();
        const summaries = await VaultStorage.getSummaries();
        clearTimeout(timeout);
        if (!cancelled) onLoaded(summaries);
      } catch {
        clearTimeout(timeout);
        if (!cancelled) onLoaded([]);
      }
    })();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [isReady, userId]);
}
