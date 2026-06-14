import React from 'react';
import { Psb4Artifact, CharacterFunctionAuditPayload } from '../types';
import { User, AlertOctagon, Zap } from 'lucide-react';

const RISK_STYLES = {
  low: 'text-emerald-400 bg-emerald-950/20 border-emerald-800/40',
  medium: 'text-amber-400 bg-amber-950/20 border-amber-800/40',
  high: 'text-red-400 bg-red-950/20 border-red-900/40',
};

export const CharacterFunctionAuditView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as CharacterFunctionAuditPayload;
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.5 • Character Function Audit</span>
        <h2 className="text-lg font-bold text-white mt-1">Arc vs. Repeated Behavior</h2>
        {payload.summary && <p className="text-xs text-white/70 mt-2 leading-relaxed">{payload.summary}</p>}
      </div>

      <div className="space-y-4">
        {payload.characters.map((char, i) => (
          <div key={i} className="bg-[#0e0e0e] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#111] border-b border-white/10 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <User size={12} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-bold text-white">{char.name}</span>
                {char.handle && <span className="ml-2 text-[10px] font-mono text-white/60">{char.handle}</span>}
              </div>
              <span className={`text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded border ${RISK_STYLES[char.flatteningRisk]}`}>
                {char.flatteningRisk} risk
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 mb-1 flex items-center gap-1"><Zap size={9} /> Strongest Function</div>
                <p className="text-xs text-white/80 leading-relaxed">{char.strongestFunction}</p>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1 flex items-center gap-1"><AlertOctagon size={9} /> Repeated Behavior Risk</div>
                <p className="text-xs text-white/80 leading-relaxed">{char.repeatedBehaviorRisk}</p>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300 mb-1">Needed Per Section</div>
                <p className="text-xs text-white/80 leading-relaxed">{char.neededPerSection}</p>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-1">Revision Requirement</div>
                <p className="text-xs text-white/80 leading-relaxed">{char.revisionRequirement}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
