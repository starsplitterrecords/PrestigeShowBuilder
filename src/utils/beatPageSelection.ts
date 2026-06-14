import { Show, CinematicBeat, ComicGalleryEntry } from '../types/models';

export type CanonicalBeatPageState = {
  beatPageState: 'MISSING' | 'CURRENT' | 'STALE';
  letteringState: 'MISSING' | 'CURRENT' | 'STALE';
  panelPlanSource: 'AI' | 'HEURISTIC' | 'NONE';
  panelPlanFreshness: 'CURRENT' | 'STALE' | 'NONE';
  latestEntry?: ComicGalleryEntry;
  letteredEntry?: ComicGalleryEntry;
  refinedEntry?: ComicGalleryEntry;
  baseEntry?: ComicGalleryEntry;
};

/**
 * D118: Internal helper to find a beat by FID within a show.
 */
function findBeat(show: Show, beatFid: string): CinematicBeat | undefined {
  for (const season of show.seasons) {
    for (const ep of season.episodes) {
      for (const act of ep.acts) {
        for (const scene of act.scenes) {
          const beat = scene.cinematicBeats.find(b => b.fid === beatFid);
          if (beat) return beat;
        }
      }
    }
  }
  return undefined;
}

/**
 * D218: Shared helper to resolve the authoritative "canonical" state of a beat's comic output.
 * Used by both the UI and the Production Review export to ensure consistency.
 * 
 * Logic:
 * 1. Collect all non-archived gallery entries for the beat.
 * 2. Identify the latest version family (linage).
 * 3. Within that family, find base, lettered, and refined variants.
 * 4. Compare against current beat versions to determine freshness.
 */
export function getCanonicalBeatPageState(show: Show, beatFid: string): CanonicalBeatPageState {
  const beat = findBeat(show, beatFid);
  return getCanonicalBeatPageStateFromBeat(beat, show.comicGallery || [], beatFid);
}

export function getCanonicalBeatPageStateFromBeat(
  beat: CinematicBeat | undefined, 
  gallery: ComicGalleryEntry[],
  beatFidFallback?: string
): CanonicalBeatPageState {
  const beatFid = beat?.fid || beatFidFallback || '';
  
  // 1. collect all comicGallery entries for the beat, ignore archived
  // D240: Explicit chronological sort — newest first
  const beatEntries = gallery
    .filter(e => e.beatFid === beatFid && e.status !== 'archived')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  // panelPlanSource: AI | HEURISTIC | NONE
  const planSourceRaw = beat?.panelPlanSource;
  const panelPlanSource: 'AI' | 'HEURISTIC' | 'NONE' = 
    planSourceRaw === 'ai-plan' ? 'AI' : 
    (planSourceRaw === 'heuristic-plan' ? 'HEURISTIC' : 'NONE');

  // panelPlanFreshness: CURRENT | STALE | NONE
  const panelPlanFreshness: 'CURRENT' | 'STALE' | 'NONE' = 
    beat?.panelPlanStale ? 'STALE' : 
    (beat?.panelPlans && beat.panelPlans.length > 0 ? 'CURRENT' : 'NONE');

  if (beatEntries.length === 0) {
    return {
      beatPageState: 'MISSING',
      letteringState: 'MISSING',
      panelPlanSource,
      panelPlanFreshness,
    };
  }

  // 2. group by versionFamilyId where present, prefer the latest family
  // The first entry in the filtered list is the newest generation (based on unshift logic in useBeatGeneration)
  const latestEntry = beatEntries[0];
  const familyId = latestEntry.versionFamilyId;

  const familyEntries = familyId 
    ? beatEntries.filter(e => e.versionFamilyId === familyId)
    : [latestEntry];

  // 3. identify: canonical base entry, lettered entry, refined entry
  let baseEntry = familyEntries.find(e => e.variantType === 'base');
  const letteredEntry = familyEntries.find(e => e.variantType === 'lettered');
  const refinedEntry = familyEntries.find(e => e.variantType === 'refined');

  // D219: Fallback — if no variantType === 'base' exists, use any non-lettered, non-refined entry
  if (!baseEntry) {
    baseEntry = familyEntries.find(e => 
      e.variantType !== 'lettered' && 
      e.variantType !== 'refined' &&
      (e.generationMethod === 'beat-page' || e.generationMethod === 'scene-page' || e.generationMethod === 'single-panel' || e.generationMethod === 'uploaded')
    );
  }

  // D219: Force Re-Letter path — if baseEntry is still null, check archived entries
  // This handles legacy data where the base was archived during lettering.
  if (!baseEntry && letteredEntry?.sourceAssetId) {
    baseEntry = gallery.find(e => e.assetId === letteredEntry.sourceAssetId);
  }

  // 4. return canonical states
  
  // beatPageState: MISSING | CURRENT | STALE
  // If we have entries but no base entry, it's still "MISSING" in terms of the primary artifact
  const beatPageState: 'MISSING' | 'CURRENT' | 'STALE' = 
    !baseEntry ? 'MISSING' : (beat?.beatPageStale ? 'STALE' : 'CURRENT');

  // letteringState: MISSING | CURRENT | STALE
  const getLetteringState = (): 'MISSING' | 'CURRENT' | 'STALE' => {
    if (!letteredEntry) return 'MISSING';
    const isStale = beat && (
      letteredEntry.sourcePageVersion !== beat.pageVersion ||
      letteredEntry.sourceLayoutVersion !== beat.layoutVersion ||
      letteredEntry.sourceVisualVersion !== beat.visualVersion ||
      letteredEntry.sourceScriptVersion !== beat.scriptVersion
    );
    return isStale ? 'STALE' : 'CURRENT';
  };
  const letteringState = getLetteringState();

  return {
    beatPageState,
    letteringState,
    panelPlanSource,
    panelPlanFreshness,
    latestEntry,
    letteredEntry,
    refinedEntry,
    baseEntry
  };
}
