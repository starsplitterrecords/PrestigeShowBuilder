import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, ScenePoolPayload } from '../../types';

const parser: Parser<ScenePoolPayload> = {
  id: 'scene_pool', artifactType: ArtifactType.SCENE_POOL_ENTRY, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    const scenes = Array.isArray(d?.scenes) ? d.scenes.map((s: any) => ({
      title: String(s?.title || ''), characters: Array.isArray(s?.characters) ? s.characters.map(String) : [],
      placementSuggestion: String(s?.placementSuggestion || ''), lengthNote: String(s?.lengthNote || ''),
      emotionalFunction: String(s?.emotionalFunction || ''), whatItReveals: String(s?.whatItReveals || ''),
      fullVersion: String(s?.fullVersion || ''), compressedVersion: String(s?.compressedVersion || ''),
      singlePanelVersion: String(s?.singlePanelVersion || ''), laterPayoff: String(s?.laterPayoff || ''),
      integrationRule: String(s?.integrationRule || ''),
    })) : [];
    const characterHabits = Array.isArray(d?.characterHabits) ? d.characterHabits.map((h: any) => ({
      character: String(h?.character || ''), habit: String(h?.habit || ''),
      emotionalMeaning: String(h?.emotionalMeaning || ''), bestUse: String(h?.bestUse || ''), payoff: String(h?.payoff || ''),
    })) : [];
    return { ok: true, payload: { scenes, characterHabits } };
  }
};
registerParser(parser);
export default parser;
