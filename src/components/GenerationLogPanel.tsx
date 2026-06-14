import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../StoreContext';
import { GenerationLogEntry } from '../types/models';

const METHOD_COLORS: Record<string, string> = {
  visual:   'text-blue-400 border-blue-500/30 bg-blue-500/10',
  script:      'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  'beat-page': 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  cover:       'text-amber-400 border-amber-500/30 bg-amber-500/10',
  portrait: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  freetext: 'text-white border-white/30 bg-white/10',
};

const GenerationLogPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow, logFilter, activePath } = state;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>(logFilter || 'all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle cross-navigation filter and highlighting
  useEffect(() => {
    if (logFilter) {
      setFilter(logFilter);
    }
    
    const highlightId = activePath.highlightLogId;
    if (highlightId) {
      setExpandedIds(prev => new Set([...Array.from(prev), highlightId]));
      // Give it a moment to render then scroll
      setTimeout(() => {
        const el = document.getElementById(`log-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [logFilter, activePath.highlightLogId]);

  if (!currentShow) return null;

  const log = currentShow.generationLog ?? [];
  const methods = ['all', ...Array.from(new Set(log.map(e => e.method)))];
  
  // Filtering logic: matches method OR beatFid
  const filtered = filter === 'all' 
    ? log 
    : log.filter(e => e.method === filter || e.beatFid === filter || e.beatFid.includes(filter));

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const MetadataItem = ({ label, value, className = '' }: { label: string, value: string, className?: string }) => (
    <div className={`flex flex-col ${className}`}>
      <span className="text-white/70 text-[10px] uppercase tracking-widest leading-none mb-1.5 font-bold">{label}</span>
      <span className="text-white/90 text-[10px] font-mono leading-none truncate" title={value}>{value}</span>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070707] text-white overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-white/70 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Generation Log</h1>
          <p className="text-white/60 text-[10px] uppercase tracking-widest mt-1">
            {log.length} entries — full prompts and provenance recorded
          </p>
        </div>
        {/* Method filter */}
        <div className="flex gap-2 flex-wrap justify-end">
          {methods.map(m => (
            <button key={m}
              onClick={() => setFilter(m)}
              className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border transition-all ${
                filter === m
                  ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                  : 'border-white/50 text-white/60 hover:border-white/70'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide" ref={scrollRef}>
        {filtered.length === 0 && (
          <div className="text-white/60 text-[11px] uppercase tracking-widest py-24 text-center">
            No entries captured yet
          </div>
        )}
        {filtered.map(entry => (
          <div key={entry.id} id={`log-${entry.id}`}
            className={`p-5 bg-white/5 border border-white/20 rounded-sm space-y-4 transition-all ${activePath.highlightLogId === entry.id ? 'ring-2 ring-amber-500/50 border-amber-500/50' : ''}`}>
            {/* Entry header */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[10px] font-mono text-white/60">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest
                px-2 py-0.5 rounded-sm border ${METHOD_COLORS[entry.method] || METHOD_COLORS.freetext}`}>
                {entry.method}
              </span>
              <span className="text-[10px] font-mono text-white/90 flex-1 truncate">
                {entry.beatFid}
              </span>
              <span className="text-[10px] font-mono text-white/60">
                {entry.prompt.length} chars
              </span>
            </div>

            {/* Metadata grid */}
            {(entry.model || entry.aspectRatio || entry.imageSize || entry.styleHeader) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2 border-y border-white/10">
                {entry.model && <MetadataItem label="Model" value={entry.model} />}
                {entry.aspectRatio && <MetadataItem label="Aspect" value={entry.aspectRatio} />}
                {entry.imageSize && <MetadataItem label="Dimension" value={entry.imageSize} />}
                {entry.styleHeader && <MetadataItem label="Style Key" value={entry.styleHeader} className="col-span-2 md:col-span-1" />}
              </div>
            )}

            {/* Parts Summary */}
            {Array.isArray(entry.parts) && entry.parts.length > 0 && (
              <div className="bg-black/30 rounded-sm p-3 border border-white/10">
                <div className="text-white/70 text-[10px] uppercase tracking-widest font-black mb-2">Request Part Composition</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {entry.parts.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-white/70">
                      <span className="text-white/50 shrink-0 select-none">#{i + 1}</span>
                      <span className="w-10 text-center bg-white/20 rounded-xs text-[9px] uppercase tracking-tight py-0.5 text-white/90 font-bold">{p.kind}</span>
                      <span className="truncate text-white/90">{p.label || (p.text ? (p.text.length > 30 ? p.text.substring(0, 30) + '...' : p.text) : 'Text Part')}</span>
                      {p.assetId && <span className="text-[10px] text-white/70">({p.assetId})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallbacks */}
            {Array.isArray(entry.fallbacks) && entry.fallbacks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.fallbacks.map((fb, i) => (
                  <span key={i}
                    className="px-2 py-0.5 bg-amber-500/10 text-amber-500
                                border border-amber-500/30 rounded-sm
                                text-[10px] font-mono uppercase tracking-wider">
                    ⚠ {fb}
                  </span>
                ))}
              </div>
            )}
            {/* Prompt expand/copy */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleExpanded(entry.id)}
                className="text-[10px] text-white/80 uppercase tracking-widest
                           font-black hover:text-amber-400 transition-colors flex items-center gap-1.5"
              >
                {expandedIds.has(entry.id) ? '▼ Hide Full Request' : '▶ View Full Request'}
              </button>
              <button
                onClick={() => {
                  const fullText = entry.styleHeader 
                    ? `${entry.styleHeader}\n\n${entry.prompt}`
                    : entry.prompt;
                  navigator.clipboard.writeText(fullText);
                }}
                className="text-[10px] text-emerald-400 uppercase tracking-widest
                           font-black hover:text-emerald-300 transition-colors"
              >
                Copy Prompt
              </button>
            </div>
            {expandedIds.has(entry.id) && (
              <div className="space-y-4">
                {entry.styleHeader && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-sm">
                    <div className="text-white/70 text-[10px] uppercase tracking-widest font-black mb-1">Style Header</div>
                    <pre className="text-[10px] text-white/80 font-mono whitespace-pre-wrap">{entry.styleHeader}</pre>
                  </div>
                )}
                {entry.directorNote && (
                  <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-sm">
                    <div className="text-amber-300/80 text-[10px] uppercase tracking-widest font-black mb-1">Director Note / User Intent</div>
                    <div className="text-[11px] text-white/90 italic quote font-medium">"{entry.directorNote}"</div>
                  </div>
                )}
                <pre className="text-[10px] text-white/90 font-mono whitespace-pre-wrap
                                 leading-relaxed bg-black/60 p-5 rounded-sm
                                 max-h-[500px] overflow-y-auto border border-white/20 scrollbar-hide">
                  {entry.prompt}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GenerationLogPanel;
