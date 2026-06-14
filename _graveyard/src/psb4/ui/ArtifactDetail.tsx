import React, { useState, useEffect } from 'react';
import { Psb4Artifact, ArtifactType } from '../types';
import { getArtifactView } from './artifactViewRegistry';
import { getArtifact } from '../storage';
import { openDB } from '../../storage/db';
import { Copy, Terminal, RefreshCw, Check, Library } from 'lucide-react';

interface ArtifactDetailProps {
  artifact: Psb4Artifact;
  onRefresh: () => void;
  onSwitchTab?: (tab: 'pipeline' | 'artifacts' | 'console') => void;
  readOnly?: boolean;
}

// Collapsible JSON node recursive companion
const JsonNode: React.FC<{ value: any; name?: string; depth?: number }> = ({ value, name, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  if (value === null) {
    return (
      <div className="font-mono text-[10px] pl-4" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
        {name && <span className="text-white/70 mr-1">{name}:</span>}
        <span className="text-zinc-500">null</span>
      </div>
    );
  }

  if (typeof value === 'object') {
    const isArray = Array.isArray(value);
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;

    if (isEmpty) {
      return (
        <div className="font-mono text-[10px]" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
          {name && <span className="text-white/70 mr-1">{name}:</span>}
          <span className="text-zinc-400">{isArray ? '[]' : '{}'}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col font-mono text-[10px]" style={{ paddingLeft: `${depth * 12}px` }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-left hover:text-white transition-colors py-0.5 focus:outline-none"
        >
          <span className="text-white/50 mr-1 font-mono text-[9px] select-none">
            {isExpanded ? '▼' : '▶'}
          </span>
          {name && <span className="text-amber-400 mr-1 font-semibold">{name}:</span>}
          <span className="text-zinc-500">
            {isArray ? `Array(${keys.length})` : `Object {`}
          </span>
        </button>
        {isExpanded && (
          <div className="flex flex-col border-l border-white/5 ml-1.5 pl-0.5">
            {keys.map((k) => (
              <JsonNode key={k} name={k} value={value[k]} depth={depth + 1} />
            ))}
          </div>
        )}
        {isExpanded && !isArray && (
          <span className="text-zinc-500 font-mono py-0.5" style={{ paddingLeft: '8px' }}>
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
    valColor = 'text-purple-400';
  } else if (typeof value === 'boolean') {
    valColor = 'text-blue-400';
  }

  return (
    <div className="font-mono text-[10px]" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
      {name && <span className="text-white/70 mr-1">{name}:</span>}
      <span className={valColor}>{formatted}</span>
    </div>
  );
};

export const ArtifactDetail: React.FC<ArtifactDetailProps> = ({
  artifact,
  onRefresh,
  onSwitchTab,
  readOnly = false
}) => {
  const [copied, setCopied] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [originalAuthor, setOriginalAuthor] = useState<Psb4Artifact | null>(null);

  useEffect(() => {
    const fetchOriginal = async () => {
      if (artifact.supersedesArtifactId) {
        try {
          const orig = await getArtifact(artifact.supersedesArtifactId);
          setOriginalAuthor(orig);
        } catch (err) {
          console.error('Failed to load superseded artifact:', err);
        }
      } else {
        setOriginalAuthor(null);
      }
    };
    fetchOriginal();
  }, [artifact]);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(artifact.payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevert = async () => {
    if (!artifact.supersedesArtifactId) return;
    setReverting(true);
    try {
      const dbLocal = await openDB();
      const tx = dbLocal.transaction('psb4_artifacts', 'readwrite');
      const store = tx.objectStore('psb4_artifacts');
      
      const latest = await new Promise<Psb4Artifact | null>((resolve, reject) => {
        const req = store.get(artifact.id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (latest && originalAuthor) {
        latest.payload = originalAuthor.payload;
        latest.authorEdited = false;
        latest.authorEditedAt = null;

        await new Promise<void>((resolve, reject) => {
          const putReq = store.put(latest);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        });
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to revert active artifact:', err);
    } finally {
      setReverting(false);
    }
  };

  const handleJumpToConsole = () => {
    if (artifact.consoleEntryId && onSwitchTab) {
      localStorage.setItem('psb4-jump-run-id', artifact.runId);
      localStorage.setItem('psb4-jump-entry-id', artifact.consoleEntryId);
      onSwitchTab('console');
    }
  };

  const formatTypeLabel = (typeStr: string) => {
    return typeStr
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Registry lookup
  const CustomView = getArtifactView(artifact.artifactType);

  return (
    <div className="flex flex-col h-full bg-[#070707] border border-white/10 rounded-lg overflow-hidden" id="psb4_artifact_detail">
      {/* Header Banner */}
      <div className="p-4 bg-[#0d0d0d] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-sans font-semibold text-white">
              {formatTypeLabel(artifact.artifactType)}
            </h3>
            <span className="font-mono text-[9px] bg-white/5 border border-white/10 text-white/70 px-1.5 py-0.5 rounded leading-none">
              {artifact.scope.toUpperCase()}
            </span>
            {artifact.authorEdited && (
              <span className="font-mono text-[9px] bg-amber-500/15 border border-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded leading-none">
                EDITED
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-2 text-[10px] font-mono text-white/60">
            <span>Pass: <span className="text-white/90">{artifact.createdByPass}</span></span>
            <span>•</span>
            <span>Date: <span className="text-white/95">{new Date(artifact.createdAt).toLocaleDateString()}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Revert Action */}
          {!readOnly && artifact.authorEdited && artifact.supersedesArtifactId && (
            <button
              onClick={handleRevert}
              disabled={reverting}
              title="Revert to last system version"
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/40 rounded transition-all font-mono leading-none"
            >
              <RefreshCw size={10} className={reverting ? 'animate-spin' : ''} />
              Revert
            </button>
          )}

          {/* Jump to Console */}
          {artifact.consoleEntryId && onSwitchTab && (
            <button
              onClick={handleJumpToConsole}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded transition-all font-mono leading-none"
            >
              <Terminal size={10} />
              Console
            </button>
          )}

          {/* Copy payload */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded transition-all font-mono leading-none"
          >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            {copied ? 'Copied' : 'JSON'}
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {CustomView ? (
          <div className="text-white">
            <CustomView artifact={artifact} />
          </div>
        ) : (
          <div className="bg-[#030303] rounded border border-white/5 p-4 overflow-x-auto">
            <div className="text-[10px] text-zinc-500 font-mono mb-3 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Library size={12} />
              Payload Tree Explorer
            </div>
            <JsonNode value={artifact.payload} />
          </div>
        )}
      </div>
    </div>
  );
};
