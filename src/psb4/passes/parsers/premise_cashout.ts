import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, PremiseCashoutPayload } from '../../types';

const parser: Parser<PremiseCashoutPayload> = {
  id: 'premise_cashout',
  artifactType: ArtifactType.PREMISE_CASHOUT,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const data = res.payload;
    if (!data || typeof data !== 'object') return { ok: false, error: 'Parsed JSON was not a valid object' };

    const issues = Array.isArray(data.issues) ? data.issues.map((i: any) => ({
      issueLabel: String(i?.issueLabel || ''),
      titlePremisePromise: String(i?.titlePremisePromise || ''),
      concreteStoryProblem: String(i?.concreteStoryProblem || ''),
      characterCollisions: String(i?.characterCollisions || ''),
      oppositionAngle: String(i?.oppositionAngle || ''),
      climaxRequirement: String(i?.climaxRequirement || ''),
    })) : [];

    return {
      ok: true,
      payload: {
        issues,
        reformulatedSeriesPremise: data.reformulatedSeriesPremise ? String(data.reformulatedSeriesPremise) : undefined,
        summary: String(data.summary || ''),
      }
    };
  }
};

registerParser(parser);
export default parser;
