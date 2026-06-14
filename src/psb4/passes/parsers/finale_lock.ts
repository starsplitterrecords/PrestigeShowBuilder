import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, FinaleLockPayload } from '../../types';

const parser: Parser<FinaleLockPayload> = {
  id: 'finale_lock', artifactType: ArtifactType.FINALE_LOCK, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const v = String(d?.isFinaleInevitable || 'partially');
    const isFinaleInevitable = (['yes','no','partially'].includes(v) ? v : 'partially') as FinaleLockPayload['isFinaleInevitable'];
    const arr = (k: string) => Array.isArray(d?.[k]) ? d[k].map(String) : [];
    const forbiddenRepetitions = Array.isArray(d?.forbiddenRepetitions) ? d.forbiddenRepetitions.map((f: any) => ({ priorDid: String(f?.priorDid||''), finaleMustnot: String(f?.finaleMustnot||'') })) : [];
    return { ok: true, payload: { isFinaleInevitable, whatForcesIt: String(d?.whatForcesIt||''), cannotBeDelayed: String(d?.cannotBeDelayed||''), mustBeResolved: String(d?.mustBeResolved||''), lockedFinalePremise: String(d?.lockedFinalePremise||''), requiredConditions: arr('requiredConditions'), characterObligations: arr('characterObligations'), antagonistObligations: arr('antagonistObligations'), requiredPayoffs: arr('requiredPayoffs'), forbiddenRepetitions, finalStartingState: String(d?.finalStartingState||'') }};
  }
};
registerParser(parser);
export default parser;
