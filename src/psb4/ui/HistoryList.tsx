import React, { useState, useEffect } from 'react';
import { Psb4Run } from '../types';
import { preserveRun, deleteRunCascade, getArtifactsByRun } from '../storage';
import { Star, Eye, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';

interface HistoryListProps {
  runs: Psb4Run[];
  onRefresh: () => void;
  onViewRun: (run: Psb4Run) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  runs,
  onRefresh,
  onViewRun,
}) => {
  const [artifactCounts, setArtifactCounts] = useState<Record<string, number>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load artifact count maps for prior runs
  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      for (const run of runs) {
        try {
          const arts = await getArtifactsByRun(run.id);
          counts[run.id] = arts.length;
        } catch (err) {
          console.error(`Failed to get artifact count for run ${run.id}:`, err);
          counts[run.id] = 0;
        }
      }
      setArtifactCounts(counts);
    };
    fetchCounts();
  }, [runs]);

  const getRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hrs > 0) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    if (mins > 0) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getHighestPhaseReached = (run: Psb4Run): string => {
    if (!run.phaseProgress) return 'None';
    const { enrichment, rebuild, arc_lock, reduction } = run.phaseProgress;
    if (enrichment === 'complete' || run.status === 'completed') return 'Enrichment (Completed)';
    if (enrichment === 'running' || enrichment === 'failed') return 'Enrichment';
    if (rebuild === 'complete') return 'Rebuild (Completed)';
    if (rebuild === 'running' || rebuild === 'failed') return 'Rebuild';
    if (arc_lock === 'complete') return 'Arc Lock (Completed)';
    if (arc_lock === 'running' || arc_lock === 'failed') return 'Arc Lock';
    if (reduction === 'complete') return 'Reduction (Completed)';
    if (reduction === 'running' || reduction === 'failed') return 'Reduction';
    return 'None';
  };

  const handleTogglePreserve = async (run: Psb4Run) => {
    try {
      const newVal = !run.preserved;
      await preserveRun(run.id, newVal);
      onRefresh();
    } catch (err) {
      console.error('Failed to preserve run:', err);
    }
  };

  const handleDelete = async (runId: string) => {
    setIsDeleting(true);
    try {
      await deleteRunCascade(runId);
      setConfirmDeleteId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to cascade delete run:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: Psb4Run['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            ACTIVE
          </span>
        );
      case 'completed':
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            DONE
          </span>
        );
      case 'abandoned':
        return (
          <span className="bg-zinc-800 text-white/60 border border-zinc-700 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            ABAND
          </span>
        );
      case 'failed':
        return (
          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            FAIL
          </span>
        );
    }
  };

  return (
    <div className="bg-[#070707] border border-white/10 rounded-lg overflow-hidden" id="psb4_history_list">
      <div className="p-4 bg-[#0d0d0d] border-b border-white/10">
        <h3 className="text-sm font-sans font-medium text-white flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-500" />
          PSB4 Execution History
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-[#0a0a0a] border-b border-white/5 text-[10px] uppercase font-mono tracking-wider text-white/60">
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Created</th>
              <th className="p-3 font-semibold">Phase Reached</th>
              <th className="p-3 font-semibold">Artifacts</th>
              <th className="p-3 font-semibold text-center">Preserved</th>
              <th className="p-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8">
                  <p className="text-[11px] text-white/50 uppercase tracking-widest py-4">
                    No run history for this show yet
                  </p>
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Status Badge */}
                  <td className="p-3 align-middle">{getStatusBadge(run.status)}</td>

                  {/* Relative date & tooltip */}
                  <td className="p-3 align-middle" title={new Date(run.createdAt).toLocaleString()}>
                    <span className="text-white/85 font-mono text-[11px]">
                      {getRelativeTime(run.createdAt)}
                    </span>
                  </td>

                  {/* Phase completed */}
                  <td className="p-3 align-middle">
                    <span className="text-white/80 font-medium">
                      {getHighestPhaseReached(run)}
                    </span>
                  </td>

                  {/* Artifacts count */}
                  <td className="p-3 align-middle">
                    <span className="font-mono text-[11px] text-amber-300">
                      {artifactCounts[run.id] ?? 0}
                    </span>
                  </td>

                  {/* Star toggler */}
                  <td className="p-3 align-middle text-center">
                    <button
                      onClick={() => handleTogglePreserve(run)}
                      title={run.preserved ? 'Run is immune from automatic console pruning' : 'Make run immune from automatic console pruning'}
                      className="transition-transform duration-100 hover:scale-110 focus:outline-none"
                    >
                      <Star
                        size={14}
                        className={
                          run.preserved
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-white/40 hover:text-white/70'
                        }
                      />
                    </button>
                  </td>

                  {/* Actions (View/Delete with confirm) */}
                  <td className="p-3 align-middle text-right">
                    {confirmDeleteId === run.id ? (
                      <div className="flex items-center justify-end gap-1.5 bg-[#140a0c] border border-red-950 px-2 py-1 rounded inline-flex">
                        <AlertTriangle size={11} className="text-red-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-red-400 leading-none">Confirm Cascade?</span>
                        <button
                          disabled={isDeleting}
                          onClick={() => handleDelete(run.id)}
                          className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] font-black rounded uppercase leading-none"
                        >
                          delete
                        </button>
                        <button
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white/85 font-mono text-[10px] font-semibold rounded uppercase leading-none"
                        >
                          cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onViewRun(run)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono hover:text-white text-white/70 bg-white/5 border border-white/10 hover:border-white/20 rounded transition-all leading-none"
                        >
                          <Eye size={12} />
                          Browse
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(run.id)}
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono hover:text-red-300 text-red-400 bg-red-950/20 border border-red-900/30 hover:border-red-900/60 rounded transition-all leading-none"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
