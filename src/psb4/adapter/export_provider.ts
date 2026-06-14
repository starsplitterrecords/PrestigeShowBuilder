import type { Show } from '../../types/show';

/**
 * Builds the GNDS source payload from the
 * LIVE show passed in. No disk read — callers
 * pass state.currentShow.
 */
export async function getCurrentExportForShow(show: Show | null): Promise<any> {
  if (!show) {
    return null;
  }

  // Get the active season (defaulting to the first season)
  const season = show.seasons?.[0];
  if (!season || !season.episodes || season.episodes.length === 0) {
    return null;
  }

  // Format characters or get details to construct a solid structured payload (Band A/B)
  return {
    season: {
      title: season.description ? `Season ${season.number || 1}: ${season.description.substring(0, 30)}` : `Season ${season.number || 1}`,
      arcSummary: season.description || show.premise || '',
      structureConfig: show.structureConfig || null,
      briefGrid: season.outlineGrid || null
    },
    episodes: season.episodes.map((ep, epIdx) => ({
      id: ep.id,
      index: ep.number || (epIdx + 1),
      title: ep.title || `Episode ${ep.number || (epIdx + 1)}`,
      summary: ep.summary || ep.oneLiner || '',
      scenes: (ep.acts || []).flatMap((act) => 
        (act.scenes || []).map((sc, scIdx) => ({
          id: sc.id,
          index: sc.number || (scIdx + 1),
          heading: sc.title || (sc.setting ? `${sc.isExterior ? 'EXT' : 'INT'}. ${sc.setting.toUpperCase()}` : `SCENE ${sc.number || (scIdx + 1)}`),
          beats: (sc.cinematicBeats || []).map((bt, btIdx) => {
            const linesSource = bt.script?.lines || bt.lines || [];
            return {
              id: bt.id || `${sc.id}_beat_${btIdx}`,
              index: btIdx + 1,
              characterIds: bt.characterIds || [],
              description: bt.description || null,
              lines: linesSource.map((ln) => ({
                characterId: ln.characterHandle || null,
                text: ln.text || '',
                type: 'dialogue'
              }))
            };
          })
        }))
      )
    }))
  };
}
