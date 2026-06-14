import { CinematicBeat, ComicGalleryEntry } from '../types/models';
import { getCanonicalBeatPageStateFromBeat } from './beatPageSelection';
import { hasDialogueContent } from '../domainUtils';

export type PipelineStatus = 'current' | 'stale' | 'missing' | 'locked' | 'na';

export interface PipelineStageStatus {
  id: 'narrative' | 'visuals' | 'script' | 'panels' | 'page' | 'lettering';
  label: string;
  status: PipelineStatus;
  version?: number;
  reason?: string;
}

export function computeBeatPipelineStatuses(
  beat: CinematicBeat,
  gallery: ComicGalleryEntry[]
): PipelineStageStatus[] {
  const isLocked = !!beat.locked;
  const hasDialogue = hasDialogueContent(beat);
  const canon = getCanonicalBeatPageStateFromBeat(beat, gallery);

  return [
    {
      id: 'narrative',
      label: 'Narrative',
      status: isLocked ? 'locked' : (beat.description?.trim() ? 'current' : 'missing'),
    },
    {
      id: 'visuals',
      label: 'Visuals',
      status: isLocked ? 'locked' : (beat.visualsStale ? 'stale' : (beat.visualDescription?.trim() ? 'current' : 'missing')),
      version: beat.visualVersion,
      reason: beat.visualsStaleReason,
    },
    {
      id: 'script',
      label: 'Script',
      status: (() => {
        if (isLocked) return 'locked';
        if (beat.scriptStale) return 'stale';
        if (hasDialogue) return 'current';
        if (beat.beatType === 'TABLEAU') return 'current'; // Tableau has no dialogue rule
        return 'missing';
      })(),
      version: beat.scriptVersion,
      reason: beat.scriptStaleReason,
    },
    {
      id: 'panels',
      label: 'Panels',
      status: isLocked ? 'locked' : (((canon?.panelPlanFreshness || '').toLowerCase() === 'none' || !(canon?.panelPlanFreshness)) ? 'missing' : canon.panelPlanFreshness.toLowerCase() as PipelineStatus),
      version: beat.layoutVersion,
      reason: beat.panelPlanStaleReason,
    },
    {
      id: 'page',
      label: 'Page',
      status: isLocked ? 'locked' : (beat.beatPageStale ? 'stale' : (canon?.beatPageState || '').toLowerCase() as PipelineStatus),
      version: beat.pageVersion,
      reason: beat.beatPageStaleReason,
    },
    {
      id: 'lettering',
      label: 'Lettering',
      status: isLocked ? 'locked' : (beat.letteringStale ? 'stale' : (canon?.letteringState || '').toLowerCase() as PipelineStatus),
      reason: beat.letteringStaleReason,
    }
  ];
}
