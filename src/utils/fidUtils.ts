import { Show } from '../types/models';

/**
 * FID GENERATOR (Functional ID)
 * Technical: Creates a deterministic path string for a beat based on its hierarchy.
 * Format: [CODE]-S[#]-E[#]-A[#]-Sc[#]-B[#]
 */
export const generateFunctionalId = (
  showCode: string, 
  sIdx: number, 
  eIdx: number, 
  aIdx: number, 
  scIdx: number, 
  bIdx: number
) => {
  const prefix = showCode || 'XX';
  return `${prefix}-S${sIdx + 1}-E${eIdx + 1}-A${aIdx + 1}-Sc${scIdx + 1}-B${bIdx + 1}`;
};

/**
 * LINE FID GENERATOR
 */
export const generateLineFid = (
  beatFid: string,
  lineIdx: number
): string => {
  return `${beatFid}-L${lineIdx + 1}`;
};

/**
 * rewriteFids — D95
 * Applies a positional shift to beat fids and all cross-references.
 * insertedAt* and affectedLevel control which fids shift.
 *
 * FID format: SHOW-S{s}-E{e}-A{a}-Sc{sc}-B{b}  (all 1-indexed)
 *
 * Scene insert/delete: only Sc component shifts for beats in the same S/E/A.
 * Act insert/delete:   only A component shifts for beats in the same S/E.
 * Episode insert/delete: only E component shifts for beats in the same S.
 *
 * delta = +1 for insert, -1 for delete.
 * threshold = the 1-based index at or after which to apply the shift.
 *   Insert before position N: threshold = N (shift N and everything after)
 *   Delete position N: threshold = N+1 (shift everything after N)
 */
export type FidRewriteRule = {
  level: "scene" | "act" | "episode" | "beat";
  sIdx: number;   // 0-based season index
  eIdx?: number;  // 0-based episode index (required for scene, act, beat)
  aIdx?: number;  // 0-based act index (required for scene, beat)
  scIdx?: number; // 0-based scene index (required for beat)
  threshold: number;  // 1-based position at which shift begins
  delta: 1 | -1;
};

export function rewriteFids(show: Show, rule: FidRewriteRule): Show {
  const { level, sIdx, eIdx, aIdx, scIdx, threshold, delta } = rule;
  const s1 = sIdx + 1;
  const e1 = eIdx !== undefined ? eIdx + 1 : null;
  const a1 = aIdx !== undefined ? aIdx + 1 : null;
  const sc1 = scIdx !== undefined ? scIdx + 1 : null;

  // Rewrite a single fid string if it matches the rule
  function shiftFid(fid: string): string {
    if (!fid || fid.includes("COVER") || fid.includes("CHAR") || fid.includes("FREETEXT")) return fid;
    const m = fid.match(/^([^-]+)-S(\d+)-E(\d+)-A(\d+)-Sc(\d+)-B(\d+)(?:-L(\d+))?$/);
    if (!m) return fid;
    let [, showCode, fs, fe, fa, fsc, fb, fl] = m;
    let ns = +fs, ne = +fe, na = +fa, nsc = +fsc, nb = +fb;

    if (ns !== s1) return fid;  // different season — no change

    if (level === "episode") {
      if (ne >= threshold) ne += delta;
    } else if (level === "act") {
      if (ne !== e1) return fid;
      if (na >= threshold) na += delta;
    } else if (level === "scene") {
      if (ne !== e1 || na !== a1) return fid;
      if (nsc >= threshold) nsc += delta;
    } else { // beat
      if (ne !== e1 || na !== a1 || nsc !== sc1) return fid;
      if (nb >= threshold) nb += delta;
    }
    return `${showCode}-S${ns}-E${ne}-A${na}-Sc${nsc}-B${nb}${fl ? `-L${fl}` : ''}`;
  }

  // Rewrite a sceneFid (first 5 components of beatFid)
  function shiftSceneFid(sfid: string): string {
    if (!sfid || sfid.includes("COVER") || sfid.includes("CHAR")) return sfid;
    // Derive by shifting a fake beat fid and stripping the B component
    const fake = shiftFid(sfid + "-B1");
    return fake.replace(/-B1$/, "");
  }

  // Rewrite seasons (beat.fid and beat.script.lines[].fid)
  const newSeasons = (show.seasons || []).map(season => ({
    ...season,
    episodes: (season.episodes || []).map(ep => ({
      ...ep,
      acts: (ep.acts || []).map(act => ({
        ...act,
        scenes: (act.scenes || []).map(sc => ({
          ...sc,
          cinematicBeats: (sc.cinematicBeats || []).map(beat => ({
            ...beat,
            fid: shiftFid(beat.fid),
            script: beat.script ? {
              ...beat.script,
              lines: (beat.script.lines || [])?.map(l => ({
                ...l,
                fid: shiftFid(l.fid)
              })) || [],
              entries: (beat.script.entries || [])?.map(e => ({
                ...e,
                fid: shiftFid(e.fid)
              })) || [],
            } : beat.script,
            lines: (beat.lines ?? []).map(l => ({
              ...l,
              fid: shiftFid(l.fid)
            }))
          }))
        }))
      }))
    }))
  }));

  // Rewrite cross-reference collections
  const newComicGallery = (show.comicGallery ?? []).map(e => {
    // Rewrite the top-level cross-reference fields
    const base = {
      ...e,
      beatFid: shiftFid(e.beatFid),
      sceneFid: e.sceneFid ? shiftSceneFid(e.sceneFid) : e.sceneFid,
    };

    // Rewrite nested plan FIDs if a plan is present
    if (!e.plan) return base;

    const plan = e.plan;

    // ScenePagePlan: has beatFids[] array and panels[].beatFid
    // Distinguish by presence of beatFids array
    if (Array.isArray(plan.beatFids)) {
      return {
        ...base,
        plan: {
          ...plan,
          sceneFid: plan.sceneFid ? shiftSceneFid(plan.sceneFid) : plan.sceneFid,
          beatFids: (plan.beatFids as string[]).map(shiftFid),
          panels: Array.isArray(plan.panels)
            ? plan.panels.map((p: any) => ({
                ...p,
                beatFid: p.beatFid ? shiftFid(p.beatFid) : p.beatFid,
              }))
            : plan.panels,
        },
      };
    }

    // ComicPagePlan: has a single beatFid string
    // Distinguish by presence of beatFid string (not array)
    if (typeof plan.beatFid === 'string') {
      return {
        ...base,
        plan: {
          ...plan,
          beatFid: shiftFid(plan.beatFid),
        },
      };
    }

    // Unknown plan shape — return base without touching plan
    return base;
  });

  const newGenerationLog = (show.generationLog ?? []).map(e => ({
    ...e,
    beatFid: shiftFid(e.beatFid),
  }));

  return {
    ...show,
    seasons: newSeasons,
    comicGallery: newComicGallery,
    generationLog: newGenerationLog,
  };
}

export function findBeatPath(show: Show, beatFid: string) {
  if (!beatFid) return null;
  for (let sIdx = 0; sIdx < (show.seasons || []).length; sIdx++) {
    const season = show.seasons[sIdx];
    for (let eIdx = 0; eIdx < (season.episodes || []).length; eIdx++) {
      const episode = season.episodes[eIdx];
      for (let aIdx = 0; aIdx < (episode.acts || []).length; aIdx++) {
        const act = episode.acts[aIdx];
        for (let scIdx = 0; scIdx < (act.scenes || []).length; scIdx++) {
          const scene = act.scenes[scIdx];
          for (let bIdx = 0; bIdx < (scene.cinematicBeats || []).length; bIdx++) {
            const beat = scene.cinematicBeats[bIdx];
            if (beat.fid === beatFid) {
              return { seasonIdx: sIdx, episodeIdx: eIdx, actIdx: aIdx, sceneIdx: scIdx, beatIdx: bIdx };
            }
          }
        }
      }
    }
  }
  return null;
}
