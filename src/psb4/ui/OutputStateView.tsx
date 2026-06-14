import React from 'react';
import { Psb4Artifact, OutputStatePayload } from '../types';
import { ArrowRight } from 'lucide-react';

export const OutputStateView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const p = artifact.payload as OutputStatePayload;
  if (!p) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;
  const fields = [
    ['External Condition', p.externalCondition],
    ['Protagonist Condition', p.protagonistCondition],
    ['Antagonist Condition', p.antagonistCondition],
    ['Emotional Condition', p.emotionalCondition],
    ['Practical Condition', p.practicalCondition],
    ['Next Concrete Problem', p.nextConcreteProblem],
    ['Unresolved Argument', p.unresolvedArgument],
    ['Visual Motif Forward', p.visualMotifCarriedForward],
    ['New Engine Required', p.newEngineRequired],
  ];
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.10 • Output State</span>
        <h2 className="text-lg font-bold text-white mt-1">Issue {p.issueNumber} Handoff</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.filter(([,v]) => v).map(([label, val]) => (
          <div key={label as string} className="bg-[#0e0e0e] border border-white/8 rounded-lg p-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-1 flex items-center gap-1">
              <ArrowRight size={8}/>{label}
            </div>
            <p className="text-xs text-white/85 leading-relaxed">{val as string}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
