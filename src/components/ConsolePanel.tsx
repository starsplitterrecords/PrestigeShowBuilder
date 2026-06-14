import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../StoreContext';
import { 
  listRuns, 
  listConsoleEntries, 
  preserveRun,
  getConsoleEntry
} from '../psb4/storage';
import { Psb4Run, Psb4ConsoleEntry, Psb4Phase } from '../psb4/types';
import { 
  Database,
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Copy, 
  ChevronRight, 
  Calendar, 
  Terminal, 
  Hash, 
  Bookmark, 
  BookmarkCheck,
  Zap,
  Layers,
  FileCode,
  ArrowLeft,
  Search
} from 'lucide-react';

const ConsolePanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const showId = state.currentShow?.id;
  const showName = state.currentShow?.name || 'Show';

  const [runs, setRuns] = useState<Psb4Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [entries, setEntries] = useState<Psb4ConsoleEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<Psb4ConsoleEntry | null>(null);
  
  const [filterType, setFilterType] = useState<'all' | 'prompt' | 'assembly' | 'synthesis'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<'prompt' | 'output' | 'error' | null>(null);

  // Load runs for current show
  const loadRuns = async () => {
    if (!showId) return;
    try {
      const allRuns = await listRuns(showId);
      setRuns(allRuns);
      
      // Select the active run or most recent run if none is selected
      if (allRuns.length > 0 && !selectedRunId) {
        const activeRun = allRuns.find(r => r.status === 'active');
        if (activeRun) {
          setSelectedRunId(activeRun.id);
        } else {
          setSelectedRunId(allRuns[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [showId]);

  // Handle JumpToConsole triggers
  useEffect(() => {
    const checkJumps = async () => {
      const jumpRunId = localStorage.getItem('psb4-jump-run-id');
      const jumpEntryId = localStorage.getItem('psb4-jump-entry-id');
      if (jumpRunId && jumpEntryId) {
        localStorage.removeItem('psb4-jump-run-id');
        localStorage.removeItem('psb4-jump-entry-id');
        
        setSelectedRunId(jumpRunId);
        setSelectedEntryId(jumpEntryId);
        
        // Fetch explicit entry
        try {
          const entry = await getConsoleEntry(jumpEntryId);
          if (entry) {
            setSelectedEntry(entry);
          }
        } catch (err) {
          console.error('Failed to fetch jumped entry:', err);
        }
      }
    };
    
    // Check every time view pivots to psb4-replay
    if (state.view === 'psb4-replay') {
      checkJumps();
    }
  }, [state.view]);

  // Load console entries for selected run
  useEffect(() => {
    const fetchEntries = async () => {
      if (!selectedRunId) {
        setEntries([]);
        return;
      }
      try {
        const list = await listConsoleEntries(selectedRunId);
        setEntries(list);
        
        // If we have selectedEntryId, fetch current full entry
        if (selectedEntryId) {
          const matched = list.find(e => e.id === selectedEntryId);
          if (matched) {
            setSelectedEntry(matched);
          } else {
            // Check IDB directly in case it is newly linked
            const direct = await getConsoleEntry(selectedEntryId);
            setSelectedEntry(direct);
          }
        } else if (list.length > 0 && !selectedEntryId) {
          setSelectedEntryId(list[0].id);
          setSelectedEntry(list[0]);
        }
      } catch (err) {
        console.error('Failed to load entries:', err);
      }
    };

    fetchEntries();
    
    // Poll active runs periodically for real-time observability
    const activeRun = runs.find(r => r.id === selectedRunId);
    let interval: NodeJS.Timeout | null = null;
    if (activeRun && activeRun.status === 'active') {
      interval = setInterval(fetchEntries, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedRunId, selectedEntryId, runs]);

  // Toggle run preservation
  const handleTogglePreserve = async (runId: string, currentVal: boolean) => {
    try {
      await preserveRun(runId, !currentVal);
      // Reload runs to display updated save badge
      await loadRuns();
      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { 
          id: Math.random().toString(), 
          type: 'success', 
          message: `Run ${runId.substring(0, 8)} preservation ${!currentVal ? 'ENABLED' : 'DISABLED'}` 
        } 
      });
    } catch (err) {
      console.error('Failed to toggle preservation:', err);
    }
  };

  // Human date helper
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Copy helper
  const handleCopy = (text: string, field: 'prompt' | 'output' | 'error') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filtering matches
  const filteredEntries = entries.filter(e => {
    if (filterType !== 'all' && e.eventType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const stepMatch = e.step?.toLowerCase().includes(q);
      const passMatch = e.pass?.toLowerCase().includes(q);
      const phaseMatch = e.phase?.toLowerCase().includes(q);
      const rawPromptMatch = e.input?.prompt?.toLowerCase().includes(q);
      const rawOutputMatch = e.output?.raw?.toLowerCase().includes(q) || e.output?.assembled?.toLowerCase().includes(q);
      const errMsgMatch = e.error?.toLowerCase().includes(q);
      return stepMatch || passMatch || phaseMatch || rawPromptMatch || rawOutputMatch || errMsgMatch;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-screen bg-[#0d0f12] text-[#f3f4f6]" id="psb4_console_panel">
      {/* HEADER SECTION */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1f2937] bg-[#111827]">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'dashboard' })}
            className="p-1 px-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="h-4 w-px bg-gray-700"></div>
          <Database className="w-5 h-5 text-amber-500" />
          <div>
            <h1 className="text-sm font-extrabold uppercase tracking-wider text-amber-500">
              REPLAY OBSERVABILITY CONSOLE
            </h1>
            <p className="text-[11px] text-gray-400">
              PSB4 Corpus Engineering and Generation Flow Logs — {showName}
            </p>
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT COLUMN: RUNS & PROGRESS SPEC */}
        <div className="w-80 border-r border-[#1f2937] bg-[#11141b] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#1f2937] bg-[#151922]">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Historical Runs</h2>
            <p className="text-[10px] text-gray-500 leading-snug">
              Retains completed runs dynamically. Click to load full workflow.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {runs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No runs logged for this show.
              </div>
            ) : (
              runs.map((run) => {
                const isSelected = run.id === selectedRunId;
                return (
                  <div 
                    key={run.id}
                    onClick={() => {
                      setSelectedRunId(run.id);
                      setSelectedEntryId('');
                      setSelectedEntry(null);
                    }}
                    className={`p-3 rounded-md border text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-amber-500/10 border-amber-500/40' 
                        : 'bg-[#161a23] border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-gray-300 flex items-center gap-1">
                        <Hash className="w-2.5 h-2.5" /> {run.id.substring(0, 8)}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                        run.status === 'active' 
                          ? 'bg-sky-500/20 text-sky-400 animate-pulse'
                          : run.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : run.status === 'abandoned'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {run.status}
                      </span>
                    </div>

                    <div className="flex items-center text-[10px] text-gray-400 gap-1.5 mb-2.5">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      {formatDate(run.createdAt)}
                    </div>

                    {/* Checklists */}
                    <div className="border-t border-gray-800 pt-2 space-y-1 text-[9px] text-gray-400 font-mono">
                      {Object.keys(run.phaseProgress).map((phs) => {
                        // @ts-expect-error LEGACY: phaseProgress index may be strict null/undefined
                        const prog = run.phaseProgress[phs as Psb4Phase];
                        return (
                          <div key={phs} className="flex items-center justify-between">
                            <span className="capitalize">{phs.replace('_', ' ')}:</span>
                            <span className={`font-semibold ${
                              prog === 'completed' 
                                ? 'text-emerald-400'
                                : prog === 'running'
                                ? 'text-sky-400'
                                : prog === 'failed'
                                ? 'text-rose-400'
                                : 'text-gray-600'
                            }`}>
                              {prog}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Preservation Toggle */}
                    <div 
                      className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between text-[10px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePreserve(run.id, run.preserved);
                      }}
                    >
                      <span className="text-gray-400 flex items-center gap-1">
                        Locked Exemption
                      </span>
                      <button className={`p-1 rounded transition-all hover:bg-white/10 ${
                        run.preserved ? 'text-amber-400' : 'text-gray-600'
                      }`}>
                        {run.preserved ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: FLOW LOG TIMELINE */}
        <div className="flex-1 bg-[#0b0c0f] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#1f2937] bg-[#11141a] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Run Replay Feed</h2>
              <p className="text-[10px] text-gray-500 leading-snug">
                Chronological list of all synthesis prompts, model payloads, and manual edits.
              </p>
            </div>
            
            {/* SEARCH AND FILTER BAR */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                <input 
                  type="text" 
                  placeholder="Filter inputs/outputs/errors..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#181d26] border border-gray-800 rounded px-2 pl-7 py-1 text-xs text-[#e5e7eb] placeholder-gray-500 focus:outline-none focus:border-amber-500 w-44"
                />
              </div>

              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-[#181d26] border border-gray-800 text-xs text-gray-300 rounded px-2 py-1 focus:outline-none"
              >
                <option value="all">All Events</option>
                <option value="prompt">Prompts (LLM)</option>
                <option value="assembly">Assemblies</option>
                <option value="synthesis">Syntheses</option>
              </select>
            </div>
          </div>

          {/* TIMELINE LOG FEED */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">
                {entries.length === 0 
                  ? 'No console records stored for this run.' 
                  : 'No entries match your filters.'}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isSelected = entry.id === selectedEntryId;
                const isSuccess = !entry.error;
                const isPending = entry.output?.pending === true;

                // Color assignments per standard rule
                const pillColor = 
                  entry.eventType === 'prompt' 
                    ? 'border-sky-500/30 bg-sky-500/5 text-sky-400'
                    : entry.eventType === 'assembly'
                    ? 'border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-400'
                    : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';

                return (
                  <div 
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntryId(entry.id);
                      setSelectedEntry(entry);
                    }}
                    className={`p-3 rounded-md border text-left cursor-pointer transition-all flex items-start space-x-3 hover:bg-white/5 ${
                      isSelected 
                        ? 'border-amber-500/50 bg-[#1e1c15]' 
                        : 'border-gray-900 bg-[#101318]'
                    }`}
                  >
                    {/* Status check icons */}
                    <div className="mt-1">
                      {isPending ? (
                        <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                      ) : isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${pillColor}`}>
                            {entry.eventType}
                          </span>
                          <span className="text-[10px] text-gray-400 capitalize bg-white/5 px-1.5 py-0.5 rounded font-mono">
                            {entry.phase.replace('_', ' ')} v{entry.pass}
                          </span>
                          {entry.step && (
                            <span className="text-[10px] font-semibold text-gray-400 font-mono">
                              ▸ {entry.step}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-gray-500 font-mono">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>

                      {/* Snippet Preview */}
                      <p className="text-[11px] text-gray-300 font-mono break-all line-clamp-2 leading-relaxed">
                        {entry.eventType === 'prompt' 
                          ? entry.input?.prompt 
                          : entry.eventType === 'assembly'
                          ? entry.output?.assembled
                          : JSON.stringify(entry.output?.synthesized)}
                      </p>

                      {/* Duration / Token count tags */}
                      <div className="flex items-center gap-2 pt-1 font-mono text-[9px] text-gray-500">
                        {entry.metadata?.durationMs && (
                          <span>| {entry.metadata.durationMs}ms</span>
                        )}
                        {entry.metadata?.tokensIn && (
                          <span>| In: {entry.metadata.tokensIn}</span>
                        )}
                        {entry.metadata?.tokensOut && (
                          <span>| Out: {entry.metadata.tokensOut}</span>
                        )}
                        {entry.producedArtifactId && (
                          <span className="text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                            Produces Artifact
                          </span>
                        )}
                        {entry.producedCorpusId && (
                          <span className="text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                            Produces Corpus
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <ChevronRight className="w-4 h-4 text-gray-600 self-center" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: EXPANDED ENTRY DRAWER */}
        <div className="w-[500px] border-l border-[#1f2937] bg-[#10141c] flex flex-col overflow-hidden">
          {selectedEntry ? (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-[#1f2937] bg-[#161a24] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#f3f4f6] uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-amber-500" /> Event Details
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    ID: {selectedEntry.id}
                  </p>
                </div>
                
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                    selectedEntry.eventType === 'prompt' 
                      ? 'border-sky-500/30 bg-sky-500/5 text-sky-400'
                      : selectedEntry.eventType === 'assembly'
                      ? 'border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-400'
                      : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  }`}>
                  {selectedEntry.eventType}
                </span>
              </div>

              {/* DRAWER SCROLL CONTENT */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* METADATA PANEL */}
                <div className="p-3 bg-black/40 rounded border border-gray-800 text-xs font-mono space-y-1.5 text-gray-300">
                  <div className="text-[11px] font-bold text-amber-500 border-b border-gray-800 pb-1 mb-1.5 uppercase tracking-widest">
                    Execution Metadata
                  </div>
                  <div className="flex justify-between">
                    <span>Phase:</span>
                    <span className="text-white font-semibold capitalize">{selectedEntry.phase}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Iteration/Pass:</span>
                    <span className="text-white font-semibold">v{selectedEntry.pass}</span>
                  </div>
                  {selectedEntry.step && (
                    <div className="flex justify-between">
                      <span>Step Engine:</span>
                      <span className="text-white font-semibold">{selectedEntry.step}</span>
                    </div>
                  )}
                  {selectedEntry.metadata?.model && (
                    <div className="flex justify-between">
                      <span>LLM Model:</span>
                      <span className="text-sky-400 font-semibold">{selectedEntry.metadata.model}</span>
                    </div>
                  )}
                  {selectedEntry.metadata?.temperature !== undefined && (
                    <div className="flex justify-between">
                      <span>Temperature:</span>
                      <span className="text-white font-semibold">{selectedEntry.metadata.temperature}</span>
                    </div>
                  )}
                  {selectedEntry.metadata?.durationMs && (
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="text-white font-semibold">{selectedEntry.metadata.durationMs}ms</span>
                    </div>
                  )}
                  {selectedEntry.metadata?.tokensIn && (
                    <div className="flex justify-between">
                      <span>Tokens In (Prompt):</span>
                      <span className="text-white font-semibold">{selectedEntry.metadata.tokensIn}</span>
                    </div>
                  )}
                  {selectedEntry.metadata?.tokensOut && (
                    <div className="flex justify-between">
                      <span>Tokens Out (Response):</span>
                      <span className="text-white font-semibold">{selectedEntry.metadata.tokensOut}</span>
                    </div>
                  )}
                  {selectedEntry.metadata?.finishReason && (
                    <div className="flex justify-between">
                      <span>Finish Reason:</span>
                      <span className="text-white font-semibold capitalize">{selectedEntry.metadata.finishReason}</span>
                    </div>
                  )}
                </div>

                {/* ERROR ALERT (IF APPLICABLE) */}
                {selectedEntry.error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs font-mono space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      <AlertCircle className="w-4 h-4" /> TRACE ERROR DETECTED
                    </div>
                    <pre className="whitespace-pre-wrap break-all bg-black/30 p-2 rounded">
                      {selectedEntry.error}
                    </pre>
                  </div>
                )}

                {/* DYNAMIC CONTENTS PANELS BASED ON TYPE */}
                {selectedEntry.eventType === 'prompt' && (
                  <div className="space-y-4">
                    {/* PROMPT PANEL */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-sky-400" /> Prompts Instructions Sent
                        </label>
                        <button 
                          onClick={() => handleCopy(selectedEntry.input?.prompt || '', 'prompt')}
                          className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded transition-all"
                        >
                          <Copy className="w-3 h-3" /> {copiedField === 'prompt' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-3 bg-black/40 border border-gray-800 rounded text-[11px] font-mono text-gray-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                        {selectedEntry.input?.prompt}
                      </pre>
                    </div>

                    {/* MODELS RAW TEXT RESPONSE */}
                    {!selectedEntry.error && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-emerald-400" /> Models Raw Answer Output
                          </label>
                          <button 
                            onClick={() => handleCopy(selectedEntry.output?.raw || '', 'output')}
                            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded transition-all"
                          >
                            <Copy className="w-3 h-3" /> {copiedField === 'output' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="p-3 bg-black/40 border border-gray-800 rounded text-[11px] font-mono text-gray-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                          {selectedEntry.output?.raw || (selectedEntry.output?.pending ? '(Generation Pending...)' : '(No response)')}
                        </pre>
                      </div>
                    )}

                    {/* STRUCTURED JSON PARSE VISUALIZATION */}
                    {selectedEntry.output?.parsed && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-amber-500" /> Structured Extraction (Parsed JSON)
                        </label>
                        <pre className="p-3 bg-black/60 border border-gray-800 rounded text-[11px] font-mono text-[#fcd34d] overflow-x-auto leading-relaxed">
                          {JSON.stringify(selectedEntry.output.parsed, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {selectedEntry.eventType === 'assembly' && (
                  <div className="space-y-4">
                    {/* ASSEMBLY SEGMENTS PREVIEW */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-fuchsia-400" /> Assembly Source Fragments
                      </label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedEntry.input?.fragments && Array.isArray(selectedEntry.input.fragments) ? (
                          selectedEntry.input.fragments.map((frag: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-black/30 border border-gray-800 rounded font-mono text-[10px]">
                              <div className="border-b border-gray-800 text-amber-500 pb-1 mb-1 font-bold">
                                Fragment #{idx + 1}: {frag.name || 'document'}
                              </div>
                              <div className="text-gray-300 break-words line-clamp-4">
                                {frag.content}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-2 text-center text-gray-500 text-xs font-mono">
                            No fragments logged
                          </div>
                        )}
                      </div>
                    </div>

                    {/* COMPILED ASSEMBLY OUTPUT */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-amber-400" /> Compiled Final Assemblage
                        </label>
                        <button 
                          onClick={() => handleCopy(selectedEntry.output?.assembled || '', 'output')}
                          className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded transition-all"
                        >
                          <Copy className="w-3 h-3" /> {copiedField === 'output' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-3 bg-black/40 border border-gray-800 rounded text-[11px] font-mono text-gray-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                        {selectedEntry.output?.assembled}
                      </pre>
                    </div>
                  </div>
                )}

                {selectedEntry.eventType === 'synthesis' && (
                  <div className="space-y-4">
                    {/* INPUT SOURCE */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-400" /> Input Payload
                      </label>
                      <pre className="p-3 bg-black/40 border border-gray-800 rounded text-[11px] font-mono text-gray-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                        {typeof selectedEntry.input === 'string' 
                          ? selectedEntry.input 
                          : JSON.stringify(selectedEntry.input, null, 2)}
                      </pre>
                    </div>

                    {/* SYNTHESIZED PRODUCT */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-400" /> Synthesized Result Product
                        </label>
                        <button 
                          onClick={() => handleCopy(JSON.stringify(selectedEntry.output?.synthesized || {}, null, 2), 'output')}
                          className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded transition-all"
                        >
                          <Copy className="w-3 h-3" /> {copiedField === 'output' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-3 bg-black/40 border border-gray-800 rounded text-[11px] font-mono text-gray-200 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                        {JSON.stringify(selectedEntry.output?.synthesized, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-500">
              <Terminal className="w-10 h-10 text-gray-700 mb-2" />
              <p className="text-xs">No entry selected</p>
              <p className="text-[10px] text-gray-600 mt-1 max-w-[280px] text-center">
                Click any prompt or synthesis event in the timeline feed to load audit-trail details.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ConsolePanel;
