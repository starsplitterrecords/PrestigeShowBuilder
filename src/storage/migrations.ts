import { Show } from "../types/models";

/**
 * Show migrations applied during read or save to keep older
 * Show records compatible with the current schema.
 *
 * Extracted from VaultStorage.ts in D281 (F5A pass 1).
 * Pure functions; idempotent; safe to call multiple times.
 */

function migrateGalleryCreatedAt(
  entries: any[] | undefined,
  baseTimestamp: number
): any[] {
  if (!entries) return [];
  return entries.map((e, idx) => {
    if (e.createdAt != null) return e;
    // Synthesize: earlier in array = higher createdAt.
    // Subtract index seconds from baseTimestamp so order is preserved.
    return { ...e, createdAt: baseTimestamp - idx * 1000 };
  });
}

function migrateScenePageMethod(entries: any[]): any[] {
  return entries.map(e => {
    // Heuristic: if method is "script" AND it has a
    // ScenePagePlan-shaped plan, it is a scene-page entry
    // under the old naming.
    const plan = e.plan as any;
    const looksLikeScenePage = plan
      && (Array.isArray(plan.beatFids)
          || Array.isArray(plan.panels));
    if (e.generationMethod === 'script' && looksLikeScenePage) {
      return {
        ...e,
        generationMethod: 'scene-page',
        baseGenerationMethod:
          e.baseGenerationMethod ?? 'scene-page',
        variantType: e.variantType ?? 'base',
      };
    }
    return e;
  });
}

export function migrateShowInPlace(show: Show) {
  const baseTime = show.lastModified ?? Date.now();

  // 1. Scene-page normalization BEFORE timestamping
  //    so new props are included
  if (show.comicGallery) {
    show.comicGallery = migrateScenePageMethod(show.comicGallery);
  }

  // 2. Timestamps
  if (show.comicGallery) {
    show.comicGallery = migrateGalleryCreatedAt(
      show.comicGallery, baseTime);
  }

  // 3. New production model arrays (DA-002)
  if (!show.issues)           show.issues = [];
  if (!show.productionPages)  show.productionPages = [];
  if (!show.issueManifests)   show.issueManifests = [];
  if (!show.imageVersions)    show.imageVersions = [];
  if (!show.promotionRecords) show.promotionRecords = [];
}

export function migrateShow(show: any): Show {
  // 1. Ensure basic collections exist
  if (!show.characters)    show.characters    = [];
  if (!show.comicGallery)  show.comicGallery  = [];
  if (!show.generationLog) show.generationLog = [];
  if (!show.lockedReferences)  show.lockedReferences  = [];
  if (!show.settingAnchors)    show.settingAnchors    = [];
  if (!show.writingRules) show.writingRules = { dialogueRules: [], blockingRules: [], structureRules: [], craftNotes: [] };
  
  if (!show.issues)           show.issues = [];
  if (!show.productionPages)  show.productionPages = [];
  if (!show.issueManifests)   show.issueManifests = [];
  if (!show.imageVersions)    show.imageVersions = [];
  if (!show.promotionRecords) show.promotionRecords = [];
  
  // 2. depthConfig — must exist for UI components
  if (!show.depthConfig) {
    show.depthConfig = { lines: true };
  }
  
  // 3. structureConfig — defaults for old shows
  if (!show.structureConfig) {
    show.structureConfig = {
      episodesPerSeason: 1,
      actsPerEpisode: 1,
      scenesPerAct: 1,
      beatsPerScene: 5,
    };
  }
  
  // 4. comicStyle — update outdated provider defaults
  if (!show.comicStyle || show.comicStyle.provider === 'fal-ai') {
    show.comicStyle = {
      artistStyle: show.comicStyle?.artistStyle || '',
      negativePrompt: show.comicStyle?.negativePrompt || '',
      compositionPrompt: show.comicStyle?.compositionPrompt || '',
    };
  }
  
  // 5. styleConfig — ensure exists
  if (!show.styleConfig) {
    show.styleConfig = {
      positivePrompt: '',
      negativePrompt: '',
      compositionPrompt: '',
    };
  }
  
  // 6. Seasons/episodes hierarchy and FIDs
  if (!show.seasons) show.seasons = [];
  show.seasons.forEach((season: any, sIdx: number) => {
    if (!season.episodes) season.episodes = [];
    if (!season.characterPhilosophies) season.characterPhilosophies = [];
    if (!season.characterArcLanes)     season.characterArcLanes     = [];
    if (!season.episodePairings)       season.episodePairings       = [];
    season.episodes.forEach((episode: any, eIdx: number) => {
      if (!episode.fid) episode.fid = show.showCode + "-S" + (season.number || sIdx + 1) + "-E" + (episode.number || eIdx + 1);
      if (!episode.acts) episode.acts = [];
      episode.acts.forEach((act: any, aIdx: number) => {
        if (!act.fid) act.fid = show.showCode + "-S" + (season.number || sIdx + 1) + "-E" + (episode.number || eIdx + 1) + "-A" + (act.number || aIdx + 1);
        if (!act.scenes) act.scenes = [];
        act.scenes.forEach((scene: any, scIdx: number) => {
          if (!scene.fid) scene.fid = show.showCode + "-S" + (season.number || sIdx + 1) + "-E" + (episode.number || eIdx + 1)
            + "-A" + (act.number || aIdx + 1) + "-Sc" + (scene.number || scIdx + 1);
          if (!scene.cinematicBeats) scene.cinematicBeats = [];
          scene.cinematicBeats.forEach((beat: any) => {
            if (!beat.script) {
              beat.script = {
                lines: beat.lines || [],
                entries: []
              };
            }
            if (!beat.characterIds) beat.characterIds = [];
          });
        });
      });
    });
  });
  
  // 7. generationMethod backfill
  show.comicGallery = (show.comicGallery || []).map((entry: any) => ({
    ...entry,
    generationMethod: entry.generationMethod || 'visual',
  }));

  // 8. Backfill IssuePageAssignment from existing comicGallery entries
  if (!show.issuePageAssignments) {
    show.issuePageAssignments = [];
  }

  const existingAssignments = new Set(
    show.issuePageAssignments.map((a: any) => `${a.issueId}_${a.pageNumber}`)
  );

  (show.comicGallery || []).forEach((entry: any) => {
    if (entry.issueId && entry.pageNumber !== undefined && entry.status !== 'archived') {
      const key = `${entry.issueId}_${entry.pageNumber}`;
      if (!existingAssignments.has(key)) {
        let seasonId: string | undefined;
        let episodeId: string | undefined;
        let actId: string | undefined;
        let sceneId: string | undefined;
        
        if (entry.beatFid && show.seasons) {
          outerLoop: for (const season of show.seasons) {
            for (const episode of season.episodes) {
              for (const act of episode.acts) {
                for (const scene of act.scenes) {
                  const hasBeat = (scene.cinematicBeats || []).some((b: any) => b.fid === entry.beatFid);
                  if (hasBeat) {
                    seasonId = season.id;
                    episodeId = episode.id;
                    actId = act.id;
                    sceneId = scene.id;
                    break outerLoop;
                  }
                }
              }
            }
          }
        }

        let assignmentStatus: 'planned' | 'generated' | 'approved' | 'lettered' | 'exported' = 'generated';
        if (entry.status === 'approved') {
          assignmentStatus = 'approved';
        } else if (entry.variantType === 'lettered') {
          assignmentStatus = 'lettered';
        }

        show.issuePageAssignments.push({
          id: `${entry.issueId}_${entry.pageNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          showId: show.id,
          issueId: entry.issueId,
          pageNumber: entry.pageNumber,
          isCover: entry.isCover || false,
          seasonId,
          episodeId,
          actId,
          sceneId,
          beatFid: entry.beatFid,
          galleryEntryId: entry.assetId,
          assetId: entry.assetId,
          status: assignmentStatus,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        existingAssignments.add(key);
      }
    }
  });
  
  return show as Show;
}
