import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, BalancedConflictPayload } from '../../types';
const parser: Parser<BalancedConflictPayload> = {
  id: 'balanced_conflict', artifactType: ArtifactType.BALANCED_CONFLICT, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.conflicts) ? d.conflicts.map((item: any) => ({
      scene: String(item?.scene||''),
      argument: String(item?.argument||''),
      sideAProtects: String(item?.sideAProtects||''),
      sideBProtects: String(item?.sideBProtects||''),
      blindSpotA: String(item?.blindSpotA||''),
      blindSpotB: String(item?.blindSpotB||''),
      revision: String(item?.revision||''),
    })) : [];
    const payload: any = { conflicts: items };
    
    return { ok: true, payload: payload as BalancedConflictPayload };
  }
};
registerParser(parser);
export default parser;
