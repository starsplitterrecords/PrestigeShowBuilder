import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, CallbackMapPayload } from '../../types';
const parser: Parser<CallbackMapPayload> = {
  id: 'callback_map', artifactType: ArtifactType.CALLBACK_MAP, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.callbacks) ? d.callbacks.map((item: any) => ({
      element: String(item?.element||''),
      seedLocation: String(item?.seedLocation||''),
      reinforcement: String(item?.reinforcement||''),
      payoffLocation: String(item?.payoffLocation||''),
      emotionalMeaning: String(item?.emotionalMeaning||''),
      payoffActionOrLine: String(item?.payoffActionOrLine||''),
    })) : [];
    const payload: any = { callbacks: items };
    
    return { ok: true, payload: payload as CallbackMapPayload };
  }
};
registerParser(parser);
export default parser;
