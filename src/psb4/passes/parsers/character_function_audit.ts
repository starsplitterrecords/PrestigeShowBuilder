import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, CharacterFunctionAuditPayload } from '../../types';

const parser: Parser<CharacterFunctionAuditPayload> = {
  id: 'character_function_audit',
  artifactType: ArtifactType.CHARACTER_FUNCTION_AUDIT,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const data = res.payload;
    if (!data || typeof data !== 'object') return { ok: false, error: 'Parsed JSON was not a valid object' };

    const characters = Array.isArray(data.characters) ? data.characters.map((c: any) => {
      const riskRaw = String(c?.flatteningRisk || 'medium');
      const flatteningRisk = (['low', 'medium', 'high'].includes(riskRaw) ? riskRaw : 'medium') as 'low' | 'medium' | 'high';
      return {
        name: String(c?.name || ''),
        handle: c?.handle ? String(c.handle) : undefined,
        strongestFunction: String(c?.strongestFunction || ''),
        repeatedBehaviorRisk: String(c?.repeatedBehaviorRisk || ''),
        flatteningRisk,
        neededPerSection: String(c?.neededPerSection || ''),
        revisionRequirement: String(c?.revisionRequirement || ''),
      };
    }) : [];

    return { ok: true, payload: { characters, summary: String(data.summary || '') } };
  }
};

registerParser(parser);
export default parser;
