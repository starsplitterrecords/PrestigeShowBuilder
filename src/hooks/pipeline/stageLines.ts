
import { Show, CinematicBeat, ScriptLine } from '../../types/models';
import { generateDialogueScript } from '../../geminiService';
// D272: assembleBeatContext removed
import { resolveCharacter, resolveSpeakerDisplayLabel, getSpeakerClassification } from '../../domainUtils';
import { appendTextGenerationLog } from '../../apiUtils';
import { runSceneConversation } from '../../ai/textGeneration/sceneConversation';
import { resolveTextModel } from '../../utils/generationMode';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const stageLines = async (
  liveShowRef: { current: Show },
  beatsToProcess: {
    eIdx: number; aIdx: number; scIdx: number; bIdx: number; beat: CinematicBeat;
  }[],
  forceRedraft: boolean,
  { log, updateStatus, checkCancelled, commit, sIdx, isBatchFill, mode, dispatch }: any
) => {
  // Build scene-level beat lists so each beat can receive its scene position.
  const sceneBeatMap = new Map<string, CinematicBeat[]>();
  beatsToProcess.forEach(({ eIdx, aIdx, scIdx }) => {
    const key = `${sIdx}-${eIdx}-${aIdx}-${scIdx}`;
    if (!sceneBeatMap.has(key)) {
      const scene = liveShowRef.current.seasons[sIdx]
        ?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx];
      sceneBeatMap.set(key, scene?.cinematicBeats ?? []);
    }
  });

  // Build scene groups from the flat beatsToProcess list
  type SceneKey = string;  // `${sIdx}-${eIdx}-${aIdx}-${scIdx}`
  const sceneGroups = new Map<SceneKey, typeof beatsToProcess>();
  beatsToProcess.forEach(entry => {
    const key = `${sIdx}-${entry.eIdx}-${entry.aIdx}-${entry.scIdx}`;
    if (!sceneGroups.has(key)) sceneGroups.set(key, []);
    sceneGroups.get(key)!.push(entry);
  });

  // Pre-run conversation sessions for scenes with >=2 dialogue beats
  const conversationResults = new Map<string, ScriptLine[]>();

  for (const [sceneKey, sceneEntries] of sceneGroups) {
    const dialogueEntries = sceneEntries.filter(e => {
      const bt = e.beat.beatType ?? 'DIALOGUE';
      return !['TABLEAU', 'ESTABLISHING', 'MEMORY_BLEED'].includes(bt);
    });
    if (dialogueEntries.length < 2) continue;  // single beat: use existing path

    const { eIdx, aIdx, scIdx } = dialogueEntries[0];
    const scene = liveShowRef.current.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx];
    if (!scene) continue;

    const orderedBeats = dialogueEntries
      .sort((a, b) => a.bIdx - b.bIdx)
      .map(e => e.beat);

    log(`AI: Scene conversation — ${orderedBeats.length} beats in ${scene.title || sceneKey}`);
    const results = await runSceneConversation(
      liveShowRef.current, scene, orderedBeats, mode,
      (beatFid, prompt, raw) => appendTextGenerationLog(dispatch, liveShowRef.current, {
        targetFid: beatFid,
        targetKind: 'beat',
        generator: 'scene-conversation-dialogue',
        prompt,
        rawResponse: raw,
        model: resolveTextModel(mode),
        mode: mode === 'free' ? 'free' : 'paid',
      })
    );
    results.forEach((lines, fid) => conversationResults.set(fid, lines));
  }
  
  let failedBeats = 0;
  const MAX_FAILURES = 5;

  for (let i = 0; i < beatsToProcess.length; i++) {
    checkCancelled(i);
    const { eIdx, aIdx, scIdx, bIdx, beat } = beatsToProcess[i];

    // Defensive: TABLEAU/ESTABLISHING/MEMORY_BLEED beats generate no lines
    const beatType = beat.beatType ?? 'DIALOGUE';
    if (beatType === 'TABLEAU' || beatType === 'ESTABLISHING' || beatType === 'MEMORY_BLEED') continue;

    log(`AI: Writing lines for ${beat.fid}...`);
    updateStatus(
      `Dialogue Fill — ${beat.fid} (${i + 1} of ${beatsToProcess.length} remaining)`,
      { current: i + 1, total: beatsToProcess.length }
    );
  
    const sceneKey = `${sIdx}-${eIdx}-${aIdx}-${scIdx}`;
    const sceneBeats = sceneBeatMap.get(sceneKey) || [];
    const beatIndexInScene = sceneBeats.findIndex(b => b.fid === beat.fid);
  
    try {
      let newLines: ScriptLine[] = [];
      
      const scene = liveShowRef.current
        .seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx];
      const act = liveShowRef.current
        .seasons[sIdx]?.episodes[eIdx]?.acts[aIdx];
      const episode = liveShowRef.current
        .seasons[sIdx]?.episodes[eIdx];

      const conversationLines = conversationResults.get(beat.fid);
      if (conversationLines !== undefined) {
        newLines = conversationLines;
      } else {
        const contextObj = {
          beatIndex: beatIndexInScene,
          totalBeats: sceneBeats.length,
          precedingBeats: sceneBeats.slice(0, beatIndexInScene),
          precedingBeatSummaries: sceneBeats
            .slice(0, beatIndexInScene)
            .map(b => b.description),
          followingBeatSummary: sceneBeats[beatIndexInScene + 1]?.description,
          show: liveShowRef.current,
          scene,
          actSummary: act?.summary,
          episodeSummary: episode?.summary ?? episode?.oneLiner,
        };

        // D275: both branches now use generateDialogueScript through
        // the resolver. The if-branch was migrated as part of D267;
        // the else-branch was the remaining legacy call site for
        // generateBeatLines. After this change, generateBeatLines has
        // zero callers and can be retired.
        newLines = await generateDialogueScript(
          liveShowRef.current,
          beat,
          scene!,
          contextObj.precedingBeats,
          mode,
          undefined,
          dispatch
        );
      }
  
      // D297: Zero-length scripts are now valid (visual/silent beats). 
      // We process them as success rather than incrementing failedBeats.
      const normalisedLines = newLines.length > 0 
        ? newLines.map(line => {
            const resolved = resolveCharacter(liveShowRef.current, line.characterHandle);
            const finalHandle = resolved ? resolved.handle : line.characterHandle;
            const finalId = resolved ? resolved.id : (line.characterId || null);
            const speakerClassification = getSpeakerClassification(finalHandle, liveShowRef.current);
            const speakerDisplayLabel = resolveSpeakerDisplayLabel({
              speakerKey: finalHandle,
              characterId: finalId,
              characterHandle: finalHandle,
              speakerName: line.speakerName,
              characters: liveShowRef.current.characters
            });
            const canonicalSpeakerKey = finalId ? `@${finalId}` : finalHandle;
            return {
              ...line,
              characterHandle: finalHandle,
              characterId: finalId,
              canonicalSpeakerKey,
              speakerDisplayLabel,
              displayName: speakerDisplayLabel,
              speakerClassification
            };
          })
        : [];

      const freshSeasons = structuredClone(liveShowRef.current.seasons);
      const targetScene = freshSeasons[sIdx].episodes[eIdx].acts[aIdx].scenes[scIdx];
      const targetBeat = targetScene.cinematicBeats.find(b => b.fid === beat.fid);
      if (targetBeat) {
        targetBeat.script = {
          ...targetBeat.script,
          lines: normalisedLines,
          entries: normalisedLines,
          aiGenerated: true,
        };
        // D97: backfill characterIds from the resolved line handles.
        if (normalisedLines.length > 0) {
          const lineCharIds = Array.from(new Set(
            normalisedLines
              .map(l => resolveCharacter(liveShowRef.current, l.characterHandle))
              .filter(Boolean)
              .map(c => c!.id)
          ));
          if (lineCharIds.length > 0) {
            targetBeat.characterIds = lineCharIds;
          }
        }
        await commit({ seasons: freshSeasons });
        failedBeats = 0; // reset on success
        
        if (isBatchFill && i < beatsToProcess.length - 1) {
           log("AI: Cooling down between calls...");
           await sleep(3000); // 3 second delay for batch fill
        } else {
           await sleep(800);
        }
      }
    } catch (e: any) {
      if (e.message === 'Cancelled by user.' || e.message.includes('consecutive times')) {
        throw e;
      }
      failedBeats++;
      log(`⚠ Beat ${beat.fid}: Error — ${e.message} (${failedBeats}/${MAX_FAILURES} failures)`);
      if (failedBeats >= MAX_FAILURES) {
        throw new Error(`Dialogue generation failed ${MAX_FAILURES} consecutive times. Stopping.`);
      }
      await sleep(3000);
    }
  }
};
