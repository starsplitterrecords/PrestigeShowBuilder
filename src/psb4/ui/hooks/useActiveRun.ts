import { useState, useEffect, useCallback } from 'react';
import { Psb4Run } from '../../types';
import { getActiveRun } from '../../storage';

export function useActiveRun(showId: string | null) {
  const [activeRun, setActiveRun] = useState<Psb4Run | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchActive = useCallback(async () => {
    if (!showId) {
      setActiveRun(null);
      setLoading(false);
      return;
    }
    try {
      const run = await getActiveRun(showId);
      setActiveRun(run);
    } catch (err) {
      console.error('Failed to fetch active run in useActiveRun hook:', err);
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    setLoading(true);
    fetchActive();

    if (!showId) return;

    // Periodically poll the database for run state transitions
    const interval = setInterval(fetchActive, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [showId, fetchActive]);

  return {
    activeRun,
    loading,
    refresh: fetchActive
  };
}
