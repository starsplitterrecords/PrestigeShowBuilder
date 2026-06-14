import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, WorkingInventoryPayload, WorkingElement } from '../../types';

const parser: Parser<WorkingInventoryPayload> = {
  id: 'working_inventory',
  artifactType: ArtifactType.WORKING_INVENTORY,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<Partial<WorkingInventoryPayload>>(raw);
    if (res.ok === false) {
      return { ok: false, error: (res as any).error };
    }
    const data = res.payload;
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'Parsed JSON was not a valid object' };
    }

    const rawElements = Array.isArray(data.elements) ? data.elements : [];
    const elements: WorkingElement[] = rawElements.map((el: any) => {
      return {
        element: el?.element !== undefined ? String(el.element) : '',
        whyItWorks: el?.whyItWorks !== undefined ? String(el.whyItWorks) : '',
        whatToProtect: el?.whatToProtect !== undefined ? String(el.whatToProtect) : '',
        exampleFromDraft: el?.exampleFromDraft !== undefined ? String(el.exampleFromDraft) : ''
      };
    });

    return { ok: true, payload: { elements } };
  }
};

registerParser(parser);
export default parser;
