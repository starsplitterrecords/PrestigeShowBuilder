import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, SegmentationPlanPayload, SegmentationPlanScene } from '../../types';

export function parseSingleSegPlan(raw: string | any, defaultActNumber = 1, defaultSceneNumber = 1): SegmentationPlanScene {
  let d: any;
  if (typeof raw === 'string') {
    const parsed = cleanAndParseJSON<any>(raw);
    if (parsed.ok === false) {
      throw new Error((parsed as any).error || 'Failed to parse JSON');
    }
    d = parsed.payload;
  } else {
    d = raw;
  }

  if (!d || typeof d !== 'object') {
    throw new Error('Not an object');
  }

  let rawScene = d;
  if (Array.isArray(d.scenes) && d.scenes.length > 0) {
    rawScene = d.scenes[0];
  }

  const actNumber = Number(rawScene.actNumber || defaultActNumber);
  const sceneNumber = Number(rawScene.sceneNumber || defaultSceneNumber);
  const rawPageBeats = Array.isArray(rawScene.pageBeats) ? rawScene.pageBeats : [];
  const pageBeats: SegmentationPlanScene['pageBeats'] = [];

  for (const pb of rawPageBeats) {
    if (!pb || typeof pb !== 'object') continue;

    const rawIndices = Array.isArray(pb.unitIndices) ? pb.unitIndices : [];
    const unitIndices = rawIndices
      .map((val: any) => Math.floor(Number(val)))
      .filter((val: any) => !isNaN(val) && val >= 0);

    if (unitIndices.length === 0) continue; // Skip empty pageBeats without any unit index

    let beatType: 'DIALOGUE' | 'TABLEAU' | 'ESTABLISHING' | 'MEMORY_BLEED' = 'DIALOGUE';
    if (['DIALOGUE', 'TABLEAU', 'ESTABLISHING', 'MEMORY_BLEED'].includes(pb.beatType)) {
      beatType = pb.beatType;
    }

    const description = typeof pb.description === 'string' ? pb.description.trim() : 'Scene continuation';
    const visualNote = typeof pb.visualNote === 'string' ? pb.visualNote.trim() : undefined;
    const direction = typeof pb.direction === 'string' ? pb.direction.trim() : undefined;

    pageBeats.push({
      unitIndices,
      beatType,
      description,
      visualNote,
      direction,
    });
  }

  if (pageBeats.length === 0) {
    throw new Error('No valid pageBeats found in single-scene segmentation plan');
  }

  return {
    actNumber,
    sceneNumber,
    pageBeats,
  };
}

const parser: Parser<SegmentationPlanPayload> = {
  id: 'segmentation_plan',
  artifactType: ArtifactType.SEGMENTATION_PLAN,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    if (!d || typeof d !== 'object') return { ok: false, error: 'Not an object' };

    const scenes: SegmentationPlanPayload['scenes'] = [];

    if (Array.isArray(d.scenes)) {
      for (const rawScene of d.scenes) {
        try {
          scenes.push(parseSingleSegPlan(rawScene));
        } catch (err: any) {
          return {
            ok: false,
            error: `Failed to parse scene in segmentation array: ${err.message}`
          };
        }
      }
    } else {
      try {
        scenes.push(parseSingleSegPlan(d));
      } catch (err: any) {
        return {
          ok: false,
          error: `Expected {scenes: [...]} payload or a single scene segmentation plan payload: ${err.message}`
        };
      }
    }

    if (scenes.length === 0) {
      return { ok: false, error: 'No valid scenes or pageBeats found in the segmentation plan' };
    }

    return {
      ok: true,
      payload: { scenes },
    };
  }
};

registerParser(parser);
export default parser;
