import React, { useState } from 'react';
import { Psb4Artifact, ScenePoolPayload } from '../types';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';

export const ScenePoolView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as ScenePoolPayload;
  const [expanded, setExpanded] = useState<number|null>(0);
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;
  return (
    <div className="space-y-5 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.9A • Character Care Scene Pool</span>
        <h2 className="text-lg font-bold text-white mt-1">{payload.scenes?.length || 0} Modular Scenes</h2>
      </div>
      <div className="space-y-2">
        {(payload.scenes||[]).map((scene, i) => (
          <div key={i} className="bg-[#0e0e0e] border border-white/10 rounded-xl overflow-hidden">
            <button onClick={() => setExpanded(expanded===i?null:i)} className="w-full px-4 py-3 bg-[#111] flex items-center gap-3 hover:bg-[#161616] transition-colors">
              <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-mono font-bold text-amber-400">{i+1}</span>
              </div>
              <div className="flex-1 text-left">
                <span className="text-xs font-bold text-white">{scene.title}</span>
                <span className="ml-2 text-[10px] font-mono text-white/60">{scene.characters?.join(', ')}</span>
              </div>
              <span className="text-[9px] font-mono text-white/60 mr-2">{scene.lengthNote}</span>
              {expanded===i ? <ChevronDown size={12} className="text-white/60"/> : <ChevronRight size={12} className="text-white/60"/>}
            </button>
            {expanded===i && <div className="p-4 space-y-3 border-t border-white/5">
              <div className="grid grid-cols-2 gap-3">
                {[['Emotional Function',scene.emotionalFunction],['What It Reveals',scene.whatItReveals],['Placement',scene.placementSuggestion],['Later Payoff',scene.laterPayoff]].map(([l,v]) => v ? (
                  <div key={l as string}><div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1">{l}</div><p className="text-xs text-white/90 leading-relaxed">{v as string}</p></div>
                ):null)}
              </div>
              {scene.fullVersion && <div><div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mt-1 mb-10">Full Scene</div><p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">{scene.fullVersion}</p></div>}
              <div className="grid grid-cols-2 gap-3">
                {scene.compressedVersion && <div><div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1">Compressed (2-3 panels)</div><p className="text-xs text-white/80 leading-relaxed">{scene.compressedVersion}</p></div>}
                {scene.singlePanelVersion && <div><div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1">Single Panel</div><p className="text-xs text-white/80 leading-relaxed">{scene.singlePanelVersion}</p></div>}
              </div>
              {scene.integrationRule && <div className="bg-amber-950/10 border border-amber-800/20 rounded p-2"><div className="text-[9px] font-mono uppercase tracking-widest text-amber-400/60 mb-0.5">Integration Rule</div><p className="text-xs text-amber-200/70">{scene.integrationRule}</p></div>}
            </div>}
          </div>
        ))}
      </div>
      {payload.characterHabits?.length > 0 && <div>
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white/60 mb-3">Character Habits</h3>
        <div className="grid grid-cols-2 gap-3">
          {payload.characterHabits.map((h,i) => (
            <div key={i} className="bg-[#0e0e0e] border border-white/8 rounded-lg p-3">
              <div className="text-xs font-bold text-white mb-1">{h.character}</div>
              <div className="text-[10px] font-mono text-amber-400/70 mb-0.5">{h.habit}</div>
              <p className="text-[11px] text-white/60 leading-relaxed">{h.emotionalMeaning}</p>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
};
