import { 
  Show, 
  Season, 
  Episode, 
  Act, 
  Scene, 
  CinematicBeat, 
  ComicGalleryEntry, 
  GenerationLogEntry 
} from "../types/models";

export type FidMap = Record<string, string>;

/**
 * Walks the entire seasons hierarchy and updates numbers and FIDs to match current array positions.
 * Updates descendant FIDs recursively.
 * Returns the updated seasons and a map of oldFid -> newFid.
 */
export function renumberEverything(show: Show, seasons: Season[]): { seasons: Season[], fidMap: FidMap } {
  const fidMap: FidMap = {};
  const showCode = show.showCode || "XX";

  seasons.forEach((season, sIdx) => {
    const s1 = sIdx + 1;
    season.number = s1;

    season.episodes.forEach((episode, eIdx) => {
      const e1 = eIdx + 1;
      const oldEpFid = episode.fid;
      episode.number = e1;
      episode.fid = `${showCode}-S${s1}-E${e1}`;
      if (oldEpFid && oldEpFid !== episode.fid) {
        fidMap[oldEpFid] = episode.fid;
      }

      episode.acts.forEach((act, aIdx) => {
        const a1 = aIdx + 1;
        const oldActFid = act.fid;
        act.number = a1;
        act.fid = `${showCode}-S${s1}-E${e1}-A${a1}`;
        if (oldActFid && oldActFid !== act.fid) {
          fidMap[oldActFid] = act.fid;
        }

        act.scenes.forEach((scene, scIdx) => {
          const sc1 = scIdx + 1;
          const oldSceneFid = scene.fid;
          scene.number = sc1;
          scene.fid = `${showCode}-S${s1}-E${e1}-A${a1}-Sc${sc1}`;
          if (oldSceneFid && oldSceneFid !== scene.fid) {
            fidMap[oldSceneFid] = scene.fid;
          }

          scene.cinematicBeats.forEach((beat, bIdx) => {
            const b1 = bIdx + 1;
            const oldBeatFid = beat.fid;
            const newBeatFid = `${showCode}-S${s1}-E${e1}-A${a1}-Sc${sc1}-B${b1}`;
            beat.fid = newBeatFid;
            if (oldBeatFid && oldBeatFid !== newBeatFid) {
              fidMap[oldBeatFid] = newBeatFid;
            }

            // Lines and entries
            if (beat.script?.lines) {
              beat.script.lines.forEach((l, lIdx) => {
                const oldLFid = l.fid;
                const newLFid = `${newBeatFid}-L${lIdx + 1}`;
                l.fid = newLFid;
                if (oldLFid && oldLFid !== newLFid) {
                  fidMap[oldLFid] = newLFid;
                }
              });
            }
            if (beat.script?.entries) {
              beat.script.entries.forEach((en, enIdx) => {
                const oldEnFid = en.fid;
                const newEnFid = `${newBeatFid}-L${enIdx + 1}`;
                en.fid = newEnFid;
                if (oldEnFid && oldEnFid !== newEnFid) {
                  fidMap[oldEnFid] = newEnFid;
                }
              });
            }
          });
        });
      });
    });
  });

  return { seasons, fidMap };
}

/**
 * General remapper that updates all known FID references in a Show object.
 */
export function remapAllRefs(show: Show, fidMap: FidMap): {
  comicGallery: ComicGalleryEntry[];
  generationLog: GenerationLogEntry[];
} {
  const remap = (fid: string | undefined): string | undefined => 
    fid && fidMap[fid] ? fidMap[fid] : fid;

  const newComicGallery = (show.comicGallery ?? []).map(e => {
    const base: ComicGalleryEntry = {
      ...e,
      beatFid: remap(e.beatFid) ?? e.beatFid,
      sceneFid: remap(e.sceneFid) ?? e.sceneFid,
    };

    if (!e.plan) return base;

    const plan = e.plan as any;
    if (Array.isArray(plan.beatFids)) {
      // ScenePagePlan
      return {
        ...base,
        plan: {
          ...plan,
          sceneFid: remap(plan.sceneFid),
          beatFids: plan.beatFids.map((f: string) => remap(f) ?? f),
          panels: Array.isArray(plan.panels)
            ? plan.panels.map((p: any) => ({
                ...p,
                beatFid: remap(p.beatFid) ?? p.beatFid,
              }))
            : plan.panels,
        },
      };
    }

    if (typeof plan.beatFid === 'string') {
      // ComicPagePlan
      return {
        ...base,
        plan: {
          ...plan,
          beatFid: remap(plan.beatFid) ?? plan.beatFid,
        },
      };
    }

    return base;
  });

  const newGenerationLog = (show.generationLog ?? []).map(e => ({
    ...e,
    beatFid: remap(e.beatFid) ?? e.beatFid,
  }));

  return {
    comicGallery: newComicGallery,
    generationLog: newGenerationLog,
  };
}

/**
 * Moves an episode within a season.
 */
export function moveEpisode(
  show: Show,
  sIdx: number,
  idx: number,
  delta: -1 | 1
): { seasons: Season[], comicGallery: ComicGalleryEntry[], generationLog: GenerationLogEntry[] } | null {
  const seasons = structuredClone(show.seasons);
  const episodes = seasons[sIdx].episodes;
  const targetIdx = idx + delta;

  if (targetIdx < 0 || targetIdx >= episodes.length) return null;

  [episodes[idx], episodes[targetIdx]] = [episodes[targetIdx], episodes[idx]];

  const { seasons: updatedSeasons, fidMap } = renumberEverything(show, seasons);
  const refs = remapAllRefs({ ...show, seasons: updatedSeasons }, fidMap);

  return {
    seasons: updatedSeasons,
    comicGallery: refs.comicGallery,
    generationLog: refs.generationLog
  };
}

/**
 * Moves an act within an episode.
 */
export function moveAct(
  show: Show,
  sIdx: number,
  eIdx: number,
  idx: number,
  delta: -1 | 1
): { seasons: Season[], comicGallery: ComicGalleryEntry[], generationLog: GenerationLogEntry[] } | null {
  const seasons = structuredClone(show.seasons);
  const acts = seasons[sIdx].episodes[eIdx].acts;
  const targetIdx = idx + delta;

  if (targetIdx < 0 || targetIdx >= acts.length) return null;

  [acts[idx], acts[targetIdx]] = [acts[targetIdx], acts[idx]];

  const { seasons: updatedSeasons, fidMap } = renumberEverything(show, seasons);
  const refs = remapAllRefs({ ...show, seasons: updatedSeasons }, fidMap);

  return {
    seasons: updatedSeasons,
    comicGallery: refs.comicGallery,
    generationLog: refs.generationLog
  };
}

/**
 * Moves a scene within an act.
 */
export function moveScene(
  show: Show,
  sIdx: number,
  eIdx: number,
  aIdx: number,
  idx: number,
  delta: -1 | 1
): { seasons: Season[], comicGallery: ComicGalleryEntry[], generationLog: GenerationLogEntry[] } | null {
  const seasons = structuredClone(show.seasons);
  const scenes = seasons[sIdx].episodes[eIdx].acts[aIdx].scenes;
  const targetIdx = idx + delta;

  if (targetIdx < 0 || targetIdx >= scenes.length) return null;

  [scenes[idx], scenes[targetIdx]] = [scenes[targetIdx], scenes[idx]];

  const { seasons: updatedSeasons, fidMap } = renumberEverything(show, seasons);
  const refs = remapAllRefs({ ...show, seasons: updatedSeasons }, fidMap);

  return {
    seasons: updatedSeasons,
    comicGallery: refs.comicGallery,
    generationLog: refs.generationLog
  };
}
