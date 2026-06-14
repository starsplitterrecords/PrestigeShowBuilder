import { Show, CinematicBeat } from '../../types/models';
import { GenerationTarget } from '../useProductionPipeline';
import { stageShow } from './stageShow';
import { stageSeason } from './stageSeason';
import { stageEpisode } from './stageEpisode';
import { stageAct } from './stageAct';
import { stageScene } from './stageScene';
import { stageLines } from './stageLines';
import { stagePanelPlans } from './stagePanelPlans';

import { VaultStorage, AssetStorage } from '../../storage';
import { generateBeatDirection } from '../../ai/textGeneration';
import { collectBeats, collectBeatsWithoutDirection } from './collectBeats';
import { appendGenerationLog, appendTextGenerationLog } from '../../apiUtils';

import { resolveTextModel, GenerationMode } from '../../utils/generationMode';
import { planBeatVisuals } from '../../ai/textGeneration/planBeatVisuals';
import { triggerProductionReviewExport } from '../../utils/autoExport';

export type StageContext = {
  log: (msg: string) => void;
  updateStatus: (subTask: string, progress?: { current: number; total: number }) => void;
  checkCancelled: (processedCount?: number) => void;
  commit: (updates: Partial<Show>) => Promise<void>;
  dispatch: any;
  mode: GenerationMode;
  waitForConfirmation: () => Promise<void>;
};

export async function batchDialogueFill(
  show: Show,
  dispatch: any,
  target: GenerationTarget,
  abortRef: { current: { cancelled: boolean } },
  mode: GenerationMode
) {
  const initialShow = show;
  if (!initialShow) return;

  if (initialShow.depthConfig.lines !== true) {
    dispatch({ type: 'ADD_TOAST', toast: {
      id: Math.random().toString(),
      type: 'warning',
      message: 'Enable "Auto-generate Lines" in Depth Settings first.'
    }});
    return;
  }

  dispatch({ type: 'PIPELINE_START', task: 'BATCH DIALOGUE FILL' });
  const liveShowRef = { current: structuredClone(initialShow) as Show };

  const log = (msg: string) => dispatch({ type: 'PIPELINE_LOG', log: msg });
  const updateStatus = (subTask: string, progress?: { current: number; total: number }) => {
    dispatch({ type: 'PIPELINE_UPDATE', subTask, progress });
  };

  const commit = async (updates: Partial<Show>) => {
    liveShowRef.current = { ...liveShowRef.current, ...updates };
    dispatch({ type: 'UPDATE_SHOW', updates });
    try {
      // D265: Intermediate saves are local-only
      await VaultStorage.saveOne(liveShowRef.current, false);
    } catch (err: any) {
      log(`⚠ Checkpoint save failed: ${err.message}. Progress is in memory.`);
    }
  };

  // isCancelled and its comment removed entirely.
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
    mode,
    waitForConfirmation: async () => {}
  };

  try {
    const sIdx = 'sIdx' in target ? target.sIdx : 0;
    const beatsToProcess = collectBeats(liveShowRef.current, target, sIdx);

    if (beatsToProcess.length > 0) {
      log(`AI: Batch dialogue fill — ${beatsToProcess.length} beats without lines.`);
      await stageLines(liveShowRef, beatsToProcess, false, { ...stageContext, sIdx, isBatchFill: true });
    }

    try {
      // D265: Force cloud sync at end of batch
      await VaultStorage.saveOne(liveShowRef.current, true);
      log("✓ Pipeline: Final save complete.");
    } catch (err: any) {
      log(`⚠ Pipeline: Final save failed — ${err.message}`);
      dispatch({ type: 'ADD_TOAST', toast: {
        id: `save-error-${Date.now()}`, type: 'error',
        message: 'Pipeline complete but final save failed. Check storage quota.' } });
    }
    dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Batch dialogue fill finished.' });
    log("✓ Pipeline: Batch dialogue fill complete.");

  } catch (err: any) {
    try {
      // D265: Final sync even on error
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
      log(`Error: ${err.message || 'Unknown error'}`);
      dispatch({ type: 'PIPELINE_END', task: 'ERROR', subTask: err.message });
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: `Batch Fill Error: ${err.message}` } });
    }
  }
}

export async function stageDirections(
  show: Show,
  dispatch: any,
  target: GenerationTarget,
  abortRef: { current: { cancelled: boolean } },
  mode: GenerationMode
) {
  const initialShow = show;
  if (!initialShow) return;

  dispatch({ type: 'PIPELINE_START', task: 'DIRECTION FILL' });
  const liveShowRef = { current: structuredClone(initialShow) as Show };

  const log = (msg: string) => dispatch({ type: 'PIPELINE_LOG', log: msg });
  const updateStatus = (subTask: string, progress?: { current: number; total: number }) => {
    dispatch({ type: 'PIPELINE_UPDATE', subTask, progress });
  };

  const commit = async (updates: Partial<Show>) => {
    liveShowRef.current = { ...liveShowRef.current, ...updates };
    dispatch({ type: 'UPDATE_SHOW', updates });
    try {
      // D265: Intermediate saves are local-only
      await VaultStorage.saveOne(liveShowRef.current, false);
    } catch (err: any) {
      log(`⚠ Checkpoint save failed: ${err.message}. Progress is in memory.`);
    }
  };

  // isCancelled removed entirely.
  const checkCancelled = (processedCount?: number) => {
    if (abortRef.current.cancelled) {
      const err = new Error('Cancelled by user.');
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
    mode,
    waitForConfirmation: async () => {}
  };

  try {
    const sIdx = 'sIdx' in target ? target.sIdx : 0;
    const beatsToProcess = collectBeatsWithoutDirection(liveShowRef.current, target, sIdx);

    if (beatsToProcess.length === 0) {
      dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'All beats already have direction notes.' });
      log('✓ All beats already have direction notes — nothing to fill.');
      return;
    }

    log(`AI: Filling direction for ${beatsToProcess.length} beats...`);

    for (let i = 0; i < beatsToProcess.length; i++) {
      checkCancelled(i);
      const { eIdx, aIdx, scIdx, bIdx, beat } = beatsToProcess[i];

      updateStatus(
        `Direction Fill (${i + 1}/${beatsToProcess.length})`,
        { current: i + 1, total: beatsToProcess.length }
      );

      const scene = liveShowRef.current.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx];
      const sceneBeats = scene?.cinematicBeats ?? [];

      const direction = await generateBeatDirection(
        liveShowRef.current,
        beat,
        { beatIndex: bIdx, totalBeats: sceneBeats.length },
        stageContext.mode,
        (log) => {
          appendTextGenerationLog(dispatch, liveShowRef.current, {
            generator: 'generateBeatDirection',
            targetFid: beat.fid,
            ...log
          });
        }
      ).catch(() => null);

      if (direction) {
        const seasons = structuredClone(liveShowRef.current.seasons);
        seasons[sIdx].episodes[eIdx].acts[aIdx].scenes[scIdx].cinematicBeats[bIdx].direction = direction;
        await commit({ seasons });
      }

      await new Promise(resolve => setTimeout(resolve, 400));
    }

    try {
      // D265: Big push at end
      await VaultStorage.saveOne(liveShowRef.current, true);
      log("✓ Pipeline: Final save complete.");
    } catch (err: any) {
      log(`⚠ Pipeline: Final save failed — ${err.message}`);
      dispatch({ type: 'ADD_TOAST', toast: {
        id: `save-error-${Date.now()}`, type: 'error',
        message: 'Pipeline complete but final save failed. Check storage quota.' } });
    }
    dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Direction fill complete.' });
    log('✓ Pipeline: Direction fill complete.');
    dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: `Direction notes filled for ${beatsToProcess.length} beats.` } });

  } catch (err: any) {
    try {
      // D265: Sync even on error
      await VaultStorage.saveOne(liveShowRef.current, true);
    } catch (saveErr: any) {
      log(`⚠ Pipeline: Final save failed — ${saveErr.message}`);
    }
    if (err.message === 'Cancelled by user.') {
      const count = err.processedCount || 0;
      dispatch({ type: 'PIPELINE_END', task: 'CANCELLED', subTask: 'User stopped execution.' });
      log('⚠ Pipeline cancelled by user.');
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: `Stopped after ${count} beats.` } });
    } else {
      log(`Error: ${err.message || 'Unknown error'}`);
      dispatch({ type: 'PIPELINE_END', task: 'ERROR', subTask: err.message });
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: `Direction fill failed: ${err.message}` } });
    }
  }
}

export async function runBeatScope(
  liveShowRef: { current: Show },
  target: Extract<GenerationTarget, { scope: 'beat' }>,
  ctx: StageContext
) {
  const { sIdx, eIdx, aIdx, scIdx, bIdx } = target;
  ctx.dispatch({ type: 'PIPELINE_START', task: 'REGENERATE BEAT' });
  try {
    // Save existing beats
    const existingBeats = liveShowRef.current
      .seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx]?.cinematicBeats || [];
    
    // Regenerate all beats for the scene
    await stageScene(liveShowRef, sIdx, eIdx, aIdx, scIdx, true, ctx);
    
    // Restore all beats except the target one
    const newBeats = liveShowRef.current
      .seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx]?.cinematicBeats || [];
      
    const mergedBeats = [...existingBeats];
    if (newBeats[bIdx]) {
      mergedBeats[bIdx] = newBeats[bIdx];
    }
    
    const seasons = structuredClone(liveShowRef.current.seasons);
    seasons[sIdx].episodes[eIdx].acts[aIdx].scenes[scIdx].cinematicBeats = mergedBeats;
    await ctx.commit({ seasons });
    
    ctx.dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Beat regenerated.' });
  } catch (err: any) {
    ctx.dispatch({ type: 'PIPELINE_END', task: 'ERROR', subTask: err.message });
  }
}

export async function runScriptScope(
  liveShowRef: { current: Show },
  target: Extract<GenerationTarget, { scope: 'script' }>,
  ctx: StageContext
) {
  const { sIdx, eIdx, aIdx, scIdx, bIdx } = target;
  ctx.dispatch({ type: 'PIPELINE_START', task: 'GENERATE SCRIPT LINES' });
  try {
    const beat = liveShowRef.current
      .seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx]?.cinematicBeats[bIdx];
    if (!beat) throw new Error('Beat not found');

    await stageLines(
      liveShowRef,
      [{ eIdx, aIdx, scIdx, bIdx, beat }],
      true,  // forceRedraft = true (user explicitly requested new script)
      { ...ctx, sIdx, isBatchFill: true }
    );
    ctx.dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Script lines generated.' });
  } catch (err: any) {
    ctx.dispatch({ type: 'PIPELINE_END', task: 'ERROR', subTask: err.message });
  }
}

type ScopeLevel = "show"|"season"|"episode"|"act"|"scene"|"beat";

/**
 * Returns the list of index tuples to process at a given hierarchy level,
 * given the current generation target and scope.
 *
 * Returns empty array if the target scope does not include this level.
 */
function collectScopedNodes(
  level: ScopeLevel,
  target: GenerationTarget,
  show: Show
): Array<{ sIdx: number; eIdx?: number; aIdx?: number; scIdx?: number }> {
  const SCOPE_ORDER: ScopeLevel[] =
    ["show","season","episode","act","scene","beat"];
  const levelIdx = SCOPE_ORDER.indexOf(level);
  const targetIdx = SCOPE_ORDER.indexOf(target.scope as any);
  
  // If target scope is narrower than level, we don't process this level
  // e.g. if level is 'episode' and target is 'scene', we skip the episode staging loop
  if (targetIdx !== -1 && targetIdx > levelIdx) return [];

  const sIdx = "sIdx" in target ? (target as any).sIdx : 0;
  const seasons = show.seasons ?? [];

  if (level === "episode") {
    const nodes = target.scope === "episode" ? [{ sIdx, eIdx: (target as any).eIdx }] : (seasons[sIdx]?.episodes ?? []).map((_, eIdx) => ({ sIdx, eIdx }));
    return show.isInitialSequence ? nodes.slice(0, 1) : nodes;
  }
  if (level === "act") {
    let nodes = [];
    if (target.scope === "act") {
      nodes = [{ sIdx, eIdx: (target as any).eIdx, aIdx: (target as any).aIdx }];
    } else if (target.scope === "episode") {
      nodes = (seasons[sIdx]?.episodes[(target as any).eIdx]?.acts ?? []).map((_, aIdx) =>
        ({ sIdx, eIdx: (target as any).eIdx, aIdx }));
    } else {
      nodes = seasons[sIdx]?.episodes.flatMap((ep, eIdx) =>
        (ep.acts ?? []).map((_, aIdx) => ({ sIdx, eIdx, aIdx }))) ?? [];
    }
    return show.isInitialSequence ? nodes.slice(0, 1) : nodes;
  }
  if (level === "scene") {
    let nodes = [];
    if (target.scope === "scene") {
      nodes = [{ sIdx, eIdx: (target as any).eIdx, aIdx: (target as any).aIdx, scIdx: (target as any).scIdx }];
    } else if (target.scope === "act") {
      nodes = (seasons[sIdx]?.episodes[(target as any).eIdx]?.acts[(target as any).aIdx]?.scenes ?? [])
        .map((_, scIdx) => ({ sIdx, eIdx: (target as any).eIdx, aIdx: (target as any).aIdx, scIdx }));
    } else if (target.scope === "episode") {
      nodes = (seasons[sIdx]?.episodes[(target as any).eIdx]?.acts ?? []).flatMap((act, aIdx) =>
        (act.scenes ?? []).map((_, scIdx) =>
          ({ sIdx, eIdx: (target as any).eIdx, aIdx, scIdx })));
    } else {
      nodes = seasons[sIdx]?.episodes.flatMap((ep, eIdx) =>
        (ep.acts ?? []).flatMap((act, aIdx) =>
          (act.scenes ?? []).map((_, scIdx) =>
            ({ sIdx, eIdx, aIdx, scIdx })))) ?? [];
    }
    return show.isInitialSequence ? nodes.slice(0, 1) : nodes;
  }
  return [];
}

export async function runHierarchyScope(
  liveShowRef: { current: Show },
  target: GenerationTarget,
  forceRedraft: boolean,
  ctx: StageContext
) {
  const { log, updateStatus, checkCancelled, commit, dispatch } = ctx;

  const sIdx = "sIdx" in target ? target.sIdx : 0;

  // ... nuke & rebuild + stageShow + stageSeason (unchanged) ...
  log(`AI: Initializing pipeline for [${liveShowRef.current.name}] (Scope: ${target.scope})`);
  await new Promise(resolve => setTimeout(resolve, 500));

  if (forceRedraft && target.scope === 'show') {
    log("AI: Nuke & Rebuild initiated. Clearing existing hierarchy...");
    liveShowRef.current.seasons = [];
    liveShowRef.current.characters = [];
    liveShowRef.current.draftVersion += 1;
    await commit({ seasons: [], characters: [], draftVersion: liveShowRef.current.draftVersion });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // --- SCOPE: SHOW ---
  if (target.scope === 'show') {
    await stageShow(liveShowRef, forceRedraft, ctx);
  }

  // --- SCOPE: SEASON ---
  if (['show', 'season'].includes(target.scope)) {
    const sIdx = target.scope === 'season' ? target.sIdx : 0;
    await stageSeason(liveShowRef, sIdx, forceRedraft, ctx);
  }

  for (const { eIdx } of collectScopedNodes("episode", target, liveShowRef.current)) {
    checkCancelled(0);
    await stageEpisode(liveShowRef, sIdx, eIdx!,
      target.scope === "episode" && forceRedraft, ctx);
  }

  for (const { eIdx, aIdx } of collectScopedNodes("act", target, liveShowRef.current)) {
    checkCancelled(0);
    await stageAct(liveShowRef, sIdx, eIdx!, aIdx!,
      target.scope === "act" && forceRedraft, ctx);
  }

  for (const { eIdx, aIdx, scIdx } of collectScopedNodes("scene", target, liveShowRef.current)) {
    checkCancelled(0);
    await stageScene(liveShowRef, sIdx, eIdx!, aIdx!, scIdx!, forceRedraft, ctx);
  }

  if (liveShowRef.current.isInitialSequence) {
    log("AI: Initial hierarchy generated. Preparating production review document...");
    triggerProductionReviewExport(liveShowRef.current);
    dispatch({ type: 'ADD_TOAST', toast: {
      id: `initial-export-${Date.now()}`, type: 'success',
      message: 'Production Review Document exported for your review.'
    }});
    
    // Clear flag so subsequent runs don't pause
    await commit({ isInitialSequence: false });
    
    log("AI: PAUSE triggered for initial review. Please confirm to continue with dialogue pass.");
    await ctx.waitForConfirmation();
    log("✓ Confirmation received. Continuing pipeline...");
  }

  if (liveShowRef.current.depthConfig.lines === true) {
    const sIdx = 'sIdx' in target ? target.sIdx : 0;
    const beatsToProcess = collectBeats(liveShowRef.current, target, sIdx);
    if (beatsToProcess.length > 0) {
      // Announce phase change -- clears stale "Sequencing Beats" HUD text
      updateStatus(
        `Dialogue Fill -- 0 of ${beatsToProcess.length} beats`,
        { current: 0, total: beatsToProcess.length }
      );
      log(`AI: Structure complete. Starting dialogue fill for ${beatsToProcess.length} beats...`);
      await new Promise(r => setTimeout(r, 400));
      await stageLines(liveShowRef, beatsToProcess, false, { ...ctx, sIdx, isBatchFill: true });
    } else {
      log('AI: All beats already have lines — skipping dialogue pass.');
    }
  }
}
