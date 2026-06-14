import { cleanAndParseJSON } from '../../psb4/passes/parsers/index';

export const environment_design = {
  id: 'environment_design',
  parse(raw: string) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false as const, error: res.error };
    const d = res.payload;
    if (!d || typeof d !== 'object') {
      return { ok: false as const, error: 'Not an object' };
    }
    const envs = Array.isArray(d.environments) ? d.environments : [];
    const normalizedEnvs = envs.map((e: any) => ({
      settingName: String(e.settingName || ''),
      settingAnchorId: e.settingAnchorId ? String(e.settingAnchorId) : undefined,
      source: e.source === 'reused' ? ('reused' as const) : ('generated' as const),
      visualDescription: String(e.visualDescription || ''),
      mood: String(e.mood || ''),
      interiorExterior: e.interiorExterior === 'exterior'
        ? ('exterior' as const)
        : e.interiorExterior === 'mixed'
        ? ('mixed' as const)
        : ('interior' as const),
    }));

    return { ok: true as const, payload: { environments: normalizedEnvs } };
  }
};
