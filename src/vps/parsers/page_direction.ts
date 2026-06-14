import { cleanAndParseJSON } from '../../psb4/passes/parsers/index';
import { PageDirectionPayload } from '../types';

const DEPTHS = ['foreground', 'midground', 'background'];
const DETAIL = ['sparse', 'moderate', 'rich'];

export const page_direction = {
  id: 'page_direction',
  parse(raw: string) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false as const, error: res.error };
    const d = res.payload;
    if (!d || typeof d !== 'object') {
      return { ok: false as const, error: 'Not an object' };
    }

    const reg = d.pageRegister || {};
    const pageRegister = {
      lighting: String(reg.lighting || ''),
      mood: String(reg.mood || ''),
      emotionalRegister: String(reg.emotionalRegister || ''),
      environmentalDetail: DETAIL.includes(reg.environmentalDetail)
        ? (reg.environmentalDetail as 'sparse' | 'moderate' | 'rich')
        : ('moderate' as const),
    };

    const panels = (Array.isArray(d.panels) ? d.panels : [])
      .map((pl: any) => ({
        shotType: String(pl?.shotType || ''),
        action: String(pl?.action || ''),
        foreground: String(pl?.foreground || ''),
        midground: String(pl?.midground || ''),
        background: String(pl?.background || ''),
        relationalStaging: String(pl?.relationalStaging || ''),
        blocking: (Array.isArray(pl?.blocking) ? pl.blocking : [])
          .map((b: any) => ({
            handle: String(b?.handle || ''),
            zone: String(b?.zone || ''),
            depth: DEPTHS.includes(b?.depth)
              ? (b.depth as 'foreground' | 'midground' | 'background')
              : ('midground' as const),
            facing: String(b?.facing || ''),
            bodyLanguage: String(b?.bodyLanguage || ''),
            facialExpression: String(b?.facialExpression || ''),
            inResponseTo: String(b?.inResponseTo || ''),
          })),
        dialogueIndices: (Array.isArray(pl?.dialogueIndices)
          ? pl.dialogueIndices : []).map(Number),
        captionIndices: (Array.isArray(pl?.captionIndices)
          ? pl.captionIndices : []).map(Number),
        directAddress: pl?.directAddress === true,
        directAddressRationale: pl?.directAddressRationale || undefined,
        props: (Array.isArray(pl?.props) ? pl.props : [])
          .map((pr: any) => ({
            label: String(pr?.label || ''),
            description: String(pr?.description || ''),
          })).filter((pr: any) => pr.label),
      }));

    const comp = d.pageComposition || {};
    const panelCount = panels.length || 1;
    const DEFAULT_LAYOUT: Record<number, string> = {
      1: 'SPLASH', 2: 'EQUAL_CONFRONTATION',
      3: 'DIALOGUE_ROW', 4: 'FOUR-PANEL 2x2 GRID',
    };

    const VALID_LAYOUTS_BY_COUNT: Record<number, string[]> = {
      1: ['SPLASH', 'SINGLE PANEL', 'FULL_PAGE_COMPOSITE'],
      2: ['WIDE_TIGHT', 'EQUAL_CONFRONTATION', 'CINEMATIC_STRIP', 'ASYMMETRIC_WEIGHT', 'TIGHT_WIDE', 'TWO-PANEL VERTICAL SPLIT', 'TWO-PANEL EQUAL STACK', 'TWO-PANEL CINEMATIC', 'TWO-PANEL ASYMMETRIC'],
      3: ['ACTION_SEQUENCE', 'DIALOGUE_ROW', 'FEATURE_DETAIL', 'ESCALATION', 'TRIPTYCH_H', 'TRIPTYCH_V', 'WIDE_SPLIT', 'SPLIT_WIDE', 'THREE-PANEL SEQUENCE', 'THREE-PANEL FOCUS', 'THREE-PANEL ESCALATION'],
      4: ['GRID_2x2', 'FEATURE_STRIP', 'MAGAZINE', 'FOUR-PANEL 2x2 GRID', 'FOUR-PANEL FEATURE'],
      5: ['DYNAMIC_5', 'ESCALATING_5'],
      6: ['GRID_2x3', 'FEATURE_6'],
    };

    const rawLayout = String(comp.layoutName || '').trim();
    const allowed = VALID_LAYOUTS_BY_COUNT[panelCount] || [];
    const layoutName = allowed.includes(rawLayout)
      ? rawLayout
      : (DEFAULT_LAYOUT[panelCount] || 'SPLASH');

    const pageComposition = {
      layoutName,
      focalPanelIndex: Number.isInteger(comp.focalPanelIndex)
        ? Math.max(0, Math.min(panelCount - 1, comp.focalPanelIndex)) : 0,
      isSplash: comp.isSplash === true || panelCount === 1,
      compositionNote: String(comp.compositionNote || ''),
    };

    return {
      ok: true as const,
      payload: { pageRegister, pageComposition, panels } as PageDirectionPayload
    };
  },
};
