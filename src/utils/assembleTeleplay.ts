import { Show } from '../types/models';
import { resolveLines, resolveCharacter } from '../domainUtils';

/**
 * Statistics container representing high-level text metrics for show production scripts.
 */
export interface TeleplaysStats {
  episodes: number;
  beats: number;
  estimatedWords: number;
  estimatedPages: number;
}

/**
 * Aggregates high-level metrics (episode count, script beats, word estimates, and printable page estimates)
 * across are all nested structural hierarchies in a designated Show.
 *
 * @param {Show} show - The target television or comic show model instance
 * @returns {TeleplaysStats} Summarized script metrics
 */
export const getTeleplaysStats = (show: Show): TeleplaysStats => {
  let episodes = 0;
  let beats = 0;
  let words = 0;

  (show.seasons ?? []).forEach(s => {
    (s.episodes ?? []).forEach(e => {
      episodes++;
      (e.acts ?? []).forEach(a => {
        (a.scenes ?? []).forEach(sc => {
          (sc.cinematicBeats ?? []).forEach(b => {
            beats++;
            words += (b.description || '').split(' ').length;
            resolveLines(b).forEach(l => {
              words += (l.text || '').split(' ').length;
            });
          });
        });
      });
    });
  });

  return {
    episodes,
    beats,
    estimatedWords: words,
    estimatedPages: Math.ceil(words / 250)
  };
};

/**
 * backfillSceneTitles — one-time migration for scenes generated before database schema revision 12.
 * Iterates through all nested scenes. If a scene lacks an explicit string title, derives one from the first
 * clause of its descriptive summary or falls back to a structural index label.
 *
 * @param {Show} show - The target show to migrate
 * @returns {Show["seasons"] | null} Returns a post-migration seasons hierarchy array or null if no edits were required
 */
export const backfillSceneTitles = (show: Show): Show["seasons"] | null => {
  let changed = false;
  const seasons = (show.seasons ?? []).map((s, si) => ({
    ...s,
    episodes: (s.episodes ?? []).map((ep, ei) => ({
      ...ep,
      acts: (ep.acts ?? []).map((act, ai) => ({
        ...act,
        scenes: (act.scenes ?? []).map((sc, scIdx) => {
          if (sc.title) return sc;
          changed = true;
          const derived =
            sc.summary?.split(/[.!?]/)[0]?.trim() || `Scene ${sc.number ?? scIdx + 1}`;
          return { ...sc, title: derived };
        }),
      })),
    })),
  }));
  return changed ? seasons : null;
};

