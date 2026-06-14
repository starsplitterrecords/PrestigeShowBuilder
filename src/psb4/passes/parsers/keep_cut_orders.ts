import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, KeepCutOrdersPayload } from '../../types';

const VALID_CATEGORIES = ['keep', 'cut', 'consolidate', 'limit', 'compress'] as const;

const parser: Parser<KeepCutOrdersPayload> = {
  id: 'keep_cut_orders',
  artifactType: ArtifactType.KEEP_CUT_ORDERS,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const data = res.payload;
    if (!data || typeof data !== 'object') return { ok: false, error: 'Parsed JSON was not a valid object' };

    const orders = Array.isArray(data.orders) ? data.orders.map((o: any) => {
      const category = VALID_CATEGORIES.includes(o?.category) ? o.category : 'keep';
      return {
        category,
        directive: String(o?.directive || ''),
        reason: String(o?.reason || ''),
      };
    }) : [];

    return { ok: true, payload: { orders, summary: String(data.summary || '') } };
  }
};

registerParser(parser);
export default parser;
