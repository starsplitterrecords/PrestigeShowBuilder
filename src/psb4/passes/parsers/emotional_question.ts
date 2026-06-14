import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, EmotionalQuestionPayload } from '../../types';
const parser: Parser<EmotionalQuestionPayload> = {
  id: 'emotional_question', artifactType: ArtifactType.EMOTIONAL_QUESTION, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.sections) ? d.sections.map((item: any) => ({
      sectionLabel: String(item?.sectionLabel||''),
      localQuestion: String(item?.localQuestion||''),
      strongestPressureScene: String(item?.strongestPressureScene||''),
      currentGap: String(item?.currentGap||''),
      revision: String(item?.revision||''),
      suggestedTextOrPanel: String(item?.suggestedTextOrPanel||''),
    })) : [];
    const payload: any = { sections: items };
        if (d?.arcEmotionalQuestion !== undefined) (payload as any).arcEmotionalQuestion = String(d.arcEmotionalQuestion||'');
    return { ok: true, payload: payload as EmotionalQuestionPayload };
  }
};
registerParser(parser);
export default parser;
