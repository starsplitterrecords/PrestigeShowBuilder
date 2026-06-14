import React from 'react';
import { Psb4Artifact, RepetitionDiagnosisPayload } from '../types';
import { AlertTriangle, CheckCircle, Scissors, Merge } from 'lucide-react';

export const RepetitionDiagnosisView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as RepetitionDiagnosisPayload;
  if (!payload) return <div className="p-4 text-xs font-mono text-red-400">Invalid payload.</div>;

  const verdictColor = payload.verdict === 'shaped_story' ? 'text-emerald-400' : payload.verdict === 'scene_dump' ? 'text-red-400' : 'text-amber-400';
  const verdictLabel = payload.verdict === 'shaped_story' ? 'SHAPED STORY' : payload.verdict === 'scene_dump' ? 'SCENE DUMP' : 'MIXED';

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">Phase 0.3 • Repetition Diagnosis</span>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="text-lg font-bold text-white">Scene-Dump Analysis</h2>
          <span className={`text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded border ${verdictColor} border-current bg-current/10`}>{verdictLabel}</span>
        </div>
        {payload.summary && <p className="text-xs text-white/70 mt-2 leading-relaxed">{payload.summary}</p>}
      </div>

      {payload.loops.length === 0 ? (
        <div className="flex items-center gap-3 p-6 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
          <CheckCircle size={16} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300">No repeated loops detected. Material is structurally clean.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payload.loops.map((loop, i) => (
            <div key={i} className="bg-[#0e0e0e] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-[#111] border-b border-white/10 flex items-center gap-2">
                <AlertTriangle size={12} className="text-amber-400" />
                <span className="text-xs font-mono font-bold text-white/90">{loop.patternName || `Loop ${i + 1}`}</span>
                <span className="ml-auto text-[10px] font-mono text-white/60">{loop.occurrences.length} occurrences</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1">Appears in</div>
                  <div className="flex flex-wrap gap-1.5">
                    {loop.occurrences.map((o, j) => (
                      <span key={j} className="text-[10px] font-mono px-2 py-0.5 bg-white/5 border border-white/10 rounded">{o}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1">Why it weakens motion</div>
                  <p className="text-xs text-white/80 leading-relaxed">{loop.whyWeakens}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle size={9} /> Keep</div>
                    <p className="text-xs text-white/80 leading-relaxed">{loop.keepVersion}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1 flex items-center gap-1"><Scissors size={9} /> Cut / Merge</div>
                    <ul className="space-y-0.5">{loop.cutOrMerge.map((c, j) => <li key={j} className="text-xs text-white/70">• {c}</li>)}</ul>
                  </div>
                </div>
                {loop.requiredEscalation && (
                  <div className="bg-amber-950/20 border border-amber-800/30 rounded p-3">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-1">If beat must repeat — required escalation</div>
                    <p className="text-xs text-amber-200/80 leading-relaxed">{loop.requiredEscalation}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
