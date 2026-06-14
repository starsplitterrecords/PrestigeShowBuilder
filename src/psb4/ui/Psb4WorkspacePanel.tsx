import React, { useState, useEffect, useRef } from 'react';
import { Psb4Run, PassSpec, Psb4Artifact, Psb4ConsoleEntry, NormalizedSource, ArtifactType } from '../types';
import { getArtifactsByRun, listConsoleEntries, abandonRun, unabandonRun, listRuns, autoApproveBlankNotes, resetPass09W, resetPass09G, createRun, getSourceByRun, writeSource, writeArtifact, failRun, clearStaleActiveRuns, forkRun, getStorageMode, setStorageMode, isFirestoreQuotaExhausted } from '../storage';
import { getAllPassSpecs } from '../passes/registry';
import { computePassStatuses, PassStatus } from './utils/passStatus';
import { Psb4PassNavigator } from './Psb4PassNavigator';
import { Psb4PassWorkArea } from './Psb4PassWorkArea';
import { Psb4PassContext } from './Psb4PassContext';
import { Psb4RunHistoryDrawer } from './Psb4RunHistoryDrawer';
import { runPass } from '../passes/executor';
import { useStore } from '../../StoreContext';
import { History, Loader2, AlertTriangle, ArrowLeft, Wrench } from 'lucide-react';
import { getApiKey } from '../../domainUtils';
import { generateUlid } from '../console';

const FRONT_HALF_PASSES = [
  '0.0','0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.8A'
] as const;

const BACK_HALF_PASSES = [
  '0.8R','0.8RA',
  '0.9','0.9S','0.9W','0.9G','0.9A','0.12','0.14',
  '1','2','3','4','5','6','7','8','9','10','11','12'
] as const;

interface Psb4WorkspacePanelProps {
  run: Psb4Run;
  onRefresh: () => void;
  readOnly?: boolean;
  onViewRun?: (run: Psb4Run) => void;
}

export const Psb4WorkspacePanel: React.FC<Psb4WorkspacePanelProps> = ({
  run,
  onRefresh,
  readOnly = false,
  onViewRun,
}) => {
  const { state, dispatch } = useStore();
  const show = state.currentShow;

  const hasApiKey = !state.currentShow ? true : !!getApiKey();

  // Local state for workspace loaded artifacts & logs
  const [artifacts, setArtifacts] = useState<Psb4Artifact[]>([]);
  const [consoleEntries, setConsoleEntries] = useState<Psb4ConsoleEntry[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  // Navigator and active Workspace selections
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [runningPassId, setRunningPassId] = useState<string | null>(null);

  // Auto-chain state
  const [isChaining, setIsChaining] = useState(false);
  const [chainProgress, setChainProgress] = useState<{
    index: number;
    total: number;
    passId: string;
    passName: string;
  } | null>(null);
  const chainAbortRef = useRef(false);

  // History Drawer state & lists
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [priorRuns, setPriorRuns] = useState<Psb4Run[]>([]);
  const [loadingPriorRuns, setLoadingPriorRuns] = useState(false);

  // Abandon run confirmation
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);

  // Storage mode and quota state conforming to Directive D185
  const [storageMode, setStorageModeState] = useState<'cloud' | 'local'>(getStorageMode());
  const [quotaExhausted, setQuotaExhausted] = useState<boolean>(isFirestoreQuotaExhausted());

  useEffect(() => {
    const handleModeChange = () => {
      setStorageModeState(getStorageMode());
    };
    const handleQuotaChange = () => {
      setQuotaExhausted(isFirestoreQuotaExhausted());
    };
    window.addEventListener('psb4_storage_mode_changed', handleModeChange);
    window.addEventListener('psb4_firestore_quota_exhausted_changed', handleQuotaChange);
    return () => {
      window.removeEventListener('psb4_storage_mode_changed', handleModeChange);
      window.removeEventListener('psb4_firestore_quota_exhausted_changed', handleQuotaChange);
    };
  }, []);

  const specs = getAllPassSpecs();
  const showEpisodes = show?.seasons?.[0]?.episodes || [];
  const defaultEpisodeIds = showEpisodes.map(ep => ep.id);

  // 1. Fetch workspace data for active run
  const fetchWorkspaceData = async () => {
    try {
      const runArtifacts = await getArtifactsByRun(run.id);
      const runLogs = await listConsoleEntries(run.id);
      setArtifacts(runArtifacts);
      setConsoleEntries(runLogs);
    } catch (err) {
      console.error('Failed to load active workspace data:', err);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    setLoadingWorkspace(true);
    fetchWorkspaceData();
  }, [run.id]);

  // Handle local workspace refresher
  const handleRefresh = async () => {
    await fetchWorkspaceData();
    onRefresh();
  };

  // 2. Compute status maps
  const statuses = computePassStatuses(run, artifacts, consoleEntries, defaultEpisodeIds, runningPassId, show);

  // Derive effective run status: Do not allow completed/DONE status if 0.9G is partial/incomplete
  let effectiveRunStatus = run.status;
  if (run.status === 'completed') {
    const status09G = statuses['0.9G'];
    if (status09G && status09G !== 'complete' && status09G !== 'author-edited') {
      if (status09G === 'error') {
        effectiveRunStatus = 'failed';
      } else {
        effectiveRunStatus = 'active'; // display correct ongoing progress instead of fake "DONE"
      }
    }
  }

  useEffect(() => {
    console.log('[Psb4WorkspacePanel] Computed Pass Statuses:', statuses);
  }, [JSON.stringify(statuses)]);

  // 3. Assign initial default selected pass
  useEffect(() => {
    if (!selectedPassId && Object.keys(statuses).length > 0) {
      // Find earliest incomplete pass with a completed prerequisite
      let defaultId = '0.0';
      for (const spec of specs) {
        const status = statuses[spec.id];
        if (status !== 'complete' && status !== 'author-edited' && status !== 'blocked') {
          defaultId = spec.id;
          break;
        }
      }
      setSelectedPassId(defaultId);
    }
  }, [selectedPassId, statuses]);

  // Synchronize episode context when selected pass changes
  useEffect(() => {
    if (selectedPassId) {
      const spec = specs.find(s => s.id === selectedPassId);
      if (spec && (spec.scope === 'episode' || spec.scope === 'episode-anchored')) {
        const scopedEps = run.scopeEpisodeIds && run.scopeEpisodeIds.length > 0
          ? run.scopeEpisodeIds
          : defaultEpisodeIds;

        if (scopedEps.length > 0 && (!selectedEpisodeId || !scopedEps.includes(selectedEpisodeId))) {
          setSelectedEpisodeId(scopedEps[0]);
        }
      } else {
        setSelectedEpisodeId(null);
      }
    }
  }, [selectedPassId, run.scopeEpisodeIds, showEpisodes]);

  // Prior Runs fetch
  const handleOpenPriorRuns = async () => {
    setLoadingPriorRuns(true);
    setHistoryDrawerOpen(true);
    try {
      const runs = await listRuns(run.showId);
      const filtered = runs.filter(r => r.id !== run.id);
      setPriorRuns(filtered);
    } catch (err) {
      console.error('Failed to fetch prior runs:', err);
    } finally {
      setLoadingPriorRuns(false);
    }
  };

  // Run pass trigger inside middle pane
  const handleRunPass = async (
    spec: PassSpec,
    forceRegenerate = false
  ) => {
    if (readOnly && spec.id !== '0.9G') return;
    if (!hasApiKey) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'error',
          message: 'Execution Blocked: Gemini API Key is missing.'
        }
      });
      return;
    }

    let targetRunId = run.id;
    let targetRun = run;

    setRunningPassId(spec.id);
    
    // Optimistic status update
    setConsoleEntries(prev => [
      {
        id: generateUlid(),
        runId: targetRunId,
        showId: show?.id ?? '',
        pass: spec.id,
        eventType: 'assembly',
        createdAt: Date.now(),
        metadata: { model: spec.defaultModel }
      } as unknown as Psb4ConsoleEntry,
      ...prev
    ]);

    try {
      const result = await runPass(targetRunId, spec, { forceRegenerate });
      if (!result.success) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: generateUlid(),
            type: 'error',
            message: result.error || `Failed to run pass ${spec.id}`
          }
        });
      } else {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: generateUlid(),
            type: 'success',
            message: `Pass ${spec.id} completed successfully.`
          }
        });
      }
    } catch (err) {
      console.error(`Error running pass ${spec.id}:`, err);
    } finally {
      setRunningPassId(null);
      handleRefresh();
    }
  };

  const handleRunChain = async (passIds: readonly string[], skipNotesMode = false) => {
    if (isChaining || readOnly) return;
    if (!hasApiKey) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'error',
          message: 'Execution Blocked: Gemini API Key is missing.'
        }
      });
      return;
    }
    chainAbortRef.current = false;

    // Compute which passes to actually run.
    // Skip: complete, author-edited.
    // Abort chain if: blocked (prerequisite not met).
    // For 0.8R / 0.8RA: skip if arcLockNotes is empty and we are NOT in skipNotesMode.
    const toRun: PassSpec[] = [];
    for (const pid of passIds) {
      const spec = specs.find(s => s.id === pid);
      if (!spec) continue;
      const st = statuses[pid] || 'pending';
      if (st === 'complete' || st === 'author-edited') continue;
      if (!skipNotesMode && (pid === '0.8R' || pid === '0.8RA') && !run.arcLockNotes?.trim()) continue;
      toRun.push(spec);
    }

    if (toRun.length === 0) return;

    setIsChaining(true);
    try {
      for (let i = 0; i < toRun.length; i++) {
        if (chainAbortRef.current) break;
        const spec = toRun[i];

        if (skipNotesMode && (spec.id === '0.8R' || spec.id === '0.8RA')) {
          if (spec.id === '0.8R') {
            setChainProgress({
              index: i + 1,
              total: toRun.length,
              passId: '0.8R/RA',
              passName: 'Auto-approving Blank Revision...',
            });
            await autoApproveBlankNotes(run.id);
            // Refresh to ensure statuses and local state reflect the new artifacts
            const freshArts = await getArtifactsByRun(run.id);
            const freshLogs = await listConsoleEntries(run.id);
            setArtifacts(freshArts);
            setConsoleEntries(freshLogs);
          }
          continue;
        }

        setChainProgress({
          index: i + 1,
          total: toRun.length,
          passId: spec.id,
          passName: spec.name,
        });
        // Use the existing single-pass runner.
        // handleRunPass already updates runningPassId + refreshes.
        await handleRunPass(spec, true);  // chain always force-regenerates
        // After each pass, check statuses. If the pass we just ran
        // ended in error, the toast will have appeared — stop the chain.
        const freshArts = await getArtifactsByRun(run.id);
        const freshLogs = await listConsoleEntries(run.id);
        setArtifacts(freshArts);
        setConsoleEntries(freshLogs);
        const freshStatuses = computePassStatuses(run, freshArts, freshLogs, defaultEpisodeIds, null, show);
        const resultStatus = freshStatuses[spec.id];
        if (resultStatus !== 'complete' && resultStatus !== 'author-edited') {
          // Pass did not complete — stop chain.
          break;
        }
      }
    } finally {
      const wasAborted = chainAbortRef.current;
      setIsChaining(false);
      setChainProgress(null);
      chainAbortRef.current = false;
      handleRefresh();

      if (!wasAborted && (toRun.at(-1)?.id === '12' || toRun.at(-1)?.id === '12D')) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now().toString(),
            type: 'success',
            message: 'Run complete — promote the 0.9G scene structure to production.',
          }
        });
      }
    }
  };

  // Abandon run trigger
  const handleAbandonClick = async () => {
    setIsAbandoning(true);
    try {
      await abandonRun(run.id);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'warning',
          message: 'Run has been abandoned.'
        }
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to abandon run:', err);
    } finally {
      setIsAbandoning(false);
      setShowAbandonConfirm(false);
    }
  };

  const [isUnabandoning, setIsUnabandoning] = useState(false);

  const handleUnabandonClick = async () => {
    setIsUnabandoning(true);
    try {
      await unabandonRun(run.id);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'success',
          message: 'Run has been unabandoned.'
        }
      });
      onRefresh();
    } catch (err) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'error',
          message: err instanceof Error ? err.message : 'Could not unabandon run'
        }
      });
    } finally {
      setIsUnabandoning(false);
    }
  };

  const [isClearingStale, setIsClearingStale] = useState(false);

  const handleClearStaleRuns = async () => {
    if (!show?.id) return;
    setIsClearingStale(true);
    try {
      await clearStaleActiveRuns(show.id);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'success',
          message: 'Cleared all stale active runs successfully.'
        }
      });
      onRefresh();
    } catch (err: any) {
      console.error('Failed to clear stale active runs:', err);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'error',
          message: `Failed to clear stale active runs: ${err.message || err}`
        }
      });
    } finally {
      setIsClearingStale(false);
    }
  };

  const handleForkRun = async () => {
    try {
      const newRun = await forkRun(run.id);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'success',
          message: 'Run successfully forked and active.'
        }
      });
      if (onViewRun) {
        onViewRun(newRun);
      }
      onRefresh();
    } catch (err: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: generateUlid(),
          type: 'error',
          message: `Fork failed: ${err.message}`
        }
      });
    }
  };

  // Resolve status Badge
  const getStatusBadge = (status: Psb4Run['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="bg-amber-400/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase">
            ACTIVE
          </span>
        );
      case 'completed':
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase">
            COMPLETED
          </span>
        );
      case 'abandoned':
        return (
          <span className="bg-zinc-800 text-white/60 border border-zinc-700 px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase">
            ABANDONED
          </span>
        );
      case 'failed':
        return (
          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase">
            FAILED
          </span>
        );
    }
  };

  // Phase strip markers
  const PHASES_LIST: Array<{ id: 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment'; label: string }> = [
    { id: 'reduction', label: 'Reduction' },
    { id: 'arc_lock', label: 'Arc Lock' },
    { id: 'rebuild', label: 'Rebuild' },
    { id: 'enrichment', label: 'Enrichment' }
  ];

  const getPhaseDotStyle = (phaseId: string) => {
    const progress = (run.phaseProgress as Record<string, string | undefined>)?.[phaseId];
    if (run.currentPhase === phaseId && effectiveRunStatus === 'active') {
      return 'bg-amber-500 animate-pulse';
    }
    if (progress === 'complete') {
      return 'bg-emerald-400';
    }
    if (progress === 'failed') {
      return 'bg-red-500';
    }
    return 'bg-white/20';
  };

  const getPhaseTextStyle = (phaseId: string) => {
    const progress = (run.phaseProgress as Record<string, string | undefined>)?.[phaseId];
    if (run.currentPhase === phaseId && effectiveRunStatus === 'active') {
      return 'text-amber-300 font-bold';
    }
    if (progress === 'complete') {
      return 'text-emerald-400';
    }
    if (progress === 'failed') {
      return 'text-red-400';
    }
    return 'text-white/50';
  };

  const activePassSpec = selectedPassId ? (specs.find(s => s.id === selectedPassId) ?? null) : null;
  const activePassStatus = selectedPassId ? (statuses[selectedPassId] || 'pending') : 'pending';

  // Front half can always be rerun as long as chaining isn't active.
  const frontHalfRunnable =
    !isChaining && effectiveRunStatus === 'active' && !readOnly && hasApiKey;

  // Back half is runnable when 0.8A is done AND author notes have been saved, and can be rerun.
  const arc08ADone =
    statuses['0.8A'] === 'complete' || statuses['0.8A'] === 'author-edited';
  const backHalfRunnable =
    arc08ADone &&
    !!run.arcLockNotes?.trim() &&
    !isChaining &&
    effectiveRunStatus === 'active' &&
    !readOnly && hasApiKey;

  // Defensive guard against mismatched show run during transitions to prevent render crashing/stale data flicker
  if (run.showId !== show?.id) {
    return (
      <div className="h-full flex flex-col bg-[#070707] text-white overflow-hidden items-center justify-center">
        <Loader2 className="animate-spin text-amber-500 mb-2.5" size={24} />
        <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest animate-pulse">
          Syncing Channel Context...
        </span>
      </div>
    );
  }

  return (
    <div 
      className="h-full flex flex-col bg-black text-white overflow-hidden select-none"
      id="psb4_workspace_root"
    >
      {/* Quota Exhausted Alert Banner conforming to Directive D185 */}
      {storageMode !== 'local' && quotaExhausted && (
        <div className="bg-red-950/40 border-b border-red-900/40 px-4 py-2 flex items-center gap-2 text-red-300 font-mono text-[11px] animate-pulse">
          <AlertTriangle className="text-red-400 shrink-0" size={14} />
          <span>
            Firestore write quota exhausted. Pipeline execution is paused. Use local/emulator mode or wait for quota reset.
          </span>
        </div>
      )}

      {/* 7. Slim Run Top Bar */}
      <div 
        className="px-4 py-2.5 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between gap-4 shrink-0"
        id="psb4_workspace_topbar"
      >
        <div className="flex items-center gap-4 min-w-0">
          {getStatusBadge(effectiveRunStatus)}
          {storageMode === 'local' && (
            <span className="bg-amber-400/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase" id="psb4_local_mode_badge">
              LOCAL MODE
            </span>
          )}
          <div className="font-mono text-[10px] text-white/50 shrink-0 select-text">
            RUN ID: <span className="text-white/80">{run.id.substring(0, 8)}</span> • STARTED: <span className="text-white/80">{new Date(run.createdAt).toLocaleString()}</span>
          </div>

          <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-white/10 shrink-0">
            {PHASES_LIST.map(ph => (
              <div key={ph.id} className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${getPhaseDotStyle(ph.id)}`} />
                <span className={getPhaseTextStyle(ph.id)}>{ph.label}</span>
              </div>
            ))}
          </div>

          {/* Chain Progress or Chain Buttons */}
          {isChaining && chainProgress ? (
            <div className="flex items-center gap-3 flex-1 min-w-0 pl-4 border-l border-white/10">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-amber-300 uppercase tracking-widest">
                  Pass {chainProgress.index}/{chainProgress.total}: {chainProgress.passId}
                </span>
                <span className="text-[10px] font-mono text-white/50 ml-2 truncate">
                  {chainProgress.passName}
                </span>
              </div>
              <button
                onClick={() => { chainAbortRef.current = true; }}
                className="ml-auto shrink-0 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest
                  border border-red-900/40 text-red-400 hover:text-red-300 hover:border-red-600
                  bg-red-950/20 rounded transition"
              >
                STOP
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-4 border-l border-white/10 shrink-0">
              {frontHalfRunnable && (
                <button
                  onClick={() => handleRunChain(FRONT_HALF_PASSES)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-950/40 border border-blue-500/30
                    text-blue-300 hover:bg-blue-900/40 hover:border-blue-400 text-[10px] font-mono
                    uppercase tracking-widest rounded transition"
                  title="Auto-run all Reduction and Arc Lock passes"
                >
                  <span>▶▶</span> Run Front Half
                </button>
              )}
              {frontHalfRunnable && (
                <button
                  onClick={() => handleRunChain([...FRONT_HALF_PASSES, ...BACK_HALF_PASSES], true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-purple-950/40 border border-purple-500/30
                    text-purple-300 hover:bg-purple-900/40 hover:border-purple-400 text-[10px] font-mono
                    uppercase tracking-widest rounded transition"
                  title="Auto-run all passes automatically, skipping the manual authorial notes step"
                >
                  <span>▶▶</span> Run Front & Back
                </button>
              )}
              {backHalfRunnable && (
                <button
                  onClick={() => handleRunChain(BACK_HALF_PASSES)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30
                    text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-400 text-[10px] font-mono
                    uppercase tracking-widest rounded transition"
                  title="Auto-run all Rebuild and Enrichment passes"
                >
                  <span>▶▶</span> Run Back Half
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Storage Mode Toggle conforming to D185 */}
          <div className="flex items-center bg-[#141414] border border-white/10 rounded px-1.5 py-0.5" id="psb4_storage_mode_container">
            <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase mr-2 select-none">
              STORAGE
            </span>
            <button
              onClick={() => {
                const newMode = storageMode === 'local' ? 'cloud' : 'local';
                setStorageMode(newMode);
                setStorageModeState(newMode);
                dispatch({
                  type: 'ADD_TOAST',
                  toast: {
                    id: generateUlid(),
                    type: 'info',
                    message: `Storage mode switched to ${newMode.toUpperCase()}`
                  }
                });
                onRefresh();
              }}
              className={`px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider rounded font-bold transition select-none cursor-pointer ${
                storageMode === 'local'
                  ? 'bg-amber-400 text-[#070707] hover:bg-amber-300'
                  : 'bg-zinc-800 text-white/60 hover:text-white'
              }`}
              id="psb4_storage_mode_toggle_btn"
            >
              {storageMode === 'local' ? 'LOCAL' : 'CLOUD'}
            </button>
          </div>

          <button
            onClick={handleOpenPriorRuns}
            className="flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/80 font-mono uppercase tracking-wider rounded transition"
            id="psb4_prior_runs_btn"
          >
            <History size={10} className="text-amber-400 mr-0.5" /> PRIOR RUNS
          </button>

          {!readOnly && (
            <button
              onClick={handleClearStaleRuns}
              disabled={isClearingStale}
              className="flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/80 font-mono uppercase tracking-wider rounded transition disabled:opacity-50"
              id="psb4_clear_stale_runs_btn"
              title="Force clear stale active runs for this show"
            >
              <Wrench size={10} className="text-red-400 mr-0.5" /> CLEAN STALE RUNS
            </button>
          )}

          {!readOnly && run.status === 'active' && (
            <div className="relative">
              {!showAbandonConfirm ? (
                <button
                  onClick={() => setShowAbandonConfirm(true)}
                  className="px-3 py-1 border border-red-900/30 hover:border-red-600 bg-red-950/25 hover:bg-red-950/40 text-red-400 hover:text-red-300 text-[10px] font-mono uppercase tracking-wider rounded transition"
                  id="workspace_abandon_btn"
                >
                  ABANDON
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-[#120a0c] border border-red-900/40 p-1.5 rounded text-left shadow-lg scale-95 transition-all">
                  <span className="text-[9px] text-white/80 font-mono mr-1">Are you sure?</span>
                  <button
                    disabled={isAbandoning}
                    onClick={handleAbandonClick}
                    className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-mono text-[9px] uppercase rounded"
                    id="workspace_confirm_abandon"
                  >
                    YES
                  </button>
                  <button
                    disabled={isAbandoning}
                    onClick={() => setShowAbandonConfirm(false)}
                    className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white/80 font-mono text-[9px] uppercase rounded"
                  >
                    NO
                  </button>
                </div>
              )}
            </div>
          )}

          {!readOnly && run.status === 'abandoned' && (
            <button
              disabled={isUnabandoning}
              onClick={handleUnabandonClick}
              className="px-3 py-1 border border-amber-500/40 hover:border-amber-500 text-amber-400 hover:text-amber-300 bg-amber-950/20 text-[10px] font-mono uppercase tracking-wider rounded transition disabled:opacity-50"
              id="workspace_unabandon_btn"
            >
              {isUnabandoning ? 'UNABANDONING...' : 'UNABANDON'}
            </button>
          )}
        </div>
      </div>

      {!hasApiKey && run.status === 'active' && !readOnly && (
        <div className="bg-red-950/20 border-b border-red-500/30 px-4 py-2 flex items-start gap-3 text-left shrink-0">
          <AlertTriangle className="text-red-400 w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-[10px] font-bold text-red-300 uppercase tracking-widest font-mono">
              Preflight Warning: Gemini API Key is Missing
            </h4>
            <p className="text-[11px] text-white/70 mt-0.5 leading-relaxed">
              You must provide a Gemini API Key in the application platform settings to execute pipeline runs. Execution is currently disabled.
            </p>
          </div>
        </div>
      )}

      {/* Main Three Pane Layout */}
      {run.status === 'hydrating' ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#070707] px-6 select-text animate-fade-in" id="psb4_hydration_progress_overlay">
          <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-6 font-mono text-left shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Loader2 className="animate-spin text-amber-400 shrink-0" size={16} />
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                Fork Hydration In Progress
              </span>
            </div>
            
            <p className="text-white/70 text-[11px] mb-4 leading-relaxed">
              Copying assets, checkpoints, and pipeline configurations to prevent state loss. This run is copy-isolated from the source run.
            </p>

            <div className="space-y-3" id="hydration_progress_stats">
              <div className="flex justify-between text-[10px] text-white/50">
                <span>STAGE:</span>
                <span className="text-amber-300 font-bold uppercase">{run.hydrationProgress?.stage || 'Initializing...'}</span>
              </div>
              
              <div className="flex justify-between text-[10px] text-white/50">
                <span>COPIED:</span>
                <span className="text-white/90">
                  {run.hydrationProgress?.copied ?? 0} / {run.hydrationProgress?.total ?? 100} units
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-amber-400 h-full transition-all duration-300 ease-out"
                  style={{ 
                    width: `${Math.min(100, Math.max(0, (((run.hydrationProgress?.copied ?? 0) / (run.hydrationProgress?.total ?? 1)) * 100)))}%` 
                  }}
                />
              </div>

              <div className="flex justify-between text-[9px] text-white/40">
                <span>CONCURRENCY CAP:</span>
                <span>MAX 5 IN FLIGHT</span>
              </div>
            </div>
          </div>
        </div>
      ) : loadingWorkspace ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#070707]">
          <Loader2 className="animate-spin text-amber-500 mb-2.5" size={24} />
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest animate-pulse">
            Configuring GN Workspace...
          </span>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0" id="psb4_workspace_panes">
          {/* Left Pane: Navigator */}
          <div className="basis-[22%] shrink-0 border-r border-white/10 overflow-hidden flex flex-col h-full bg-[#090909]">
            <Psb4PassNavigator
              run={run}
              passStatuses={statuses}
              selectedPassId={selectedPassId}
              onSelectPass={(passId) => setSelectedPassId(passId)}
              readOnly={readOnly || !hasApiKey}
              artifacts={artifacts}
              defaultEpisodeIds={defaultEpisodeIds}
              onNotesSaved={() => {
                onRefresh();
                fetchWorkspaceData();
              }}
            />
          </div>

          {/* Middle Pane: Pass Work Area */}
          <div className="flex-1 overflow-hidden flex flex-col h-full bg-[#070707]">
            <Psb4PassWorkArea
              run={run}
              passSpec={activePassSpec}
              artifacts={artifacts}
              passStatus={activePassStatus}
              reason={selectedPassId ? (statuses as any)._details?.[selectedPassId]?.reason : undefined}
              selectedEpisodeId={selectedEpisodeId}
              onEpisodeSelect={(epId) => setSelectedEpisodeId(epId)}
              onRunPass={(spec, force) => handleRunPass(spec, force)}
              onRefresh={handleRefresh}
              readOnly={readOnly || isChaining || !hasApiKey}
              onResetPass={async () => {
                if (!activePassSpec) return;
                try {
                  if (activePassSpec.id === '0.9G') {
                    await resetPass09G(run.id);
                    dispatch({
                      type: 'ADD_TOAST',
                      toast: {
                        id: generateUlid(),
                        type: 'success',
                        message: 'Pass 0.9G has been completely reset.'
                      }
                    });
                  } else {
                    await resetPass09W(run.id);
                    dispatch({
                      type: 'ADD_TOAST',
                      toast: {
                        id: generateUlid(),
                        type: 'success',
                        message: 'Pass 0.9W has been completely reset.'
                      }
                    });
                  }
                  await fetchWorkspaceData();
                  onRefresh();
                } catch (err: any) {
                  dispatch({
                    type: 'ADD_TOAST',
                    toast: {
                      id: generateUlid(),
                      type: 'error',
                      message: err.message || 'Reset failed.'
                    }
                  });
                }
              }}
              onFork={handleForkRun}
            />
          </div>

          {/* Right Pane: Context Inspector & Console */}
          <div className="basis-[26%] shrink-0 border-l border-white/10 overflow-hidden flex flex-col h-full bg-[#090909]">
            <Psb4PassContext
              run={run}
              passSpec={activePassSpec}
              artifacts={artifacts}
              selectedEpisodeId={selectedEpisodeId}
              consoleEntries={consoleEntries}
            />
          </div>
        </div>
      )}

      {/* Run History Drawer */}
      <Psb4RunHistoryDrawer
        isOpen={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        runs={priorRuns}
        onRefresh={() => handleRefresh()}
        onViewRun={(selectedRun) => {
          if (onViewRun) {
            onViewRun(selectedRun);
          }
          setHistoryDrawerOpen(false);
        }}
      />
    </div>
  );
};
