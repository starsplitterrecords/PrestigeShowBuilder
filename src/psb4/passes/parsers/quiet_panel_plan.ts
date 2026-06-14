import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, QuietPanelPlanPayload } from '../../types';
const parser: Parser<QuietPanelPlanPayload> = {
  id: 'quiet_panel_plan', artifactType: ArtifactType.QUIET_PANEL_PLAN, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const items = Array.isArray(d?.panels) ? d.panels.map((item: any) => ({
      section: String(item?.section||''),
      placement: String(item?.placement||''),
      visualDescription: String(item?.visualDescription||''),
      emotionalFunction: String(item?.emotionalFunction||''),
      panelType: String(item?.panelType||''),
      suggestedSize: String(item?.suggestedSize||''),
    })) : [];
    const payload: any = { panels: items };
    
    return { ok: true, payload: payload as QuietPanelPlanPayload };
  }
};
registerParser(parser);
export default parser;
