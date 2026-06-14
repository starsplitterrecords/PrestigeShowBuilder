import { Show } from '../types/models';
import { resolveLines, resolveCharacter } from '../domainUtils';
import { getCanonicalBeatPageState } from './beatPageSelection';

export interface BeatGapStatus {
  bIdx: number;
  fid: string;
  hasLines: boolean;
  hasComic: boolean;
  hasVisualDescription: boolean;
  lineCount: number;
  // D318 Preflight Audit
  hasPortraits: boolean;
  missingPortraitNames?: string[];
  hasPanelPlan: boolean;
  hasSettingRef: boolean;
  hasPriorPage: boolean;
}

export interface SceneGapReport {
  aIdx: number;
  scIdx: number;
  fid: string; // added
  title: string;
  hasBeats: boolean;
  beatCount: number;
  beatsWithLines: number;
  beatsWithComic: number;
  beats: BeatGapStatus[];
  status: 'empty' | 'partial' | 'complete';
}

export interface EpisodeGapReport {
  sIdx: number;
  eIdx: number;
  seasonNum: number;
  episodeNum: number;
  title: string;
  hasActs: boolean;
  hasScenes: boolean;
  hasBeats: boolean;
  hasDialogue: boolean;
  beatCount: number;
  lineCount: number;
  beatsWithLines: number;
  beatsWithComic: number;
  scenes: SceneGapReport[];
  status: 'empty' | 'partial' | 'complete';
}

export const computeGapReport = (show: Show): EpisodeGapReport[] => {
  const report: EpisodeGapReport[] = [];
  (show.seasons ?? []).forEach((s, sIdx) => {
    (s.episodes ?? []).forEach((ep, eIdx) => {
      const hasActs = (ep.acts ?? []).length > 0;
      let hasScenes = false, hasBeats = false, hasDialogue = false;
      let beatCount = 0, lineCount = 0, beatsWithLines = 0, beatsWithComic = 0;
      const sceneReports: SceneGapReport[] = [];

      (ep.acts ?? []).forEach((act, aIdx) => {
        if ((act.scenes ?? []).length > 0) hasScenes = true;
        (act.scenes ?? []).forEach((sc, scIdx) => {
          const beatStatuses: BeatGapStatus[] = [];
          let sceneBeatCount = 0, sceneBeatsWithLines = 0, sceneBeatsWithComic = 0;

          if ((sc.cinematicBeats ?? []).length > 0) hasBeats = true;

          const sceneFid = sc.fid || `S${sIdx+1}-E${eIdx+1}-A${aIdx+1}-Sc${scIdx+1}`;

          (sc.cinematicBeats ?? []).forEach((b, bIdx) => {
            beatCount++;
            sceneBeatCount++;
            const lines = resolveLines(b);
            const bHasLines = lines.length > 0;
            const canon = getCanonicalBeatPageState(show, b.fid);
            const bHasComic = canon.beatPageState !== 'MISSING';
            const bHasVisualDescription = !!b.visualDescription?.trim();
            if (bHasLines) { hasDialogue = true; lineCount += lines.length; beatsWithLines++; sceneBeatsWithLines++; }
            if (bHasComic) { beatsWithComic++; sceneBeatsWithComic++; }

            // D318 Preflight Audit
            const charIds = b.characterIds ?? [];
            const missingNames: string[] = [];
            charIds.forEach(cid => {
              const char = resolveCharacter(show, cid);
              if (!char || !(char.portraitAssetId ?? char.visualAnchorAssetId)) {
                missingNames.push(char?.name || cid);
              }
            });

            const hasPortraits = charIds.length > 0 && missingNames.length === 0;
            const hasPanelPlan = (b.panelPlans ?? []).length > 0;
            const hasSettingRef = !!sc.settingAnchorId && (show.lockedReferences ?? []).some(r => r.active && r.linkedSettingId === sc.settingAnchorId);
            const hasPriorPage = (show.comicGallery ?? []).some(e => e.sceneFid === sceneFid && e.status === 'approved' && e.pageIndex !== undefined && e.pageIndex < bIdx);

            beatStatuses.push({ 
              bIdx, 
              fid: b.fid, 
              hasLines: bHasLines, 
              hasComic: bHasComic, 
              hasVisualDescription: bHasVisualDescription, 
              lineCount: lines.length,
              hasPortraits,
              missingPortraitNames: missingNames.length > 0 ? missingNames : undefined,
              hasPanelPlan,
              hasSettingRef,
              hasPriorPage
            });
          });

          let sceneStatus: 'empty' | 'partial' | 'complete' = 'empty';
          if (sceneBeatCount > 0) {
            if (sceneBeatsWithLines === sceneBeatCount) sceneStatus = 'complete';
            else if (sceneBeatsWithLines > 0) sceneStatus = 'partial';
          }

          sceneReports.push({
            aIdx,
            scIdx,
            fid: sceneFid,
            title: sc.title || `Scene ${sc.number ?? scIdx + 1}`,
            hasBeats: sceneBeatCount > 0,
            beatCount: sceneBeatCount,
            beatsWithLines: sceneBeatsWithLines,
            beatsWithComic: sceneBeatsWithComic,
            beats: beatStatuses,
            status: sceneStatus,
          });
        });
      });

      let episodeStatus: 'empty' | 'partial' | 'complete' = 'empty';
      if (hasActs && hasScenes && hasBeats && beatCount > 0) {
        if (beatsWithLines === beatCount) episodeStatus = 'complete';
        else if (beatsWithLines > 0) episodeStatus = 'partial';
      }

      report.push({
        sIdx, eIdx,
        seasonNum: s.number ?? sIdx + 1,
        episodeNum: ep.number ?? eIdx + 1,
        title: ep.title || 'Untitled',
        hasActs, hasScenes, hasBeats, hasDialogue,
        beatCount, lineCount, beatsWithLines, beatsWithComic,
        scenes: sceneReports,
        status: episodeStatus,
      });
    });
  });
  return report;
};
