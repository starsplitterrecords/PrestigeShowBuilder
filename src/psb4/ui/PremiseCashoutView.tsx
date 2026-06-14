import React from 'react';
import { Psb4Artifact, PremiseCashoutPayload } from '../types';
import { Target, Swords, Users, Eye, Flame } from 'lucide-react';

export const PremiseCashoutView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as PremiseCashoutPayload;
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.6 • Premise Cash-Out</span>
        <h2 className="text-lg font-bold text-white mt-1">Title / Premise vs. Story Reality</h2>
        {payload.summary && <p className="text-xs text-white/70 mt-2 leading-relaxed">{payload.summary}</p>}
      </div>

      {payload.reformulatedSeriesPremise && (
        <div className="bg-amber-950/20 border border-amber-700/40 rounded-lg p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-1.5">Reformulated Series Premise</div>
          <p className="text-sm text-amber-200 font-medium leading-relaxed">{payload.reformulatedSeriesPremise}</p>
        </div>
      )}

      <div className="space-y-4">
        {payload.issues.map((issue, i) => (
          <div key={i} className="bg-[#0e0e0e] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#111] border-b border-white/10">
              <span className="text-[10px] font-mono text-white/60 mr-2">{i + 1}</span>
              <span className="text-sm font-bold text-white">{issue.issueLabel}</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-0.5 flex items-center gap-1"><Target size={9} /> Promise</div>
                <p className="text-xs text-white/80 leading-relaxed">{issue.titlePremisePromise}</p>
              </div>
              <div className="bg-amber-950/10 border border-amber-800/20 rounded p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300 mb-0.5 flex items-center gap-1"><Flame size={9} /> Concrete Story Problem</div>
                <p className="text-xs text-amber-200/80 font-medium leading-relaxed">{issue.concreteStoryProblem}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-0.5 flex items-center gap-1"><Users size={9} /> Character Collisions</div>
                  <p className="text-xs text-white/75 leading-relaxed">{issue.characterCollisions}</p>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-0.5 flex items-center gap-1"><Swords size={9} /> Opposition Angle</div>
                  <p className="text-xs text-white/75 leading-relaxed">{issue.oppositionAngle}</p>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 mb-0.5 flex items-center gap-1"><Eye size={9} /> Climax Requirement</div>
                  <p className="text-xs text-white/75 leading-relaxed">{issue.climaxRequirement}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
