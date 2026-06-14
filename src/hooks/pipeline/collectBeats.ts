import { Show, CinematicBeat } from '../../types/models';
import { resolveLines } from '../../domainUtils';
import { GenerationTarget } from '../useProductionPipeline';

export const collectBeats = (show: Show, target: GenerationTarget, sIdx: number) => {
  const result: { eIdx: number; aIdx: number; scIdx: number; bIdx: number; beat: CinematicBeat }[] = [];
  (show.seasons[sIdx]?.episodes ?? []).forEach((ep, eIdx) => {
    if (target.scope === 'episode' && 'eIdx' in target && target.eIdx !== eIdx) return;
    if (target.scope === 'act' && 'eIdx' in target && target.eIdx !== eIdx) return;
    (ep.acts ?? []).forEach((act, aIdx) => {
      if (target.scope === 'act' && 'aIdx' in target && target.aIdx !== aIdx) return;
      (act.scenes ?? []).forEach((scene, scIdx) => {
        if (target.scope === 'scene' && 'aIdx' in target && 'scIdx' in target &&
            (target.aIdx !== aIdx || target.scIdx !== scIdx)) return;
        (scene.cinematicBeats ?? []).forEach((beat, bIdx) => {
          const beatType = beat.beatType ?? 'DIALOGUE';
          if (beatType === 'TABLEAU' || beatType === 'ESTABLISHING' || beatType === 'MEMORY_BLEED') return;
          // D89: check both locations during migration window
          const hasLines = resolveLines(beat).length > 0;
          if (!hasLines) {
            result.push({ eIdx, aIdx, scIdx, bIdx, beat });
          }
        });
      });
    });
  });
  return result;
};

export const collectBeatsWithoutDirection = (show: Show, target: GenerationTarget, sIdx: number) => {
  const result: { eIdx: number; aIdx: number; scIdx: number; bIdx: number; beat: CinematicBeat }[] = [];
  (show.seasons[sIdx]?.episodes ?? []).forEach((ep, eIdx) => {
    if (target.scope === 'episode' && 'eIdx' in target && target.eIdx !== eIdx) return;
    if (target.scope === 'act' && 'eIdx' in target && target.eIdx !== eIdx) return;
    (ep.acts ?? []).forEach((act, aIdx) => {
      if (target.scope === 'act' && 'aIdx' in target && target.aIdx !== aIdx) return;
      (act.scenes ?? []).forEach((scene, scIdx) => {
        if (target.scope === 'scene' && 'aIdx' in target && 'scIdx' in target &&
            (target.aIdx !== aIdx || target.scIdx !== scIdx)) return;
        (scene.cinematicBeats ?? []).forEach((beat, bIdx) => {
          if (!beat.direction) {
            result.push({ eIdx, aIdx, scIdx, bIdx, beat });
          }
        });
      });
    });
  });
  return result;
};
