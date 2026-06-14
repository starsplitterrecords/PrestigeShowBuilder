import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, RepetitionDiagnosisPayload } from '../../types';

const parser: Parser<RepetitionDiagnosisPayload> = {
  id: 'repetition_diagnosis',
  artifactType: ArtifactType.REPETITION_DIAGNOSIS,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const data = res.payload;
    if (!data || typeof data !== 'object') return { ok: false, error: 'Parsed JSON was not a valid object' };

    const loops = Array.isArray(data.loops) ? data.loops.map((l: any) => ({
      patternName: String(l?.patternName || ''),
      occurrences: Array.isArray(l?.occurrences) ? l.occurrences.map(String) : [],
      whyWeakens: String(l?.whyWeakens || ''),
      keepVersion: String(l?.keepVersion || ''),
      cutOrMerge: Array.isArray(l?.cutOrMerge) ? l.cutOrMerge.map(String) : [],
      requiredEscalation: String(l?.requiredEscalation || ''),
    })) : [];

    const verdictRaw = String(data.verdict || 'mixed');
    const verdict = ['shaped_story', 'scene_dump', 'mixed'].includes(verdictRaw)
      ? verdictRaw as RepetitionDiagnosisPayload['verdict']
      : 'mixed';

    return { ok: true, payload: { loops, verdict, summary: String(data.summary || '') } };
  }
};

registerParser(parser);
export default parser;
