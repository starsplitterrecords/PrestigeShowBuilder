import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../StoreContext';
import { getTeleplaysStats, TeleplaysStats } from '../utils/assembleTeleplay';
import { formatEpisode } from '../lib/teleplayer/formatter';

const TeleplaysPanel: React.FC = () => {
  const { state } = useStore();
  const { currentShow } = state;
  const [teleplayText, setTeleplayText] = useState<string>('');
  const [stats, setStats] = useState<TeleplaysStats | null>(null);
  const [isAssembling, setIsAssembling] = useState(true);
  const [tocOpen, setTocOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const readerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentShow) return;
    setIsAssembling(true);
    
    const timer = setTimeout(() => {
      const parts: string[] = [];
      for (const season of currentShow.seasons) {
        for (const episode of season.episodes) {
          parts.push(formatEpisode(episode, currentShow));
          parts.push('\n\f'); // page break between episodes
        }
      }
      const text = parts.join('\n');
      
      const s = getTeleplaysStats(currentShow);
      setTeleplayText(text);
      setStats(s);
      setIsAssembling(false);
    }, 30);

    return () => clearTimeout(timer);
  }, [currentShow]);

  const lines = useMemo(() => teleplayText.split('\n'), [teleplayText]);

  const matches = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    const result: number[] = [];
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(q)) {
        result.push(idx);
      }
    });
    return result;
  }, [lines, searchQuery]);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [matches]);

  const scrollToMatch = (idx: number) => {
    const lineEl = document.getElementById(`line-${matches[idx]}`);
    if (lineEl) {
      lineEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const nextMatch = () => {
    if (matches.length === 0) return;
    const next = (currentMatchIdx + 1) % matches.length;
    setCurrentMatchIdx(next);
    scrollToMatch(next);
  };

  const prevMatch = () => {
    if (matches.length === 0) return;
    const prev = (currentMatchIdx - 1 + matches.length) % matches.length;
    setCurrentMatchIdx(prev);
    scrollToMatch(prev);
  };

  const handleExport = () => {
    if (!currentShow) return;
    const blob = new Blob([teleplayText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const title = (currentShow.titleSuggestion || currentShow.name || 'show').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.href = url;
    a.download = `${title}_teleplay_v${currentShow.draftVersion}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLineStyle = (line: string) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('ACT ') || trimmed.startsWith('END OF ACT ') || trimmed === 'COLD OPEN' || trimmed === 'END OF COLD OPEN') return 'text-amber-500 font-bold mt-8 mb-2';
    if (trimmed.match(/^(INT\.|EXT\.)/)) return 'text-cyan-500/80 font-bold mt-4';
    if (line.match(/^ {28,}[A-Z][A-Z\s]+$/) && !trimmed.startsWith('(')) return 'text-white uppercase tracking-widest font-black'; // Character cue
    if (line.match(/^ {24,}\(/)) return 'text-white text-sm'; // Parenthetical
    if (line.startsWith('                         ')) return 'text-white text-sm leading-relaxed'; // Dialogue
    return 'text-white text-sm'; // Action
  };

  const tocEntries = useMemo(() => {
    if (!currentShow) return [];
    const entries: { id: string, label: string, lineIdx: number }[] = [];
    
    currentShow.seasons.forEach((s, sIdx) => {
      s.episodes.forEach((e, eIdx) => {
        const eLine = lines.findIndex(l => l.includes(`"${e.title.toUpperCase()}"`));
        if (eLine !== -1) entries.push({ id: `e-${sIdx}-${eIdx}`, label: `S${s.number || sIdx + 1}E${e.number || eIdx + 1}: ${e.title}`, lineIdx: eLine });
      });
    });
    
    return entries;
  }, [currentShow, lines]);

  const scrollToLine = (lineIdx: number) => {
    const el = document.getElementById(`line-${lineIdx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.innerWidth < 1024) setTocOpen(false);
  };

  if (!currentShow) return null;

  return (
    <div className="flex h-full bg-[#070707] text-white overflow-hidden relative">
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-[#0a0a0a] border-r border-white/70 flex flex-col transition-transform duration-300
        lg:relative lg:translate-x-0
        ${tocOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-14 border-b border-white/70 flex items-center justify-between px-6 shrink-0">
          <span className="text-[10px] uppercase tracking-widest font-black text-white">Table of Contents</span>
          <button onClick={() => setTocOpen(false)} className="lg:hidden text-white hover:text-white">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
          {tocEntries.map(entry => (
            <button
              key={entry.id}
              onClick={() => scrollToLine(entry.lineIdx)}
              className="w-full text-left py-2 px-4 text-[10px] uppercase tracking-widest font-bold text-white hover:text-white hover:bg-white/30 rounded-sm transition-all whitespace-pre"
            >
              {entry.label}
            </button>
          ))}
        </div>

        {stats && (
          <div className="p-6 border-t border-white/70 bg-black/20 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-amber-400 font-black">Production Stats</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="space-y-0.5">
                <div className="text-[10px] text-white/70 uppercase font-black">Episodes</div>
                <div className="text-xs font-mono">{stats.episodes}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-white/70 uppercase font-black">Beats</div>
                <div className="text-xs font-mono">{stats.beats}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-white/70 uppercase font-black">Words</div>
                <div className="text-xs font-mono">{stats.estimatedWords.toLocaleString()}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] text-white/70 uppercase font-black">Pages</div>
                <div className="text-xs font-mono">{stats.estimatedPages}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-white/70 bg-[#0a0a0a] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            {!tocOpen && (
              <button onClick={() => setTocOpen(true)} className="text-white hover:text-white text-xs uppercase tracking-widest font-bold">
                ☰ TOC
              </button>
            )}
            <div className="flex items-center gap-2 bg-white/30 border border-white/70 rounded-sm px-3 py-1.5">
              <span className="text-white/90 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search script..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-white w-32 md:w-64"
              />
              {matches.length > 0 && (
                <div className="flex items-center gap-2 border-l border-white/70 pl-2 ml-2">
                  <span className="text-[10px] font-mono text-amber-400 font-bold">{currentMatchIdx + 1}/{matches.length}</span>
                  <button onClick={prevMatch} className="text-white hover:text-white">↑</button>
                  <button onClick={nextMatch} className="text-white hover:text-white">↓</button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleExport}
            className="bg-amber-500 text-black px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all"
          >
            ↓ Export .txt
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-12 scrollbar-hide" ref={readerRef}>
          {isAssembling ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
              <div className="text-[10px] uppercase tracking-[0.4em] text-white/90 font-black">Assembling Teleplay...</div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-0.5 font-mono">
              {lines.map((line, idx) => {
                const isMatch = matches.includes(idx);
                const isCurrentMatch = isMatch && matches[currentMatchIdx] === idx;
                
                return (
                  <div
                    key={idx}
                    id={`line-${idx}`}
                    className={`
                      whitespace-pre-wrap min-h-[1.2em] px-4 py-0.5 rounded-sm transition-colors
                      ${getLineStyle(line)}
                      ${isMatch ? (isCurrentMatch ? 'bg-amber-500/40 text-white' : 'bg-amber-500/10') : ''}
                    `}
                  >
                    {line || ' '}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeleplaysPanel;
