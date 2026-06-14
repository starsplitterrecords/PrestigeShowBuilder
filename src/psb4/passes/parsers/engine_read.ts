import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, EngineReadPayload } from '../../types';

const parser: Parser<EngineReadPayload> = {
  id: 'engine_read',
  artifactType: ArtifactType.ENGINE_READ,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<Partial<EngineReadPayload>>(raw);
    if (res.ok === false) {
      return { ok: false, error: (res as any).error };
    }
    const data = res.payload;
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Parsed JSON was not a valid object' };
    }

    const fields: (keyof EngineReadPayload)[] = [
      'premise',
      'genreLane',
      'characterEngine',
      'externalPressure',
      'visualWorld',
      'antagonistMode',
      'endingImage'
    ];

    const result: any = {};
    for (const field of fields) {
      if (data[field] === undefined || data[field] === null) {
        result[field] = '';
      } else {
        result[field] = String(data[field]);
      }
    }

    return { ok: true, payload: result as EngineReadPayload };
  }
};

registerParser(parser);
export default parser;
