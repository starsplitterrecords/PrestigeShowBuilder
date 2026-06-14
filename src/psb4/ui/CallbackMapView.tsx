import React from 'react';
import { Psb4Artifact } from '../types';

export const CallbackMapView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as any;
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;
  const items: any[] = payload.callbacks || [];
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 9 • Callback Map</span>
        <h2 className="text-lg font-bold text-white mt-1">Emotional Callbacks</h2>
        {payload.arcEmotionalQuestion && <p className="text-sm text-amber-200/80 mt-2 font-medium italic">&ldquo;{payload.arcEmotionalQuestion}&rdquo;</p>}
        {payload.summary && <p className="text-xs text-white/60 mt-1 leading-relaxed">{payload.summary}</p>}
        {payload.intendedAftertaste && <p className="text-xs text-amber-200/70 mt-2 italic">{payload.intendedAftertaste}</p>}
        {payload.finalAftertaste && <p className="text-xs text-white/60 mt-1 leading-relaxed">{payload.finalAftertaste}</p>}
      </div>
      <div className="space-y-3">
        {items.map((item: any, i: number) => (
          <div key={i} className="bg-[#0e0e0e] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#111] border-b border-white/5 flex items-center gap-2">
              <span className="text-[9px] font-mono text-amber-400/60 w-5">{i+1}</span>
              <span className="text-xs font-bold text-white/90">{item.element || `Item ${i+1}`}</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {item.seedLocation && <div><div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-0.5">Seed</div><p className="text-xs text-white/80 leading-relaxed">{item.seedLocation}</p></div>}
              {item.reinforcement && <div><div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-0.5">Reinforcement</div><p className="text-xs text-white/80 leading-relaxed">{item.reinforcement}</p></div>}
              {item.payoffLocation && <div><div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-0.5">Payoff Location</div><p className="text-xs text-white/80 leading-relaxed">{item.payoffLocation}</p></div>}
              {item.emotionalMeaning && <div><div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-0.5">Meaning</div><p className="text-xs text-white/80 leading-relaxed">{item.emotionalMeaning}</p></div>}
              {item.payoffActionOrLine && <div><div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-0.5">Payoff Action</div><p className="text-xs text-white/80 leading-relaxed">{item.payoffActionOrLine}</p></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
