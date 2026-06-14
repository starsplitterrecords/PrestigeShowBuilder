import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, EarnedLinePayload } from '../../types';
const parser: Parser<EarnedLinePayload> = {
  id: 'earned_line', artifactType: ArtifactType.EARNED_LINE, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.characters) ? d.characters.map((item: any) => ({
      name: String(item?.name||''),
      earnedLine: String(item?.earnedLine||''),
      whyImpossibleEarlier: String(item?.whyImpossibleEarlier||''),
      whatChanged: String(item?.whatChanged||''),
      setupBeats: String(item?.setupBeats||''),
      finalPlacement: String(item?.finalPlacement||''),
      surroundingAction: String(item?.surroundingAction||''),
    })) : [];
    const payload: any = { characters: items };
    
    return { ok: true, payload: payload as EarnedLinePayload };
  }
};
registerParser(parser);
export default parser;
