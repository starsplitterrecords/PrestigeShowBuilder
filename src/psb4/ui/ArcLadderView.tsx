import React, { useState } from 'react';
import { Psb4Artifact, ArcLadderPayload } from '../types';
import { ChevronDown, ChevronRight, Zap, Users, TrendingUp, RefreshCw } from 'lucide-react';

export const ArcLadderView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as ArcLadderPayload;
  const [expandedIssue, setExpandedIssue] = useState<number | null>(0);
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.8A • Arc Imagination</span>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="text-lg font-bold text-white">Issue Ladder</h2>
          <span className="text-[10px] font-mono font-black text-amber-400 px-2 py-0.5 border border-amber-600/40 bg-amber-950/20 rounded">
            {payload.recommendedIssueCount} issues
          </span>
        </div>
        {payload.arcLengthRationale && <p className="text-xs text-white/60 mt-1.5 italic">{payload.arcLengthRationale}</p>}
      </div>

      {/* Issue ladder */}
      <div className="space-y-2">
        {payload.issues.map((issue, i) => (
          <div key={i} className="bg-[#0e0e0e] border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedIssue(expandedIssue === i ? null : i)}
              className="w-full px-4 py-3 bg-[#111] flex items-center gap-3 hover:bg-[#161616] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-mono font-bold text-amber-400">{issue.number}</span>
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-bold text-white">{issue.workingTitle || `Issue ${issue.number}`}</span>
                <span className="ml-3 text-[10px] font-mono text-white/60 uppercase tracking-widest">{issue.climaxType}</span>
              </div>
              {expandedIssue === i ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
            </button>
            {expandedIssue === i && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-white/5">
                {[
                  ['Function', issue.function],
                  ['External Problem', issue.externalProblem],
                  ['Character Conflict', issue.characterConflict],
                  ['Opposition Move', issue.oppositionMove],
                  ['Ending Condition', issue.endingCondition],
                  ['How World Changed', issue.howWorldChanged],
                ].map(([label, val]) => val ? (
                  <div key={label as string}>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-0.5">{label}</div>
                    <p className="text-xs text-white/80 leading-relaxed">{val as string}</p>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Arc summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/10">
        {[
          { icon: <Users size={12} />, label: 'Protagonist Arc', val: payload.protagonistArc, color: 'text-blue-400' },
          { icon: <Users size={12} />, label: 'Supporting Arcs', val: payload.supportingArcs, color: 'text-blue-400' },
          { icon: <TrendingUp size={12} />, label: 'Antagonist Escalation', val: payload.antagonistEscalation, color: 'text-red-400' },
          { icon: <RefreshCw size={12} />, label: 'Recurring Engine', val: payload.recurringEngine, color: 'text-emerald-300' },
          { icon: <Zap size={12} />, label: 'Must Not Repeat', val: payload.mustNotRepeat, color: 'text-amber-300' },
          { icon: <Zap size={12} />, label: 'Next Task', val: payload.nextTask, color: 'text-amber-300' },
        ].filter(item => item.val).map(item => (
          <div key={item.label}>
            <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 flex items-center gap-1 ${item.color}`}>
              {item.icon}{item.label}
            </div>
            <p className="text-xs text-white/80 leading-relaxed">{item.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
