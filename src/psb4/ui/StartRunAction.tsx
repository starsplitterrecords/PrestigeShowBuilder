import React, { useState } from 'react';
import { useStore } from '../../StoreContext';
import { getCurrentExportForShow } from '../adapter/export_provider';
import { computeExportHash } from '../reader/hash';
import { createRun, failRun } from '../storage';
import { readSource } from '../reader';
import { Play, Loader2, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface StartRunActionProps {
  showId: string;
  onRunCreated: () => void;
}

export const StartRunAction: React.FC<StartRunActionProps> = ({ showId, onRunCreated }) => {
  const { state, dispatch } = useStore();
  const show = state.currentShow;
  const [isStarting, setIsStarting] = useState(false);

  // Scoping controls
  const [scopeIssueCount, setScopeIssueCount] = useState<4 | 6 | 8>(6);
  
  const showEpisodes = show?.seasons?.[0]?.episodes || [];
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>(
    showEpisodes.map(ep => ep.id)
  );

  const handleToggleEpisode = (epId: string) => {
    setSelectedEpisodeIds(prev =>
      prev.includes(epId)
        ? prev.filter(id => id !== epId)
        : [...prev, epId]
    );
  };

  const handleSelectAll = () => {
    setSelectedEpisodeIds(showEpisodes.map(ep => ep.id));
  };

  const handleClearAll = () => {
    setSelectedEpisodeIds([]);
  };

  const handleStartRun = async () => {
    if (selectedEpisodeIds.length === 0) return;
    setIsStarting(true);
    try {
      // 1. Resolve original export payload
      const exportPayload = await getCurrentExportForShow(show);
      if (!exportPayload) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Math.random().toString(),
            type: 'error',
            message: 'No available PSB3 teleplay export. Create one first.',
          },
        });
        setIsStarting(false);
        return;
      }

      // 2. Compute hash
      const hash = computeExportHash(exportPayload);

      // 3. Create active run in DB with scoping information passed
      let run;
      try {
        run = await createRun(showId, hash, scopeIssueCount, selectedEpisodeIds);
      } catch (err: any) {
        if (err && err.code === 'DUPLICATE_ACTIVE_RUN') {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: Math.random().toString(),
              type: 'warning',
              message: 'Active run already exists. Redirecting to current run.',
            },
          });
          onRunCreated();
          setIsStarting(false);
          return;
        }
        throw err;
      }

      // 4. Trace the original source extraction inside reader
      try {
        await readSource(run.id, exportPayload);
      } catch (innerErr: any) {
        console.error('Exception during run initialization:', innerErr);
        try {
          await failRun(run.id);
        } catch (failErr) {
          console.error('Failed to mark run as failed after init error:', failErr);
        }
        throw innerErr;
      }

      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Math.random().toString(),
          type: 'success',
          message: `PSB4 Run initialized: Source Teleplay hash ${hash.substring(0, 8)}.`,
        },
      });

      onRunCreated();
    } catch (err: any) {
      console.error('Failed to start PSB4 run:', err);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Math.random().toString(),
          type: 'error',
          message: err?.message || 'Failed to initialize PSB4 run.',
        },
      });
    } finally {
      setIsStarting(false);
    }
  };

  const isStartDisabled = isStarting || selectedEpisodeIds.length === 0;

  return (
    <div className="flex flex-col p-6 border border-white/10 rounded-lg bg-[#0b0b0b] w-full max-w-lg mx-auto text-left" id="psb4_start_run_action">
      <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white mb-2 text-center">
        Initialize Creative Reconstruction
      </h2>
      <p className="text-xs text-white/70 text-center mb-6 leading-relaxed">
        Starting a PSB4 run generates a pristine immutable copy of this show's current teleplay, begins the reduction pass, and establishes your pipeline's console tracking.
      </p>

      {/* 11. Scoping Controls Form */}
      <div className="space-y-5 border-t border-b border-white/10 py-5 mb-6">
        {/* 11.1 Issue Count Selector */}
        <div className="space-y-2">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-white/50 font-bold">
            1. Scoped Issue Count
          </label>
          <div className="grid grid-cols-3 gap-3">
            {([4, 6, 8] as const).map(num => {
              const isSelected = scopeIssueCount === num;
              const sublabel = num === 4 ? '4 — Tight arc' : num === 6 ? '6 — Standard arc' : '8 — Extended arc';
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setScopeIssueCount(num)}
                  className={`px-3 py-2 flex flex-col items-center justify-center rounded border transition focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
                    isSelected
                      ? 'bg-amber-400 text-[#070707] border-amber-400 font-bold'
                      : 'border-white/10 hover:border-white/20 text-white bg-transparent'
                  }`}
                  id={`issue_count_btn_${num}`}
                >
                  <span className="text-xs font-bold">{num} Issues</span>
                  <span className={`text-[10px] font-mono mt-0.5 select-none ${isSelected ? 'text-[#070707]/90' : 'text-white/60'}`}>
                    {sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 11.2 Episode multi-select */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono uppercase tracking-widest text-white/50 font-bold">
              2. Episode Scope
            </label>
            <div className="flex items-center gap-2 font-mono text-[9px] font-bold">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-amber-400 hover:text-amber-300 uppercase"
                id="scope_select_all"
              >
                SELECT ALL
              </button>
              <span className="text-white/30">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-white/50 hover:text-white uppercase"
                id="scope_clear_all"
              >
                CLEAR ALL
              </button>
            </div>
          </div>

          <div className="border border-white/10 rounded bg-[#101010] divide-y divide-white/5 max-h-[170px] overflow-y-auto p-1 space-y-0.5">
            {showEpisodes.length === 0 ? (
              <div className="p-4 text-center text-[10px] font-mono text-white/40 uppercase tracking-wider">
                No episodes available under this show
              </div>
            ) : (
              showEpisodes.map(ep => {
                const isSelected = selectedEpisodeIds.includes(ep.id);
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => handleToggleEpisode(ep.id)}
                    className="w-full text-left px-2 py-1.5 flex items-center gap-2.5 transition rounded hover:bg-white/5 focus:outline-none"
                    id={`scope_ep_row_${ep.id}`}
                  >
                    {isSelected ? (
                      <CheckSquare size={13} className="text-amber-400 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 border border-white/30 rounded shrink-0" />
                    )}
                    <div className="min-w-0 font-mono text-xs">
                      <span className="text-amber-400 font-bold mr-1.5 select-none">Ep {ep.number}:</span>
                      <span className="text-white/80 truncate inline-block max-w-[280px] align-bottom">
                        {ep.title}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-white/50 px-1 mt-1">
            <span>
              {selectedEpisodeIds.length} of {showEpisodes.length} episodes in scope
            </span>
            {selectedEpisodeIds.length === 0 && (
              <span className="text-red-400 font-bold uppercase flex items-center gap-1 animate-pulse">
                <AlertTriangle size={10} /> Selection required
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Warning banner for unconfirmed GN Packet */}
      {!show?.gnPacketConfirmed && (
        <div className="flex items-start gap-2 p-3 rounded border border-amber-800/30 bg-amber-950/10 text-xs text-amber-300/80 mb-6">
          <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
          <span>
            <span className="font-bold">GN Packet not confirmed.</span>{' '}
            Pass 0.0 will use a placeholder. Fill and confirm the packet for higher quality output.{' '}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('psb_open_gn_packet'));
              }}
              className="text-amber-400 hover:text-amber-300 font-bold underline ml-1 cursor-pointer"
            >
              Open Packet →
            </button>
          </span>
        </div>
      )}

      {/* Start Button */}
      <div className="flex flex-col items-center">
        <button
          disabled={isStartDisabled}
          onClick={handleStartRun}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 font-sans font-semibold text-xs tracking-wider uppercase rounded shadow transition-all duration-150 ${
            isStartDisabled
              ? 'bg-amber-950/25 text-amber-500/30 border border-amber-950/20 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
          }`}
          id="psb4_start_action_btn"
        >
          {isStarting ? (
            <>
              <Loader2 className="animate-spin text-black" size={14} />
              Starting Run...
            </>
          ) : (
            <>
              <Play fill="currentColor" size={12} />
              Start PSB4 Run
            </>
          )}
        </button>
      </div>
    </div>
  );
};
