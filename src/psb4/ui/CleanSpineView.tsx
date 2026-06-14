import React from 'react';
import { Psb4Artifact, CleanSpinePayload } from '../types';
import { ArrowRight } from 'lucide-react';

export const CleanSpineView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as CleanSpinePayload;
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.8 • Clean Spine</span>
        <h2 className="text-lg font-bold text-white mt-1">Production Spine</h2>
        {payload.summary && <p className="text-xs text-white/70 mt-2 leading-relaxed">{payload.summary}</p>}
      </div>

      <div className="space-y-3">
        {payload.sections.map((section, i) => (
          <div key={i} className="relative">
            {i < payload.sections.length - 1 && (
              <div className="absolute left-[1.4rem] top-full h-3 w-px bg-white/10 z-10" />
            )}
            <div className="bg-[#0e0e0e] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[#111] border-b border-white/10 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-mono font-bold text-amber-400">{i + 1}</span>
                </div>
                <span className="text-sm font-bold text-white">{section.label || `Section ${i + 1}`}</span>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ['Story Event', section.storyEvent, 'text-white/80'],
                  ['Character Conflict', section.characterConflict, 'text-white/80'],
                  ['Emotional Turn', section.emotionalTurn, 'text-amber-200/80'],
                  ['Opposition Move', section.oppositionMove, 'text-red-200/80'],
                  ['Consequence', section.consequence, 'text-white/80'],
                ].map(([label, val, cls]) => val ? (
                  <div key={label as string}>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-0.5">{label}</div>
                    <p className={`text-xs leading-relaxed ${cls}`}>{val as string}</p>
                  </div>
                ) : null)}
                {section.pageTurnQuestion && (
                  <div className="col-span-full bg-amber-950/10 border border-amber-800/20 rounded p-3 flex items-start gap-2">
                    <ArrowRight size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300 mb-0.5">Page-Turn Question</div>
                      <p className="text-xs text-amber-200/80 font-medium leading-relaxed">{section.pageTurnQuestion}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
