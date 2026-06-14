import { Show } from '../types/show';
import { VpsRecord, EnvironmentDesignPayload, VpsRecordType } from './types';
import { markVpsRecordApplied, getActiveVpsRun, getVpsRecordsByRun, markVpsRecordsStale } from './storage';
import { generateUID } from '../domainUtils';

export async function applyEnvironmentDesign(
  record: VpsRecord,
  show: Show
): Promise<Show> {
  const payload = record.payload as EnvironmentDesignPayload;
  const anchors = [ ...((show as any).settingAnchors ?? []) ];

  const match = (name: string) => anchors.find(a =>
    a.name?.toLowerCase() === name.toLowerCase() ||
    a.shortName?.toLowerCase() === name.toLowerCase());

  for (const env of payload.environments) {
    if (env.source === 'reused') continue;  // established, leave it
    const anchor = match(env.settingName);
    if (anchor) {
      anchor.visualDescription = env.visualDescription;
      anchor.mood = env.mood || anchor.mood;
      anchor.interiorExterior =
        env.interiorExterior || anchor.interiorExterior;
    } else {
      anchors.push({
        id: generateUID(),
        name: env.settingName,
        physicalDescription: env.visualDescription,
        visualDescription: env.visualDescription,
        mood: env.mood,
        interiorExterior: env.interiorExterior,
      });
    }
  }

  // Resolve settingAnchorId on every scene of this issue whose setting
  // now has an anchor.
  const issues = (show.issues ?? []).map(iss => {
    if (iss.uid !== record.issueUid) return iss;
    return {
      ...iss,
      acts: iss.acts.map(act => ({
        ...act,
        scenes: act.scenes.map(sc => {
          const a = match(sc.setting ?? '');
          return a ? { ...sc, settingAnchorId: a.id } : sc;
        })
      }))
    };
  });

  const changed = payload.environments.some(env => env.source !== 'reused');
  if (changed) {
    const vpsRun = await getActiveVpsRun(show.id, record.issueUid);
    if (vpsRun) {
      const recs = await getVpsRecordsByRun(vpsRun.id);
      const pageUids = recs
        .filter(r => r.recordType === VpsRecordType.PAGE_DIRECTION)
        .map(r => r.scopeKey!)
        .filter(Boolean);
      if (pageUids.length) {
        await markVpsRecordsStale(vpsRun.id, pageUids, 'environment-reapplied');
      }
    }
  }

  await markVpsRecordApplied(record.id);
  return { ...show, settingAnchors: anchors as any, issues } as Show;
}
