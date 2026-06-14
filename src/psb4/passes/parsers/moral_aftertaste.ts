import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, MoralAftertastePayload } from '../../types';
const parser: Parser<MoralAftertastePayload> = {
  id: 'moral_aftertaste', artifactType: ArtifactType.MORAL_AFTERTASTE, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.pages) ? d.pages.map((item: any) => ({
      page: String(item?.page||''),
      beat: String(item?.beat||''),
      action: String(item?.action||''),
      quietPanel: String(item?.quietPanel||''),
      dialogue: String(item?.dialogue||''),
      callback: String(item?.callback||''),
      readerAftertaste: String(item?.readerAftertaste||''),
    })) : [];
    const payload: any = { pages: items };
        if (d?.intendedAftertaste !== undefined) (payload as any).intendedAftertaste = String(d.intendedAftertaste||'');
    return { ok: true, payload: payload as MoralAftertastePayload };
  }
};
registerParser(parser);
export default parser;
