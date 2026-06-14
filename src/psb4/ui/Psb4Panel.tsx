import React, { useState, useEffect } from 'react';
import { useStore } from '../../StoreContext';
import { useActiveRun } from './hooks/useActiveRun';
import { listRuns, restorePsb4FromCloud } from '../storage';
import { Psb4Run } from '../types';
import { getCurrentExportForShow } from '../adapter/export_provider';
import { NoShowSelected, NoExportFound } from './EmptyStates';
import { StartRunAction } from './StartRunAction';
import { HistoryList } from './HistoryList';
import { Psb4WorkspacePanel } from './Psb4WorkspacePanel';
import { GnPacketEntry } from './GnPacketEntry';
import { Loader2, ArrowLeft } from 'lucide-react';

export const Psb4Panel: React.FC = () => {
  const { state } = useStore();
  const showId = state.currentShow?.id || null;

  // Active run from database hook
  const { activeRun, loading: activeLoading, refresh: refreshActive } = useActiveRun(showId);

  // Derive run validity at render time (Fix A)
  const activeRunIsForCurrentShow = activeRun?.showId === showId;
  const validActiveRun = activeRunIsForCurrentShow ? activeRun : null;

  // Other panel states
  const [exportAvailable, setExportAvailable] = useState<boolean>(false);
  const [exportCheckedForShowId, setExportCheckedForShowId] = useState<string | null>(null);
  const [checkingExport, setCheckingExport] = useState<boolean>(true);
  const [allRuns, setAllRuns] = useState<Psb4Run[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  // Selected historic run to inspect in read-only mode
  const [historicRun, setHistoricRun] = useState<Psb4Run | null>(null);

  // Synchronously derived states to prevent flashing/transition bugs (Fix B)
  const exportReady = exportAvailable && exportCheckedForShowId === showId;
  const checkingThisShow = checkingExport || exportCheckedForShowId !== showId;

  // Clear historic run when show changes
  useEffect(() => {
    setHistoricRun(null);
  }, [showId]);

  // Clear historic run if it becomes active to transition to active dashboard
  useEffect(() => {
    if (historicRun && validActiveRun && historicRun.id === validActiveRun.id) {
      setHistoricRun(null);
    }
  }, [historicRun, validActiveRun]);

  // Check show export availability
  useEffect(() => {
    const checkPrerequisites = async () => {
      if (!showId) {
        setExportAvailable(false);
        setExportCheckedForShowId(null);
        setCheckingExport(false);
        return;
      }
      setCheckingExport(true);
      try {
        const payload = await getCurrentExportForShow(state.currentShow);
        setExportAvailable(payload !== null);
        setExportCheckedForShowId(showId);
      } catch (err) {
        console.error('Failed to verify current export in Psb4Panel:', err);
        setExportAvailable(false);
        setExportCheckedForShowId(showId);
      } finally {
        setCheckingExport(false);
      }
    };
    checkPrerequisites();
  }, [showId, state.currentShow?.seasons?.[0]?.episodes?.length]);

  // Load all runs for history and local state
  const loadHistory = async () => {
    if (!showId) {
      setAllRuns([]);
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const list = await listRuns(showId);
      // Sort reverse-chronological
      list.sort((a, b) => b.createdAt - a.createdAt);
      setAllRuns(list);
    } catch (err) {
      console.error('Failed to load runs history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showId) {
      restorePsb4FromCloud(showId).finally(() => {
        loadHistory();
      });
    } else {
      loadHistory();
    }
  }, [showId, activeRun]);

  const handleRefreshAll = () => {
    refreshActive();
    loadHistory();
  };

  const handleStartRunSucceeded = () => {
    setHistoricRun(null);
    handleRefreshAll();
  };

  // State 1: No show selected
  if (!showId) {
    return (
      <div className="h-full flex flex-col bg-black text-white overflow-hidden" id="psb4_panel_no_show">
        <div className="flex-1 flex items-center justify-center p-12">
          <NoShowSelected />
        </div>
      </div>
    );
  }

  // Loading phase
  if (activeLoading || checkingThisShow) {
    return (
      <div className="h-full flex flex-col bg-black text-white overflow-hidden" id="psb4_panel_loading">
        <div className="flex-1 flex items-center justify-center flex-col">
          <Loader2 className="animate-spin text-amber-500 mb-2" size={24} />
          <span className="text-xs font-mono text-white/50 uppercase tracking-widest">
            Resolving Run Context
          </span>
        </div>
      </div>
    );
  }

  // State 2: No teleplay export
  if (!exportReady) {
    return (
      <div className="h-full flex flex-col bg-black text-white overflow-hidden" id="psb4_panel_no_export">
        <div className="flex-1 flex items-center justify-center p-12">
          <NoExportFound />
        </div>
      </div>
    );
  }

  // State 3.5: Reading a historical/closed run (Browse view)
  if (historicRun) {
    return (
      <div className="h-full flex flex-col bg-black text-white overflow-hidden" id="psb4_panel_historic_view">
        <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#0a0a0a] flex items-center">
          <button
            onClick={() => setHistoricRun(null)}
            className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-white/65 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to History List
          </button>
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          <Psb4WorkspacePanel 
            run={historicRun} 
            onRefresh={handleRefreshAll} 
            readOnly={historicRun.status === 'abandoned' ? false : true} 
            onViewRun={(selectedRun) => setHistoricRun(selectedRun)}
          />
        </div>
      </div>
    );
  }

  // State 4: Active run dashboard
  if (validActiveRun) {
    return (
      <div className="h-full flex flex-col bg-black text-white overflow-hidden" id="psb4_panel_active_dashboard">
        <div className="flex-1 overflow-hidden min-h-0">
          <Psb4WorkspacePanel 
            run={validActiveRun} 
            onRefresh={handleRefreshAll} 
            readOnly={false} 
            onViewRun={(selectedRun) => setHistoricRun(selectedRun)}
          />
        </div>
      </div>
    );
  }

  // State 3: Ready to run (Show selected, export available, no active run)
  const priorRuns = allRuns.filter((r) => r.status !== 'active');

  return (
    <>
      <div className="h-full flex flex-col bg-black text-white overflow-hidden" id="psb4_panel_ready_to_run">
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Column - Start Run Action (38%) */}
          <div className="basis-[38%] border-r border-white/10 p-6 flex flex-col justify-center min-h-0" id="psb4_ready_start">
            <div className="max-w-md w-full mx-auto">
              <StartRunAction showId={showId} onRunCreated={handleStartRunSucceeded} />
            </div>
          </div>

          {/* Right Column - History List (62%) */}
          <div className="basis-[62%] p-6 flex flex-col min-h-0" id="psb4_ready_history">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest font-black">
                Prior Runs ({priorRuns.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-4 min-h-0">
              {loadingHistory ? (
                <div className="flex items-center justify-center p-8 h-full">
                  <Loader2 className="animate-spin text-amber-500" size={20} />
                </div>
              ) : (
                <HistoryList
                  runs={priorRuns}
                  onRefresh={handleRefreshAll}
                  onViewRun={(run) => setHistoricRun(run)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <GnPacketEntry hiddenTrigger={true} />
    </>
  );
};

export default Psb4Panel;
