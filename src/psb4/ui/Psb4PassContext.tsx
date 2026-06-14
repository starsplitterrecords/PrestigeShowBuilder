import React, { useState } from 'react';
import { Psb4Run, PassSpec, Psb4Artifact, Psb4ConsoleEntry, ArtifactType } from '../types';
import { useStore } from '../../StoreContext';
import { getArtifactView } from './artifactViewRegistry';
import { ChevronDown, ChevronRight, HardDrive, Terminal, FileText, CheckCircle, AlertTriangle, ExternalLink, ShieldCheck, UserCheck } from 'lucide-react';

interface Psb4PassContextProps {
  run: Psb4Run;
  passSpec: PassSpec | null;
  artifacts: Psb4Artifact[];
  selectedEpisodeId: string | null;
  consoleEntries: Psb4ConsoleEntry[];
}

// Collapsible JSON node recursive companion styled conforming to D185 for context inputs
const JsonNode: React.FC<{ value: any; name?: string; depth?: number }> = ({ value, name, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 1);

  if (value === null) {
    return (
      <div className="font-mono text-[10px] pl-4 py-0.5" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
        {name && <span className="text-white/60 mr-1">{name}:</span>}
        <span className="text-white/40">null</span>
      </div>
    );
  }

  if (typeof value === 'object') {
    const isArray = Array.isArray(value);
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;

    if (isEmpty) {
      return (
        <div className="font-mono text-[10px] py-0.5" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
          {name && <span className="text-white/60 mr-1">{name}:</span>}
          <span className="text-white/40">{isArray ? '[]' : '{}'}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col font-mono text-[10px]" style={{ paddingLeft: `${depth * 12}px` }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-left hover:text-white transition-colors py-0.5 focus:outline-none"
        >
          <span className="text-white/60 mr-1.5 font-mono text-[10px] select-none">
            {isExpanded ? '▼' : '▶'}
          </span>
          {name && <span className="text-amber-400 mr-1.5 font-bold">{name}:</span>}
          <span className="text-white/50">
            {isArray ? `Array(${keys.length})` : `Object {`}
          </span>
        </button>
        {isExpanded && (
          <div className="flex flex-col border-l border-white/5 ml-1.5 pl-1.5">
            {keys.map((k) => (
              <JsonNode key={k} name={k} value={value[k]} depth={depth + 1} />
            ))}
          </div>
        )}
        {isExpanded && !isArray && (
          <span className="text-white/40 font-mono py-0.5" style={{ paddingLeft: '8px' }}>
            {"}"}
          </span>
        )}
      </div>
    );
  }

  // Primitive values
  let valColor = 'text-white/90';
  let formatted = String(value);

  if (typeof value === 'string') {
    valColor = 'text-emerald-300';
    formatted = `"${value}"`;
  } else if (typeof value === 'number') {
    valColor = 'text-purple-300';
  } else if (typeof value === 'boolean') {
    valColor = 'text-blue-400';
  }

  return (
    <div className="font-mono text-[10px] py-0.5" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
      {name && <span className="text-white/60 mr-1">{name}:</span>}
      <span className={valColor}>{formatted}</span>
    </div>
  );
};

export const Psb4PassContext: React.FC<Psb4PassContextProps> = ({
  run,
  passSpec,
  artifacts,
  selectedEpisodeId,
  consoleEntries
}) => {
  const { state, dispatch } = useStore();
  const show = state.currentShow;

  // Local state to track which inputs are expanded
  const [expandedInputs, setExpandedInputs] = useState<Record<string, boolean>>({});

  const toggleExpandInput = (id: string) => {
    setExpandedInputs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const showEpisodes = show?.seasons?.[0]?.episodes || [];
  const totalEpisodeCount = showEpisodes.length;

  const handleViewAllConsole = () => {
    dispatch({ type: 'SET_VIEW', view: 'psb4-replay' });
  };

  // Helper to extract preview text
  const getArtifactSnippet = (payload: any): string => {
    if (!payload || typeof payload !== 'object') return '';
    const searchKeys = ['premise', 'rationale', 'description', 'heading', 'themes', 'analysis', 'regroundingStatement', 'summary'];
    for (const k of searchKeys) {
      if (typeof payload[k] === 'string' && payload[k].trim().length > 0) {
        return payload[k].trim();
      }
    }
    for (const k of Object.keys(payload)) {
      if (typeof payload[k] === 'string' && payload[k].trim().length > 10) {
        return payload[k].trim();
      }
    }
    return '';
  };

  // Format Artifact type name to readable string
  const formatArtifactTypeName = (type: string) => {
    return type
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  if (!passSpec) {
    return (
      <div className="h-full flex flex-col justify-between bg-[#090909] text-white/50 p-4 select-none" id="ctx-pane-empty">
        <div className="text-center py-20 font-mono text-[10px] uppercase tracking-widest text-white/50">
          No pass selected.
        </div>
      </div>
    );
  }

  // Filter console entries matching the current pass
  const passConsoleEntries = consoleEntries
    .filter(c => c.pass === passSpec.id)
    .sort((a, b) => b.createdAt - a.createdAt); // newest first

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#090909] text-left" id="psb4_pass_context_pane">
      {/* Inputs Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 min-w-0" id="ctx_inputs_section">
        <div className="flex items-center justify-between shrink-0 mb-1.5 border-b border-white/5 pb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#939393]">
            Inputs
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/70">
            {passSpec?.inputs?.length || 0} DEPS
          </span>
        </div>

        {passSpec.inputs.length === 0 ? (
          <div className="text-[10px] font-mono text-center py-8 text-white/40 uppercase tracking-widest">
            No dependencies required.
          </div>
        ) : (
          <div className="space-y-2">
            {passSpec.inputs.map((inputSpec, idx) => {
              const inputId = `input_${idx}`;
              const isExpanded = !!expandedInputs[inputId];

              if (inputSpec.kind === 'source') {
                return (
                  <div key={inputId} className="p-3 bg-[#0d0d0d] border border-white/10 rounded" id={`ctx_input_source_${idx}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText size={13} className="text-amber-400 shrink-0" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white font-bold select-none">
                        Source Teleplay
                      </span>
                    </div>
                    <div className="text-[10px] space-y-0.5 font-mono text-white/60">
                      <div>Band: <span className="text-white/80">Standard (PSB3)</span></div>
                      <div>Scope: <span className="text-white/80">{inputSpec.selector === 'full' ? 'Full Season' : String(inputSpec.selector)}</span></div>
                      <div>Episodes: <span className="text-white/80">{totalEpisodeCount}</span></div>
                    </div>
                  </div>
                );
              }

              if (inputSpec.kind === 'show') {
                return (
                  <div key={inputId} className="p-3 bg-[#0d0d0d] border border-white/10 rounded" id={`ctx_input_show_${idx}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white font-bold select-none">
                        Show Context
                      </span>
                    </div>
                    <div className="text-[10px] space-y-0.5 font-mono text-white/60">
                      <div>Title: <span className="text-white/80 truncate block">{show?.name || 'Untitled Show'}</span></div>
                      <div>Characters Count: <span className="text-white/80">{(show?.characters || []).length}</span></div>
                      <div>Tone/Guidelines: <span className="text-white/80">{inputSpec.selector}</span></div>
                    </div>
                  </div>
                );
              }

              if (inputSpec.kind === 'literal') {
                return (
                  <div key={inputId} className="p-3 bg-[#0d0d0d] border border-white/10 rounded" id={`ctx_input_literal_${idx}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Terminal size={13} className="text-purple-400 shrink-0" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white font-bold">
                        {inputSpec.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70 line-clamp-2">
                      {inputSpec.value}
                    </p>
                  </div>
                );
              }

              if (inputSpec.kind === 'artifact') {
                // Find matching artifacts
                const matches = artifacts.filter(a => a.artifactType === inputSpec.type);
                // Filter by episode if looking up 'current' episode ref (latest first)
                let targetArtifact: Psb4Artifact | null = null;
                
                if (inputSpec.episodeRef === 'current' && selectedEpisodeId) {
                  const epMatches = matches.filter(a => a.episodeId === selectedEpisodeId);
                  targetArtifact = epMatches.length > 0 ? epMatches[epMatches.length - 1] : null;
                } else {
                  targetArtifact = matches.length > 0 ? matches[matches.length - 1] : null;
                }

                if (!targetArtifact) {
                  return (
                    <div key={inputId} className="p-3 bg-white/[0.01] border border-white/5 opacity-55 rounded text-white/40" id={`ctx_input_missing_${idx}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={13} className="text-white/30 shrink-0 animate-pulse" />
                        <span className="text-[10px] font-mono uppercase tracking-wider">
                          {formatArtifactTypeName(inputSpec.type)}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono italic">
                        Not yet generated
                      </p>
                    </div>
                  );
                }

                const snippet = getArtifactSnippet(targetArtifact.payload);
                const displaySnippet = snippet.length > 120 ? snippet.slice(0, 120) + '...' : snippet;

                return (
                  <div 
                    key={inputId} 
                    className={`p-3 bg-[#0d0d0d] border hover:bg-[#111] transition duration-150 rounded cursor-pointer ${
                      isExpanded ? 'border-amber-500/40 bg-[#111111]' : 'border-white/10'
                    }`}
                    onClick={() => toggleExpandInput(inputId)}
                    id={`ctx_input_artifact_${idx}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <HardDrive size={13} className="text-amber-400 shrink-0" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-white font-bold truncate">
                          {formatArtifactTypeName(inputSpec.type)}
                        </span>
                      </div>
                      <ChevronDown 
                        size={12} 
                        className={`text-white/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      />
                    </div>

                    {!isExpanded ? (
                      /* Compact snippet display */
                      <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                        {displaySnippet || <span className="opacity-40 italic">Structural data payload</span>}
                      </p>
                    ) : (
                      /* Expanded full artifact view */
                      <div className="mt-2.5 pt-2 border-t border-white/5 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const InputView = getArtifactView(targetArtifact.artifactType);
                          if (InputView) {
                            return <InputView artifact={targetArtifact} />;
                          }
                          return <JsonNode value={targetArtifact.payload} name="payload" />;
                        })()}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 h-px bg-white/10" />

      {/* Console Section */}
      <div className="shrink-0 max-h-[35%] overflow-hidden flex flex-col bg-[#070707]" id="ctx_console_section">
        {/* Header */}
        <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Terminal size={12} className="text-white/60" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#a1a1a1]">
              Console ({passConsoleEntries.length})
            </span>
          </div>

          <button
            onClick={handleViewAllConsole}
            className="text-[10px] font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 uppercase transition"
            id="ctx_view_all_console_btn"
          >
            VIEW ALL <ExternalLink size={9} />
          </button>
        </div>

        {/* Trace List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5" id="ctx_console_list">
          {passConsoleEntries.length === 0 ? (
            <div className="text-[10px] font-mono text-center text-white/40 py-10 uppercase tracking-widest">
              No activity yet.
            </div>
          ) : (
            passConsoleEntries.slice(0, 8).map(entry => {
              const hasError = !!entry.error;
              const date = new Date(entry.createdAt);
              const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div 
                  key={entry.id} 
                  className={`p-2 bg-[#0d0d0d] border rounded font-mono text-[10px] flex flex-col gap-1 ${
                    hasError ? 'border-red-900/30 bg-red-950/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasError ? 'bg-red-500' : 'bg-emerald-400'}`} />
                      <span className="text-[10px] font-bold text-white/50 uppercase select-none shrink-0 border border-white/5 px-1 bg-white/[0.02]">
                        {entry.eventType}
                      </span>
                      <span className="text-white/60 truncate text-[9px]">
                        Pass {entry.pass} {entry.step ? `• ${entry.step}` : ''}
                      </span>
                    </div>
                    <span className="text-white/40 text-[9px] shrink-0 font-mono">
                      {timeString}
                    </span>
                  </div>

                  {/* Summary row */}
                  <div className="text-[10.5px] text-white/80 line-clamp-1 leading-relaxed pl-3 font-medium">
                    {hasError ? (
                      <span className="text-red-400">{entry.error}</span>
                    ) : (
                      <span>
                        Model: {entry.metadata?.model || 'unknown'} • Duration:{' '}
                        {entry.metadata?.durationMs ? `${(entry.metadata.durationMs / 1000).toFixed(1)}s` : 'N/A'} • In:{' '}
                        {entry.metadata?.tokensIn || 0} Out: {entry.metadata?.tokensOut || 0}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
