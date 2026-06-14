import { useCallback, useRef } from 'react';
import { useStore } from '../StoreContext';
import { Show } from '../types/models';
import { VaultStorage } from '../storage';
import {
  runBeatScope, runScriptScope,
  runHierarchyScope, batchDialogueFill, stageDirections
} from './pipeline/runScopes';

export type GenerationTarget =
  | { scope: 'show' }
  | { scope: 'season'; sIdx: number }
  | { scope: 'episode'; sIdx: number; eIdx: number }
  | { scope: 'act'; sIdx: number; eIdx: number; aIdx: number }
  | { scope: 'scene'; sIdx: number; eIdx: number; aIdx: number; scIdx: number }
  | { scope: 'beat';   sIdx: number; eIdx: number; aIdx: number; scIdx: number; bIdx: number }
  | { scope: 'script'; sIdx: number; eIdx: number; aIdx: number; scIdx: number; bIdx: number };

export const useProductionPipeline = () => {
  const { state, dispatch } = useStore();
  const showRef = useRef(state.currentShow);
  showRef.current = state.currentShow;
  
  const pipelineRef = useRef(state.pipeline);
  pipelineRef.current = state.pipeline;
  
  const abortRef = useRef<{ cancelled: boolean; aborted: boolean }>({ cancelled: false, aborted: false });

  const log = useCallback((msg: string) => {
    dispatch({ type: 'PIPELINE_LOG', log: msg });
  }, [dispatch]);

  const updateStatus = useCallback((subTask: string, progress?: { current: number; total: number }) => {
    dispatch({ type: 'PIPELINE_UPDATE', subTask, progress });
  }, [dispatch]);

  const cancel = useCallback(() => {
    abortRef.current.cancelled = true;
  }, []);

  const confirm = useCallback(() => {
    dispatch({ type: 'PIPELINE_CONFIRM' });
  }, [dispatch]);

  const abortNow = useCallback(() => {
    abortRef.current.cancelled = true;
    abortRef.current.aborted = true;
    dispatch({ type: 'PIPELINE_END', task: 'ABORTED', subTask: 'Immediate termination requested.' });
    dispatch({ type: 'ADD_TOAST', toast: { id: 'abort-' + Date.now(), type: 'error', message: 'Pipeline Aborted Immediately.' } });
  }, [dispatch]);

  const run = useCallback(async (target: GenerationTarget, forceRedraft: boolean = false) => {
    if (state.pipeline.isRunning) {
      console.warn("Pipeline already running. Request ignored.");
      return;
    }
    abortRef.current.cancelled = false;
    abortRef.current.aborted = false;
    
    const initialShow = showRef.current;
    if (!initialShow) {
      console.error("Pipeline Exit: state.currentShow is NULL.");
      return;
    }

    const taskName = target.scope === 'show' ? (forceRedraft ? 'FULL REDRAFT' : 'SMART FILL') : `GENERATE ${target.scope.toUpperCase()}`;
    dispatch({ type: 'PIPELINE_START', task: taskName });

    const liveShowRef = { current: structuredClone(initialShow) as Show };

    const commit = async (updates: Partial<Show>) => {
      liveShowRef.current = { ...liveShowRef.current, ...updates };
      dispatch({ type: 'UPDATE_SHOW', updates });
      try {
        // D265: Intermediate saves are local-only (forceCloud: false).
        // Coalescing happens by calling saveOne(..., true) at the end of the pipeline.
        await VaultStorage.saveOne(liveShowRef.current, false);
      } catch (err: any) {
        log(`⚠ Checkpoint save failed: ${err.message}. Progress is in memory.`);
      }
    };

    const checkCancelled = (processedCount?: number) => {
      if (abortRef.current.cancelled) {
        const err = new Error("Cancelled by user.");
        (err as any).processedCount = processedCount;
        throw err;
      }
    };

    const stageContext = { 
      log, 
      updateStatus, 
      checkCancelled, 
      commit, 
      dispatch,
      mode: state.generationMode,
      waitForConfirmation: async () => {
        dispatch({ 
          type: 'PIPELINE_UPDATE', 
          subTask: 'AWAITING APPROVAL: Production Review Exported.',
          pendingConfirmation: true 
        } as any);
        
        while (pipelineRef.current.pendingConfirmation) {
          await new Promise(r => setTimeout(r, 500));
          if (abortRef.current.cancelled) throw new Error("Cancelled by user.");
        }
      }
    };

    try {
      // === BOTTOM-LAYER SCOPES (D83) ===
      // These handle beat/script/comic without touching structure above.
      if (target.scope === 'beat') {
        await runBeatScope(liveShowRef, target, stageContext);
        return;
      }
      if (target.scope === 'script') {
        await runScriptScope(liveShowRef, target, stageContext);
        return;
      }
      // === END BOTTOM-LAYER SCOPES ===

      // === HIERARCHY SCOPES (D130) ===
      await runHierarchyScope(liveShowRef, target, forceRedraft, stageContext);
      // === END HIERARCHY SCOPES ===

      try {
        // D265: One final "Big Push" to cloud at the end of the pipeline.
        await VaultStorage.saveOne(liveShowRef.current, true);
        log("✓ Pipeline: Final save complete.");
      } catch (err: any) {
        log(`⚠ Pipeline: Final save failed — ${err.message}`);
        dispatch({ type: 'ADD_TOAST', toast: {
          id: `save-error-${Date.now()}`, type: 'error',
          message: 'Pipeline complete but final save failed. Check storage quota.' } });
      }
      dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Generation finished successfully.' });
      log("✓ Pipeline: Execution complete.");
    } catch (err: any) {
      try {
        // D265: Force cloud write even on error to preserve partial progress.
        await VaultStorage.saveOne(liveShowRef.current, true);
      } catch (saveErr: any) {
        log(`⚠ Pipeline: Final save failed — ${saveErr.message}`);
      }
      if (err.message === "Cancelled by user.") {
        const count = err.processedCount || 0;
        dispatch({ type: 'PIPELINE_END', task: 'CANCELLED', subTask: 'User stopped execution.' });
        log("⚠ Pipeline cancelled by user.");
        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: `Stopped after ${count} beats.` } });
      } else {
        if (abortRef.current.aborted) return; // Already handled by abortNow
        log(`Error: ${err.message || 'Unknown error'}`);
        dispatch({ type: 'PIPELINE_END', task: 'ERROR', subTask: err.message });
        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: `Pipeline Error: ${err.message}` } });
      }
    }
  }, [state.currentShow, state.pipeline.isRunning, dispatch, log, updateStatus]);

  const nukeAndRebuild = useCallback(async (target: GenerationTarget) => {
    if (state.pipeline.isRunning) return;
    const show = showRef.current;
    if (!show) return;

    const seasons = structuredClone(show.seasons);
    const sIdx = 'sIdx' in target ? target.sIdx : 0;

    if (target.scope === 'show') {
      // D260: wipe production but preserve bible.
      // Each season has episodes cleared and description cleared so stageSeason regenerates
      // from a clean arc state, but the bible-level fields
      // (characters, themes, narrativeMechanism, etc.) are preserved on the show object.
      seasons.forEach(s => {
        s.episodes = [];
        s.description = '';
      });
      dispatch({ 
        type: 'UPDATE_SHOW', 
        updates: { 
          seasons,
          // Wipe gallery too — these refer to beat FIDs that no longer exist after redraft.
          comicGallery: [] 
        } 
      });
    } else if (target.scope === 'season') {
      if (seasons[sIdx]) {
        seasons[sIdx].episodes = [];
        seasons[sIdx].description = '';
      }
      dispatch({ type: 'UPDATE_SHOW', updates: { seasons } });
    } else if (target.scope === 'episode') {
      const ep = seasons[sIdx]?.episodes[target.eIdx];
      if (ep) {
        ep.acts = [];
        ep.summary = '';
      }
      dispatch({ type: 'UPDATE_SHOW', updates: { seasons } });
    } else if (target.scope === 'act') {
      const ep = seasons[sIdx]?.episodes[target.eIdx];
      const act = ep?.acts[target.aIdx];
      if (act) {
        act.scenes = [];
        act.summary = '';
      }
      if (ep) {
        ep.summary = '';
      }
      dispatch({ type: 'UPDATE_SHOW', updates: { seasons } });
    } else if (target.scope === 'scene') {
      const act = seasons[sIdx]?.episodes[target.eIdx]?.acts[target.aIdx];
      const sc = act?.scenes[target.scIdx];
      if (sc) {
        sc.cinematicBeats = [];
        sc.summary = '';
        sc.dramaticWant = '';
      }
      if (act) {
        act.summary = '';
      }
      dispatch({ type: 'UPDATE_SHOW', updates: { seasons } });
    }
    // 'beat' scope: no pre-wipe needed —
    // stageScene forceRedraft replaces beats array

    await new Promise(r => setTimeout(r, 200));
    run(target, false);
  }, [state.currentShow, state.pipeline.isRunning, dispatch, run]);

  const resetSeason = useCallback(async (sIdx: number = 0) => {
    if (state.pipeline.isRunning) return;
    const show = showRef.current;
    if (!show) return;

    const seasons = structuredClone(show.seasons);
    if (!seasons[sIdx]) return;

    seasons[sIdx] = {
      ...seasons[sIdx],
      episodes: [],
      description: '',
      characterArcLanes: [],
      episodePairings: [],
      characterPhilosophies: [],
    };

    dispatch({ type: 'UPDATE_SHOW', updates: { seasons } });
    
    // We wait for the state update to propagate so that when run() 
    // captures showRef.current, it sees the empty season state.
    // D252: using a slightly longer delay and explicit redraft.
    await new Promise(r => setTimeout(r, 400));
    run({ scope: 'season', sIdx }, true);
  }, [state.pipeline.isRunning, dispatch, run]);

  const runBatchDialogueFill = useCallback(async (target: GenerationTarget) => {
    if (state.pipeline.isRunning) return;
    const show = showRef.current;
    if (!show) return;
    abortRef.current.cancelled = false;
    abortRef.current.aborted = false;
    await batchDialogueFill(show, dispatch, target, abortRef, state.generationMode);
  }, [state.pipeline.isRunning, state.generationMode, dispatch]);

  const runStageDirections = useCallback(async (target: GenerationTarget) => {
    if (state.pipeline.isRunning) return;
    const show = showRef.current;
    if (!show) return;
    abortRef.current.cancelled = false;
    abortRef.current.aborted = false;
    await stageDirections(show, dispatch, target, abortRef, state.generationMode);
  }, [state.pipeline.isRunning, state.generationMode, dispatch]);

  return {
    run,
    cancel,
    confirm,
    abortNow,
    nukeAndRebuild,
    runBatchDialogueFill,
    runStageDirections,
    resetSeason,
    ...state.pipeline
  };
};
