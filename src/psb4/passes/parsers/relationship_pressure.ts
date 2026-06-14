import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, RelationshipPressurePayload } from '../../types';
const parser: Parser<RelationshipPressurePayload> = {
  id: 'relationship_pressure', artifactType: ArtifactType.RELATIONSHIP_PRESSURE, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.relationships) ? d.relationships.map((item: any) => ({
      pair: String(item?.pair||''),
      wantFromEachOther: String(item?.wantFromEachOther||''),
      refuseToGive: String(item?.refuseToGive||''),
      misunderstanding: String(item?.misunderstanding||''),
      pressureForces: String(item?.pressureForces||''),
      visualChange: String(item?.visualChange||''),
      startingDynamic: String(item?.startingDynamic||''),
      middlePressurePoint: String(item?.middlePressurePoint||''),
      lateArcChange: String(item?.lateArcChange||''),
      sceneInsertion: String(item?.sceneInsertion||''),
      visualMarker: String(item?.visualMarker||''),
    })) : [];
    const payload: any = { relationships: items };
    
    return { ok: true, payload: payload as RelationshipPressurePayload };
  }
};
registerParser(parser);
export default parser;
