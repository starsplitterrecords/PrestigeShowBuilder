import { DetectionResult } from '../types';

/**
 * Detects format and band of the PSB3 export payload.
 * Runs deterministic pattern matching on the export payload.
 * 
 * Band A: Beats and scenes present, all character IDs in beats match the show roster.
 * Band B: Beats and scenes present, some character IDs do not match the roster directly (aliases or stale).
 * Band C: Episode-level structure/prose exists, scene markers like INT./EXT. are found.
 * Band D: Pure prose without scene headings or structure.
 */
export function detectBandAndFormat(
  payload: any,
  canonicalCharacterIds: string[]
): DetectionResult {
  let data: any = payload;
  let isParsed = false;

  // Try parsing if it is a string
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload);
      isParsed = true;
    } catch {
      // Not a valid JSON string, treat as raw prose
      return {
        exportFormat: 'psb3-prose',
        detectedBand: 'D'
      };
    }
  } else if (payload && typeof payload === 'object') {
    isParsed = true;
  }

  if (!isParsed || !data) {
    return {
      exportFormat: 'unknown',
      detectedBand: 'D'
    };
  }

  const episodes = Array.isArray(data.episodes) ? data.episodes : [];
  
  // Look for beat arrays inside episodes
  let hasBeats = false;
  let allCharacterIdsMatch = true;
  let hasCharactersChecked = false;

  const charIdSet = new Set(canonicalCharacterIds);

  for (const ep of episodes) {
    const scenes = Array.isArray(ep.scenes) ? ep.scenes : [];
    for (const sc of scenes) {
      const beats = Array.isArray(sc.beats) ? sc.beats : [];
      if (beats.length > 0) {
        hasBeats = true;
      }
      for (const beat of beats) {
        const beatCharIds = Array.isArray(beat.characterIds) ? beat.characterIds : [];
        for (const cid of beatCharIds) {
          hasCharactersChecked = true;
          if (!charIdSet.has(cid)) {
            allCharacterIdsMatch = false;
          }
        }
        // Check line-level characterId too
        const lines = Array.isArray(beat.lines) ? beat.lines : [];
        for (const line of lines) {
          if (line.characterId) {
            hasCharactersChecked = true;
            if (!charIdSet.has(line.characterId)) {
              allCharacterIdsMatch = false;
            }
          }
        }
      }
    }
  }

  if (hasBeats) {
    // If we have characters in the beats but some didn't match canonical list, it's Band B.
    // Otherwise, if all matched, it's Band A.
    const band = (hasCharactersChecked && !allCharacterIdsMatch) ? 'B' : 'A';
    return {
      exportFormat: 'psb3-internal-v1',
      detectedBand: band
    };
  }

  // No beats found. Check for scene markers "INT." or "EXT." or custom scenes in prose or head
  let containsSceneMarkers = false;

  // Inspect episode prose/headings
  for (const ep of episodes) {
    // Check if there are scene arrays with headings e.g. "INT. LIVING ROOM"
    const scenes = Array.isArray(ep.scenes) ? ep.scenes : [];
    if (scenes.some((sc: { heading?: string }) => sc.heading && (/INT\./i.test(sc.heading) || /EXT\./i.test(sc.heading)))) {
      containsSceneMarkers = true;
      break;
    }

    const rawProse = ep.rawProse || ep.prose || '';
    if (typeof rawProse === 'string') {
      if (/INT\./i.test(rawProse) || /EXT\./i.test(rawProse) || /INT\s*\//i.test(rawProse) || /EXT\s*\//i.test(rawProse)) {
        containsSceneMarkers = true;
        break;
      }
    }
  }

  // Also check if root has properties typical of structured export but empty beats
  if (data.season || episodes.length > 0) {
    return {
      exportFormat: 'psb3-internal-v1',
      detectedBand: containsSceneMarkers ? 'C' : 'D'
    };
  }

  return {
    exportFormat: 'psb3-prose',
    detectedBand: containsSceneMarkers ? 'C' : 'D'
  };
}
