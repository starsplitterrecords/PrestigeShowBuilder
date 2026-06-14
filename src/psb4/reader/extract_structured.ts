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
 * Extracts normalized content from structured exports (Bands A and B).
 */
export function extractStructured(
  payload: any,
  reconciler: CharacterReconciler
): { episodes: NormalizedEpisode[]; flags: SourceFlag[] } {
  const flags: SourceFlag[] = [];
  const episodes: NormalizedEpisode[] = [];
  const seenEpisodeIds = new Set<string>();

  const rawEpisodes = (payload && Array.isArray(payload.episodes)) 
    ? payload.episodes 
    : [];

  rawEpisodes.forEach((rawEp: any, rawEpIndex: number) => {
    const epIndex = rawEpIndex + 1;
    let epId = rawEp.id || '';
    
    if (!epId) {
      epId = generateId();
    }

    // Flag duplicate episode ID
    if (seenEpisodeIds.has(epId)) {
      flags.push({
        level: 'error',
        code: FlagCode.DUPLICATE_EPISODE_ID,
        episodeId: epId,
        sceneId: null,
        beatId: null,
        message: `Duplicate Episode ID "${epId}" encountered. This episode was skipped or flagged.`
      });
      return; // Skip duplicate ID
    }
    seenEpisodeIds.add(epId);

    // Flag missing episode title
    let title = rawEp.title || '';
    if (!title) {
      title = `Episode ${epIndex}`;
      flags.push({
        level: 'warn',
        code: FlagCode.MISSING_EPISODE_TITLE,
        episodeId: epId,
        sceneId: null,
        beatId: null,
        message: `Episode at index ${epIndex} has no title. Synthesized "${title}".`
      });
    }

    const scenes: NormalizedScene[] = [];
    const rawScenes = Array.isArray(rawEp.scenes) ? rawEp.scenes : [];

    rawScenes.forEach((rawSc: any, rawScIndex: number) => {
      const scIndex = rawScIndex + 1;
      const scId = rawSc.id || generateId();
      
      const beats: NormalizedBeatsWrapper[] = [];
      const rawBeats = Array.isArray(rawSc.beats) ? rawSc.beats : [];

      rawBeats.forEach((rawBt: any, rawBtIndex: number) => {
        const btIndex = rawBtIndex + 1;
        const btId = rawBt.id || generateId();

        // Reconcile characterIds at the beat level
        const rawCharIds = Array.isArray(rawBt.characterIds) ? rawBt.characterIds : [];
        const reconciledCharIds: string[] = [];
        
        rawCharIds.forEach((cid: string) => {
          const { reconciledId, flag } = reconciler.reconcileId(cid, epId, scId, btId);
          if (flag) {
            flags.push(flag);
          }
          if (reconciledId && !reconciledCharIds.includes(reconciledId)) {
            reconciledCharIds.push(reconciledId);
          }
        });

        // Parse line-level dialogue/actions
        const lines: NormalizedLine[] = [];
        const rawLines = Array.isArray(rawBt.lines) ? rawBt.lines : [];

        rawLines.forEach((rawLn: any) => {
          let lineCharId: string | null = null;
          if (rawLn.characterId) {
            const { reconciledId, flag } = reconciler.reconcileId(rawLn.characterId, epId, scId, btId);
            if (flag) {
              flags.push(flag);
            }
            lineCharId = reconciledId;
          }

          let lineType = rawLn.type;
          if (!lineType || !['dialogue', 'caption', 'sfx', 'narration', 'unknown'].includes(lineType)) {
            lineType = 'dialogue'; // default fallback
          }

          lines.push({
            characterId: lineCharId,
            text: (rawLn.text || '').trim(),
            type: lineType as any
          });
        });

        beats.push({
          id: btId,
          index: btIndex,
          characterIds: reconciledCharIds,
          description: rawBt.description || null,
          direction: rawBt.direction || null,
          continuityAnchor: rawBt.continuityAnchor || null,
          panelPlans: rawBt.panelPlans || rawBt.panelPlan || null,
          lines
        });
      });

      scenes.push({
        id: scId,
        index: scIndex,
        heading: rawSc.heading || null,
        beats
      });
    });

    // Check empty episode
    const hasRawProse = typeof rawEp.rawProse === 'string' && rawEp.rawProse.trim().length > 0;
    const hasScenes = scenes.length > 0 && scenes.some(s => s.beats.length > 0);

    if (!hasScenes && !hasRawProse) {
      flags.push({
        level: 'error',
        code: FlagCode.EMPTY_EPISODE,
        episodeId: epId,
        sceneId: null,
        beatId: null,
        message: `Episode "${title}" has no scenes and no rawProse.`
      });
    }

    episodes.push({
      id: epId,
      index: epIndex,
      title,
      summary: rawEp.summary || null,
      brief: rawEp.brief || null,
      scenes,
      rawProse: null // A & B do not store rawProse
    });
  });

  return { episodes, flags };
}

type NormalizedBeatsWrapper = NormalizedBeat;
