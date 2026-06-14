import { Show } from '../types/models';

export const sanitizeShow = (show: Show): Show => ({
  ...show,
  characters: show.characters ?? [],
  seasons: (show.seasons ?? []).map(season => ({
    ...season,
    episodes: (season.episodes ?? []).map(ep => ({
      ...ep,
      acts: (ep.acts ?? []).map(act => ({
        ...act,
        scenes: (act.scenes ?? []).map(scene => ({
          ...scene,
          cinematicBeats: (scene.cinematicBeats ?? []).map(beat => ({
            ...beat,
            script: beat.script ?? { lines: beat.lines ?? [] },
            lines: beat.lines ?? [],
            characterIds: beat.characterIds ?? [],
          }))
        }))
      }))
    }))
  }))
});
