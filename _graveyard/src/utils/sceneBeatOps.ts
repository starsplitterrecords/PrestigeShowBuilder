import type { 
  Show, 
  Scene, 
  CinematicBeat,
  ComicGalleryEntry, 
  GenerationLogEntry 
} from "../types/models";

export interface ScenePath {
  seasonIdx: number;
  episodeIdx: number;
  actIdx: number;
  sceneIdx: number;
}

export type FidMap = Record<string, string>;

/**
 * Internal helper to locate a scene by index-path.
 */
function getSceneAt(show: Show, path: ScenePath): Scene | null {
  return (
    show.seasons?.[path.seasonIdx]
      ?.episodes?.[path.episodeIdx]
      ?.acts?.[path.actIdx]
      ?.scenes?.[path.sceneIdx] ?? null
  );
}

/**
 * Generates a beat FID matching the app's standard format:
 * {showCode}-S{season#}-E{ep#}-A{act#}-Sc{scene#}-B{beatIdx+1}
 */
function makeBeatFid(show: Show, path: ScenePath, beatIdx: number): string {
  const season = show.seasons[path.seasonIdx];
  const episode = season?.episodes[path.episodeIdx];
  const act = episode?.acts[path.actIdx];
  const scene = act?.scenes[path.sceneIdx];

  if (!season || !episode || !act || !scene) return "";

  return `${show.showCode}-S${season.number}-E${episode.number}-A${act.number}-Sc${scene.number}-B${beatIdx + 1}`;
}

/**
 * Rewrite FIDs for all beats in a scene to match their current array position.
 * Returns updated beats array AND a fidMap describing the {oldFid: newFid} changes.
 */
export function renumberSceneBeatFids(
  show: Show, 
  path: ScenePath
): { updatedBeats: CinematicBeat[]; fidMap: FidMap } | null {
  const scene = getSceneAt(show, path);
  if (!scene) return null;

  const fidMap: FidMap = {};
  const updatedBeats = scene.cinematicBeats.map((beat, i) => {
    const newFid = makeBeatFid(show, path, i);
    if (beat.fid !== newFid) {
      fidMap[beat.fid] = newFid;
    }
    return { ...beat, fid: newFid };
  });

  return { updatedBeats, fidMap };
}

/**
 * Walk galleries and generationLog and update any beatFid references per the fidMap.
 * Also handles sceneFid if provided (for parking).
 */
export function updateBeatRefsAfterFidShift(
  show: Show, 
  fidMap: FidMap,
  sceneFidMap?: Record<string, string> // Optional: maps beatFid to NEW sceneFid (used for parking)
): { 
  comicGallery: ComicGalleryEntry[];
  generationLog: GenerationLogEntry[];
} {
  const remapBeatFid = (fid: string | undefined): string | undefined => 
    fid && fidMap[fid] ? fidMap[fid] : fid;

  const getSceneFid = (beatFid: string | undefined): string | undefined => {
    if (!beatFid) return undefined;
    if (sceneFidMap?.[beatFid]) return sceneFidMap[beatFid];
    // Otherwise, we just update the FID if it shifted in place
    const newBeatFid = remapBeatFid(beatFid);
    if (!newBeatFid) return undefined;
    return newBeatFid.split('-').slice(0, 5).join('-');
  };

  const comicGallery: ComicGalleryEntry[] = (show.comicGallery ?? []).map(e => ({
    ...e,
    beatFid: remapBeatFid(e.beatFid)!,
    sceneFid: getSceneFid(e.beatFid)!,
  }));

  const generationLog: GenerationLogEntry[] = (show.generationLog ?? []).map(e => ({
    ...e,
    beatFid: remapBeatFid(e.beatFid)!,
  }));

  return { comicGallery, generationLog };
}

/**
 * Remove a beat from a scene. Renumbers remaining beats.
 * REMOVES references that pointed to the deleted beat.
 */
export function deleteBeat(
  show: Show, 
  path: ScenePath, 
  deleteIdx: number
): {
  seasons: Show["seasons"];
  comicGallery: ComicGalleryEntry[];
  generationLog: GenerationLogEntry[];
} | null {
  const scene = getSceneAt(show, path);
  if (!scene) return null;
  if (deleteIdx < 0 || deleteIdx >= scene.cinematicBeats.length) return null;

  const deletedFid = scene.cinematicBeats[deleteIdx].fid;

  // Clone seasons
  const seasons = structuredClone(show.seasons);
  const newScene = seasons[path.seasonIdx]
    .episodes[path.episodeIdx]
    .acts[path.actIdx]
    .scenes[path.sceneIdx];
  
  newScene.cinematicBeats.splice(deleteIdx, 1);

  // Renumber remaining beats
  const stagedShow: Show = { ...show, seasons };
  const renumber = renumberSceneBeatFids(stagedShow, path);
  if (renumber) {
    newScene.cinematicBeats = renumber.updatedBeats;
  }

  const fidMap = renumber?.fidMap || {};
  const remapBeatFid = (fid: string | undefined): string | undefined => 
    fid && fidMap[fid] ? fidMap[fid] : fid;

  const comicGallery: ComicGalleryEntry[] = (show.comicGallery ?? [])
    .filter(e => e.beatFid !== deletedFid)
    .map(e => ({ 
      ...e, 
      beatFid: remapBeatFid(e.beatFid)!, 
      sceneFid: remapBeatFid(e.beatFid)!.split('-').slice(0, 5).join('-') 
    }));

  const generationLog: GenerationLogEntry[] = (show.generationLog ?? [])
    .filter(e => e.beatFid !== deletedFid)
    .map(e => ({ ...e, beatFid: remapBeatFid(e.beatFid)! }));

  return { seasons, comicGallery, generationLog };
}

/**
 * Insert a new beat at a specific index. Renumbers and remaps.
 */
export function insertBeat(
  show: Show,
  path: ScenePath,
  insertAtIdx: number,
  partial?: Partial<CinematicBeat>
): {
  seasons: Show["seasons"];
  comicGallery: ComicGalleryEntry[];
  generationLog: GenerationLogEntry[];
} | null {
  const scene = getSceneAt(show, path);
  if (!scene) return null;
  if (insertAtIdx < 0 || insertAtIdx > scene.cinematicBeats.length) return null;

  const seasons = structuredClone(show.seasons);
  const newScene = seasons[path.seasonIdx]
    .episodes[path.episodeIdx]
    .acts[path.actIdx]
    .scenes[path.sceneIdx];

  const newBeat: CinematicBeat = {
    id: Math.random().toString(36).substring(2, 9),
    fid: "", // Assigned by renumber
    description: "New Beat",
    visualDescription: "Medium Shot, Natural Lighting",
    subtext: "",
    characterIds: [],
    script: { lines: [] },
    ...partial,
  };

  newScene.cinematicBeats.splice(insertAtIdx, 0, newBeat);

  const stagedShow: Show = { ...show, seasons };
  const renumber = renumberSceneBeatFids(stagedShow, path);
  if (renumber) {
    newScene.cinematicBeats = renumber.updatedBeats;
  }

  const refs = updateBeatRefsAfterFidShift(stagedShow, renumber?.fidMap || {});

  return {
    seasons,
    comicGallery: refs.comicGallery,
    generationLog: refs.generationLog
  };
}

/**
 * Swap two beats. renumbers and remaps.
 */
export function moveBeat(
  show: Show, 
  path: ScenePath,
  idx: number, 
  delta: -1 | 1
): {
  seasons: Show["seasons"];
  comicGallery: ComicGalleryEntry[];
  generationLog: GenerationLogEntry[];
} | null {
  const scene = getSceneAt(show, path);
  if (!scene) return null;

  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= scene.cinematicBeats.length) return null;

  const seasons = structuredClone(show.seasons);
  const newScene = seasons[path.seasonIdx]
    .episodes[path.episodeIdx]
    .acts[path.actIdx]
    .scenes[path.sceneIdx];

  const beats = newScene.cinematicBeats;
  [beats[idx], beats[targetIdx]] = [beats[targetIdx], beats[idx]];

  const stagedShow: Show = { ...show, seasons };
  const renumber = renumberSceneBeatFids(stagedShow, path);
  if (renumber) {
    newScene.cinematicBeats = renumber.updatedBeats;
  }

  const refs = updateBeatRefsAfterFidShift(stagedShow, renumber?.fidMap || {});

  return {
    seasons,
    comicGallery: refs.comicGallery,
    generationLog: refs.generationLog
  };
}

/**
 * Park a beat at the very end of the show.
 */
export function parkBeatAtEndOfShow(
  show: Show, 
  sourcePath: ScenePath, 
  parkIdx: number
): {
  seasons: Show["seasons"];
  comicGallery: ComicGalleryEntry[];
  generationLog: GenerationLogEntry[];
} | null {
  const sourceScene = getSceneAt(show, sourcePath);
  if (!sourceScene) return null;
  if (parkIdx < 0 || parkIdx >= sourceScene.cinematicBeats.length) return null;

  const beat = sourceScene.cinematicBeats[parkIdx];
  const oldFid = beat.fid;

  const seasons = structuredClone(show.seasons);

  // Remove from source
  const sourceSceneClone = seasons[sourcePath.seasonIdx]
    .episodes[sourcePath.episodeIdx]
    .acts[sourcePath.actIdx]
    .scenes[sourcePath.sceneIdx];
  sourceSceneClone.cinematicBeats.splice(parkIdx, 1);

  // Find destination (last scene)
  const lastSIdx = seasons.length - 1;
  const lastEIdx = seasons[lastSIdx].episodes.length - 1;
  const lastAIdx = seasons[lastSIdx].episodes[lastEIdx].acts.length - 1;
  const lastScIdx = seasons[lastSIdx].episodes[lastEIdx].acts[lastAIdx].scenes.length - 1;
  
  const lastScene = seasons[lastSIdx].episodes[lastEIdx].acts[lastAIdx].scenes[lastScIdx];

  // Append
  lastScene.cinematicBeats.push({ ...beat, fid: "" });

  const stagedShow: Show = { ...show, seasons };
  
  // Renumber source scene
  const sourceRenumber = renumberSceneBeatFids(stagedShow, sourcePath);
  if (sourceRenumber) {
    sourceSceneClone.cinematicBeats = sourceRenumber.updatedBeats;
  }

  // Renumber destination scene
  const destPath: ScenePath = {
    seasonIdx: lastSIdx,
    episodeIdx: lastEIdx,
    actIdx: lastAIdx,
    sceneIdx: lastScIdx
  };
  const destRenumber = renumberSceneBeatFids(stagedShow, destPath);
  if (destRenumber) {
    lastScene.cinematicBeats = destRenumber.updatedBeats;
  }

  // Identify new FID for the parked beat
  const parkedNewFid = lastScene.cinematicBeats[lastScene.cinematicBeats.length - 1].fid;
  const newSceneFid = parkedNewFid.split('-').slice(0, 5).join('-');

  const combinedFidMap: FidMap = {
    ...(sourceRenumber?.fidMap || {}),
    ...(destRenumber?.fidMap || {}),
    [oldFid]: parkedNewFid
  };

  const sceneFidMap: Record<string, string> = {
    [oldFid]: newSceneFid
  };

  const refs = updateBeatRefsAfterFidShift(stagedShow, combinedFidMap, sceneFidMap);

  return {
    seasons,
    comicGallery: refs.comicGallery,
    generationLog: refs.generationLog
  };
}

export function markSceneBeatsStale(beats: CinematicBeat[]): CinematicBeat[] {
  return beats.map(b => ({ ...b, contentStale: true }));
}

export function clearSceneBeatStaleFlags(beats: CinematicBeat[]): CinematicBeat[] {
  return beats.map(b => ({ ...b, contentStale: false }));
}
