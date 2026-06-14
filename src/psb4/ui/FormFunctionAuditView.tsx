import React, { useState } from 'react';
import { Psb4Artifact, FormFunctionAuditPayload } from '../types';
import { CheckCircle, XCircle, Eye } from 'lucide-react';

const DECISION_STYLES: Record<string, string> = {
  keep: 'text-emerald-400 border-emerald-800/50 bg-emerald-950/20',
  cut: 'text-red-400 border-red-900/50 bg-red-950/20',
  merge: 'text-blue-400 border-blue-900/50 bg-blue-950/20',
  compress: 'text-amber-400 border-amber-800/50 bg-amber-950/20',
  rewrite: 'text-purple-400 border-purple-900/50 bg-purple-950/20',
  tone: 'text-white/50 border-white/10 bg-white/5',
};

export const FormFunctionAuditView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as FormFunctionAuditPayload;
  const [filter, setFilter] = useState<string>('all');
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  const filtered = filter === 'all' ? payload.scenes : payload.scenes.filter(s => s.decision === filter);
  const total = payload.scenes.length;
  const weak = payload.weakSceneCount;

  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.4 • Form-Function Audit</span>
        <h2 className="text-lg font-bold text-white mt-1">Scene-by-Scene Structural Audit</h2>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-[10px] font-mono text-white/60">{total} scenes audited</span>
          <span className={`text-[10px] font-mono ${weak > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{weak} weak</span>
          {payload.summary && <span className="text-xs text-white/60 italic">{payload.summary}</span>}
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {['all', 'keep', 'cut', 'merge', 'compress', 'rewrite', 'tone'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded border transition-all ${filter === f ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-white/10 text-white/60 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((scene, i) => (
          <div key={i} className="bg-[#0e0e0e] border border-white/8 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-3">
              {scene.changesStory ? <CheckCircle size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-red-400 shrink-0" />}
              <span className="text-xs font-mono font-bold text-white/90 flex-1">{scene.sceneId || `Scene ${i + 1}`}</span>
              <span className={`text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded border ${DECISION_STYLES[scene.decision] || ''}`}>{scene.decision}</span>
            </div>
            <div className="px-4 pb-3 grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
              {[['Intention', scene.intention], ['Conflict', scene.conflict], ['Turn', scene.turn],
                ['Consequence', scene.consequence], ['Visual', scene.visualFunction]].map(([label, val]) => val ? (
                <div key={label as string}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-0.5">{label}</div>
                  <p className="text-[11px] text-white/75 leading-relaxed">{val as string}</p>
                </div>
              ) : null)}
              {scene.note && (
                <div className="col-span-full">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-0.5">Note</div>
                  <p className="text-[11px] text-white/60 italic">{scene.note}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
