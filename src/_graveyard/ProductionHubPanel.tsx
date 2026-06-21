import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { useProductionPipeline } from '../hooks/useProductionPipeline';
import { getTeleplaysStats } from '../utils/assembleTeleplay';
import { computeGapReport } from '../utils/computeGapReport';
import { 
  Sparkles, 
  MessageSquare, 
  Video, 
  RefreshCw, 
  Trash2, 
  Activity, 
  Layers, 
  FileText, 
  ChevronRight, 
  Sliders, 
  History 
} from 'lucide-react';

export const ProductionHubPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const {
    run,
    isRunning,
    runBatchDialogueFill,
    runStageDirections,
    resetSeason,
    nukeAndRebuild
  } = useProductionPipeline();

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRedraft, setConfirmRedraft] = useState(false);
  const [expandedEps, setExpandedEps] = useState<Set<string>>(new Set());

  if (!currentShow) return null;

  const stats = getTeleplaysStats(currentShow);
  const gapReport = computeGapReport(currentShow);

  const handleFullRedraft = () => {
    if (!confirmRedraft) {
      setConfirmRedraft(true);
      setTimeout(() => setConfirmRedraft(false), 3000);
      return;
    }
    setConfirmRedraft(false);
    nukeAndRebuild({ scope: 'show' });
  };

  const handleSmartFill = () => {
    run({ scope: 'show' }, false);
  };

  const handleBatchDialogue = () => {
    runBatchDialogueFill({ scope: 'show' });
  };

  const handleStageDirections = () => {
    runStageDirections({ scope: 'show' });
  };

  const handleSeasonReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setConfirmReset(false);
    resetSeason(0);
  };

  // Extract recent logs (last 4 items combined)
  const combinedLogs = React.useMemo(() => {
    const list: { type: 'text' | 'image'; timestamp: number; message: string }[] = [];
    
    (currentShow.generationLog || []).forEach(log => {
      list.push({
        type: 'image',
        timestamp: log.timestamp || 0,
        message: `${(log as any).promptSummary || 'Rendered Comic Panel'} for ${log.beatFid || 'unknown beat'}`,
      });
    });

    (currentShow.textGenerationLog || []).forEach(log => {
      list.push({
        type: 'text',
        timestamp: log.timestamp || 0,
        message: `Generated text [${(log as any).targetField || 'script'}] for ${(log as any).nodeFid || 'unknown node'}`
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  }, [currentShow.generationLog, currentShow.textGenerationLog]);

  return (
    <div className="h-full flex flex-col bg-black text-white overflow-hidden animate-in fade-in duration-500">
      
      {/* Header bar (shrink-0 strip above the panes) */}
      <div className="flex items-center justify-between border-b border-white/10 p-6 shrink-0 bg-neutral-950">
        <div className="space-y-1">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-[0.35em] block">
            Control Center
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase leading-none">
            Production Hub
          </h1>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black">
              Pipeline Active
            </span>
          </div>
        )}
      </div>

      {/* Pane Layout Container */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Left Pane - 35% Generation Control Stack */}
        <div className="flex-1 md:flex-none md:w-[35%] border-r border-white/10 flex flex-col min-h-0 bg-neutral-950/40">
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            
            <div className="space-y-1">
              <h2 className="text-xs uppercase tracking-widest font-black text-white/90">
                Action Control Strip
              </h2>
              <p className="text-[10px] text-white/60 lowercase">
                sequential orchestrators to automatically construct series assets.
              </p>
            </div>

            <div className="space-y-4">
              {/* Smart Fill */}
              <button 
                onClick={handleSmartFill}
                disabled={isRunning}
                className="w-full p-4 bg-white/5 border border-white/10 hover:border-amber-500/50 transition-all text-left rounded-sm flex items-start gap-4 disabled:opacity-30 group"
              >
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-sm shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    Smart Fill
                  </div>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Expand missing show hierarchy without overwriting existing data structures.
                  </p>
                </div>
              </button>

              {/* Batch Dialogue */}
              <button 
                onClick={handleBatchDialogue}
                disabled={isRunning}
                className="w-full p-4 bg-white/5 border border-white/10 hover:border-amber-500/50 transition-all text-left rounded-sm flex items-start gap-4 disabled:opacity-30 group"
              >
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-sm shrink-0">
                  <MessageSquare size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    Batch Dialogue
                  </div>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Synthesize character scripts and line items for beats that are currently blank.
                  </p>
                </div>
              </button>

              {/* Fill Direction Notes */}
              <button 
                onClick={handleStageDirections}
                disabled={isRunning}
                className="w-full p-4 bg-white/5 border border-white/10 hover:border-amber-500/50 transition-all text-left rounded-sm flex items-start gap-4 disabled:opacity-30 group"
              >
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-sm shrink-0">
                  <Video size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    Fill Direction Notes
                  </div>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Synthesize camera framing and narrative stage rules for beats that are missing notes.
                  </p>
                </div>
              </button>

              {/* Integrity Audit Tool */}
              <button 
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'production-audit' })}
                className="w-full p-4 bg-white/5 border border-white/10 hover:border-amber-500/50 transition-all text-left rounded-sm flex items-start gap-4 group cursor-pointer"
              >
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-sm shrink-0">
                  <Activity size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    Integrity Audit Tool
                  </div>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Check references, missing assets, duplicate manifest entries, and gallery records before final migration.
                  </p>
                </div>
              </button>

              {/* Season Reset */}
              <button
                onClick={handleSeasonReset}
                disabled={isRunning}
                className={`w-full p-4 border transition-all rounded-sm flex items-start gap-4 text-left ${
                  confirmReset 
                    ? 'bg-amber-500 border-amber-400 text-black animate-pulse font-bold' 
                    : 'bg-white/5 border-white/10 hover:border-amber-500/50'
                }`}
              >
                <div className={`p-2 rounded-sm shrink-0 ${confirmReset ? 'bg-black/20 text-black' : 'bg-amber-500/10 text-amber-500'}`}>
                  <RefreshCw size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className={`text-xs font-bold ${confirmReset ? 'text-black' : 'text-white'}`}>
                    {confirmReset ? 'Confirm S1 Wipe-out?' : 'Reset Season Production'}
                  </div>
                  <p className={`text-[10px] leading-relaxed ${confirmReset ? 'text-black/80' : 'text-white/60'}`}>
                    {confirmReset 
                      ? 'DANGER: Click again in 3s to erase S1 hierarchy completely.' 
                      : 'Erase acts, episodes, and script databases. Preserves character guides and bibliographies.'}
                  </p>
                </div>
              </button>

              {/* Full Series Redraft */}
              <button 
                onClick={handleFullRedraft}
                disabled={isRunning}
                className={`w-full p-4 border transition-all rounded-sm flex items-start gap-4 text-left ${
                  confirmRedraft
                    ? 'bg-red-500 border-red-400 text-white animate-pulse font-bold'
                    : 'bg-red-500/5 border-red-500/10 hover:border-red-500/50'
                }`}
              >
                <div className={`p-2 rounded-sm shrink-0 ${confirmRedraft ? 'bg-white/20 text-white' : 'bg-red-500/10 text-red-400'}`}>
                  <Trash2 size={16} />
                </div>
                <div className="space-y-0.5">
                  <div className={`text-xs font-bold ${confirmRedraft ? 'text-white' : 'text-red-400'}`}>
                     {confirmRedraft ? 'Permanently Wipe Series?' : 'Full Series Nuke & Redraft'}
                  </div>
                  <p className={`text-[10px] leading-relaxed ${confirmRedraft ? 'text-white/95 font-bold' : 'text-white/60'}`}>
                    {confirmRedraft
                      ? 'DANGER: This erases all generated visual plates and scripts instantly. Click again to execute.'
                      : 'Wipe current draft summaries and rebuild draft frames directly from Bible premise.'}
                  </p>
                </div>
              </button>
            </div>

            {/* Depth & Speed Controls */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <h3 className="text-[10px] text-white/80 uppercase font-black tracking-widest flex items-center gap-2">
                <Sliders size={12} className="text-amber-500" /> Pipeline Settings
              </h3>
              
              <div className="bg-black/40 border border-white/10 p-4 rounded-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-white/95 block font-bold">Generation Quality</span>
                    <span className="text-[9px] text-white/60 uppercase tracking-widest block font-medium">
                      {state.generationMode === 'paid' ? 'Paid (Highly Detailed)' : 'Free Tier Fast'}
                    </span>
                  </div>
                  <button
                    onClick={() => dispatch({ 
                      type: 'SET_GENERATION_MODE', 
                      mode: state.generationMode === 'paid' ? 'free' : 'paid' 
                    })}
                    className={`px-2.5 py-1.2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all ${
                      state.generationMode === 'paid'
                        ? 'bg-amber-500 text-black'
                        : 'border border-amber-500/50 text-amber-500 hover:bg-amber-500/10'
                    }`}
                  >
                    Set {state.generationMode === 'paid' ? 'Free' : 'Paid'}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[11px] text-white/95 font-bold">Auto-generate Script Lines</span>
                  <input 
                    type="checkbox" 
                    checked={!!currentShow.depthConfig.lines}
                    onChange={(e) => dispatch({ type: 'UPDATE_SHOW', updates: { depthConfig: { ...currentShow.depthConfig, lines: e.target.checked } } })}
                    className="accent-amber-500 w-3.5 h-3.5"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Pane - 65% Health Dashboard */}
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950/10">
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
            
            {/* Show Health Inventory Bar */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-widest font-black text-white/90 flex items-center gap-2">
                <Activity size={14} className="text-emerald-400" /> Series Inventory Analytics
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
                  <div className="text-[9px] text-white/60 uppercase tracking-wider font-extrabold mb-1">Generated Episodes</div>
                  <div className="text-xl font-bold font-mono text-white">{stats.episodes}</div>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
                  <div className="text-[9px] text-white/60 uppercase tracking-wider font-extrabold mb-1">Production Beats</div>
                  <div className="text-xl font-bold font-mono text-white">{stats.beats}</div>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
                  <div className="text-[9px] text-white/60 uppercase tracking-wider font-extrabold mb-1">Estimated Words</div>
                  <div className="text-xl font-bold font-mono text-white">{Math.round(stats.estimatedWords / 1000)}k</div>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
                  <div className="text-[9px] text-white/60 uppercase tracking-wider font-extrabold mb-1">Rendered Comic Pages</div>
                  <div className="text-xl font-bold font-mono text-white">{stats.estimatedPages}</div>
                </div>
              </div>
            </div>

            {/* Gap report */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <h3 className="text-xs uppercase tracking-widest font-black text-white/90 flex items-center gap-2">
                  <Layers size={14} className="text-amber-500" /> Episode Coverage & Gap Logs
                </h3>
                <span className="text-[10px] text-white/60 font-mono">
                  {gapReport.length} itemized branches
                </span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-2 border border-white/5 bg-black/20 rounded-sm p-4">
                {gapReport.map((ep) => {
                  const key = `${ep.sIdx}-${ep.eIdx}`;
                  const isExpanded = expandedEps.has(key);
                  return (
                    <div key={key} className="border-b border-white/5 last:border-b-0 pb-3 last:pb-0">
                      <div
                        className="flex items-center justify-between py-2 cursor-pointer select-none"
                        onClick={() => setExpandedEps(prev => {
                          const next = new Set(prev);
                          next.has(key) ? next.delete(key) : next.add(key);
                          return next;
                        })}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-[10px] font-mono font-black text-amber-500 shrink-0">
                            S{ep.seasonNum}E{ep.episodeNum}
                          </span>
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ep.status === 'complete' ? 'bg-green-500' : ep.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'}`} title={`Status: ${ep.status}`}></span>
                          
                          <div className="flex gap-1 shrink-0">
                            {[
                              { label: "A", detail: "Acts present", condition: ep.hasActs },
                              { label: "S", detail: "Scenes present", condition: ep.hasScenes },
                              { label: "B", detail: "Beats present", condition: ep.hasBeats },
                              { label: "D", detail: "Scripts mapped", condition: ep.hasDialogue },
                            ].map(({ label, detail, condition }) => (
                              <span 
                                key={label}
                                title={detail}
                                className={`w-4.5 h-4.5 flex items-center justify-center rounded-sm text-[9px] font-black ${
                                  condition ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-white/5 text-white/40 border border-white/10"
                                }`}
                              >
                                {label}
                              </span>
                            ))}
                          </div>

                          <span className="text-xs text-white/90 truncate font-semibold">
                            {ep.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 pl-2">
                          {ep.status !== 'complete' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                run({ scope: "episode", sIdx: ep.sIdx, eIdx: ep.eIdx }, false);
                              }}
                              disabled={isRunning}
                              className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-white text-black hover:bg-neutral-200 disabled:opacity-30 transition-all"
                            >
                              Fill
                            </button>
                          )}
                          <ChevronRight size={14} className={`text-white/60 transition-transform ${isExpanded ? 'rotate-90 text-amber-400' : ''}`} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pl-6 mt-2 pt-2 border-t border-white/5 space-y-2 bg-black/40 p-3 rounded-sm">
                          {ep.scenes.map((sc) => (
                            <div key={`${sc.aIdx}-${sc.scIdx}`} className="flex items-center justify-between gap-3 text-[11px] py-1 border-b border-white/5 last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[9px] font-mono text-white/60 shrink-0 bg-white/5 px-1 rounded-sm">
                                  A{sc.aIdx + 1}·Sc{sc.scIdx + 1}
                                </span>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.status === 'complete' ? 'bg-green-500' : sc.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                <span className="text-white/90 truncate max-w-[140px] font-medium">
                                  {sc.title}
                                </span>
                                
                                <div className="flex gap-1 flex-wrap">
                                  {sc.beats.map((b) => {
                                    const missingMsg = b.missingPortraitNames?.length ? `Missing portraits: ${b.missingPortraitNames.join(', ')}` : 'Ok';
                                    return (
                                      <span
                                        key={b.fid}
                                        title={`Beat: ${b.fid}\n- Has Lines: ${b.hasLines ? 'Yes' : 'No'}\n- Panel Plan: ${b.hasPanelPlan ? 'Yes' : 'No'}\n- Portraits: ${missingMsg}`}
                                        className={`w-2 h-2 rounded-full ${ b.hasLines ? "bg-green-500" : "bg-neutral-600" } ${b.hasVisualDescription ? 'ring-1 ring-amber-400' : ''}`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              <span className="text-[10px] text-white/60 font-mono shrink-0">
                                {sc.beatsWithLines}/{sc.beatCount} beats dialogued
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit Logs Quick Strip */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Recent Generation activity log */}
              <div className="lg:col-span-2 border border-white/10 bg-black/40 p-4 rounded-sm space-y-3">
                <h4 className="text-[10px] uppercase font-black tracking-widest text-white/80 flex items-center gap-2">
                  <History size={12} className="text-blue-400" /> Recent Generative Pipeline Log
                </h4>
                {combinedLogs.length === 0 ? (
                  <p className="text-[10px] text-white/50 uppercase tracking-wider text-center py-6">
                    No run logs registered.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {combinedLogs.map((log, index) => (
                      <div key={index} className="text-[11px] text-white/90 font-mono bg-white/5 px-3 py-2 rounded-sm flex justify-between gap-3 text-ellipsis overflow-hidden">
                        <span className="truncate">{log.message}</span>
                        <span className="text-[9px] text-white/50 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation Actions Shortcuts */}
              <div className="border border-white/10 bg-black/40 p-4 rounded-sm flex flex-col justify-between gap-4">
                <span className="text-[10px] uppercase font-black tracking-widest text-white/80 flex items-center gap-2">
                  <FileText size={12} className="text-purple-400" /> Log / Export Centers
                </span>
                <div className="space-y-2">
                  <button 
                    onClick={() => dispatch({ type: 'SET_VIEW', view: 'generation-log' })}
                    className="w-full text-left px-3 py-2 border border-white/10 hover:border-amber-500/50 transition-all rounded-sm flex items-center justify-between group"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-amber-500">Image Logs</span>
                    <span className="text-[9px] text-white/50 font-mono">{(currentShow.generationLog ?? []).length} lines</span>
                  </button>
                  <button 
                    onClick={() => dispatch({ type: 'SET_VIEW', view: 'text-generation-log' })}
                    className="w-full text-left px-3 py-2 border border-white/10 hover:border-emerald-500/50 transition-all rounded-sm flex items-center justify-between group"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover:text-emerald-500">Text Logs</span>
                    <span className="text-[9px] text-white/50 font-mono">{(currentShow.textGenerationLog ?? []).length} lines</span>
                  </button>
                  <button 
                    onClick={() => dispatch({ type: 'SET_VIEW', view: 'export' })}
                    className="w-full bg-white text-black text-center py-2 rounded-sm text-[9px] font-black uppercase tracking-wider hover:bg-neutral-200 transition-colors"
                  >
                    Deliverable Export
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductionHubPanel;
