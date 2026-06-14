import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, RegroundingBriefPayload } from '../../types';

const parser: Parser<RegroundingBriefPayload> = {
  id: 'regrounding_brief',
  artifactType: ArtifactType.REGROUNDING_BRIEF,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<Partial<RegroundingBriefPayload>>(raw);
    if (res.ok === false) {
      return { ok: false, error: (res as any).error };
    }
    const data = res.payload;
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Parsed JSON was not a valid object' };
    }

    const fields: (keyof RegroundingBriefPayload)[] = [
      'title',
      'premise',
      'genre',
      'tone',
      'themes',
      'narrativeMechanism',
      'conflictEngine',
      'characterRosterStatus',
      'seasonArcSummary',
      'settingDetails',
      'editorialPriorities'
    ];

    const result: any = {};
    for (const field of fields) {
      if (data[field] === undefined || data[field] === null) {
        result[field] = '';
      } else {
        result[field] = String(data[field]);
      }
    }

    return { ok: true, payload: result as RegroundingBriefPayload };
  }
};

registerParser(parser);
export default parser;
