import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, CleanSpinePayload } from '../../types';

const parser: Parser<CleanSpinePayload> = {
  id: 'clean_spine',
  artifactType: ArtifactType.CLEAN_SPINE,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const data = res.payload;
    if (!data || typeof data !== 'object') return { ok: false, error: 'Parsed JSON was not a valid object' };

    const sections = Array.isArray(data.sections) ? data.sections.map((s: any) => ({
      label: String(s?.label || ''),
      storyEvent: String(s?.storyEvent || ''),
      characterConflict: String(s?.characterConflict || ''),
      emotionalTurn: String(s?.emotionalTurn || ''),
      oppositionMove: String(s?.oppositionMove || ''),
      consequence: String(s?.consequence || ''),
      pageTurnQuestion: String(s?.pageTurnQuestion || ''),
    })) : [];

    return { ok: true, payload: { sections, summary: String(data.summary || '') } };
  }
};

registerParser(parser);
export default parser;
