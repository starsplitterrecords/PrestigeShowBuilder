import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, VisualMotifPayload } from '../../types';
const parser: Parser<VisualMotifPayload> = {
  id: 'visual_motif', artifactType: ArtifactType.VISUAL_MOTIF, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.motifs) ? d.motifs.map((item: any) => ({
      motif: String(item?.motif||''),
      emotionalMeaning: String(item?.emotionalMeaning||''),
      firstSeed: String(item?.firstSeed||''),
      reinforcement: String(item?.reinforcement||''),
      meaningShift: String(item?.meaningShift||''),
      payoff: String(item?.payoff||''),
    })) : [];
    const payload: any = { motifs: items };
    
    return { ok: true, payload: payload as VisualMotifPayload };
  }
};
registerParser(parser);
export default parser;
