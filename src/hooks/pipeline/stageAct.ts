
import { Show, Act, Scene } from '../../types/models';
import { generateShowBiblePart, prompts, schemas } from '../../geminiService';
import { appendTextGenerationLog } from '../../apiUtils';
import { resolveTextModel } from '../../utils/generationMode';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const stageAct = async (
  liveShowRef: { current: Show },
  sIdx: number,
  eIdx: number,
  aIdx: number,
  forceRedraft: boolean,
  { log, updateStatus, checkCancelled, commit, mode, dispatch }: any
) => {
  const liveShow = liveShowRef.current;
  const act = liveShow.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx];
  if (!act) return;

  const targetSceneCount = liveShow.structureConfig?.scenesPerAct ?? 5;
  const needsScenes = !act.scenes || act.scenes.length < targetSceneCount;
  if (needsScenes || forceRedraft) {
    log(`AI: Mapping Scenes for Ep ${eIdx + 1} Act ${act.number}...`);
    updateStatus(`Mapping Scenes — Ep ${eIdx + 1} Act ${act.number}`);

    const startTime = Date.now();
    const promptText = prompts.generateActScenes(sIdx, eIdx, aIdx, act, liveShow);
    const scData = await generateShowBiblePart(
      liveShow,
      promptText,
      schemas.actScenes,
      { s: sIdx, e: eIdx, a: aIdx },
      mode
    );
    const durationMs = Date.now() - startTime;

    // D257: log the call
    appendTextGenerationLog(dispatch, liveShowRef.current, {
      generator: "generateActScenes",
      targetFid: act.fid,
      targetKind: "act",
      prompt: promptText,
      schemaName: "actScenes",
      model: resolveTextModel(mode, false),
      mode,
      rawResponse: JSON.stringify(scData),
      durationMs,
    });
    
    if (scData && Array.isArray(scData.scenes)) {
      // Strip framing scaffold — schema-required but not persisted
      const scenesForShow = (scData.scenes || []).map((s: any, si: number) => {
        const { framing, ...rest } = s;
        if (framing) {
          console.debug(`Scene framing: ${s.title}`, framing);
        }
        return {
          ...rest,
          id: Math.random().toString(36).substring(2, 9),
          number: si + 1,
          title: s.title || `Scene ${si + 1}`,
          cinematicBeats: []
        };
      });

      const seasons = structuredClone(liveShowRef.current.seasons);
      let mergedScenes = [...(act.scenes || [])];
      if (forceRedraft) {
        mergedScenes = scenesForShow;
      } else {
        scenesForShow.forEach((sc: any, i: number) => {
          if (!mergedScenes[i]) mergedScenes[i] = sc;
        });
      }
      seasons[sIdx].episodes[eIdx].acts[aIdx].scenes = mergedScenes;
      await commit({ seasons });
      await sleep(1000);
    }
  }
};
