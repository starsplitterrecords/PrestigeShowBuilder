
import { Show, Scene, CinematicBeat } from '../../types/models';
import { generateEpisodeBeats } from '../../geminiService';
import { generateFunctionalId, resolveCharacter } from '../../domainUtils';
import { appendTextGenerationLog } from '../../apiUtils';
import { resolveTextModel } from '../../utils/generationMode';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const stageScene = async (
  liveShowRef: { current: Show },
  sIdx: number,
  eIdx: number,
  aIdx: number,
  scIdx: number,
  forceRedraft: boolean,
  { log, updateStatus, checkCancelled, commit, mode, dispatch }: any
) => {
  const liveShow = liveShowRef.current;
  const scene = liveShow.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx];
  if (!scene) return;

  const targetBeatCount = liveShow.isInitialSequence ? 1 : (liveShow.structureConfig?.beatsPerScene ?? 5);
  const beatMin = liveShow.isInitialSequence ? 1 : Math.max(1, targetBeatCount - 2);
  const needsBeats = !scene.cinematicBeats || scene.cinematicBeats.length < beatMin;
  if (needsBeats || forceRedraft) {
    log(`AI: Sequencing Beats for Ep ${eIdx + 1} Sc ${scene.number}...`);
    updateStatus(`Sequencing Beats — Ep ${eIdx + 1} Act ${aIdx + 1} Sc ${scene.number}`);

    try {
      const startTime = Date.now();
      const beatData = await generateEpisodeBeats(
        liveShow,
        sIdx,
        eIdx,
        aIdx,
        scIdx,
        mode
      );
      const durationMs = Date.now() - startTime;

      // D257: log the call
      appendTextGenerationLog(dispatch, liveShow, {
        generator: "generateCinematicBeats",
        targetFid: scene.fid,
        targetKind: "scene",
        prompt: "(prompt generated internally in generateEpisodeBeats)", // Unfortunately generateEpisodeBeats doesn't easily expose the prompt
        model: resolveTextModel(mode, false),
        mode,
        rawResponse: JSON.stringify(beatData),
        durationMs,
      });
      
      if (Array.isArray(beatData)) {
        const newBeats: CinematicBeat[] = beatData.map((b: any, bi: number) => {
          const { framing, ...rest } = b;
          if (framing) {
            console.debug(`Beat framing: ${bi + 1}`, framing);
          }

          return {
            ...rest,
            beatType: rest.beatType || rest.type || 'DIALOGUE',
            groundingEnsemble: rest.groundingEnsemble && rest.groundingEnsemble !== 'undefined' ? rest.groundingEnsemble : 'General background activity',
            continuityAnchor: rest.continuityAnchor && rest.continuityAnchor !== 'undefined' ? rest.continuityAnchor : 'Scene environment',
            // D88: preserve visualDescription from AI response
            visualDescription: rest.visualDescription || undefined,
            id: Math.random().toString(36).substring(2, 9),
            fid: generateFunctionalId(liveShow.showCode, sIdx, eIdx, aIdx, scIdx, bi),
            characterIds: (rest.characterNames || []).map((name: string) => {
               // Primary: existing resolveCharacter (id / handle / name / suffix)
               let char: any = resolveCharacter(liveShow, name);
               // D97: secondary — role substring match
               // Catches AI role descriptions: 'Social Worker' -> Carrie,
               // 'The Raid Leader' -> Bjorn, 'Navigator' -> Gunnar.
               if (!char) {
                 const nameLower = name.toLowerCase().replace(/^the /, '').trim();
                 char = liveShow.characters.find(c => {
                   const roleLower = (c.role || '').toLowerCase();
                   return nameLower.length > 3 && (
                     roleLower.includes(nameLower) ||
                     nameLower.includes(roleLower.replace(/[^a-z ]/g, '').trim())
                   );
                 }) ?? null;
                 if (char) {
                   console.info(`[D97] characterId resolved via role: "${name}" -> ${char.handle}`);
                 }
               }
               if (!char) {
                 console.warn(`[D97] characterId unresolved: "${name}" — storing raw name.`);
               }
               return char ? char.id : name;
            }),
            lines: [],      // always start empty; stageLines fills this
            dialogue: undefined,  // never populate; field is deprecated (D82)
          };
        });

        const seasons = structuredClone(liveShow.seasons);
        let mergedBeats = [...(scene.cinematicBeats || [])];
        if (forceRedraft) {
          mergedBeats = newBeats;
        } else {
          newBeats.forEach((b, i) => {
            if (!mergedBeats[i]) mergedBeats[i] = b;
          });
        }
        seasons[sIdx].episodes[eIdx].acts[aIdx].scenes[scIdx].cinematicBeats = mergedBeats;
        await commit({ seasons });
        await sleep(1500);
      }
    } catch (e) {
      log(`⚠ Beat generation failed for Scene ${scene.number}. Skipping...`);
      console.error(e);
    }
  }
};
