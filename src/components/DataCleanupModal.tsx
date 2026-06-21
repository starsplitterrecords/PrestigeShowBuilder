import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, AlertCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { useStore } from '../StoreContext';
import { Show } from '../types/models';
import { Operation, RosterChange, StructuralChange, ProseChange, PlaceholderHit, RepairDoubleAtResult, DuplicateIssueChange } from '../types/dataCleanup';
import {
  previewNormalizeRoster, applyNormalizeRoster,
  previewNormalizeStructural, applyNormalizeStructural,
  previewResolveProse, applyResolveProse,
  findTemplatePlaceholders,
  previewRepairDoubleAt, applyRepairDoubleAt,
  previewDedupIssues, applyDedupIssues,
  canonicalize
} from '../utils/dataCleanup';
 
export const DataCleanupModal = ({
  onApply, onCancel,
}: {
  onApply: (next: Show, op: Operation) => void;
  onCancel: () => void;
}) => {
  const { state } = useStore();
  const show = state.currentShow;
 
  const [op, setOp] = useState<Operation | null>(null);
  const [showCode, setShowCode] = useState('vik'); 
  const [preview, setPreview] = useState<any>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [completedOps, setCompletedOps] = useState<Set<Operation>>(new Set());
 
  if (!show) return null;
 
  // Recommendations: 1 -> 2 -> 3 -> 4, with 5 as a standalone recovery step
  const opOrder: Operation[] = ['roster', 'structural', 'prose', 'placeholders', 'repair-double-at', 'dedup-issues'];
  const opLabels: Record<Operation, string> = {
    roster: '1. Normalize Roster',
    structural: '2. Normalize References',
    prose: '3. Resolve Handles to Names',
    placeholders: '4. Surface Placeholders',
    'repair-double-at': '5. Repair Double-@ Handles',
    'dedup-issues': '6. De-duplicate Issues',
  };
 
  const handleSelectOp = (selectedOp: Operation) => {
    setOp(selectedOp);
    if (selectedOp === 'repair-double-at') {
      setPreview(previewRepairDoubleAt(show));
    } else if (selectedOp === 'dedup-issues') {
      setPreview(previewDedupIssues(show));
    }
  };
 
  const totalChanges = useMemo(() => {
    if (!preview) return 0;
    if (op === 'repair-double-at') {
      return (preview.rosterRepairs?.length ?? 0) + (preview.structuralRepairs?.length ?? 0);
    }
    return preview.length ?? 0;
  }, [preview, op]);
 
  const runPreview = () => {
    if (op === 'roster')
      setPreview(previewNormalizeRoster(show, showCode));
    else if (op === 'structural')
      setPreview(previewNormalizeStructural(show));
    else if (op === 'prose')
      setPreview(previewResolveProse(show));
    else if (op === 'placeholders')
      setPreview(findTemplatePlaceholders(show));
    else if (op === 'repair-double-at')
      setPreview(previewRepairDoubleAt(show));
    else if (op === 'dedup-issues')
      setPreview(previewDedupIssues(show));
  };
 
  const runApply = () => {
    setIsApplying(true);
    setTimeout(() => {
      let next = show;
      try {
        if (op === 'roster')
          next = applyNormalizeRoster(show, preview);
        else if (op === 'structural')
          next = applyNormalizeStructural(show, preview);
        else if (op === 'prose')
          next = applyResolveProse(show, preview);
        else if (op === 'repair-double-at')
          next = applyRepairDoubleAt(show, preview);
        else if (op === 'dedup-issues')
          next = applyDedupIssues(show, preview);
        
        if (op !== 'placeholders') {
          onApply(next, op!);
          setCompletedOps(prev => new Set(prev).add(op!));
          setConfirmed(true);
        } else {
          setCompletedOps(prev => new Set(prev).add(op!));
          setConfirmed(true);
        }
      } catch (err) {
        console.error("Cleanup error:", err);
      } finally {
        setIsApplying(false);
      }
    }, 500);
  };
 
  const reset = () => {
    setOp(null);
    setPreview(null);
    setConfirmed(false);
  };
 
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-[#070707] border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-medium text-white">Show Data Cleanup</h2>
            <p className="text-[11px] text-white/60 uppercase tracking-widest mt-1">
              Data hygiene & normalization tool
            </p>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
 
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!op ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opOrder.map((key, index) => {
                const isRecommendedNext = index > 0 && index < 4 && !completedOps.has(opOrder[index - 1]);
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectOp(key)}
                    className="p-6 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-amber-500/50 transition-all text-left group"
                  >
                    <h3 className="font-medium text-white group-hover:text-amber-400">
                      {opLabels[key]}
                      {completedOps.has(key) && <Check className="w-4 h-4 text-emerald-400 inline-block ml-2" />}
                    </h3>
                    <p className="text-xs mt-2 text-white/60 font-light leading-relaxed">
                      {key === 'roster' && 'Canonicalize character handles like @vik.PascalCase.'}
                      {key === 'structural' && 'Update structural fields (handle, ids) across the show.'}
                      {key === 'prose' && 'Replace @handles in prose fields with character names.'}
                      {key === 'placeholders' && 'Find @SHOWCODE and other template leftovers.'}
                      {key === 'repair-double-at' && 'Finds and removes accidental double-@ prefixes on handles (@@vik.Name -> @vik.Name).'}
                      {key === 'dedup-issues' && 'Find same-number duplicate issues, keep the structured copy and remove the staging-only copy.'}
                    </p>
                    {isRecommendedNext && (
                      <p className="text-[10px] text-white/60 uppercase tracking-widest mt-2 font-semibold">
                        Recommended after step {index}
                      </p>
                    )}
                  </button>
                );
              })}
              <div className="md:col-span-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Safety First</h4>
                    <p className="text-xs text-white/70 mt-1 leading-relaxed font-light">
                      Operations are undoable and skip log fields. Recommended order: 1 → 2 → 3. Use Operation 5 to repair double-@ damage, and Operation 6 to resolve duplicate Issue objects.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : !preview ? (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <h3 className="text-lg text-white">Configure {opLabels[op]}</h3>
              {op === 'roster' && (
                <div className="w-full max-w-xs space-y-2">
                   <label className="text-[10px] text-white/60 uppercase tracking-widest px-1">Show Code Prefix</label>
                  <input
                    value={showCode}
                    onChange={e => setShowCode(e.target.value.replace(/^@+/, '').replace(/[^a-zA-Z0-9]/g, ''))}
                    className="w-full bg-white/5 border border-white/20 rounded-md p-3 text-white focus:border-amber-500 outline-none"
                    placeholder="e.g. vik"
                    autoFocus
                  />
                  <p className="text-[10px] text-white/60 italic">Result format: @{showCode}.CharacterName</p>
                </div>
              )}
              <div className="flex gap-4">
                <button 
                  onClick={() => setOp(null)}
                  className="px-6 py-2 border border-white/10 rounded-md text-white/60 hover:bg-white/5"
                >
                  Back
                </button>
                <button 
                  onClick={runPreview}
                  className="px-8 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-md"
                >
                  Preview Changes
                </button>
              </div>
            </div>
          ) : !confirmed ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg text-white">Preview: {opLabels[op]}</h3>
                  <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-mono text-white/70 uppercase">
                    {totalChanges} Changes Detected
                  </span>
                </div>
                {op !== 'repair-double-at' && op !== 'dedup-issues' && (
                  <button 
                    onClick={() => setPreview(null)}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    Change Settings
                  </button>
                )}
              </div>
 
              <div className="border border-white/10 rounded-lg overflow-hidden bg-black">
                {op === 'roster' && <RosterPreview data={preview} />}
                {op === 'structural' && <StructuralPreview data={preview} />}
                {op === 'prose' && <ProsePreview data={preview} />}
                {op === 'placeholders' && <PlaceholderPreview data={preview} />}
                {op === 'repair-double-at' && <RepairPreview data={preview} show={show} />}
                {op === 'dedup-issues' && <DedupPreview data={preview} />}
              </div>
 
              <div className="flex justify-between items-center bg-white/5 p-4 rounded-lg">
                <div className="text-xs text-white/60 max-w-md font-light">
                  {op === 'placeholders' 
                    ? "This is a read-only report to help you find leftovers manually." 
                    : "Proceeding will update your show data. You can undo this change after applying if needed."}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setPreview(null)}
                    className="px-4 py-2 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  {op !== 'placeholders' && (
                    <button 
                      onClick={runApply}
                      disabled={isApplying || totalChanges === 0}
                      className="flex items-center gap-2 px-8 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/60 text-black font-bold rounded-md text-xs uppercase tracking-wider"
                    >
                      {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {op === 'repair-double-at' ? 'Apply Repairs' : op === 'dedup-issues' ? 'Apply De-duplication' : `Apply ${totalChanges} Changes`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/50 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl text-white">Cleanup Applied Successfully</h3>
              <p className="text-sm text-white/60 max-w-sm text-center font-light leading-relaxed">
                Your show data has been updated and immediately saved to Firestore.
              </p>
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-sm text-white text-xs font-bold uppercase tracking-wider"
                >
                  <RotateCcw className="w-4 h-4" />
                  Run Another Operation
                </button>
                <button 
                  onClick={onCancel}
                  className="px-8 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-sm text-xs uppercase tracking-wider"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
 
const RosterPreview = ({ data }: { data: RosterChange[] }) => (
  <table className="w-full text-left text-xs border-collapse">
    <thead className="bg-white/5 border-b border-white/10">
      <tr>
        <th className="p-3 text-[10px] text-white/60 uppercase tracking-widest font-medium">Status</th>
        <th className="p-3 text-[10px] text-white/60 uppercase tracking-widest font-medium">Current Handle</th>
        <th className="p-3 text-white shrink-0 w-8"><ArrowRight className="w-3 h-3 opacity-30" /></th>
        <th className="p-3 text-[10px] text-white/60 uppercase tracking-widest font-medium">New Handle</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-white/5">
      {data.map((row, i) => (
        <tr key={i} className={`hover:bg-white/5 ${row.needsManualReview ? 'bg-amber-500/5' : ''}`}>
          <td className="p-3 font-mono">
            {row.reason === 'no-change' ? (
              <span className="text-white/60 italic">Clean</span>
            ) : row.needsManualReview ? (
              <span className="text-amber-400 font-bold">Manual Review</span>
            ) : (
              <span className="text-emerald-400">Fix Preferred</span>
            )}
          </td>
          <td className="p-3 text-white/60 font-mono">{row.oldHandle}</td>
          <td className="p-3 text-white/60"><ArrowRight className="w-3 h-3" /></td>
          <td className="p-3">
            <span className={row.reason === 'no-change' ? 'text-white/60 font-mono' : 'text-white font-mono'}>
              {row.newHandle}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);
 
const StructuralPreview = ({ data }: { data: StructuralChange[] }) => {
  const samples = data.slice(0, 10);
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 gap-2">
        {samples.map((s, i) => (
          <div key={i} className="flex flex-col p-3 bg-white/5 rounded border border-white/5">
            <div className="text-[10px] font-mono text-white/60 mb-1">{s.path}</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-white/60 font-mono">{s.oldValue}</span>
              <ArrowRight className="w-3 h-3 text-white/60" />
              <span className="text-emerald-400 font-mono font-medium">{s.newValue}</span>
            </div>
          </div>
        ))}
        {data.length > 10 && (
          <div className="text-center py-2 text-[10px] text-white/60 italic">
            ... and {data.length - 10} more changes across the show structure.
          </div>
        )}
      </div>
    </div>
  );
};
 
const ProsePreview = ({ data }: { data: ProseChange[] }) => {
  const unresolved = Array.from(new Set(data.flatMap(d => d.unresolvedHandles)));
  const samples = data.slice(0, 5);
 
  return (
    <div className="p-4 space-y-6">
      {unresolved.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded">
          <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Unresolved Handles
          </h4>
          <p className="text-[10px] text-white/60 mt-1 font-light leading-relaxed">
            These handles have no match in your current roster and will be left as-is:
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {unresolved.map(h => (
              <span key={h} className="px-1.5 py-0.5 bg-black rounded text-[10px] font-mono text-white/60 border border-white/10">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
 
      <div className="space-y-4">
        {samples.map((s, i) => (
          <div key={i} className="space-y-2">
            <div className="text-[10px] font-mono text-white/60">{s.path}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-red-500/5 rounded border border-red-500/20 text-[11px] text-white/60 italic leading-relaxed">
                {s.before}
              </div>
              <div className="p-3 bg-emerald-500/5 rounded border border-emerald-500/20 text-[11px] text-white leading-relaxed">
                {s.after}
              </div>
            </div>
          </div>
        ))}
        {data.length > 5 && (
          <div className="text-center py-2 text-[10px] text-white/60 italic">
             + {data.length - 5} other prose blocks resolved.
          </div>
        )}
      </div>
    </div>
  );
};
 
const PlaceholderPreview = ({ data }: { data: PlaceholderHit[] }) => (
  <div className="p-4 space-y-4">
    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
      <p className="text-xs text-white/70 font-light leading-relaxed">
        The following fields contain template placeholders (e.g. @show.firstname). These should be manually resolved or cleared.
      </p>
    </div>
    <div className="space-y-2">
      {data.map((h, i) => (
        <div key={i} className="p-3 bg-white/5 rounded border border-white/5">
          <div className="text-[10px] font-mono text-white/60 mb-1">{h.path}</div>
          <div className="flex flex-wrap gap-2">
            {h.placeholders.map(p => (
              <span key={p} className="px-2 py-0.5 bg-red-500/20 rounded text-[10px] font-mono text-red-300 border border-red-500/30">
                {p}
              </span>
            ))}
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <div className="text-center py-12 text-sm text-white/60 font-light">
          No template placeholders detected. Your show is clean!
        </div>
      )}
    </div>
  </div>
);
 
const RepairPreview = ({ data, show }: { data: RepairDoubleAtResult; show: Show }) => {
  const hasRoster = data.rosterRepairs && data.rosterRepairs.length > 0;
  const hasStructural = data.structuralRepairs && data.structuralRepairs.length > 0;
 
  if (!hasRoster && !hasStructural) {
    return (
      <div className="p-8 text-center bg-black">
        <p className="text-[11px] text-white/60 uppercase tracking-widest py-12 font-bold">
          No double-@ handles detected. Nothing to repair.
        </p>
      </div>
    );
  }
 
  return (
    <div className="p-4 space-y-6 bg-black">
      {hasRoster && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            Roster Repairs
          </h4>
          <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0c0c0c]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#121212] border-b border-white/10">
                <tr>
                  <th className="p-3 text-[10px] text-white/70 uppercase tracking-widest font-mono font-medium">Character Name</th>
                  <th className="p-3 text-[10px] text-white/70 uppercase tracking-widest font-mono font-medium">Old Handle</th>
                  <th className="p-3 text-white shrink-0 w-8"></th>
                  <th className="p-3 text-[10px] text-white/70 uppercase tracking-widest font-mono font-medium">New Handle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.rosterRepairs.map((r, i) => {
                  const charName = show.characters?.find(c => c.id === r.characterId)?.name || r.characterId;
                  return (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="p-3 text-white font-medium">{charName}</td>
                      <td className="p-3 text-white/60 font-mono">{r.oldHandle}</td>
                      <td className="p-3 text-white/60"><ArrowRight className="w-3 h-3" /></td>
                      <td className="p-3 text-emerald-400 font-mono font-medium">{r.newHandle}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
 
      {hasStructural && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            Structural Repairs
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {data.structuralRepairs.map((s, i) => (
              <div key={i} className="flex flex-col p-3 bg-[#0c0c0c] rounded border border-white/10">
                <div className="text-[10px] font-mono text-white/70 mb-1">{s.path}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-white/60 font-mono">{s.oldValue}</span>
                  <ArrowRight className="w-3 h-3 text-white/60" />
                  <span className="text-emerald-400 font-mono font-medium">{s.newValue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
 
const DedupPreview = ({ data }: { data: DuplicateIssueChange[] }) => (
  <div className="p-4 space-y-4 bg-black">
    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded">
      <p className="text-xs text-white/70 font-light leading-relaxed">
        The following same-number duplicate Issue objects were found. Applying will remove the staging/weaker copy and preserve the canonical copy.
      </p>
    </div>
    <div className="space-y-3">
      {data.map((h, i) => (
        <div key={i} className="p-3 bg-white/5 border border-white/5 rounded-lg space-y-2">
          <div className="text-sm font-semibold text-white">Issue #{h.issueNumber} Duplicate</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded">
              <span className="text-[10px] font-bold text-emerald-400 uppercase block mb-1">Preserving (Canonical structure and dialogue)</span>
              <span className="text-white font-mono text-[11px] block truncate">{h.keptUid}</span>
              <span className="text-white/60 block mt-1">{h.keptSummary}</span>
            </div>
            <div className="p-2.5 bg-red-500/5 border border-red-500/20 rounded">
              <span className="text-[10px] font-bold text-red-400 uppercase block mb-1">Removing (Derivable panel plans & staging copy)</span>
              <span className="text-white font-mono text-[11px] block truncate">{h.removedUid}</span>
              <span className="text-white/60 block mt-1">{h.removedSummary}</span>
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <div className="text-center py-12 text-sm text-white/60 font-light">
          No same-number duplicate issues detected. Your show is clean!
        </div>
      )}
    </div>
  </div>
);
