import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, ArcLadderPayload } from '../../types';

const parser: Parser<ArcLadderPayload> = {
  id: 'arc_ladder',
  artifactType: ArtifactType.ARC_LADDER,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const data = res.payload;
    if (!data || typeof data !== 'object') return { ok: false, error: 'Parsed JSON was not a valid object' };

    const countRaw = Number(data.recommendedIssueCount);
    const recommendedIssueCount = ([4, 6, 8].includes(countRaw) ? countRaw : 6) as 4 | 6 | 8;

    const issues = Array.isArray(data.issues) ? data.issues.map((i: any) => ({
      number: Number(i?.number || 0),
      workingTitle: String(i?.workingTitle || ''),
      function: String(i?.function || ''),
      externalProblem: String(i?.externalProblem || ''),
      characterConflict: String(i?.characterConflict || ''),
      oppositionMove: String(i?.oppositionMove || ''),
      climaxType: String(i?.climaxType || ''),
      endingCondition: String(i?.endingCondition || ''),
      howWorldChanged: String(i?.howWorldChanged || ''),
    })) : [];

    // Warn if model produced wrong count — log but accept
    if (data.recommendedIssueCount && !([4, 6, 8].includes(Number(data.recommendedIssueCount)))) {
      console.warn(`[arc_ladder parser] recommendedIssueCount ${data.recommendedIssueCount} is not 4/6/8 — defaulting to 6`);
    }

    return {
      ok: true,
      payload: {
        recommendedIssueCount,
        arcLengthRationale: String(data.arcLengthRationale || ''),
        issues,
        protagonistArc: String(data.protagonistArc || ''),
        supportingArcs: String(data.supportingArcs || ''),
        antagonistEscalation: String(data.antagonistEscalation || ''),
        recurringEngine: String(data.recurringEngine || ''),
        mustNotRepeat: String(data.mustNotRepeat || ''),
        nextTask: String(data.nextTask || ''),
      }
    };
  }
};

registerParser(parser);
export default parser;
