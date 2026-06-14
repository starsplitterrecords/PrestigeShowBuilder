
import { Show, Character } from '../../types/models';
import { 
  mineConceptFromRichInput, 
  generateShowBiblePart, 
  prompts, 
  schemas, 
  mineCharactersFromRichInput, 
  mineCharacterSummary, 
  generateCharacterSummary, 
  generateCharacterPortrait,
  generateCharacterVoiceProfile,
  classifyProtagonists,
  generateVoiceConstraints,
  generateBleedPalette,
  extractNarrativeMechanism
} from '../../geminiService';

import { appendTextGenerationLog } from '../../apiUtils';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs async tasks with a maximum concurrency limit.
 * Prevents overwhelming the API with simultaneous requests
 * while still achieving meaningful parallelism.
 */
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const queue = tasks.map((task, index) => ({ task, index }));
  
  async function runNext(): Promise<void> {
    const item = queue.shift();
    if (!item) return;
    results[item.index] = await item.task();
    await runNext();
  }
  
  // Start `limit` workers simultaneously
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, runNext)
  );
  
  return results;
}

export const stageShow = async (
  liveShowRef: { current: Show },
  forceRedraft: boolean,
  { log, updateStatus, checkCancelled, commit, dispatch, mode }: any
) => {
  const liveShow = () => liveShowRef.current;

  // 1. Expand Concept if missing or forced
  if (!liveShow().themes || forceRedraft) {
    checkCancelled();
    log("AI: Processing Concept...");
    updateStatus("Analyzing Series Foundation...");
    
    if (liveShow().initMode === 'mine' && liveShow().richInput) {
      const data = await mineConceptFromRichInput(liveShow(), mode, (log) => {
        appendTextGenerationLog(dispatch, liveShow(), {
          generator: 'mineConceptFromRichInput',
          targetKind: 'show',
          targetFid: `SHOW-${liveShow().id}`,
          ...log
        });
      });
      await commit({
        titleSuggestion: data.titleSuggestion,
        premise: data.premise,
        themes: data.themes || '',
      });
    } else {
      const data = await generateShowBiblePart(
        liveShow(),
        prompts.expandConcept(liveShow().name, liveShow().premise),
        schemas.expandConcept,
        undefined,
        mode,
        (log) => {
          appendTextGenerationLog(dispatch, liveShow(), {
            generator: 'expandConcept',
            targetKind: 'show',
            targetFid: `SHOW-${liveShow().id}`,
            ...log
          });
        }
      );
      await commit({
        titleSuggestion: data.titleSuggestion,
        expandedBible: data.expandedPremise,
        premise: liveShow().premise || data.expandedPremise,
        themes: data.themes || '',
      });
    }
    await sleep(1000);
  }

  // 1.5 Extract Narrative Mechanism
  if (!liveShow().narrativeMechanism || forceRedraft) {
    checkCancelled();
    log("AI: Extracting Narrative Mechanism...");
    updateStatus("Analyzing Narrative Structure...");
    const mechanism = await extractNarrativeMechanism(liveShow(), mode, (log) => {
      appendTextGenerationLog(dispatch, liveShow(), {
        generator: 'extractNarrativeMechanism',
        targetKind: 'show',
        targetFid: `SHOW-${liveShow().id}`,
        ...log
      });
    });
    if (mechanism) {
      await commit({ narrativeMechanism: mechanism });
      log("✓ Narrative Mechanism committed.");
    }
  }

  // 2. Generate Characters if missing or forced
  if (liveShow().characters.length === 0 || forceRedraft) {
    checkCancelled();
    log("AI: Building Ensemble...");
    updateStatus("Populating Character Vault...");
    
    let charData: any[];
    
    if (liveShow().initMode === 'mine' && liveShow().richInput) {
      log('AI: Mining character data from rich input...');
      charData = await mineCharactersFromRichInput(liveShow(), mode, (log) => {
        appendTextGenerationLog(dispatch, liveShow(), {
          generator: 'mineCharactersFromRichInput',
          targetKind: 'show',
          targetFid: `SHOW-${liveShow().id}`,
          ...log
        });
      });
    } else {
      charData = await generateShowBiblePart(
        liveShow(),
        prompts.generateCharacters(liveShow().seedCharacters ?? "", liveShow()),
        schemas.characterCore,
        undefined,
        mode,
        (log) => {
          appendTextGenerationLog(dispatch, liveShow(), {
            generator: 'generateCharacters',
            targetKind: 'show',
            targetFid: `SHOW-${liveShow().id}`,
            ...log
          });
        }
      );
    }
    
    const newChars: Character[] = charData.map((c: any) => ({
      ...c,
      id: Math.random().toString(36).substring(2, 11),
      handle: c.handle?.startsWith('@')
        ? c.handle
        : `@${liveShow().showCode?.toLowerCase() || 'show'}.${(c.handle || c.name || 'char').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      isMinor: false,
      summary: ''
    }));
    
    await commit({ characters: newChars });
    await sleep(500);

    log("AI: Deep-diving into character profiles...");
    
    let completedCount = 0;
    const summaryTasks = newChars.map((char) => async () => {
      checkCancelled();
      
      let summary = '';
      let visualAnchor = '';
      if (liveShow().initMode === 'mine' && liveShow().richInput) {
        const res = await mineCharacterSummary(liveShow(), char, mode, (log) => {
          appendTextGenerationLog(dispatch, liveShow(), {
            generator: `mineCharacterSummary:${char.handle}`,
            targetKind: 'show',
            targetFid: char.id,
            ...log
          });
        });
        summary = res.summary;
        visualAnchor = res.visualAnchor;
      } else {
        const res = await generateCharacterSummary(liveShow(), char, mode, (log) => {
          appendTextGenerationLog(dispatch, liveShow(), {
            generator: `generateCharacterSummary:${char.handle}`,
            targetKind: 'show',
            targetFid: char.id,
            ...log
          });
        });
        summary = res.summary;
        visualAnchor = res.visualAnchor;
      }
      
      completedCount++;
      updateStatus(`Synthesizing Profile: ${char.name}`, { current: completedCount, total: newChars.length });
      
      return { char, summary, visualAnchor };
    });

    const summaryResults = await withConcurrencyLimit(summaryTasks, 3);

    const updatedChars = [...liveShow().characters];
    for (const { char, summary, visualAnchor } of summaryResults) {
      const idx = updatedChars.findIndex(c => c.id === char.id);
      if (idx !== -1) {
        updatedChars[idx] = { 
          ...updatedChars[idx], 
          summary, 
          ...(visualAnchor ? { visualAnchor } : {}) 
        };
      }
    }
    await commit({ characters: updatedChars });
    await sleep(300);
    
    // NEW: Initial Configuration (Item 9)
    if (!liveShow().structureConfig || forceRedraft) {
      log("AI: Setting default show configurations and writing rules...");
      await commit({
        structureConfig: {
          beatsPerScene: 5,
          scenesPerAct: 3,
          actsPerEpisode: 3,
          episodesPerSeason: 8,
        },
        register: 'drama', // Default register
        writingRules: {
          dialogueRules: [
            "Maintain character voice profiles strictly.",
            "Use natural phrasing, avoid exposition-heavy dialogue.",
            "Dialogue should reinforce the scene's dramatic want."
          ],
          blockingRules: [
            "Include dynamic camera angles (Close-up, Wide, Over-the-shoulder).",
            "Characters should be physically active or reacting to the environment.",
            "Balance dialogue with visual storytelling."
          ],
          structureRules: [
            "Each beat must advance the scene's objective.",
            "Ensure clear cause-and-effect between beats.",
            "Maintain consistent narrative perspective."
          ],
          craftNotes: [
            "Focus on emotional resonance and subtext.",
            "Maintain stylistic consistency across episodes.",
            "Highlight key symbolic elements.",
            "Maintenance Mode: ON",
            "Migration Mode: ON"
          ]
        }
      });
    }

    // 2.1 Classify Protagonists
    log("AI: Classifying Protagonists...");
    const protagonistMap = await classifyProtagonists(liveShow(), mode, (log) => {
      appendTextGenerationLog(dispatch, liveShow(), {
        generator: 'classifyProtagonists',
        targetKind: 'show',
        targetFid: `SHOW-${liveShow().id}`,
        ...log
      });
    });
    const charsWithProtagonist = [...liveShow().characters];
    for (const char of charsWithProtagonist) {
      // Only set if not already manually overridden
      if (char.isProtagonist === undefined) {
        char.isProtagonist = protagonistMap[char.id] || false;
      }
    }
    await commit({ characters: charsWithProtagonist });
    log("✓ Protagonists classified.");

    const charsNeedingVoice = liveShow().characters.filter(
      c => !c.voiceProfile || c.voiceProfile.trim() === ''
    );

    if (charsNeedingVoice.length > 0) {
      log(`AI: Generating voice profiles for ${charsNeedingVoice.length} characters...`);
      let voiceCompleted = 0;

      const voiceTasks = charsNeedingVoice.map(char => async () => {
        checkCancelled();
        const voiceProfile = await generateCharacterVoiceProfile(
          liveShow(), char, mode,
          (log) => {
            appendTextGenerationLog(dispatch, liveShow(), {
              generator: `generateCharacterVoiceProfile:${char.handle}`,
              targetKind: 'show',
              targetFid: char.id,
              ...log
            });
          }
        ).catch(() => '');
        voiceCompleted++;
        updateStatus(`Voice Profile: ${char.name}`, { current: voiceCompleted, total: charsNeedingVoice.length });
        return { charId: char.id, voiceProfile };
      });

      const voiceResults = await withConcurrencyLimit(voiceTasks, 3);

      const charsWithVoice = [...liveShow().characters];
      for (const { charId, voiceProfile } of voiceResults) {
        if (!voiceProfile) continue;
        const idx = charsWithVoice.findIndex(c => c.id === charId);
        if (idx !== -1) {
          charsWithVoice[idx] = { ...charsWithVoice[idx], voiceProfile };
        }
      }
      await commit({ characters: charsWithVoice });
      log('✓ Voice profiles committed.');
    }

    // 2.2 Extract Voice Constraints
    const charsNeedingVoiceConstraints = liveShow().characters.filter(
      c => c.voiceProfile && !c.voiceConstraints
    );
    if (charsNeedingVoiceConstraints.length > 0) {
      log(`AI: Extracting voice constraints for ${charsNeedingVoiceConstraints.length} characters...`);
      const voiceConstraintsTasks = charsNeedingVoiceConstraints.map(char => async () => {
        checkCancelled();
        const voiceConstraints = await generateVoiceConstraints(liveShow(), char, mode, (log) => {
          appendTextGenerationLog(dispatch, liveShow(), {
            generator: `generateVoiceConstraints:${char.handle}`,
            targetKind: 'show',
            targetFid: char.id,
            ...log
          });
        }).catch(() => '');
        return { charId: char.id, voiceConstraints };
      });
      const voiceConstraintsResults = await withConcurrencyLimit(voiceConstraintsTasks, 3);
      const charsWithVoiceConstraints = [...liveShow().characters];
      for (const { charId, voiceConstraints } of voiceConstraintsResults) {
        if (!voiceConstraints) continue;
        const idx = charsWithVoiceConstraints.findIndex(c => c.id === charId);
        if (idx !== -1) {
          charsWithVoiceConstraints[idx] = { ...charsWithVoiceConstraints[idx], voiceConstraints };
        }
      }
      await commit({ characters: charsWithVoiceConstraints });
      log('✓ Voice constraints committed.');
    }

    // After voiceConstraints commit in stageShow:
    const protagonistsNeedingPalette = liveShow().characters.filter(
      c => c.isProtagonist && !c.memoryBleedPalette
    );
    if (protagonistsNeedingPalette.length > 0) {
      log('AI: Generating memory bleed palettes for protagonists...');
      const paletteTasks = protagonistsNeedingPalette.map(char => async () => {
        const memoryBleedPalette = await generateBleedPalette(liveShow(), char, mode, (log) => {
          appendTextGenerationLog(dispatch, liveShow(), {
            generator: `generateBleedPalette:${char.handle}`,
            targetKind: 'show',
            targetFid: char.id,
            ...log
          });
        }).catch(() => '');
        return { charId: char.id, memoryBleedPalette };
      });
      const paletteResults = await withConcurrencyLimit(paletteTasks, 3);
      const charsWithPalettes = [...liveShow().characters];
      for (const { charId, memoryBleedPalette } of paletteResults) {
        if (!memoryBleedPalette) continue;
        const idx = charsWithPalettes.findIndex(c => c.id === charId);
        if (idx !== -1)
          charsWithPalettes[idx] = { ...charsWithPalettes[idx], memoryBleedPalette };
      }
      await commit({ characters: charsWithPalettes });
      log('✓ Memory bleed palettes committed.');
    }

    log("AI: Synthesizing visual anchors...");
    const charsNeedingPortrait = liveShow().characters.filter(
      c => !c.portraitAssetId
    );
    if (charsNeedingPortrait.length > 0) {
      const portraitTasks = charsNeedingPortrait.map(char => async () => {
        const result = await generateCharacterPortrait(
          liveShow(), char as Character, mode
        ).catch(() => null);
        return { charId: char.id, assetId: result?.assetId ?? null };
      });
      const portraitResults = await withConcurrencyLimit(portraitTasks, 2);
      const charsWithPortraits = [...liveShow().characters];
      for (const { charId, assetId } of portraitResults) {
        if (!assetId) continue;
        const idx = charsWithPortraits.findIndex(c => c.id === charId);
        if (idx !== -1) {
          charsWithPortraits[idx] = {
            ...charsWithPortraits[idx],
            portraitAssetId: assetId
          };
        }
      }
      await commit({ characters: charsWithPortraits });
      log(`✓ Portraits committed for ${portraitResults.filter(r => r.assetId).length} characters.`);
    }
    
    await sleep(1000);
  }
};
