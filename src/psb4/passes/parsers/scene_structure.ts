import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, SceneStructurePayload, SceneStructureBeat, SceneScriptEntry } from '../../types';

const parser: Parser<SceneStructurePayload> = {
  id: 'scene_structure',
  artifactType: ArtifactType.SCENE_STRUCTURE,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    if (!d || typeof d !== 'object') return { ok: false, error: 'Not an object' };

    const rawActs = Array.isArray(d.acts) ? d.acts : [];
    
    const acts = rawActs.map((actRaw: any) => {
      const rawScenes = Array.isArray(actRaw?.scenes) ? actRaw.scenes : [];
      const scenes = rawScenes.map((szRaw: any) => {
        const rawBeats = Array.isArray(szRaw?.beats) ? szRaw.beats : [];
        const beats: SceneStructureBeat[] = rawBeats.map((btRaw: any) => {
          const beatBase: any = {
            description: String(btRaw?.description || ''),
            beatType: (btRaw?.beatType === 'TABLEAU' || btRaw?.beatType === 'ESTABLISHING' || btRaw?.beatType === 'MEMORY_BLEED' || btRaw?.beatType === 'DIALOGUE')
              ? btRaw.beatType
              : 'DIALOGUE',
            characterHandles: Array.isArray(btRaw?.characterHandles) ? btRaw.characterHandles.map(String) : [],
            subtext: String(btRaw?.subtext || ''),
            visualNote: String(btRaw?.visualNote || ''),
            direction: String(btRaw?.direction || ''),
            source: (btRaw?.source === 'preserved' || btRaw?.source === 'consolidated' || btRaw?.source === 'new')
              ? btRaw.source
              : 'new',
            sourceBeatNumbers: Array.isArray(btRaw?.sourceBeatNumbers) ? btRaw.sourceBeatNumbers.map(Number) : [],
          };

          const script: SceneScriptEntry[] = Array.isArray(btRaw?.script)
            ? btRaw.script.map((e: any) => ({
                kind: e.kind === 'caption' ? 'caption' : 'line',
                characterHandle: e.characterHandle || undefined,
                text: String(e.text || ''),
                parenthetical: e.parenthetical || undefined,
                captionStyle: e.captionStyle || undefined,
              }))
            : [];

          return { ...beatBase, script: script.length > 0 ? script : undefined };
        });

        return {
          sceneNumber: Number(szRaw?.sceneNumber || 0),
          title: String(szRaw?.title || ''),
          setting: String(szRaw?.setting || ''),
          dramaticWant: String(szRaw?.dramaticWant || ''),
          function: String(szRaw?.function || ''),
          beats,
        };
      });

      return {
        actNumber: Number(actRaw?.actNumber || 0),
        title: String(actRaw?.title || ''),
        scenes,
      };
    });

    return {
      ok: true,
      payload: { acts },
    };
  }
};

registerParser(parser);
export default parser;
