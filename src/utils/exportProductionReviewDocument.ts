import { Show, Episode, CinematicBeat, Act, Scene, ScriptLine, CaptionEntry } from '../types/models';
import { resolveEntries, isCaption } from '../domainUtils';
import { getCanonicalBeatPageState } from './beatPageSelection';

export interface ProductionReviewBeat {
  fid: string;
  number: number;
  type: string;
  description: string;
  subtext: string;
  visualDescription?: string;
  direction?: string;
  continuityAnchor?: string;
  groundingEnsemble?: string;
  characterNames: string[];
  locked?: boolean;
  versions: {
    script: number;
    visual: number;
    page: number;
  };
  panelPlans?: any[];
  dialogue: { character: string; text: string; parenthetical?: string; kind: 'dialogue' | 'caption' }[];
  comicState: {
    panelPlanSource: string;
    panelPlanFreshness: string;
    panelCount: number;
    beatPageState: string;
    letteringState: string;
  };
}

export interface ProductionReviewScene {
  title: string;
  setting?: string;
  settingAnchorName?: string;
  dramaticWant?: string;
  summary: string;
  beats: ProductionReviewBeat[];
}

export interface ProductionReviewAct {
  number: number;
  title?: string;
  summary: string;
  scenes: ProductionReviewScene[];
}

export interface ProductionReviewEpisode {
  title: string;
  number: number;
  oneLineSummary?: string;
  acts: ProductionReviewAct[];
}

export interface ProductionReviewDocument {
  showTitle: string;
  identifier: string;
  exportDate: string;
  episodes: ProductionReviewEpisode[];
}

export function buildProductionReviewDocument(show: Show, episodeId?: string): ProductionReviewDocument {
  const episodesToExport: { episode: Episode; seasonNumber: number }[] = [];
  let identifier = "";
  
  if (episodeId) {
    for (const season of show.seasons) {
      const ep = season.episodes.find(e => e.id === episodeId);
      if (ep) {
        episodesToExport.push({ episode: ep, seasonNumber: season.number });
        identifier = `Season ${season.number} / Episode ${ep.number}`;
        break;
      }
    }
  } else {
    // Export all episodes
    for (const season of show.seasons) {
      for (const ep of season.episodes) {
        episodesToExport.push({ episode: ep, seasonNumber: season.number });
      }
    }
    identifier = "Full Production Review";
  }

  if (episodesToExport.length === 0) {
    throw new Error("No episodes found for export.");
  }

  const doc: ProductionReviewDocument = {
    showTitle: show.titleSuggestion || show.name,
    identifier: identifier,
    exportDate: new Date().toLocaleString(),
    episodes: episodesToExport.map(({ episode, seasonNumber }) => ({
      title: episode.title,
      number: episode.number,
      oneLineSummary: episode.oneLiner,
      acts: episode.acts.map(act => ({
        number: act.number,
        title: (act as any).title,
        summary: act.summary,
        scenes: act.scenes.map(scene => {
          const settingAnchor = show.settingAnchors?.find(a => a.id === scene.settingAnchorId);
          return {
            title: scene.title,
            setting: scene.setting,
            settingAnchorName: settingAnchor?.name,
            dramaticWant: scene.dramaticWant,
            summary: scene.summary,
            beats: scene.cinematicBeats.map((beat, bIdx) => {
              const entries = resolveEntries(beat);
              const dialogue = entries.map(e => {
                if (isCaption(e)) {
                  return {
                    character: e.characterHandle || 'NARRATOR',
                    text: e.text,
                    kind: 'caption' as const
                  };
                } else {
                  return {
                    character: e.characterHandle,
                    text: e.text,
                    parenthetical: e.parenthetical,
                    kind: 'dialogue' as const
                  };
                }
              });

              // Resolve character names from characterIds
              const characterNames = (beat.characterIds || []).map(id => {
                const char = show.characters.find(c => c.id === id);
                return char ? char.name : `[unknown: ${id}]`;
              });

              // Comic state
              const canon = getCanonicalBeatPageState(show, beat.fid);
              
              return {
                fid: beat.fid,
                number: bIdx + 1,
                type: beat.beatType || 'NARRATIVE',
                description: beat.description,
                subtext: beat.subtext,
                visualDescription: beat.visualDescription,
                direction: beat.direction,
                continuityAnchor: beat.continuityAnchor,
                groundingEnsemble: beat.groundingEnsemble,
                characterNames,
                locked: beat.locked,
                versions: {
                  script: beat.scriptVersion || 0,
                  visual: beat.visualVersion || 0,
                  page: beat.pageVersion || 0
                },
                panelPlans: beat.panelPlans,
                dialogue,
                comicState: {
                  panelPlanSource: canon.panelPlanSource,
                  panelPlanFreshness: canon.panelPlanFreshness,
                  panelCount: beat.panelCountOverride || beat.panelPlans?.length || 0,
                  beatPageState: canon.beatPageState,
                  letteringState: canon.letteringState
                }
              };
            })
          };
        })
      }))
    }))
  };

  return doc;
}
