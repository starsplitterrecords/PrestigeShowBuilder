
import { Show, CinematicBeat } from '../../types/models';
import { planBeatVisuals } from '../../ai/textGeneration/planBeatVisuals';

export const stagePanelPlans = async (
  liveShowRef: { current: Show },
  beatsToProcess: {
    sIdx: number; eIdx: number; aIdx: number; scIdx: number; bIdx: number; beat: CinematicBeat;
  }[],
  { log, updateStatus, checkCancelled, commit, mode, dispatch }: any
) => {
  for (let i = 0; i < beatsToProcess.length; i++) {
    checkCancelled(i);
    const { sIdx, eIdx, aIdx, scIdx, bIdx, beat } = beatsToProcess[i];

    // Skip if already has panel plans
    if (beat.panelPlans && beat.panelPlans.length > 0) continue;

    log(`AI: Planning panel layouts for ${beat.fid}...`);
    updateStatus(
      `Layout Planning — ${beat.fid} (${i + 1} of ${beatsToProcess.length})`,
      { current: i + 1, total: beatsToProcess.length }
    );

    const scene = liveShowRef.current.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx];
    if (!scene) continue;

    try {
      const { panels, props } = await planBeatVisuals(
        liveShowRef.current,
        beat,
        scene,
        mode,
        undefined,
        dispatch
      );

      if (panels && panels.length > 0) {
        const freshSeasons = structuredClone(liveShowRef.current.seasons);
        const targetBeat = freshSeasons[sIdx].episodes[eIdx].acts[aIdx].scenes[scIdx].cinematicBeats[bIdx];
        if (targetBeat) {
          targetBeat.panelPlans = panels;
          targetBeat.panelProps = props;
          targetBeat.panelPlanSource = 'ai-plan';
          await commit({ seasons: freshSeasons });
        }
      }
      
      await new Promise(r => setTimeout(r, 600));
    } catch (e: any) {
      log(`⚠ Layout Planning failed for ${beat.fid}: ${e.message}`);
    }
  }
};
