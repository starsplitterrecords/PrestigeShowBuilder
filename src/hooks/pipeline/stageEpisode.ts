
import { Show, Episode, Act, Scene } from '../../types/models';
import { generateShowBiblePart, prompts, schemas } from '../../geminiService';
import { appendTextGenerationLog } from '../../apiUtils';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const stageEpisode = async (
  liveShowRef: { current: Show },
  sIdx: number,
  eIdx: number,
  forceRedraft: boolean,
  { log, updateStatus, checkCancelled, commit, mode, dispatch }: any
) => {
  const liveShow = liveShowRef.current;
  const episode = liveShow.seasons[sIdx]?.episodes[eIdx];
  if (!episode) return;

  const targetActCount = liveShow.structureConfig?.actsPerEpisode ?? 3;
  const targetSceneCount = liveShow.structureConfig?.scenesPerAct ?? 5;

  const needsActs = !episode.acts || episode.acts.length < targetActCount;
  const needsScenes = episode.acts?.some(act => !act.scenes || act.scenes.length < targetSceneCount);

  if (needsActs || needsScenes || forceRedraft) {
    log(`AI: Synthesizing Full Structure (Acts & Scenes) for Ep ${episode.number}...`);
    updateStatus(`Processing Episode Structure — Ep ${episode.number}`);
    
    const fullStructureData = await generateShowBiblePart(
      liveShow,
      prompts.generateEpisodeFullStructure(sIdx, eIdx, episode, liveShow),
      schemas.episodeFullStructure,
      { s: sIdx, e: eIdx },
      mode,
      (log) => {
        appendTextGenerationLog(dispatch, liveShow, {
          generator: 'generateEpisodeFullStructure',
          targetKind: 'episode',
          targetFid: episode.fid || `${liveShow.showCode}-S${sIdx+1}-E${eIdx+1}`,
          ...log
        });
      }
    );
    
    if (fullStructureData && fullStructureData.acts) {
      const newActs: Act[] = fullStructureData.acts.map((act: any, ai: number) => {
        const newScenes: Scene[] = (act.scenes || []).map((scene: any, si: number) => ({
          ...scene,
          id: Math.random().toString(36).substring(2, 9),
          number: si + 1,
          cinematicBeats: []
        }));

        return {
          ...act,
          id: Math.random().toString(36).substring(2, 9),
          number: ai + 1,
          scenes: newScenes
        };
      });

      const seasons = structuredClone(liveShowRef.current.seasons);
      seasons[sIdx].episodes[eIdx].summary = fullStructureData.summary || episode.summary;
      
      let mergedActs = [...(episode.acts || [])];
      if (forceRedraft) {
        mergedActs = newActs;
      } else {
        newActs.forEach((newAct, i) => {
          if (!mergedActs[i]) {
            mergedActs[i] = newAct;
          } else {
            // If the act exists, only add scenes if it doesn't have any
            if (!mergedActs[i].scenes || mergedActs[i].scenes.length === 0) {
              mergedActs[i].scenes = newAct.scenes;
            }
          }
        });
      }
      seasons[sIdx].episodes[eIdx].acts = mergedActs;
      await commit({ seasons });
      await sleep(1000);
    }
  }
};
