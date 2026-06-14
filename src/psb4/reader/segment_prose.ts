import { 
  NormalizedEpisode, 
  NormalizedScene, 
  NormalizedBeat, 
  NormalizedLine, 
  SourceFlag, 
  FlagCode 
} from '../types';
import { CharacterReconciler } from './reconcile_characters';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deterministically segments text-based prose into best-effort episodes, scenes, and lines.
 */
export function segmentProse(
  payload: any,
  reconciler: CharacterReconciler,
  detectedBand: 'C' | 'D'
): { episodes: NormalizedEpisode[]; flags: SourceFlag[] } {
  const flags: SourceFlag[] = [];
  const episodes: NormalizedEpisode[] = [];

  // Register band D low structure flag if applicable
  if (detectedBand === 'D') {
    flags.push({
      level: 'info',
      code: FlagCode.BAND_D_LOW_STRUCTURE,
      episodeId: null,
      sceneId: null,
      beatId: null,
      message: 'Detected Band D (Prose-only): Structural content is minimal. No beat arrays are present; Wave 2 matches must reconstruct content.'
    });
  }

  // Normalize export into list of raw episodes
  let rawEpisodesList: Array<{ id?: string; title?: string; summary?: string; rawProse?: string; brief?: any }> = [];

  if (typeof payload === 'string') {
    rawEpisodesList = [{
      id: generateId(),
      title: 'Episode 1',
      rawProse: payload
    }];
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.episodes)) {
      rawEpisodesList = payload.episodes;
    } else {
      // General structure has prose
      const prose = payload.rawProse || payload.prose || '';
      rawEpisodesList = [{
        id: payload.id || generateId(),
        title: payload.title || 'Episode 1',
        rawProse: prose
      }];
    }
  }

  rawEpisodesList.forEach((rawEp: any, rawEpIndex: number) => {
    const epIndex = rawEpIndex + 1;
    const epId = rawEp.id || generateId();
    let epTitle = rawEp.title || '';

    if (!epTitle) {
      epTitle = `Episode ${epIndex}`;
      flags.push({
        level: 'warn',
        code: FlagCode.MISSING_EPISODE_TITLE,
        episodeId: epId,
        sceneId: null,
        beatId: null,
        message: `Episode at index ${epIndex} has no title. Synthesized "${epTitle}".`
      });
    }

    const rawProse = (rawEp.rawProse || rawEp.prose || '').trim();

    if (!rawProse) {
      flags.push({
        level: 'error',
        code: FlagCode.EMPTY_EPISODE,
        episodeId: epId,
        sceneId: null,
        beatId: null,
        message: `Episode "${epTitle}" has no scenes and no rawProse.`
      });

      episodes.push({
        id: epId,
        index: epIndex,
        title: epTitle,
        summary: rawEp.summary || null,
        brief: rawEp.brief || null,
        scenes: [],
        rawProse: ''
      });
      return;
    }

    // Heuristics mapping lines to scenes
    const lines = rawProse.split(/\r?\n/);
    let currentSceneHeading: string | null = null;
    let currentSceneLines: string[] = [];
    const sceneGroupings: Array<{ heading: string | null; lines: string[] }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }

      // Check scene headings INT. or EXT.
      const isHeading = /^(INT\.|EXT\.|INT\s*\/|EXT\s*\/|SCENE\s+\d+)/i.test(line);
      
      let isSoftBoundary = false;
      if (i > 0 && lines[i - 1].trim() === '') {
        // Potential location words followed by blank line
        if (line.length < 55 && /living\s*room|kitchen|bedroom|office|hallway|street|alley|rooftop|car|park|woods|corridor|doorway|porch|lobby|stage|station/i.test(line)) {
          isSoftBoundary = true;
        }
      }

      if (isHeading || isSoftBoundary) {
        if (currentSceneLines.length > 0) {
          sceneGroupings.push({
            heading: currentSceneHeading,
            lines: currentSceneLines
          });
          currentSceneLines = [];
        }
        currentSceneHeading = line;
      } else {
        currentSceneLines.push(line);
      }
    }

    if (currentSceneLines.length > 0) {
      sceneGroupings.push({
        heading: currentSceneHeading,
        lines: currentSceneLines
      });
    }

    // Fallback: If no scenes detected, treat entire text as single scene
    if (sceneGroupings.length === 0) {
      sceneGroupings.push({
        heading: null,
        lines: lines.filter((l: string) => l.trim().length > 0).map((l: string) => l.trim())
      });
    }

    const scenes: NormalizedScene[] = [];

    sceneGroupings.forEach((group, groupIndex) => {
      const scIndex = groupIndex + 1;
      const scId = generateId();
      const btId = generateId();

      const normalizedLineList: NormalizedLine[] = [];
      const checkedCharacterIds = new Set<string>();

      group.lines.forEach((lineText) => {
        // Speaker cue tests
        // 1. NAME: Dialogue
        const speakerColonRegex = /^\s*([A-Za-z0-9\s.-]+?)(?:\s*\([^)]+\))?\s*:\s*(.+)$/;
        // 2. (NAME) Dialogue
        const speakerParenRegex = /^\s*\(([A-Za-z0-9\s.-]+?)\)\s*(.+)$/;

        const colonMatch = speakerColonRegex.exec(lineText);
        const parenMatch = speakerParenRegex.exec(lineText);

        if (colonMatch) {
          const rawSpeaker = colonMatch[1];
          const text = colonMatch[2];
          
          const { reconciledId, flag } = reconciler.reconcileId(rawSpeaker, epId, scId, btId);
          if (flag) {
            flags.push(flag);
          }
          if (reconciledId) {
            checkedCharacterIds.add(reconciledId);
          }

          // Simple type checking for sfx or narration within colons
          let type: 'dialogue' | 'caption' | 'sfx' | 'narration' | 'unknown' = 'dialogue';
          if (/sfx|sound/i.test(rawSpeaker)) {
            type = 'sfx';
          } else if (/caption/i.test(rawSpeaker)) {
            type = 'caption';
          }

          normalizedLineList.push({
            characterId: reconciledId || null,
            text: text.trim(),
            type
          });
        } else if (parenMatch) {
          const rawSpeaker = parenMatch[1];
          const text = parenMatch[2];

          const { reconciledId, flag } = reconciler.reconcileId(rawSpeaker, epId, scId, btId);
          if (flag) {
            flags.push(flag);
          }
          if (reconciledId) {
            checkedCharacterIds.add(reconciledId);
          }

          normalizedLineList.push({
            characterId: reconciledId || null,
            text: text.trim(),
            type: 'dialogue'
          });
        } else {
          // No direct speaker cue
          // Check for unattributed dialogue if it starts with quote marks
          const startsWithQuote = /^\s*["'\u201C\u201D\u2018\u2019]/.test(lineText);
          if (startsWithQuote) {
            normalizedLineList.push({
              characterId: null,
              text: lineText,
              type: 'dialogue'
            });

            flags.push({
              level: 'info',
              code: FlagCode.UNATTRIBUTED_DIALOGUE,
              episodeId: epId,
              sceneId: scId,
              beatId: btId,
              message: `Unattributed dialogue speaker line encountered on prose segmentation: "${lineText.slice(0, 45)}..."`
            });
          } else {
            // General narration line
            let type: 'dialogue' | 'caption' | 'sfx' | 'narration' | 'unknown' = 'narration';
            if (/^sfx\s*:/i.test(lineText) || /^\[\s*sfx\s*:/i.test(lineText)) {
              type = 'sfx';
            }

            normalizedLineList.push({
              characterId: null,
              text: lineText,
              type
            });
          }
        }
      });

      const singleBeat: NormalizedBeat = {
        id: btId,
        index: 1,
        characterIds: Array.from(checkedCharacterIds),
        description: null,
        direction: null,
        continuityAnchor: null,
        panelPlans: null,
        lines: normalizedLineList
      };

      scenes.push({
        id: scId,
        index: scIndex,
        heading: group.heading,
        beats: [singleBeat]
      });
    });

    episodes.push({
      id: epId,
      index: epIndex,
      title: epTitle,
      summary: rawEp.summary || null,
      brief: rawEp.brief || null,
      scenes,
      rawProse
    });
  });

  return { episodes, flags };
}
