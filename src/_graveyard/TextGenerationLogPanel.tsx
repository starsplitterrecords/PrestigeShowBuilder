import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { Clock, Cpu, Database, Clipboard, Check, ChevronDown, ChevronUp, Layers, RefreshCw } from 'lucide-react';
import { TextGenerationLogEntry } from '../types/generation';

const GENERATOR_COLORS: Record<string, string> = {
  generateActScenes: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
  generateCinematicBeats: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5',
  generateDialogueScript: 'text-teal-400 border-teal-500/20 bg-teal-500/5',
  deriveVisualFromDescription: 'text-pink-400 border-pink-500/20 bg-pink-500/5',
  deriveVisualFromScript: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
  reconcileBeatDescription: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
};

const TextGenerationLogPanel: React.FC = () => {
  const { state } = useStore();
  const { currentShow } = state;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedIdField, setCopiedIdField] = useState<string | null>(null); // e.g. "someId-prompt"

  if (!currentShow) return null;

  const logs = currentShow.textGenerationLog ?? [];

  const handleCopy = (id: string, field: 'prompt' | 'system' | 'response', text: string) => {
    navigator.clipboard.writeText(text);
    const key = `${id}-${field}`;
    setCopiedIdField(key);
    setTimeout(() => {
      setCopiedIdField(null);
    }, 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070707] text-white overflow-hidden animate-in fade-in duration-500">
      {/* Panel Header */}
      <header className="p-8 border-b border-white/70 flex items-center justify-between shrink-0 bg-neutral-950">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Text Generation Logs</h1>
          <p className="text-white/60 text-[10px] uppercase tracking-widest mt-1">
            {logs.length} operations compiled — diagnostics for backend AI synthesis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-[10px] uppercase tracking-widest font-black rounded-sm border border-white/10 text-white/50 bg-white/5">
            Backend Diagnostics
          </span>
        </div>
      </header>

      {/* Main Container / Scrollable List */}
      <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
        {logs.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-white/10 rounded-sm bg-neutral-950/30 max-w-2xl mx-auto space-y-4">
            <Layers size={36} className="mx-auto text-white/20" />
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-white/50 font-bold">No text generation logs captured yet.</p>
              <p className="text-[10px] text-white/30">When you utilize AI Smart Fill features, structural logs will register of the prompt operations.</p>
            </div>
          </div>
        ) : (
          [...logs].sort((a, b) => b.timestamp - a.timestamp).map((entry) => {
            const isExpanded = expandedIds.has(entry.id);
            const genColor = GENERATOR_COLORS[entry.generator] || 'text-white/80 border-white/10 bg-white/5';

            return (
              <div
                key={entry.id}
                className="bg-neutral-950 border border-white/10 rounded-sm hover:border-white/20 transition-colors p-5 space-y-4"
              >
                {/* Meta Header Grid */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-white/40">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${genColor} uppercase tracking-tight`}>
                        {entry.generator}
                      </span>
                      {entry.targetKind && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-white/10 px-2 py-0.5 text-white/80 rounded-sm">
                          {entry.targetKind}: {entry.targetFid || 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    {entry.durationMs && (
                      <span className="text-[10px] font-mono text-white/50 flex items-center gap-1">
                        <Clock size={10} /> {(entry.durationMs / 1000).toFixed(2)}s
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[#9b9b9b] bg-white/5 px-2 py-0.5 rounded-sm">
                      {entry.model}
                    </span>
                  </div>
                </div>

                {/* Technical Overview Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-white/5 text-[10px] font-mono text-white/70">
                  <div className="space-y-0.5">
                    <span className="text-white/40 text-[9px] uppercase tracking-wider block font-bold">Schema Constraint</span>
                    <span className="truncate block font-mono text-amber-500">{entry.schemaName || 'Plain text response'}</span>
                  </div>
                  <div className="space-y-0.5 border-l border-white/5 pl-4 ml-0">
                    <span className="text-white/40 text-[9px] uppercase tracking-wider block font-bold">Call Mode</span>
                    <span className="uppercase block">{entry.mode || 'standard'}</span>
                  </div>
                  <div className="space-y-0.5 border-l border-white/5 pl-4 ml-0 col-span-2">
                    <span className="text-white/40 text-[9px] uppercase tracking-wider block font-bold">Request Size</span>
                    <span className="text-white/60 block truncate">
                      Prompt: {entry.prompt?.length || 0}c | Response: {entry.rawResponse?.length || 0}c
                    </span>
                  </div>
                </div>

                {/* Collapsible details */}
                {isExpanded ? (
                  <div className="space-y-4 pt-2 border-t border-white/5 animate-in slide-in-from-top-1 duration-200">
                    {/* System Instruction (if exists) */}
                    {entry.systemInstruction && (
                      <div className="space-y-1 bg-black/40 p-3.5 border border-white/5 rounded-xs">
                        <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-indigo-400 font-black">
                          <span>System Instruction</span>
                          <button
                            onClick={() => handleCopy(entry.id, 'system', entry.systemInstruction!)}
                            className="hover:text-white flex items-center gap-1 font-sans"
                          >
                            {copiedIdField === `${entry.id}-system` ? (
                              <><Check size={10} /> Copied</>
                            ) : (
                              <><Clipboard size={10} /> Copy</>
                            )}
                          </button>
                        </div>
                        <pre className="text-xs text-white/80 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed border-t border-white/5 pt-2 mt-2">
                          {entry.systemInstruction}
                        </pre>
                      </div>
                    )}

                    {/* Developer Prompt */}
                    <div className="space-y-1 bg-black/40 p-3.5 border border-white/5 rounded-xs">
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-amber-500 font-black">
                        <span>User Prompt Input</span>
                        <button
                          onClick={() => handleCopy(entry.id, 'prompt', entry.prompt)}
                          className="hover:text-white flex items-center gap-1 font-sans"
                        >
                          {copiedIdField === `${entry.id}-prompt` ? (
                            <><Check size={10} /> Copied</>
                          ) : (
                            <><Clipboard size={10} /> Copy</>
                          )}
                        </button>
                      </div>
                      <pre className="text-xs text-white/80 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed border-t border-white/5 pt-2 mt-2">
                        {entry.prompt}
                      </pre>
                    </div>

                    {/* Generated AI Content Response */}
                    <div className="space-y-1 bg-[#0b0c10] p-3.5 border border-green-500/10 rounded-xs">
                      <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-emerald-400 font-black">
                        <span>Raw AI Text Response</span>
                        <button
                          onClick={() => handleCopy(entry.id, 'response', entry.rawResponse || '')}
                          className="hover:text-emerald-300 flex items-center gap-1 font-sans"
                        >
                          {copiedIdField === `${entry.id}-response` ? (
                            <><Check size={10} /> Copied</>
                          ) : (
                            <><Clipboard size={10} /> Copy</>
                          )}
                        </button>
                      </div>
                      <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed border-t border-white/5 pt-2 mt-2">
                        {entry.rawResponse || <em className="text-white/20">Empty response from model.</em>}
                      </pre>
                    </div>
                  </div>
                ) : (
                  // Truncated quick look
                  <div className="text-[11px] text-white/50 line-clamp-2 bg-black/25 px-3 py-2 rounded-sm border border-white/5 font-mono">
                    <strong>Preview:</strong> {entry.prompt || '(Empty)'}
                  </div>
                )}

                {/* Chevron expand controls */}
                <div className="flex justify-center border-t border-white/5 pt-2">
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    className="text-[9px] uppercase tracking-widest font-black text-white/40 hover:text-white transition-colors flex items-center gap-1"
                  >
                    {isExpanded ? (
                      <>Colapse Logs Details <ChevronUp size={10} /></>
                    ) : (
                      <>Expand Logs Details <ChevronDown size={10} /></>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TextGenerationLogPanel;
