import React, { useState } from 'react';
import { Psb4Run } from '../types';
import { abandonRun, unabandonRun } from '../storage';
import { PhaseStrip } from './PhaseStrip';
import { useStore } from '../../StoreContext';

interface RunHeaderProps {
  run: Psb4Run;
  onRefresh: () => void;
  readOnly?: boolean;
}

export const RunHeader: React.FC<RunHeaderProps> = ({ run, onRefresh, readOnly = false }) => {
  const { dispatch } = useStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAbandon = async () => {
    setIsSubmitting(true);
    try {
      await abandonRun(run.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to abandon run:', err);
    } finally {
      setIsSubmitting(false);
      setShowConfirm(false);
    }
  };

  const handleUnabandon = async () => {
    setIsSubmitting(true);
    try {
      await unabandonRun(run.id);
      onRefresh();
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_unabandon_success',
          type: 'success',
          message: 'Run unabandoned successfully.',
        },
      });
    } catch (err) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_unabandon_error',
          type: 'error',
          message: err instanceof Error ? err.message : 'Could not unabandon run',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(run.createdAt).toLocaleString();
  const shortHash = run.sourceTeleplayHash ? run.sourceTeleplayHash.substring(0, 8) : 'N/A';

  const getStatusBadge = (status: Psb4Run['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            ACTIVE RUN
          </span>
        );
      case 'completed':
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            COMPLETED
          </span>
        );
      case 'abandoned':
        return (
          <span className="bg-zinc-800 text-white/60 border border-zinc-700 px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            ABANDONED
          </span>
        );
      case 'failed':
        return (
          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase">
            FAILED
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 border-b border-white/10 pb-4" id="psb4_run_header">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Run Metadata */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-sans font-medium tracking-tight text-white m-0">
              Run Details
            </h1>
            {getStatusBadge(run.status)}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-white/60">
            <span>
              ID: <span className="text-white/85">{run.id}</span>
            </span>
            <span className="text-white/30">|</span>
            <span>
              Source Hash: <span className="text-white/85" title={run.sourceTeleplayHash}>{shortHash}</span>
            </span>
            <span className="text-white/30">|</span>
            <span>
              Started: <span className="text-white/85">{formattedDate}</span>
            </span>
          </div>
        </div>

        {/* Action button */}
        {!readOnly && run.status === 'active' && (
          <div className="relative">
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="px-3 py-1.5 border border-red-500/40 hover:border-red-500 text-red-400 hover:text-red-300 bg-red-950/20 text-xs font-mono font-medium tracking-wider uppercase rounded transition-colors duration-150"
              >
                Abandon Run
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-[#140a0c] border border-red-900/50 p-2 rounded max-w-xs md:max-w-none">
                <span className="text-[10px] text-white/80 font-mono mr-1">Abandon this run permanently?</span>
                <button
                  disabled={isSubmitting}
                  onClick={handleAbandon}
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white font-mono text-[9px] font-black uppercase rounded"
                >
                  Yes, Abandon
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => setShowConfirm(false)}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white/80 font-mono text-[9px] uppercase rounded"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {!readOnly && run.status === 'abandoned' && (
          <div className="relative">
            <button
              disabled={isSubmitting}
              onClick={handleUnabandon}
              className="px-3 py-1.5 border border-amber-500/40 hover:border-amber-500 text-amber-400 hover:text-amber-300 bg-amber-950/20 text-xs font-mono font-medium tracking-wider uppercase rounded transition-colors duration-150 disabled:opacity-50"
            >
              {isSubmitting ? 'Unabandoning...' : 'Unabandon Run'}
            </button>
          </div>
        )}
      </div>

      {/* Progress Strip */}
      <PhaseStrip run={run} />
    </div>
  );
};
