import React, { useState } from 'react';
import { Psb4Artifact, KeepCutOrdersPayload } from '../types';
import { Shield, Scissors, Merge, Minimize2, Shrink } from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  keep:        { label: 'Keep',        color: 'text-emerald-400 border-emerald-800/50 bg-emerald-950/20', icon: <Shield size={10} /> },
  cut:         { label: 'Cut',         color: 'text-red-400 border-red-900/50 bg-red-950/20',             icon: <Scissors size={10} /> },
  consolidate: { label: 'Consolidate', color: 'text-blue-400 border-blue-900/50 bg-blue-950/20',          icon: <Merge size={10} /> },
  limit:       { label: 'Limit',       color: 'text-amber-400 border-amber-800/50 bg-amber-950/20',       icon: <Minimize2 size={10} /> },
  compress:    { label: 'Compress',    color: 'text-purple-400 border-purple-900/50 bg-purple-950/20',    icon: <Shrink size={10} /> },
};

export const KeepCutOrdersView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as KeepCutOrdersPayload;
  const [filter, setFilter] = useState<string>('all');
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  const filtered = filter === 'all' ? payload.orders : payload.orders.filter(o => o.category === filter);
  const counts = payload.orders.reduce((acc, o) => { acc[o.category] = (acc[o.category] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.7 • Keep / Cut / Consolidate Orders</span>
        <h2 className="text-lg font-bold text-white mt-1">Revision Directives</h2>
        {payload.summary && <p className="text-xs text-white/70 mt-2 leading-relaxed">{payload.summary}</p>}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilter('all')} className={`text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border transition-all ${filter === 'all' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
          All ({payload.orders.length})
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => counts[cat] ? (
          <button key={cat} onClick={() => setFilter(cat)} className={`text-[9px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border transition-all flex items-center gap-1 ${filter === cat ? cfg.color : 'border-white/10 text-white/40 hover:text-white/70'}`}>
            {cfg.icon}{cfg.label} ({counts[cat]})
          </button>
        ) : null)}
      </div>

      <div className="space-y-2">
        {filtered.map((order, i) => {
          const cfg = CATEGORY_CONFIG[order.category] || CATEGORY_CONFIG.keep;
          return (
            <div key={i} className="bg-[#0e0e0e] border border-white/8 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className={`shrink-0 flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded border mt-0.5 ${cfg.color}`}>
                  {cfg.icon}{cfg.label}
                </span>
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs font-medium text-white leading-relaxed">{order.directive}</p>
                  <p className="text-[11px] text-white/50 italic leading-relaxed">{order.reason}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
