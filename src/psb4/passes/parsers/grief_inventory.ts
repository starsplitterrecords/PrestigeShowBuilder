import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, GriefInventoryPayload } from '../../types';
const parser: Parser<GriefInventoryPayload> = {
  id: 'grief_inventory', artifactType: ArtifactType.GRIEF_INVENTORY, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.losses) ? d.losses.map((item: any) => ({
      loss: String(item?.loss||''),
      type: String(item?.type||''),
      seedLocation: String(item?.seedLocation||''),
      lossMoment: String(item?.lossMoment||''),
      acknowledgment: String(item?.acknowledgment||''),
      finaleFeeling: String(item?.finaleFeeling||''),
    })) : [];
    const payload: any = { losses: items };
        if (d?.summary !== undefined) (payload as any).summary = String(d.summary||'');
    return { ok: true, payload: payload as GriefInventoryPayload };
  }
};
registerParser(parser);
export default parser;
