import { useState, useEffect, useCallback } from 'react';
import { Psb4Artifact } from '../../types';
import { getArtifactsByRun } from '../../storage';

export function useArtifacts(runId: string | null) {
  const [artifacts, setArtifacts] = useState<Psb4Artifact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchArtifacts = useCallback(async () => {
    if (!runId) {
      setArtifacts([]);
      setLoading(false);
      return;
    }
    try {
      const list = await getArtifactsByRun(runId);
      // Sort in reverse-chronological order or of creation time
      list.sort((a, b) => b.createdAt - a.createdAt);
      setArtifacts(list);
    } catch (err) {
      console.error('Failed to fetch artifacts in useArtifacts hook:', err);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    setLoading(true);
    fetchArtifacts();

    if (!runId) return;

    // Refresh every 3 seconds to auto-load newly written artifacts
    const interval = setInterval(fetchArtifacts, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [runId, fetchArtifacts]);

  return {
    artifacts,
    loading,
    refresh: fetchArtifacts
  };
}
