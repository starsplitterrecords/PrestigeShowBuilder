import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../StoreContext';
import { findDialogueRecoveryMatches, RecoveryMatch } from '../utils/dialogueRecovery';
import { AlertTriangle, Check, Loader, X, HelpCircle } from 'lucide-react';
 
interface Props {
  isOpen: boolean;
  onClose: () => void;
}
 
// DA-108: Dialogue Speaker Recovery modal. Preview-then-apply: shows every
// proposed match against the show's actual writing-pass artifacts before
// touching anything. Only 'matched' rows get written; 'ambiguous' and
// 'no_match' rows are left for the per-line picker (DA-107) since they
// can't be safely auto-resolved.
export const DialogueRecoveryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useStore();
  const show = state.currentShow;
 
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<RecoveryMatch[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const [didApply, setDidApply] = useState(false);
 
  useEffect(() => {
    if (!isOpen || !show) return;
    setIsLoading(true);
    setDidApply(false);
    findDialogueRecoveryMatches(show)
      .then(setMatches)
      .finally(() => setIsLoading(false));
  }, [isOpen, show?.id]);
 
  const counts = useMemo(() => ({
    matched: matches.filter(m => m.status === 'matched').length,
    ambiguous: matches.filter(m => m.status === 'ambiguous').length,
    noMatch: matches.filter(m => m.status === 'no_match').length,
  }), [matches]);
 
  const handleApply = async () => {
    if (!show) return;
    const toApply = matches.filter(m => m.status === 'matched');
    if (toApply.length === 0) return;
 
    setIsApplying(true);
    setApplyProgress(0);
 
    // Build a single fid -> proposed assignment map, then one pass over the
    // whole show writing every matching line. One dispatch, not one per line.
    const byLineFid = new Map(toApply.map(m => [m.lineFid, m]));
 
    const updatedIssues = (show.issues ?? []).map(iss => ({
      ...iss,
      acts: iss.acts.map(act => ({
        ...act,
        scenes: act.scenes.map(sc => ({
          ...sc,
          pageBeats: sc.pageBeats.map(pb => {
            const script: any = pb.script || {};
            const entries: any[] = script.entries?.length ? script.entries : (script.lines ?? []);
            let changed = false;
            const newEntries = entries.map((line: any) => {
              const match = byLineFid.get(line.fid);
              if (!match || !match.proposedHandle) return line;
              changed = true;
              const { speakerClassification, ...rest } = line;
              return {
                ...rest,
                characterHandle: match.proposedHandle,
                speakerName: match.proposedCharacterName || match.proposedHandle,
              };
            });
            if (!changed) return pb;
            return { ...pb, script: { ...script, entries: newEntries } };
          }),
        })),
      })),
    }));
 
    setApplyProgress(toApply.length);
    dispatch({ type: 'UPDATE_SHOW', updates: { issues: updatedIssues } });
    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: Date.now().toString(), type: 'success',
        message: `Recovered ${toApply.length} speaker${toApply.length !== 1 ? 's' : ''} from original writing-pass data.`,
      },
    });
 
    setIsApplying(false);
    setDidApply(true);
  };
 
  if (!isOpen) return null;
 
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
      <div className="glass p-8 w-full max-w-5xl relative max-h-[90vh] flex flex-col border-white/70 bg-[#070707] text-white">
 
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tighter text-amber-500">Dialogue Speaker Recovery</h2>
            <p className="text-[10px] text-white/60 uppercase tracking-widest mt-1">
              Matches unresolved lines against this show's original writing-pass artifacts, by exact text.
            </p>
          </div>
          {!isApplying && (
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white text-[10px] uppercase tracking-widest font-black"
            >
              Close
            </button>
          )}
        </div>
 
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
            <Loader className="animate-spin text-amber-500" size={24} />
            <p className="text-xs text-white/70 uppercase tracking-widest font-bold">Scanning writing-pass artifacts...</p>
          </div>
        ) : isApplying ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-6">
            <Loader className="animate-spin text-amber-500" size={32} />
            <p className="text-sm text-white font-bold uppercase tracking-widest">
              Writing {applyProgress} recovered speaker{applyProgress !== 1 ? 's' : ''}...
            </p>
          </div>
        ) : matches.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
            <Check className="text-emerald-400" size={32} />
            <p className="text-sm text-white/95 font-bold uppercase tracking-widest text-center leading-relaxed">
              No unresolved speakers found.
            </p>
          </div>
        ) : (
          <>
            {/* Summary counts */}
            <div className="flex items-center gap-4 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Check size={14} />
                <span className="text-xs font-bold">{counts.matched} matched</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <HelpCircle size={14} />
                <span className="text-xs font-bold">{counts.ambiguous} ambiguous</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-400">
                <AlertTriangle size={14} />
                <span className="text-xs font-bold">{counts.noMatch} no match</span>
              </div>
              <span className="text-[10px] text-white/40 ml-auto">
                Ambiguous and no-match lines are left for the per-line picker in the Dialogue Lines panel.
              </span>
            </div>
 
            {/* Scrollable match table */}
            <div className="flex-1 overflow-y-auto py-4 space-y-1.5 pr-2">
              {matches.map((m, i) => {
                const statusColor = m.status === 'matched' ? 'border-emerald-500/30 bg-emerald-500/5'
                  : m.status === 'ambiguous' ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-red-500/20 bg-red-500/5';
                return (
                  <div key={`${m.lineFid}-${i}`} className={`flex items-start gap-3 p-2.5 rounded border ${statusColor}`}>
                    <span className="text-[9px] font-mono text-white/40 shrink-0 pt-0.5 w-24 truncate" title={m.pageAddress}>
                      {m.pageAddress}
                    </span>
                    <p className="text-xs text-white/85 flex-1 leading-relaxed">
                      {m.lineText}
                    </p>
                    <div className="shrink-0 text-right">
                      {m.status === 'matched' && (
                        <span className="text-[10px] font-bold text-emerald-400">→ {m.proposedCharacterName}</span>
                      )}
                      {m.status === 'ambiguous' && (
                        <span className="text-[10px] font-bold text-amber-400" title={m.ambiguousHandles?.join(', ')}>
                          {m.ambiguousHandles?.length} possible speakers
                        </span>
                      )}
                      {m.status === 'no_match' && (
                        <span className="text-[10px] font-bold text-red-400">no source match</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
 
            {/* Footer actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10 shrink-0">
              {didApply ? (
                <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Check size={14} /> Applied. Closing this and reopening will show remaining unresolved lines.
                </p>
              ) : (
                <p className="text-[10px] text-white/40">
                  Only matched lines are written. Nothing else on the page is touched.
                </p>
              )}
              <button
                onClick={handleApply}
                disabled={counts.matched === 0 || didApply}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest rounded transition-colors cursor-pointer"
              >
                Apply {counts.matched} Matched Recover{counts.matched !== 1 ? 'ies' : 'y'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
