import React from 'react';
import { PageBeat } from '../../types/production';
import type { ScriptLine, CaptionEntry } from '../../types/beat';
import { validatePanelIndices } from '../../vps/validatePanelIndices';
import { useStore } from '../../StoreContext';
import { resolveEntries } from '../../domainUtils';
import { EditableField } from './fields/EditableField';

function isCaptionEntry(
  e: ScriptLine | CaptionEntry
): e is CaptionEntry {
  return (e as CaptionEntry).kind === 'caption';
}

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'amber' | 'neutral';
}

const Badge: React.FC<BadgeProps> = ({ children, tone = 'neutral' }) => {
  const isAmber = tone === 'amber';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
      isAmber ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-white/10 text-white/80 border border-white/10'
    }`}>
      {children}
    </span>
  );
};

interface Props {
  pageBeat: PageBeat;
  // DA-084: when provided, the Page Register and per-panel fields become editable.
  // Omit (or pass readOnly) to keep the legacy read-only view.
  updatePageBeat?: (updates: Partial<PageBeat>) => void;
  readOnly?: boolean;
}

export const WorkbenchPanelPlanView: React.FC<Props> = ({ pageBeat, updatePageBeat, readOnly }) => {
  const { state } = useStore();
  const show = state.currentShow;
  const [vdExpanded, setVdExpanded] = React.useState(true);
  const plans = pageBeat?.panelPlans ?? [];
  const v = validatePanelIndices(pageBeat);

  const editable = !!updatePageBeat && !readOnly;

  // Commit a single Page Register (visualDirection) field immutably.
  const commitVD = (field: 'lighting' | 'mood' | 'emotionalRegister' | 'environmentalDetail', value: string) => {
    if (!updatePageBeat) return;
    updatePageBeat({
      visualDirection: {
        ...(pageBeat.visualDirection ?? {}),
        [field]: value,
      } as any,
    });
  };

  // Commit a single field on one panel plan immutably (rebuilds the array).
  const commitPanel = (
    index: number,
    field: 'shotType' | 'action' | 'foreground' | 'midground' | 'background' | 'relationalStaging',
    value: string
  ) => {
    if (!updatePageBeat) return;
    const nextPlans = (pageBeat.panelPlans ?? []).map((pl, i) =>
      i === index ? { ...pl, [field]: value } : pl
    );
    updatePageBeat({ panelPlans: nextPlans as any });
  };

  // Show the editor when there is a visualDirection OR plans, OR when editing is
  // enabled (so an empty page can still gain a Page Register). Keeps the legacy
  // "render nothing" behavior only for the read-only, empty case.
  if (plans.length === 0 && !pageBeat?.visualDirection && !editable) return null;

  const vd = pageBeat.visualDirection ?? { lighting: '', mood: '', emotionalRegister: '', environmentalDetail: '' };

  return (
    <div className="border-t border-white/10 p-3 bg-black/10">
      {(pageBeat.visualDirection || editable) && (
        <div className="mb-3 p-2 bg-white/[0.02] border border-white/5 rounded">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setVdExpanded(!vdExpanded)}
          >
            <span className="text-[10px] uppercase tracking-widest text-sky-300 font-bold">
              Page Register
            </span>
            <span className="text-[10px] text-white/60 font-mono">
              {vdExpanded ? '[-]' : '[+]'}
            </span>
          </div>
          {vdExpanded && (
            editable ? (
              <div className="mt-2 space-y-2">
                <EditableField label="Lighting" value={vd.lighting ?? ''} multiline
                  placeholder="e.g. hard side-light, deep shadows"
                  onCommit={(val) => commitVD('lighting', val)} />
                <EditableField label="Mood" value={vd.mood ?? ''} multiline
                  placeholder="e.g. absurdly stoic"
                  onCommit={(val) => commitVD('mood', val)} />
                <EditableField label="Register" value={vd.emotionalRegister ?? ''} multiline
                  placeholder="e.g. deadpan seriousness"
                  onCommit={(val) => commitVD('emotionalRegister', val)} />
                <EditableField label="Detail" value={vd.environmentalDetail ?? ''} multiline
                  placeholder="e.g. moderate"
                  onCommit={(val) => commitVD('environmentalDetail', val)} />
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-xs text-white/90">
                <p><span className="font-semibold text-white/70 font-mono">LIGHTING:</span> {pageBeat.visualDirection?.lighting}</p>
                <p><span className="font-semibold text-white/70 font-mono">MOOD:</span> {pageBeat.visualDirection?.mood}</p>
                <p><span className="font-semibold text-white/70 font-mono">REGISTER:</span> {pageBeat.visualDirection?.emotionalRegister}</p>
                <p><span className="font-semibold text-white/70 font-mono">DETAIL:</span> {pageBeat.visualDirection?.environmentalDetail}</p>
              </div>
            )
          )}
        </div>
      )}

      {plans.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5 mb-2">
            <span className="text-[11px] uppercase tracking-widest text-white/70 font-black">
              Panel Plan · {plans.length} panels
            </span>
            {!v.fingerprintMatches && (
              <div className="self-start">
                <Badge tone="amber">
                  script changed since direction — re-run Page Direction
                </Badge>
              </div>
            )}
          </div>
          <div className="space-y-1.5">

            {plans.map((plan, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded p-2 text-xs">
                {editable ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/50 font-mono font-bold text-[10px] shrink-0 pt-1">P{i + 1}</span>
                      <div className="flex-1">
                        <EditableField label="Shot" value={plan.shotType ?? ''}
                          placeholder="e.g. medium two-shot"
                          onCommit={(val) => commitPanel(i, 'shotType', val)} />
                      </div>
                    </div>
                    <EditableField label="Action" value={plan.action ?? ''} multiline
                      placeholder="What the panel shows"
                      onCommit={(val) => commitPanel(i, 'action', val)} />
                    <div className="grid grid-cols-3 gap-1.5">
                      <EditableField label="FG" value={plan.foreground ?? ''} multiline
                        onCommit={(val) => commitPanel(i, 'foreground', val)} />
                      <EditableField label="MG" value={plan.midground ?? ''} multiline
                        onCommit={(val) => commitPanel(i, 'midground', val)} />
                      <EditableField label="BG" value={plan.background ?? ''} multiline
                        onCommit={(val) => commitPanel(i, 'background', val)} />
                    </div>
                    <EditableField label="Staging" value={plan.relationalStaging ?? ''} multiline
                      placeholder="Relational staging note"
                      onCommit={(val) => commitPanel(i, 'relationalStaging', val)} />
                    {plan.directAddress && (
                      <p className="text-[10px] text-amber-300 font-semibold font-mono">✦ Direct Address</p>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="text-white/80 font-mono font-bold">
                      P{i + 1} · {plan.shotType}
                    </span>
                    <p className="text-white/90 mt-0.5 leading-relaxed">
                      {plan.action}
                    </p>
                    {(plan.foreground || plan.midground || plan.background) && (
                      <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-white/70 font-mono">
                        <span>FG: {plan.foreground || '-'}</span>
                        <span>MG: {plan.midground || '-'}</span>
                        <span>BG: {plan.background || '-'}</span>
                      </div>
                    )}
                    {plan.relationalStaging && (
                      <p className="mt-1 text-[10px] text-white/70 leading-relaxed font-mono">
                        <span className="font-bold text-white/60">STAGING:</span> {plan.relationalStaging}
                      </p>
                    )}
                    {plan.directAddress && (
                      <p className="mt-1 text-[10px] text-amber-300 font-semibold font-mono">
                        ✦ Direct Address
                      </p>
                    )}
                  </>
                )}
                {((plan.dialogueIndices && plan.dialogueIndices.length > 0) ||
                  (plan.captionIndices && plan.captionIndices.length > 0)) && (
                  <div className="mt-2 pl-2 border-l-2 border-white/10 space-y-1">
                    {Array.from(new Set([...(plan.captionIndices ?? []), ...(plan.dialogueIndices ?? [])]))
                      .sort((a, b) => a - b)
                      .map((idx) => {
                        const entries = resolveEntries(pageBeat, show);
                        const entry = entries[idx];
                        if (!entry) return null;
                        return (
                          <p key={idx} className="text-[10px] text-white/70 italic leading-relaxed font-sans">
                            {isCaptionEntry(entry)
                              ? `[${entry.style ?? 'caption'}] ${entry.text}`
                              : `${(entry as any).speakerDisplayLabel || entry.characterHandle || 'Speaker'}: "${entry.text}"`}
                          </p>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Prop Lock section (DA-032 / D185 compliant) */}
      {(pageBeat.panelProps?.length ?? 0) > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <span className="text-[11px] uppercase tracking-widest text-white/70 font-black">
            Prop Lock · {pageBeat.panelProps!.length} object{pageBeat.panelProps!.length > 1 ? 's' : ''}
          </span>
          <div className="mt-1.5 space-y-1">
            {pageBeat.panelProps!.map((prop, i) => (
              editable ? (
                <div key={i} className="grid grid-cols-[120px_1fr] gap-1.5 items-start">
                  <EditableField label="" value={prop.label ?? ''} monospace
                    placeholder="label"
                    onCommit={(val) => {
                      const next = (pageBeat.panelProps ?? []).map((pr, j) => j === i ? { ...pr, label: val } : pr);
                      updatePageBeat!({ panelProps: next as any });
                    }} />
                  <EditableField label="" value={prop.description ?? ''} multiline
                    placeholder="description (the prop spec)"
                    onCommit={(val) => {
                      const next = (pageBeat.panelProps ?? []).map((pr, j) => j === i ? { ...pr, description: val } : pr);
                      updatePageBeat!({ panelProps: next as any });
                    }} />
                </div>
              ) : (
                <div key={i} className="text-xs bg-white/[0.02] border border-white/5 rounded px-2 py-1">
                  <span className="text-amber-300 font-mono font-medium">
                    {prop.label}
                  </span>
                  <span className="text-white/80 ml-1.5">
                    — {prop.description}
                  </span>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
