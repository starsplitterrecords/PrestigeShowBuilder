import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, IssueDraftPayload } from '../../types';

const parser: Parser<IssueDraftPayload> = {
  id: 'issue_draft', artifactType: ArtifactType.ISSUE_DRAFT, payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    if (!d || typeof d !== 'object') return { ok: false, error: 'Not an object' };
    const beatSpine = Array.isArray(d.beatSpine) ? d.beatSpine.map((b: any) => ({
      beatNumber: Number(b?.beatNumber || 0),
      beat: String(b?.beat || ''),
      sourceUsed: String(b?.sourceUsed || ''),
      storyFunction: String(b?.storyFunction || ''),
      characterTurn: String(b?.characterTurn || ''),
      consequence: String(b?.consequence || ''),
    })) : [];
    return { ok: true, payload: {
      issueNumber: Number(d.issueNumber || 0),
      workingTitle: String(d.workingTitle || ''),
      function: String(d.function || ''),
      corePromise: String(d.corePromise || ''),
      beatSpine,
      treatment: String(d.treatment || ''),
      preservedMaterial: Array.isArray(d.preservedMaterial) ? d.preservedMaterial.map(String) : [],
      consolidatedMaterial: Array.isArray(d.consolidatedMaterial) ? d.consolidatedMaterial.map(String) : [],
      addedConnectiveTissue: Array.isArray(d.addedConnectiveTissue) ? d.addedConnectiveTissue.map(String) : [],
      outputState: String(d.outputState || ''),
      setupForNext: String(d.setupForNext || ''),
      unresolvedItems: Array.isArray(d.unresolvedItems) ? d.unresolvedItems.map(String) : [],
    }};
  }
};
registerParser(parser);
export default parser;
