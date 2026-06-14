import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, FormFunctionAuditPayload } from '../../types';

const VALID_DECISIONS = ['keep', 'cut', 'merge', 'compress', 'rewrite', 'tone'] as const;

interface SceneAudit {
  sceneId: string;
  intention: string;
  conflict: string;
  turn: string;
  consequence: string;
  visualFunction: string;
  changesStory: boolean;
  decision: 'keep' | 'cut' | 'merge' | 'compress' | 'rewrite' | 'tone';
  note: string;
}

const parser: Parser<FormFunctionAuditPayload> = {
  id: 'form_function_audit',
  artifactType: ArtifactType.FORM_FUNCTION_AUDIT,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const data = res.payload;
    if (!data || typeof data !== 'object') return { ok: false, error: 'Parsed JSON was not a valid object' };

    const rawScenes = Array.isArray(data.scenes) ? data.scenes : [];
    const scenes: SceneAudit[] = rawScenes.map((s: any) => {
      const decision = (VALID_DECISIONS as readonly string[]).includes(s?.decision) ? s.decision : 'keep';
      return {
        sceneId: String(s?.sceneId || ''),
        intention: String(s?.intention || ''),
        conflict: String(s?.conflict || ''),
        turn: String(s?.turn || ''),
        consequence: String(s?.consequence || ''),
        visualFunction: String(s?.visualFunction || ''),
        changesStory: s?.changesStory === true || s?.changesStory === 'true',
        decision: decision as any,
        note: String(s?.note || ''),
      };
    });

    const weakSceneCount = scenes.filter((s: SceneAudit) => !s.changesStory).length;
    return { ok: true, payload: { scenes, weakSceneCount, summary: String(data.summary || '') } };
  }
};

registerParser(parser);
export default parser;
