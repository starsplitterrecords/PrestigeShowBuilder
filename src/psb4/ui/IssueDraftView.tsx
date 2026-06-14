import React, { useState } from 'react';
import { Psb4Artifact, IssueDraftPayload } from '../types';
import { BookOpen, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

export const IssueDraftView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as IssueDraftPayload;
  const [tab, setTab] = useState<'treatment'|'spine'|'meta'>('treatment');
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  return (
    <div className="h-full flex flex-col text-left">
      <div className="shrink-0 border-b border-white/10 pb-3 px-1 pt-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
          Issue Draft • {artifact.episodeId ? `Episode` : 'Arc'}
        </span>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="text-lg font-bold text-white">
            Issue {payload.issueNumber}{payload.workingTitle ? ` — ${payload.workingTitle}` : ''}
          </h2>
        </div>
        {payload.corePromise && <p className="text-xs text-amber-200/70 mt-1 italic">{payload.corePromise}</p>}
        {payload.function && <p className="text-xs text-white/50 mt-0.5">{payload.function}</p>}
      </div>

      <div className="shrink-0 flex gap-1 pt-3 px-1">
        {(['treatment','spine','meta'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[9px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border transition-all ${tab===t ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
            {t === 'treatment' ? 'Full Treatment' : t === 'spine' ? `Beat Spine (${payload.beatSpine?.length||0})` : 'Production Notes'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto mt-3 px-1">
        {tab === 'treatment' && (
          <div className="prose prose-invert prose-sm max-w-none">
            <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap font-sans">
              {payload.treatment || 'No treatment generated.'}
            </div>
          </div>
        )}
        {tab === 'spine' && (
          <div className="space-y-2">
            {(payload.beatSpine || []).map((beat, i) => (
              <div key={i} className="bg-[#0e0e0e] border border-white/8 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono font-black text-amber-400 w-6">{beat.beatNumber}</span>
                  <span className="text-xs font-medium text-white flex-1">{beat.beat}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pl-8">
                  {[['Function',beat.storyFunction],['Character Turn',beat.characterTurn],['Consequence',beat.consequence]].map(([l,v]) => v ? (
                    <div key={l as string}>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-white/70 mb-0.5">{l}</div>
                      <p className="text-[11px] text-white/70 leading-relaxed">{v as string}</p>
                    </div>
                  ) : null)}
                </div>
                {beat.sourceUsed && <div className="pl-8 mt-1"><span className="text-[10px] font-mono text-white/60">Source: </span><span className="text-xs font-mono text-white/80 italic">{beat.sourceUsed}</span></div>}
              </div>
            ))}
          </div>
        )}
        {tab === 'meta' && (
          <div className="space-y-4">
            {[
              ['Output State', payload.outputState],
              ['Setup for Next', payload.setupForNext],
            ].map(([label, val]) => val ? (
              <div key={label as string}>
                <div className="text-[9px] font-mono uppercase tracking-widest text-amber-400/60 mb-1 flex items-center gap-1"><ArrowRight size={9}/>{label}</div>
                <p className="text-xs text-white/80 leading-relaxed">{val as string}</p>
              </div>
            ) : null)}
            {payload.preservedMaterial?.length > 0 && <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/60 mb-1">Preserved</div>
              <ul className="space-y-0.5">{payload.preservedMaterial.map((s,i) => <li key={i} className="text-xs text-white/60">• {s}</li>)}</ul>
            </div>}
            {payload.unresolvedItems?.length > 0 && <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-amber-400/60 mb-1">Unresolved (for later passes)</div>
              <ul className="space-y-0.5">{payload.unresolvedItems.map((s,i) => <li key={i} className="text-xs text-white/60">• {s}</li>)}</ul>
            </div>}
          </div>
        )}
      </div>
    </div>
  );
};
