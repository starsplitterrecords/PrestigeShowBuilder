import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, PrivateWoundPayload } from '../../types';
const parser: Parser<PrivateWoundPayload> = {
  id: 'private_wound', artifactType: ArtifactType.PRIVATE_WOUND, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.characters) ? d.characters.map((item: any) => ({
      name: String(item?.name||''),
      privateWound: String(item?.privateWound||''),
      behavioralDistortion: String(item?.behavioralDistortion||''),
      surfacePoint1: String(item?.surfacePoint1||''),
      surfacePoint2: String(item?.surfacePoint2||''),
      surfacePoint3: String(item?.surfacePoint3||''),
      payoffMoment: String(item?.payoffMoment||''),
    })) : [];
    const payload: any = { characters: items };
    
    return { ok: true, payload: payload as PrivateWoundPayload };
  }
};
registerParser(parser);
export default parser;
