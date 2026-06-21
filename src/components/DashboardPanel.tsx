import React, { useState, useEffect } from 'react';
import { useStore } from '../StoreContext';
import { getTeleplaysStats } from '../utils/assembleTeleplay';
import { computeGapReport } from '../utils/computeGapReport';

const DashboardPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  if (!currentShow) return null;

  const stats = getTeleplaysStats(currentShow);
  const gapReport = computeGapReport(currentShow);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set());
  const [localTitle, setLocalTitle] = useState(currentShow.titleSuggestion || currentShow.name);

  // Re-sync if show changes
  useEffect(() => {
    setLocalTitle(currentShow.titleSuggestion || currentShow.name);
  }, [currentShow.id, currentShow.titleSuggestion, currentShow.name]);

  const cards = [
    { label: 'Characters', value: currentShow.characters?.length ?? 0, view: 'characters' as const },
    { label: 'Issues', value: stats.episodes, view: 'issue-compiler' as const },
    { label: 'Page Beats', value: stats.beats, view: 'teleplay' as const },
  ];

  return (
    <div className="p-8 md:p-12 space-y-12 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 font-black uppercase tracking-widest rounded-sm">
            Production Active
          </span>
          <span className="text-[10px] text-white uppercase tracking-widest font-bold">
            Draft v{currentShow.draftVersion}
          </span>
        </div>
        <input
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={() => dispatch({ type: 'UPDATE_SHOW', updates: { titleSuggestion: localTitle } })}
          className="text-4xl md:text-6xl font-bold text-white tracking-tight bg-transparent border-none outline-none w-full focus:border-b focus:border-amber-500/20 transition-all"
        />
        <p className="text-white text-sm md:text-lg max-w-2xl leading-relaxed">
          {currentShow.premise}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {cards.map(card => (
          <button
            key={card.label}
            onClick={() => dispatch({ type: 'SET_VIEW', view: card.view })}
            className="glass p-6 text-left group hover:border-amber-500/30 transition-all"
          >
            <div className="text-[10px] text-white uppercase tracking-widest font-black mb-1 group-hover:text-amber-500/60 transition-colors">
              {card.label}
            </div>
            <div className="text-3xl font-mono text-white">
              {card.value}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="glass p-8 space-y-6">
          <h3 className="text-[10px] text-white uppercase tracking-[0.3em] font-black border-b border-white/70 pb-4">
            Series Foundation
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] text-amber-500/60 uppercase tracking-widest font-bold mb-2">Themes</h4>
              <p className="text-xs text-white leading-relaxed font-mono">
                {currentShow.themes || 'No themes defined yet.'}
              </p>
            </div>
            <div>
              <h4 className="text-[10px] text-amber-500/60 uppercase tracking-widest font-bold mb-2">Visual Style</h4>
              <p className="text-xs text-white leading-relaxed">
                {currentShow.styleConfig.positivePrompt}
              </p>
            </div>
          </div>
          <button 
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'concept' })}
            className="text-[10px] text-white uppercase tracking-widest font-bold hover:text-white transition-colors"
          >
            Edit Bible →
          </button>
        </section>

        <section className="glass p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/70 pb-4">
            <h3 className="text-[10px] text-white uppercase tracking-[0.3em] font-black">
              Production Health
            </h3>
            <span className="text-[10px] text-white/90 font-mono">
              {gapReport.filter(e => e.status === 'complete').length}/{gapReport.length} complete
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {gapReport.length === 0 ? (
              <p className="text-[10px] text-white/90">No issues generated yet.</p>
            ) : (
              gapReport.map((ep) => (
                <div key={`${ep.sIdx}-${ep.eIdx}`} className="border-b border-white/60">
                   <div
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/30 px-2 rounded-sm"
                    onClick={() => {
                      const key = `${ep.sIdx}-${ep.eIdx}`;
                      const next = new Set(expandedEpisodes);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      setExpandedEpisodes(next);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/90 w-3">{expandedEpisodes.has(`${ep.sIdx}-${ep.eIdx}`) ? '▼' : '▶'}</span>
                      <span className="text-[10px] font-mono text-white w-12">S{ep.seasonNum}I{ep.episodeNum}</span>
                      <span className={`w-2 h-2 rounded-full ${ep.status === 'complete' ? 'bg-green-500/60' : ep.status === 'partial' ? 'bg-amber-500/60' : 'bg-red-500/60'}`} title={`Status: ${ep.status}`}></span>
                      <span className="text-[10px] text-white truncate max-w-[120px]">{ep.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Beat fill progress bar */}
                      {ep.beatCount > 0 && (
                        <div className="w-16 h-1 bg-white/50 rounded-full overflow-hidden" title={`${ep.beatsWithLines}/${ep.beatCount} page beats with lines`}>
                          <div
                            className={`h-full rounded-full ${ep.status === 'complete' ? 'bg-green-500/60' : 'bg-amber-500/60'}`}
                            style={{ width: `${Math.round((ep.beatsWithLines / ep.beatCount) * 100)}%` }}
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {[
                          { key: 'A', has: ep.hasActs, label: 'Acts' },
                          { key: 'S', has: ep.hasScenes, label: 'Scenes' },
                          { key: 'PB', has: ep.hasBeats, label: 'Page Beats' },
                          { key: 'D', has: ep.hasDialogue, label: 'Dialogue' },
                        ].map(({ key, has, label }) => (
                          <span key={key} title={label}
                            className={`w-5 h-5 flex items-center justify-center rounded-sm text-[10px] font-black ${
                              has ? 'bg-green-500/20 text-green-300' : 'bg-white/30 text-white/80'
                            }`}
                          >{key}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                 
                  {/* Expanded scene rows */}
                  {expandedEpisodes.has(`${ep.sIdx}-${ep.eIdx}`) && (
                    <div className="pl-6 pb-2 space-y-1">
                      {ep.scenes.map((sc) => (
                        <div key={`${sc.aIdx}-${sc.scIdx}`}
                             className="flex items-center gap-3 py-1">
                          {/* Scene ID */}
                          <span className="text-[10px] font-mono text-white/90 w-16">
                            A{sc.aIdx + 1}·Sc{sc.scIdx + 1}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.status === 'complete' ? 'bg-green-500/60' : sc.status === 'partial' ? 'bg-amber-500/60' : 'bg-red-500/60'}`} title={`Status: ${sc.status}`}></span>
                          {/* Scene title */}
                          <span className="text-[10px] text-white truncate max-w-[100px]">
                            {sc.title}
                          </span>
                          {/* Per-beat dot strip */}
                          <div className="flex gap-0.5 flex-wrap">
                            {sc.beats.map((b) => (
                              <span
                                key={b.fid}
                                title={b.fid}
                                className={`w-2 h-2 rounded-full ${ b.hasLines ? "bg-green-500/60" : "bg-white/50" }`}
                              />
                            ))}
                          </div>
                          {/* Counts */}
                          <span className="text-[10px] text-white/90 font-mono ml-auto shrink-0">
                            {sc.beatsWithLines}/{sc.beatCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass p-8 space-y-6">
          <h3 className="text-[10px] text-white uppercase tracking-[0.3em] font-black border-b border-white/70 pb-4">
            AI Generation Stats
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <div className="text-[10px] text-amber-500/60 uppercase tracking-widest font-bold">Punch Ups</div>
              <div className="text-3xl font-mono text-white">{currentShow.generationStats?.punchUps ?? 0}</div>
              <p className="text-[10px] text-white/70 uppercase tracking-tighter">Script refinements</p>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-amber-500/60 uppercase tracking-widest font-bold">Visual Gens</div>
              <div className="text-3xl font-mono text-white">{currentShow.generationStats?.visualGenerations ?? 0}</div>
              <p className="text-[10px] text-white/70 uppercase tracking-tighter">Full page requests</p>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-amber-500/60 uppercase tracking-widest font-bold">Auto Layouts</div>
              <div className="text-3xl font-mono text-white">{currentShow.generationStats?.autoLayouts ?? 0}</div>
              <p className="text-[10px] text-white/70 uppercase tracking-tighter">AI panel planning</p>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-amber-500/60 uppercase tracking-widest font-bold">Panel Gens</div>
              <div className="text-3xl font-mono text-white">{currentShow.generationStats?.panelGenerations ?? 0}</div>
              <p className="text-[10px] text-white/70 uppercase tracking-tighter">Total panels rendered</p>
            </div>
          </div>
        </section>
      </div>

      <section className="glass p-8 bg-amber-500/5 border border-amber-500/20 rounded-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-left">
          <span className="text-[9px] bg-amber-500 text-black px-2 py-0.5 font-black uppercase tracking-widest rounded-sm">
            PSB4 Observability Trace Enabled
          </span>
          <h3 className="text-xl font-bold text-white tracking-tight">Replay Observability Console</h3>
          <p className="text-xs text-white/70 max-w-xl leading-relaxed">
            Every prompt assembly, LLM model execution, structured JSON synthesis, and teleplay compilation step is captured in real-time. Lock exemptions to protect important historical runs from daily prune schedules.
          </p>
        </div>
        <button 
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'psb4-replay' })}
          className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-black uppercase tracking-widest px-6 py-3.5 rounded-sm transition-all shadow-[0_4px_20px_rgba(245,158,11,0.2)] hover:shadow-none whitespace-nowrap cursor-pointer"
        >
          Open Replay Console
        </button>
      </section>
    </div>
  );
};

export default DashboardPanel;
