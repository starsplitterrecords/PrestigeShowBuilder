import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, OutputStatePayload } from '../../types';

const FIELDS: (keyof OutputStatePayload)[] = ['issueNumber','externalCondition','protagonistCondition','antagonistCondition','emotionalCondition','practicalCondition','nextConcreteProblem','unresolvedArgument','visualMotifCarriedForward','newEngineRequired'];
const parser: Parser<OutputStatePayload> = {
  id: 'output_state', artifactType: ArtifactType.OUTPUT_STATE, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload; const result: any = {};
    for (const f of FIELDS) result[f] = f === 'issueNumber' ? Number(d?.[f] || 0) : String(d?.[f] || '');
    return { ok: true, payload: result as OutputStatePayload };
  }
};
registerParser(parser);
export default parser;
