import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, PageTurnMapPayload } from '../../types';
const parser: Parser<PageTurnMapPayload> = {
  id: 'page_turn_map', artifactType: ArtifactType.PAGE_TURN_MAP, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.sections) ? d.sections.map((item: any) => ({
      sectionLabel: String(item?.sectionLabel||''),
      emotionalPageTurnQuestion: String(item?.emotionalPageTurnQuestion||''),
      actByActEscalation: String(item?.actByActEscalation||''),
      currentWeakTransition: String(item?.currentWeakTransition||''),
      revisedPageTurn: String(item?.revisedPageTurn||''),
      readerPull: String(item?.readerPull||''),
    })) : [];
    const payload: any = { sections: items };
    
    return { ok: true, payload: payload as PageTurnMapPayload };
  }
};
registerParser(parser);
export default parser;
