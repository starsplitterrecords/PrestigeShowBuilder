import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, PageRhythmPayload } from '../../types';
const parser: Parser<PageRhythmPayload> = {
  id: 'page_rhythm', artifactType: ArtifactType.PAGE_RHYTHM, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.sections) ? d.sections.map((item: any) => ({
      sectionLabel: String(item?.sectionLabel||''),
      currentRhythmIssue: String(item?.currentRhythmIssue||''),
      recommendedTreatment: String(item?.recommendedTreatment||''),
      sceneOrPageAffected: String(item?.sceneOrPageAffected||''),
      reason: String(item?.reason||''),
    })) : [];
    const payload: any = { sections: items };
    
    return { ok: true, payload: payload as PageRhythmPayload };
  }
};
registerParser(parser);
export default parser;
