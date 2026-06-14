import React, { useState, useEffect } from 'react';
import { Psb4Run, PassSpec, Psb4Artifact, ModelId, ArtifactType } from '../types';
import { useStore } from '../../StoreContext';
import { updateRunModelOverride, markArtifactAuthorEdited, getArtifactsByRun, getStorageMode, isFirestoreQuotaExhausted } from '../storage';
import { getArtifactView } from './artifactViewRegistry';
import { getArtifact } from '../storage';
import { Play, Edit3, Save, X, ChevronRight, FileJson, Check, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { PassStatus, computePassStatuses } from './utils/passStatus';
import { applyGndsImport } from '../bridge/applyGndsImport';
import { promoteToProduction } from '../bridge/promoteToProduction';

interface Psb4PassWorkAreaProps {
  run: Psb4Run;
  passSpec: PassSpec | null;
  artifacts: Psb4Artifact[];
  passStatus: PassStatus;
  reason?: string;
  selectedEpisodeId: string | null;
  onEpisodeSelect: (episodeId: string) => void;
  onRunPass: (spec: PassSpec, force?: boolean) => void;
  onRefresh: () => void;
  readOnly?: boolean;
  onResetPass?: () => Promise<void> | void;
  onFork?: () => Promise<void> | void;
}

// Collapsible JSON node recursive companion styled conforming to D185
const JsonNode: React.FC<{ value: any; name?: string; depth?: number }> = ({ value, name, depth = 0 }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  if (value === null) {
    return (
      <div className="font-mono text-[11px] pl-4 py-0.5" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
        {name && <span className="text-white/60 mr-1">{name}:</span>}
        <span className="text-white/50">null</span>
      </div>
    );
  }

  if (typeof value === 'object') {
    const isArray = Array.isArray(value);
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;

    if (isEmpty) {
      return (
        <div className="font-mono text-[11px] py-0.5" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
          {name && <span className="text-white/60 mr-1">{name}:</span>}
          <span className="text-white/50">{isArray ? '[]' : '{}'}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col font-mono text-[11px]" style={{ paddingLeft: `${depth * 12}px` }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-left hover:text-white transition-colors py-0.5 focus:outline-none"
        >
          <span className="text-white/50 mr-1.5 font-mono text-[9px] select-none">
            {isExpanded ? '▼' : '▶'}
          </span>
          {name && <span className="text-amber-400 mr-1.5 font-bold">{name}:</span>}
          <span className="text-white/60">
            {isArray ? `Array(${keys.length})` : `Object {`}
          </span>
        </button>
        {isExpanded && (
          <div className="flex flex-col border-l border-white/10 ml-2 pl-2">
            {keys.map((k) => (
              <JsonNode key={k} name={k} value={value[k]} depth={depth + 1} />
            ))}
          </div>
        )}
        {isExpanded && !isArray && (
          <span className="text-white/50 font-mono py-0.5" style={{ paddingLeft: '12px' }}>
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
    <div className="font-mono text-[11px] py-0.5" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
      {name && <span className="text-white/60 mr-1">{name}:</span>}
      <span className={valColor}>{formatted}</span>
    </div>
  );
};

export const Psb4PassWorkArea: React.FC<Psb4PassWorkAreaProps> = ({
  run,
  passSpec,
  artifacts,
  passStatus,
  reason,
  selectedEpisodeId,
  onEpisodeSelect,
  onRunPass,
  onRefresh,
  readOnly = false,
  onResetPass,
  onFork,
}) => {
  const { state, dispatch } = useStore();
  const show = state.currentShow;

  // Fork states
  const [isForking, setIsForking] = useState(false);

  const handleForkClick = async () => {
    if (!onFork) return;
    setIsForking(true);
    try {
      await onFork();
    } finally {
      setIsForking(false);
    }
  };

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Reset confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Custom import confirmation modal state
  const [importConfirmInfo, setImportConfirmInfo] = useState<{
    originalEpisodeName: string;
    isPass12D: boolean;
  } | null>(null);

  const [isPromoting, setIsPromoting] = useState(false);

  // Version Picker
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | null>(null);

  // Resolve episodes
  const showEpisodes = show?.seasons?.[0]?.episodes || [];
  const episodesInScope = showEpisodes.filter(e => {
    if (!run.scopeEpisodeIds || run.scopeEpisodeIds.length === 0) return true;
    return run.scopeEpisodeIds.includes(e.id);
  });

  // Reset states when current pass or episode changes
  useEffect(() => {
    setIsEditing(false);
    setEditText('');
    setEditError(null);
    setSelectedVersionIndex(null);
  }, [passSpec?.id, selectedEpisodeId]);

  if (!passSpec) {
    return (
      <div 
        className="h-full flex flex-col items-center justify-center text-center p-8 bg-[#070707] flex-1 select-none"
        id="pass_work_area_empty"
      >
        <span className="text-white/50 text-[10px] uppercase tracking-widest font-mono flex items-center gap-2 mb-2 animate-pulse">
          ← Select a pass from the navigator to begin.
        </span>
        <p className="text-xs text-white/50 max-w-sm">
          Execute tasks sequentially or select a prior step to inspect generated artifacts.
        </p>
      </div>
    );
  }

  // Filter versions of artifacts matching this spec's output artifact and current scope
  const relatedArtifacts = artifacts
    .filter(a => a.artifactType === passSpec.outputArtifactType && ((passSpec.scope !== 'episode' && passSpec.scope !== 'episode-anchored') || a.episodeId === selectedEpisodeId))
    .sort((a, b) => a.createdAt - b.createdAt); // oldest first, newest last

  const latestArtifact = relatedArtifacts.length > 0 ? relatedArtifacts[relatedArtifacts.length - 1] : null;

  // Resolve current displayed artifact based on version picker
  let activeArtifact = latestArtifact;
  const hasMultipleVersions = relatedArtifacts.length > 1;

  if (selectedVersionIndex !== null && selectedVersionIndex >= 0 && selectedVersionIndex < relatedArtifacts.length) {
    activeArtifact = relatedArtifacts[selectedVersionIndex];
  }

  const isPriorVersion = activeArtifact && latestArtifact && activeArtifact.id !== latestArtifact.id;

  // Double-check if 0.9G is complete to allow promotion
  const defaultEpIds = showEpisodes.map(e => e.id);
  const calculatedStatuses = computePassStatuses(run, artifacts, [], defaultEpIds, null, show);
  const status09G = calculatedStatuses['0.9G'];
  const is09GComplete = status09G === 'complete' || status09G === 'author-edited';

  let promotionBlockerMessage = '';
  if (!is09GComplete) {
    // Collect exact cross-episode stats
    const epStats = episodesInScope.map(ep => {
      const epId = ep.id;
      const epScriptArts = artifacts.filter(
        a => a.artifactType === 'scene_script' && a.episodeId === epId && a.runId === run.id && a.showId === run.showId
      ).sort((a, b) => b.createdAt - a.createdAt);
      const epScriptArt = epScriptArts[0];

      let epExpectedKeys: string[] = [];
      if (epScriptArt && epScriptArt.payload && Array.isArray((epScriptArt.payload as any).scenes)) {
        epExpectedKeys = (epScriptArt.payload as any).scenes.map((s: any) => `${epId}:A${s.actNumber}S${s.sceneNumber}`);
      } else {
        const epSStructureArts = artifacts.filter(
          a => a.artifactType === 'scene_structure' && a.createdByPass === '0.9S' && a.episodeId === epId && a.runId === run.id && a.showId === run.showId
        ).sort((a, b) => b.createdAt - a.createdAt);
        const epSStructureArt = epSStructureArts[0];
        if (epSStructureArt && epSStructureArt.payload && Array.isArray((epSStructureArt.payload as any).acts)) {
          const acts = (epSStructureArt.payload as any).acts;
          for (const act of acts) {
            if (act && Array.isArray(act.scenes)) {
              for (const sc of act.scenes) {
                if (sc && sc.sceneNumber !== undefined) {
                  epExpectedKeys.push(`${epId}:A${act.actNumber}S${sc.sceneNumber}`);
                }
              }
            }
          }
        }
      }

      const epGStructureArts = artifacts.filter(
        a => a.artifactType === 'scene_structure' && a.createdByPass === '0.9G' && a.episodeId === epId && a.runId === run.id && a.showId === run.showId
      ).sort((a, b) => b.createdAt - a.createdAt);
      const epGStructureArt = epGStructureArts[0];

      const epCompletedSceneKeys = new Set<string>();
      if (epGStructureArt && epGStructureArt.payload) {
        const payload = epGStructureArt.payload as any;
        if (Array.isArray(payload.acts)) {
          for (const act of payload.acts) {
            if (act && Array.isArray(act.scenes)) {
              for (const sc of act.scenes) {
                if (sc && sc.sceneNumber !== undefined) {
                  const beats = sc.beats || sc.pageBeats || [];
                  if (Array.isArray(beats) && beats.length > 0) {
                    epCompletedSceneKeys.add(`${epId}:A${act.actNumber}S${sc.sceneNumber}`);
                  }
                }
              }
            }
          }
        }
        if (payload.metadata && Array.isArray(payload.metadata.completedSceneKeys)) {
          payload.metadata.completedSceneKeys.forEach((k: string) => {
            const cleaned = k.includes(':') ? k : `${epId}:${k.includes('_') ? ('A' + k.split('_')[0] + 'S' + k.split('_')[1]) : k}`;
            epCompletedSceneKeys.add(cleaned);
          });
        } else if (payload.metadata && Array.isArray(payload.metadata.completedScenes)) {
          payload.metadata.completedScenes.forEach((k: string) => {
            const cleaned = k.includes(':') ? k : `${epId}:${k.includes('_') ? ('A' + k.split('_')[0] + 'S' + k.split('_')[1]) : k}`;
            epCompletedSceneKeys.add(cleaned);
          });
        }
      }

      const completedKeys = epExpectedKeys.filter(k => epCompletedSceneKeys.has(k));
      const missingKeys = epExpectedKeys.filter(k => !epCompletedSceneKeys.has(k));

      return { expectedKeys: epExpectedKeys, completedKeys, missingKeys };
    });

    const allExpectedKeys: string[] = [];
    const allCompletedKeys: string[] = [];
    const allMissingKeys: string[] = [];
    epStats.forEach(stat => {
      allExpectedKeys.push(...stat.expectedKeys);
      allCompletedKeys.push(...stat.completedKeys);
      allMissingKeys.push(...stat.missingKeys);
    });

    const getEpLabel = (epId: string) => {
      const epObj = showEpisodes.find((e: any) => e.id === epId);
      if (epObj) {
        const val = (epObj as any).index ?? (epObj as any).number ?? (epObj as any).episodeNumber;
        if (val !== undefined && val !== null) {
          return `EP${val}`;
        }
      }
      const numMatch = epId.match(/\d+/);
      if (numMatch) {
         return `EP${numMatch[0]}`;
      }
      return epId;
    };

    const missingKeysStr = allMissingKeys.map(k => {
      const [id, asKey] = k.includes(':') ? k.split(':') : [episodesInScope[0]?.id, k];
      const epLabel = getEpLabel(id);
      return `${epLabel} ${asKey}`;
    }).join(', ');

    promotionBlockerMessage = `Promotion blocked: 0.9G is incomplete. ${allCompletedKeys.length}/${allExpectedKeys.length} scenes segmented. Missing: ${missingKeysStr}`;
  }

  const currentModelOverride = run.overrides?.[passSpec.id] || passSpec.defaultModel;

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (readOnly) return;
    try {
      await updateRunModelOverride(run.id, passSpec.id, e.target.value as ModelId);
      onRefresh();
    } catch (err) {
      console.error('Failed to update model override:', err);
    }
  };

  // Run pass trigger
  const isQuotaLocked = getStorageMode() !== 'local' && isFirestoreQuotaExhausted();
  const canRun = !readOnly && passStatus !== 'running' && passStatus !== 'blocked' && !isQuotaLocked;

  useEffect(() => {
    if (passSpec) {
      console.log(`[Psb4PassWorkArea] Pass ${passSpec.id} canRun Check:`, {
        canRun,
        readOnly,
        passStatus,
        latestArtifactId: latestArtifact?.id ?? null
      });
    }
  }, [passSpec?.id, canRun, readOnly, passStatus, latestArtifact?.id]);
  
  const handleRunClick = () => {
    if (!canRun || !passSpec) return;
    if (passStatus === 'author-edited') {
      // Author edits are intentional — warn before overwriting.
      if (!window.confirm(
        'This pass has manual author edits. Re-running will '
        + 'discard them and replace the artifact. Continue?'
      )) return;
      onRunPass(passSpec, true);
    } else {
      // complete / pending / partial / error — force is safe.
      const shouldForce = passSpec.id === '0.9G'
        ? passStatus === 'complete' // only force if complete, resume if partial
        : (passStatus === 'complete' || passStatus === 'partial');
      onRunPass(passSpec, shouldForce);
    }
  };

  // Start edit
  const handleStartEdit = () => {
    if (!activeArtifact || readOnly) return;
    setEditText(JSON.stringify(activeArtifact.payload, null, 2));
    setEditError(null);
    setIsEditing(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!activeArtifact) return;
    try {
      const parsed = JSON.parse(editText);
      await markArtifactAuthorEdited(activeArtifact.id, parsed);
      setIsEditing(false);
      setEditError(null);
      onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Invalid JSON payload');
    }
  };

  // Get status dot for an episode tab button
  const getEpisodePassStatus = (episodeId: string) => {
    const epArtifacts = artifacts.filter(a => a.artifactType === passSpec.outputArtifactType && a.episodeId === episodeId);
    if (epArtifacts.length > 0) {
      const hasEdited = epArtifacts.some(a => a.authorEdited);
      return hasEdited ? 'author-edited' : 'complete';
    }
    return 'pending';
  };

  const handlePromoteToProduction = async () => {
    if (!activeArtifact || !show) return;
    setIsPromoting(true);
    try {
      const result = await promoteToProduction(
        show, activeArtifact
      );
      // Reload show from storage so UI sees new data.
      await onRefresh();
      dispatch({ type: 'RELOAD_SHOW' });
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'success',
          message: `Promoted to Issue ${result.issue.issueCode} — ${result.pages.length} pages created.`
        }
      });
    } catch (err: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `Promotion failed: ${err.message}`
        }
      });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-[#070707] flex-1 text-left min-w-0"
      id={`pass_work_area_${passSpec.id?.replace('.', '_')}`}
    >
      {/* 9.3 Pass header strip */}
      <div className="px-5 py-3 border-b border-white/10 bg-[#0b0b0b] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-950/25 px-2 py-0.5 rounded border border-amber-500/10 shrink-0">
            Pass {passSpec.id}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-bold uppercase tracking-wide text-white truncate">
              {passSpec.name}
            </h4>
            <p className="text-[11px] text-white/60 truncate">
              {passSpec.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Model Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-white/50 uppercase">Model:</span>
            <select
              value={currentModelOverride}
              onChange={handleModelChange}
              disabled={readOnly || passStatus === 'running'}
              className="bg-[#121212] border border-white/10 hover:border-white/20 rounded px-2.5 py-1 text-[11px] font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              id={`model_selector_${passSpec.id?.replace('.', '_')}`}
            >
              <option value="gemini-pro">GEMINI-PRO</option>
              <option value="gemini-flash">GEMINI-FLASH</option>
            </select>
          </div>

          {/* Reset Button (only for 0.9W or 0.9G) */}
          {!readOnly && (passSpec.id === '0.9W' || passSpec.id === '0.9G') && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition bg-red-950/40 text-red-400 border border-red-900/30 hover:bg-red-950/60 hover:text-red-300 select-none cursor-pointer"
              id={passSpec.id === '0.9G' ? "work_area_reset_btn_0_9g" : "work_area_reset_btn_0_9w"}
            >
              {passSpec.id === '0.9G' ? 'RESET 0.9G' : 'RESET'}
            </button>
          )}

          {/* Fork required warning for partial 0.9G on read-only runs conforming to D185 */}
          {readOnly && passSpec?.id === '0.9G' && passStatus === 'partial' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[10px] uppercase tracking-wider select-none shrink-0" id="work_area_fork_required_warning">
              <AlertTriangle size={12} className="text-amber-500 shrink-0" />
              Fork required to resume
            </div>
          )}

          {/* Read-only Fork From This Run Button */}
          {readOnly && onFork && (
            <button
              onClick={handleForkClick}
              disabled={isForking}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black active:scale-95 disabled:opacity-50 select-none cursor-pointer"
              id="work_area_fork_btn"
            >
              {isForking ? (
                <>
                  <span className="w-2.5 h-2.5 border-2 border-t-transparent border-[#070707] rounded-full animate-spin mr-1" />
                  FORKING RUN... COPYING ARTIFACTS
                </>
              ) : (
                <>
                  FORK FROM THIS RUN
                </>
              )}
            </button>
          )}

          {/* Run Button (shown only when NOT readOnly) */}
          {!readOnly && (
            <button
              onClick={handleRunClick}
              disabled={!canRun}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider transition ${
                !canRun
                  ? 'bg-white/5 text-white/40 border border-white/5 cursor-not-allowed'
                  : 'bg-amber-400 text-[#070707] hover:bg-amber-300'
              }`}
              title={passStatus === 'blocked' ? 'Required prerequisite artifacts are missing.' : undefined}
              id={`work_area_run_btn_${passSpec.id?.replace('.', '_')}`}
            >
              {passStatus === 'running' ? (
                <>
                  <span className="w-2.5 h-2.5 border-2 border-t-transparent border-current rounded-full animate-spin mr-1" />
                  RUNNING
                </>
              ) : (
                <>
                  <Play size={10} fill="currentColor" />
                  {latestArtifact ? 'RE-RUN' : 'RUN PASS'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 9.4 Episode scope bar */}
      {(passSpec.scope === 'episode' || passSpec.scope === 'episode-anchored') && episodesInScope.length > 0 && (
        <div className="flex border-b border-white/10 bg-[#0a0a0a] overflow-x-auto shrink-0 scrollbar-none" id="episode-scope-bar">
          {episodesInScope.map(ep => {
            const isSelected = selectedEpisodeId === ep.id;
            const epStatus = getEpisodePassStatus(ep.id);
            let dotColor = 'bg-white/20';
            if (epStatus === 'complete') dotColor = 'bg-emerald-400';
            if (epStatus === 'author-edited') dotColor = 'bg-amber-500';

            return (
              <button
                key={ep.id}
                onClick={() => onEpisodeSelect(ep.id)}
                className={`flex items-center gap-2 px-4 py-2 text-[11px] font-mono font-medium border-r border-white/5 uppercase transition-all shrink-0 focus:outline-none ${
                  isSelected
                    ? 'bg-white/5 text-amber-400 border-b-2 border-b-amber-400'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
                }`}
                id={`ep_tab_${ep.number}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                Ep {ep.number}: {ep.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Dynamic Status Reason Banner */}
      {reason && (
        <div className={`mx-5 mt-3 px-4 py-2 border rounded-sm text-xs leading-tight font-mono ${
          passStatus === 'error'
            ? 'bg-red-950/20 text-red-300 border-red-900/30'
            : passStatus === 'blocked'
              ? 'bg-zinc-950 text-white/60 border-white/10'
              : passStatus === 'partial'
                ? 'bg-amber-950/20 text-amber-300 border-amber-900/30'
                : 'bg-emerald-950/20 text-emerald-300 border-emerald-950/30'
        }`} id="work_area_status_reason_banner">
          <div className="flex items-center gap-2">
            <span className="font-extrabold uppercase shrink-0">[{passStatus}]</span>
            <span>{reason}</span>
          </div>
        </div>
      )}

      {/* Import control panel for SCENE_STRUCTURE artifact */}
      {activeArtifact && activeArtifact.artifactType === ArtifactType.SCENE_STRUCTURE && (
        <div className="mx-5 my-3 bg-[#0c0d0f] border border-white/10 p-4 rounded-sm flex flex-col gap-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
                  GNDS Promotion Bridge
                </span>
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                  Promote GNDS Structure to Production
                </h5>
                {/* Provenance Badge */}
                {(() => {
                  const pass = activeArtifact.createdByPass;
                  if (pass === '12D') {
                    return (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950/20 border border-purple-500/30 text-purple-400">
                        PROVENANCE: 12D (Final Script)
                      </span>
                    );
                  } else if (pass === '0.9G' || pass === '0.9D') {
                    return (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950/20 border border-amber-500/30 text-amber-500">
                        PROVENANCE: 0.9G (Scene Segmentation)
                      </span>
                    );
                  } else {
                    return (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/20 border border-emerald-500/30 text-emerald-400">
                        PROVENANCE: 0.9S (Initial structure)
                      </span>
                    );
                  }
                })()}
              </div>
              <p className="text-[11px] text-white/70 font-sans">
                Promote this structured beat spine and script into the production season. This is a one-way operation — review the artifact before proceeding.
              </p>
              {(() => {
                const payload = activeArtifact.payload as any;
                const hasDialogue = payload?.acts?.some((act: any) => act.scenes?.some((sc: any) => sc.beats?.some((b: any) => b.script && b.script.length > 0)));
                return (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-white/60">Status:</span>
                    {hasDialogue ? (
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                        ✓ Structure + Dialogue
                      </span>
                    ) : (
                      <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                        ⚠ Structure Only — run 0.9W/0.9G for dialogue
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            
            <div className="shrink-0 flex flex-col items-end gap-2">
              {promotionBlockerMessage && (
                <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-sm max-w-sm" id="promotion_blocker_warning">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle size={12} className="text-amber-400" />
                    Promotion Blocked:
                  </span>
                  <p className="mt-0.5 leading-normal text-white/80">{promotionBlockerMessage}</p>
                </div>
              )}
              <button
                onClick={handlePromoteToProduction}
                disabled={isPromoting || readOnly || !is09GComplete || !!promotionBlockerMessage}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-extrabold text-[10px] uppercase tracking-widest rounded transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Check size={12} className="stroke-[3]" />
                {isPromoting ? 'Promoting...' : 'Promote to Production'}
              </button>
            </div>
          </div>

          {/* Post-Import Reminders Checklist Box */}
          <div className="border-t border-white/5 pt-3 mt-1">
            <h6 className="text-[10px] font-bold text-white/60 uppercase tracking-widest font-mono mb-2">
              Post-Promotion Verification Checklist
            </h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
              <div className="flex items-start gap-2 text-[10px] text-white/60">
                <span className="text-amber-500 font-mono select-none">•</span>
                <span>Verify that all character handles in the imported beats map correctly to active caster handles in your show roster.</span>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-white/60">
                <span className="text-amber-500 font-mono select-none">•</span>
                <span>Audit derived panel actions, visual descriptions, and dialogs inside the Scene Detail flow for truncation or raw token noise.</span>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-white/60">
                <span className="text-amber-500 font-mono select-none">•</span>
                <span>Observe scene settings and transition timings in the production board to keep flow pace dynamic.</span>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-white/60">
                <span className="text-amber-500 font-mono select-none">•</span>
                <span>Trigger a fresh pre-flight compiler assembly pass to highlight any missing assets or orphaned beats.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning banner about prior versions */}
      {isPriorVersion && (
        <div className="px-5 py-2.5 bg-amber-950/20 border-b border-amber-900/30 flex items-center gap-2 text-xs text-amber-300 shrink-0 select-none">
          <AlertTriangle size={14} className="shrink-0 text-amber-400" />
          <span className="font-mono uppercase tracking-wide font-medium">Viewing historical version (Read-Only Mode)</span>
        </div>
      )}

      {/* Main artifact content or prompt to run */}
      <div className="flex-1 overflow-y-auto p-5 relative min-h-0 min-w-0" id="artifact_content_container">
        {/* Version Picker & Save/Edit icon overlay in the top right corner */}
        {activeArtifact && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-black/40 backdrop-blur-sm p-1 rounded border border-white/5">
            {/* Version dropdown/picker */}
            {hasMultipleVersions && (
              <div className="flex items-center gap-1 bg-[#121212] px-1.5 py-0.5 rounded border border-white/10">
                <span className="text-[10px] font-mono text-white/50 uppercase">Ver:</span>
                <select
                  value={selectedVersionIndex === null ? relatedArtifacts.length - 1 : selectedVersionIndex}
                  onChange={(e) => setSelectedVersionIndex(parseInt(e.target.value, 10))}
                  className="bg-transparent text-[10px] font-mono font-bold text-amber-500 focus:outline-none select-none cursor-pointer"
                  id={`version_picker_${passSpec.id?.replace('.', '_')}`}
                >
                  {relatedArtifacts.map((art, idx) => (
                    <option key={art.id} value={idx}>
                      v{idx + 1} {idx === relatedArtifacts.length - 1 ? '(Latest)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Edit / View JSON toggle button */}
            {!readOnly && !isPriorVersion && (
              <button
                onClick={isEditing ? () => setIsEditing(false) : handleStartEdit}
                className={`p-1.5 rounded transition ${
                  isEditing 
                    ? 'bg-amber-400 text-black hover:bg-amber-300' 
                    : 'bg-white/5 hover:bg-white/10 text-white/80'
                }`}
                title={isEditing ? "Cancel editing" : "Edit Raw JSON payload"}
                id={`edit_json_btn_${passSpec.id?.replace('.', '_')}`}
              >
                {isEditing ? <X size={12} /> : <Edit3 size={12} />}
              </button>
            )}
          </div>
        )}

        {isEditing ? (
          /* JSON payload raw editor */
          <div className="h-full flex flex-col space-y-3" id="json_raw_editor_layout">
            <div className="flex items-center justify-between pb-1 shrink-0">
              <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                <AlertCircle size={10} /> Raw JSON payload editor. Be extremely careful.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 font-mono text-[10px] text-white/60 hover:text-white border border-white/15 bg-white/5 rounded"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1 px-3 py-1 font-mono font-bold text-[10px] text-black bg-amber-400 hover:bg-amber-300 rounded"
                  id={`save_raw_json_${passSpec.id?.replace('.', '_')}`}
                >
                  <Save size={10} /> SAVE
                </button>
              </div>
            </div>

            {editError && (
              <div className="p-3 bg-red-950/25 border border-red-900/35 rounded text-xs text-red-400 font-mono flex items-center gap-2 shrink-0">
                <AlertCircle size={14} className="shrink-0" />
                <div>
                  <div className="font-bold">JSON SYNTAX ERROR:</div>
                  <div className="opacity-80 text-[11px] mt-0.5">{editError}</div>
                </div>
              </div>
            )}

            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="flex-1 w-full p-4 bg-[#0a0a0a] border border-white/10 font-mono text-xs text-emerald-400 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded resize-none min-h-[300px]"
              autoFocus
            />
          </div>
        ) : activeArtifact ? (
          /* Render Artifact */
          <div className="h-full max-w-full pb-8">
            {(() => {
              const ViewComponent = getArtifactView(activeArtifact.artifactType);
              if (ViewComponent) {
                return (
                  <div className="relative text-left" id={`view_rendered_${activeArtifact.id}`}>
                    <ViewComponent artifact={activeArtifact} />
                  </div>
                );
              }
              // Fallback collapsing interactive JSON tree
              return (
                <div className="p-5 border border-white/10 rounded bg-[#0b0b0b] overflow-x-auto" id={`view_raw_tree_${activeArtifact.id}`}>
                  <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-white/5 text-[10px] font-mono text-white/50 uppercase tracking-widest shrink-0">
                    <FileJson size={12} className="text-amber-500" />
                    Interactive JSON Explorer (Fallback)
                  </div>
                  <JsonNode value={activeArtifact.payload} name="payload" />
                </div>
              );
            })()}
          </div>
        ) : (
          /* 9.5 Placeholder/empty when no artifact has been run yet */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center" id="no_artifact_placeholder">
            <span className="w-12 h-12 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center text-white/40 mb-3 select-none">
              <AlertTriangle size={20} className="opacity-70" />
            </span>
            <h5 className="text-sm font-bold uppercase tracking-wider text-white/80">
              Artifact Pending Generation
            </h5>
            <p className="text-xs text-white/60 max-w-xs mt-1 mb-4">
              "{passSpec.description}"
            </p>
            <div className="text-[10px] font-mono text-white/50 uppercase tracking-widest border border-white/5 bg-[#0e0e0e] px-4 py-2.5 rounded">
              Run this pass to generate output.
            </div>
          </div>
        )}
      </div>

      {/* 0.9W / 0.9G Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" id="reset_09w_modal_container" onClick={() => setShowResetConfirm(false)}>
          <div className="bg-[#0f0f0f] border border-white/10 rounded-lg max-w-md w-full p-6 text-left shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-black uppercase tracking-wider text-rose-400 mb-2">
              Pass Reset Confirmation — {passSpec.id}
            </h4>
            <div className="space-y-4">
              <p className="text-xs text-white/90 leading-relaxed font-sans">
                {passSpec.id === '0.9G' 
                  ? '0.9G currently has a partial/error artifact.' 
                  : '0.9W currently has a partial/error artifact.'}
              </p>
              
              <div className="bg-[#080808] p-3 rounded border border-red-950/40">
                <span className="text-[10px] font-mono font-bold text-red-500 uppercase block mb-1">
                  Reset will clear:
                </span>
                <ul className="list-disc pl-4 text-xs text-white/70 space-y-1 font-sans">
                  {passSpec.id === '0.9G' ? (
                    <>
                      <li>0.9G SCENE_STRUCTURE artifact representation</li>
                      <li>0.9G execution logs & error states</li>
                    </>
                  ) : (
                    <>
                      <li>0.9W SCENE_SCRIPT artifact</li>
                      <li>0.9W error status</li>
                      <li>0.9G derived segmentation output</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="bg-[#080808] p-3 rounded border border-emerald-950/40">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase block mb-1">
                  Reset will preserve:
                </span>
                <ul className="list-disc pl-4 text-xs text-white/75 space-y-1 font-sans">
                  {passSpec.id === '0.9G' ? (
                    <>
                      <li>0.9S scene structure</li>
                      <li>0.9W scene script</li>
                      <li>episode source data</li>
                      <li>characters/settings</li>
                    </>
                  ) : (
                    <>
                      <li>0.9S scene structure</li>
                      <li>episode source data</li>
                      <li>characters/settings</li>
                    </>
                  )}
                </ul>
              </div>

              <p className="text-[11px] text-white/60 font-sans italic">
                This will clear pass {passSpec.id} and downstream outputs to start over cleanly. Upstream inputs are left completely intact. Are you sure you wish to proceed?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="px-4 py-2 text-xs font-mono font-bold text-white/60 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 rounded transition cursor-pointer select-none"
                  id="reset_09w_cancel_btn"
                >
                  CANCEL
                </button>
                <button
                  onClick={async () => {
                    setIsResetting(true);
                    try {
                      if (onResetPass) {
                        await onResetPass();
                      }
                      setShowResetConfirm(false);
                    } catch (err) {
                      console.error('Reset action failed:', err);
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  disabled={isResetting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold text-black bg-rose-400 hover:bg-rose-300 rounded transition active:scale-95 cursor-pointer select-none"
                  id="reset_09w_confirm_btn"
                >
                  {isResetting ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      RESETTING...
                    </>
                  ) : (
                    'CONFIRM RESET'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
