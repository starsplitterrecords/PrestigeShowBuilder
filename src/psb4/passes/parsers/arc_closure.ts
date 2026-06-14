import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, ArcClosurePayload } from '../../types';

const parser: Parser<ArcClosurePayload> = {
  id: 'arc_closure', artifactType: ArtifactType.ARC_CLOSURE_REPORT, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const issuePayoffMap = Array.isArray(d?.issuePayoffMap) ? d.issuePayoffMap.map((i: any) => ({ issueLabel: String(i?.issueLabel||''), seed: String(i?.seed||''), finalePayoff: String(i?.finalePayoff||''), payoffType: String(i?.payoffType||''), readerReUnderstanding: String(i?.readerReUnderstanding||'') })) : [];
    const characterClosureMap = Array.isArray(d?.characterClosureMap) ? d.characterClosureMap.map((c: any) => ({ character: String(c?.character||''), startingPosition: String(c?.startingPosition||''), finalAction: String(c?.finalAction||''), closureAchieved: c?.closureAchieved === true, remainingOpenTension: String(c?.remainingOpenTension||'') })) : [];
    const motifClosureMap = Array.isArray(d?.motifClosureMap) ? d.motifClosureMap.map((m: any) => ({ motif: String(m?.motif||''), payoff: String(m?.payoff||'') })) : [];
    return { ok: true, payload: { issuePayoffMap, characterClosureMap, motifClosureMap, unresolvedThreads: Array.isArray(d?.unresolvedThreads) ? d.unresolvedThreads.map(String) : [], finalAftertaste: String(d?.finalAftertaste||''), remainingRevisionRisks: Array.isArray(d?.remainingRevisionRisks) ? d.remainingRevisionRisks.map(String) : [] }};
  }
};
registerParser(parser);
export default parser;
