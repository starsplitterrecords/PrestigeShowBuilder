import { Show } from '../types/show';
import { PageBeat } from '../types/production';
import { BeatPanelPlan } from '../types/beat';
import { CharacterPosition } from '../types/character';
import { PanelZone, PanelDepth } from '../types/comic';
import { VpsRecord, PageDirectionPayload } from './types';
import { markVpsRecordApplied } from './storage';
import { scriptFingerprint } from './contentHash';

const ZONES: PanelZone[] = ['top-left','top-center','top-right',
  'middle-left','middle-center','middle-right',
  'bottom-left','bottom-center','bottom-right'];
const FACINGS = ['left','right','forward','away','up','down'] as const;

function coerceZone(z: string): PanelZone {
  return ZONES.includes(z as any) ? (z as PanelZone) : 'middle-center';
}
function coerceDepth(d: string): PanelDepth {
  return d === 'foreground' || d === 'background' ? d : 'midground';
}
function coerceFacing(f: string): CharacterPosition['facing'] {
  const s = (f || '').toLowerCase();
  return FACINGS.find(x => s.includes(x));
}

export async function applyPageDirection(
  record: VpsRecord, show: Show
): Promise<Show> {
  const pd = record.payload as PageDirectionPayload;
  const pageUid = record.scopeKey;
  if (!pageUid) return show;

  // Dedup props across panels → appearsInPanels.
  const propMap = new Map<string, { label: string;
    description: string; appearsInPanels: number[] }>();
  pd.panels.forEach((pl, idx) => {
    (pl.props ?? []).forEach(pr => {
      const key = pr.label.toLowerCase();
      const cur = propMap.get(key) ?? { label: pr.label,
        description: pr.description, appearsInPanels: [] };
      cur.appearsInPanels.push(idx);
      propMap.set(key, cur);
    });
  });
  const panelProps = [...propMap.values()]
    .filter(p => p.appearsInPanels.length > 1);  // multi-panel only

  const register = {
    lighting: pd.pageRegister.lighting,
    mood: pd.pageRegister.mood,
    emotionalRegister: pd.pageRegister.emotionalRegister,
    environmentalDetail: pd.pageRegister.environmentalDetail,
  };

  // Find and patch the PageBeat whose ProductionPage matches scopeKey.
  const issues = (show.issues ?? []).map(iss => {
    if (iss.uid !== record.issueUid) return iss;
    return { ...iss, acts: iss.acts.map(act => ({
      ...act, scenes: act.scenes.map(sc => ({
        ...sc, pageBeats: sc.pageBeats.map((pb: PageBeat) => {
          if (pb.productionPageUid !== pageUid) return pb;

          const n = (pb.script?.entries ?? []).length;
          const clamp = (arr: number[]) => arr.filter(i => i >= 0 && i < n);

          const panelPlans: BeatPanelPlan[] = pd.panels.map(pl => ({
            shotType: pl.shotType,
            action: pl.action,
            foreground: pl.foreground,
            midground: pl.midground,
            background: pl.background,
            relationalStaging: pl.relationalStaging,
            directAddress: pl.directAddress,
            dialogueIndices: clamp(pl.dialogueIndices ?? []),
            captionIndices: clamp(pl.captionIndices ?? []),
            characterPositions: (pl.blocking ?? []).map(b => ({
              characterHandle: b.handle,
              zone: coerceZone(b.zone),
              depth: coerceDepth(b.depth),
              facing: coerceFacing(b.facing),
              bodyLanguage: b.bodyLanguage,
              facialExpression: b.facialExpression,
              inResponseTo: b.inResponseTo,
            })),
          }));

          return {
            ...pb,
            panelPlans,
            panelProps: panelProps.length ? panelProps : undefined,
            visualDirection: register as any,
            layoutName: pd.pageComposition?.layoutName,
            focalPanelIndex: pd.pageComposition?.focalPanelIndex,
            isSplash: pd.pageComposition?.isSplash,
            panelPlanStale: false,
            scriptFingerprint: scriptFingerprint(pb)
          };
        }) })) })) };
  });

  await markVpsRecordApplied(record.id);
  return { ...show, issues } as Show;
}

// Convenience: apply every unapplied PAGE_DIRECTION record for a run.
import { getVpsRecordsByRun } from './storage';
import { VpsRecordType } from './types';
export async function applyAllPageDirection(
  runId: string, show: Show
): Promise<Show> {
  const recs = (await getVpsRecordsByRun(runId))
    .filter(r => r.recordType === VpsRecordType.PAGE_DIRECTION
      && !r.applied);
  let next = show;
  for (const r of recs) next = await applyPageDirection(r, next);
  return next;
}
