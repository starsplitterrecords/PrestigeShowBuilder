import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../StoreContext';
import { useWorkbenchSelection } from './workbench/useWorkbenchSelection';
import { getImageVersionsForShow, getIssueManifest, getProductionPagesForIssue } from '../storage/VaultStorage';
import { runIssueGeneration, IssueGenProgress } from '../hooks/production/runIssueGeneration';
import { estimateIssueImages, estimateShow } from '../vps/estimateRun';
import { ImageVersion, PreflightWarning } from '../types/production';
import { resolveCanonicalCharacters, getSpeakerDisplayLabel, getSpeakerClassification } from '../domainUtils';
import { WorkbenchFilmstrip } from './workbench/WorkbenchFilmstrip';
import { WorkbenchPageImage } from './workbench/WorkbenchPageImage';
import { AlertTriangle, Layers, Film, FileText, CheckCircle2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useProductionPageActions } from '../hooks/production/useProductionPageActions';
import { WorkbenchPageBeatEditor } from './workbench/WorkbenchPageBeatEditor';
import { WorkbenchPanelPlanView } from './workbench/WorkbenchPanelPlanView';
import { WorkbenchScenePool } from './workbench/WorkbenchScenePool';
import ConfirmModal from './ConfirmModal';
import { resolveProductionCharacterRefs } from '../hooks/production/productionCharacterRefs';
import { loadPageBeatLockedRefs, loadPriorPageRefs, loadSettingAnchorRef } from '../hooks/production/productionPageRefs';
import { WorkbenchPromptPanel } from './workbench/WorkbenchPromptPanel';
import { getProductionPageStatus } from '../utils/productionStatus';

export const SceneWorkbench: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  const [allPreflightWarnings, setAllPreflightWarnings] = useState<PreflightWarning[]>([]);
  const [preflightChecking, setPreflightChecking] = useState(false);
  const [preflightChecked, setPreflightChecked] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const promotedIssues = useMemo(() => {
    return currentShow ? (currentShow.issues ?? []) : [];
  }, [currentShow]);

  // Detect unpromoted episodes
  const unpromoted = useMemo(() => {
    if (!currentShow) return [];
    return currentShow.seasons.flatMap(s => s.episodes)
      .filter(ep => !ep.gndsArchived);
  }, [currentShow]);

  // Initial selected issue definition
  const initialIssueUid = useMemo(() => {
    if (!currentShow) return null;
    const { seasonIdx, episodeIdx } = state.activePath;
    if (seasonIdx !== undefined && episodeIdx !== undefined) {
      const ep = currentShow.seasons[seasonIdx]?.episodes[episodeIdx];
      if (ep && ep.gndsArchived && ep.promotedToIssueUid) {
        return ep.promotedToIssueUid;
      }
    }
    return currentShow.issues?.[0]?.uid ?? null;
  }, [currentShow, state.activePath]);

  const [selectedIssueUid, setSelectedIssueUid] = useState<string | null>(initialIssueUid);

  const [workbenchConfirm, setWorkbenchConfirm] = useState<{
    isOpen: boolean;
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const confirmProceed = (actionName: string, message: string): Promise<boolean | undefined> => {
    return new Promise((resolve) => {
      console.info('[PLAN_ISSUE_CONFIRM_OPEN]', {
        action: actionName,
        issueUid: selectedIssueUid,
        hasCurrentShow: !!currentShow,
      });

      try {
        setWorkbenchConfirm({
          isOpen: true,
          title: 'Confirm Operation',
          body: message,
          confirmLabel: 'Proceed',
          onConfirm: () => {
            setWorkbenchConfirm(null);
            console.info('[PLAN_ISSUE_CONFIRM_RESULT]', {
              action: actionName,
              confirmed: true,
              type: 'boolean',
            });
            resolve(true);
          },
          onCancel: () => {
            setWorkbenchConfirm(null);
            console.info('[PLAN_ISSUE_CONFIRM_RESULT]', {
              action: actionName,
              confirmed: false,
              type: 'boolean',
            });
            resolve(false);
          },
        });
      } catch (err: any) {
        console.error('[PLAN_ISSUE_CONFIRM_FAIL_OPEN]', err);
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now() + '_confirm_err_work',
            type: 'error',
            message: 'Confirmation dialog failed to open'
          }
        });
        resolve(undefined);
      }
    });
  };

  useEffect(() => {
    if (initialIssueUid && !selectedIssueUid) {
      setSelectedIssueUid(initialIssueUid);
    }
  }, [initialIssueUid]);

  const [showVersions, setShowVersions] = useState<ImageVersion[]>([]);
  const [issueGenRunning, setIssueGenRunning] = useState(false);
  const [issueGenProgress, setIssueGenProgress] = useState<IssueGenProgress | null>(null);
  const issueGenAbort = useRef<AbortController | null>(null);

  // Pre-load all image versions once per render when currentShow or dependencies change.
  const loadShowVersions = useCallback(() => {
    if (!currentShow?.id) {
      setShowVersions([]);
      return;
    }
    getImageVersionsForShow(currentShow.id)
      .then(setShowVersions)
      .catch((err) => console.error("[Workbench] Failed to load list:", err));
  }, [currentShow?.id]);

  useEffect(() => {
    loadShowVersions();
  }, [currentShow, loadShowVersions]);

  // Group versions by page UID in a Map
  const imageVersionsByPage = useMemo(() => {
    const map = new Map<string, ImageVersion[]>();
    for (const v of showVersions) {
      const list = map.get(v.productionPageUid) ?? [];
      list.push(v);
      map.set(v.productionPageUid, list);
    }
    return map;
  }, [showVersions]);

  // Core selection hook with new production model
  const {
    filmstripPages,
    focusedPage,
    setFocusedPage,
    focusPreviousPage,
    focusNextPage,
    focusFirstPage,
    focusLastPage,
    focusFirstPageInCurrentScene,
    focusLastPageInCurrentScene,
    focusPreviousSceneFirstPage,
    focusNextSceneFirstPage,
  } = useWorkbenchSelection(currentShow ?? undefined, selectedIssueUid, imageVersionsByPage);

  const actions = useProductionPageActions(
    focusedPage ? focusedPage.productionPage : null,
    focusedPage ? focusedPage.pageBeat : null,
    focusedPage ? focusedPage.settingAnchorId : undefined
  );

  const [isEditorCollapsibleOpen, setIsEditorCollapsibleOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'narrative' | 'panels'>('narrative');

  const focusedPageVersions = useMemo(() => {
    if (!focusedPage) return [];
    return imageVersionsByPage.get(focusedPage.productionPage.uid) || [];
  }, [focusedPage, imageVersionsByPage]);

  const focusedPageActiveVersion = focusedPage?.activeImageVersion;

  // DA-082: resolve reference counts for the live prompt preview.
  const [promptRefCounts, setPromptRefCounts] = useState(
    { characterRefs: 0, settingRefs: 0, lockedRefs: 0, priorPages: 0 });
  const [continuity, setContinuity] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!focusedPage || !currentShow) {
        setPromptRefCounts({ characterRefs: 0, settingRefs: 0, lockedRefs: 0, priorPages: 0 });
        return;
      }
      const pb = focusedPage.pageBeat;
      const refResolution = await resolveProductionCharacterRefs({ pageBeat: pb, show: currentShow });
      const [lockedRefs, priorRefs, settingRef] = await Promise.all([
        loadPageBeatLockedRefs(pb, focusedPage.settingAnchorId, currentShow),
        continuity ? loadPriorPageRefs(focusedPage.productionPage, currentShow) : Promise.resolve([]),
        loadSettingAnchorRef(focusedPage.settingAnchorId, currentShow),
      ]);
      if (cancelled) return;
      setPromptRefCounts({
        characterRefs: refResolution.loadedRefs.length,
        settingRefs: settingRef.imageRef ? 1 : 0,
        lockedRefs: lockedRefs.length,
        priorPages: priorRefs.length,
      });
    })();
    return () => { cancelled = true; };
  }, [focusedPage, currentShow, continuity]);

  const workbenchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (workbenchRef.current) {
      workbenchRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const activeEl = document.activeElement;
    const isInputActive = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      activeEl.hasAttribute('contenteditable') ||
      (activeEl as HTMLElement).isContentEditable
    );
    if (isInputActive) {
      return;
    }

    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isCmdOrCtrl && isShift) {
        focusPreviousSceneFirstPage();
      } else if (isCmdOrCtrl) {
        focusFirstPageInCurrentScene();
      } else {
        focusPreviousPage();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (isCmdOrCtrl && isShift) {
        focusNextSceneFirstPage();
      } else if (isCmdOrCtrl) {
        focusLastPageInCurrentScene();
      } else {
        focusNextPage();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusFirstPage();
    } else if (e.key === 'End') {
      e.preventDefault();
      focusLastPage();
    }
  };

  const selectedIssue = useMemo(() => {
    if (!currentShow || !selectedIssueUid) return null;
    return (currentShow.issues ?? []).find(i => i.uid === selectedIssueUid) || null;
  }, [currentShow, selectedIssueUid]);

  useEffect(() => {
    if (!currentShow || !selectedIssue) {
      setAllPreflightWarnings([]);
      setPreflightChecked(false);
      return;
    }

    let active = true;
    setPreflightChecking(true);

    const checkRefs = async () => {
      const warningList: PreflightWarning[] = [];
      const prodPages = currentShow.productionPages ?? [];

      for (const act of selectedIssue.acts ?? []) {
        for (const sc of act.scenes ?? []) {
          for (const pb of sc.pageBeats ?? []) {
            try {
              const res = await resolveProductionCharacterRefs({
                pageBeat: pb,
                show: currentShow,
              });
              
              const matchingPage = prodPages.find(p => p.pageBeatUid === pb.uid);

              // 1. Missing portrait warnings
              if (res.missing.length > 0) {
                for (const m of res.missing) {
                  // Derive script and dialogue indices where available
                  let scriptUnitIndex: number | undefined = undefined;
                  let dialogueLineIndex: number | undefined = undefined;

                  if (pb.script) {
                    const entries = pb.script.entries ?? [];
                    const lines = pb.script.lines ?? [];
                    const entryIdx = entries.findIndex((entry: any) => entry && entry.characterHandle === m.characterHandle);
                    if (entryIdx !== -1) scriptUnitIndex = entryIdx;
                    const lineIdx = lines.findIndex((line: any) => line.characterHandle === m.characterHandle);
                    if (lineIdx !== -1) dialogueLineIndex = lineIdx;
                  }

                  warningList.push({
                    scope: 'page',
                    showId: currentShow.id,
                    issueId: selectedIssue.uid,
                    actNumber: act.number,
                    sceneNumber: sc.number,
                    productionPageUid: matchingPage?.uid,
                    pageBeatUid: pb.uid,
                    scriptUnitIndex,
                    dialogueLineIndex,
                    identifier: m.characterHandle || m.characterId,
                    speakerName: m.characterName,
                    classification: 'missingPortrait',
                    severity: 'blocking',
                    message: `Character ${m.characterName} is selected but lacks a valid portrait or visual anchor asset.`,
                    sourceArtifactId: selectedIssue.gndsArtifactId,
                    sourcePass: '0.9G'
                  });
                }
              }

              // 2. Unresolved speaker warnings
              if (res.unresolvedSpeakers && res.unresolvedSpeakers.length > 0) {
                for (const u of res.unresolvedSpeakers) {
                  let scriptUnitIndex: number | undefined = undefined;
                  let dialogueLineIndex: number | undefined = undefined;

                  if (pb.script) {
                    const entries = pb.script.entries ?? [];
                    const lines = pb.script.lines ?? [];
                    const entryIdx = entries.findIndex((entry: any) => entry && entry.characterHandle === u.identifier);
                    if (entryIdx !== -1) scriptUnitIndex = entryIdx;
                    const lineIdx = lines.findIndex((line: any) => line.characterHandle === u.identifier);
                    if (lineIdx !== -1) dialogueLineIndex = lineIdx;
                  }

                  warningList.push({
                    scope: 'page',
                    showId: currentShow.id,
                    issueId: selectedIssue.uid,
                    actNumber: act.number,
                    sceneNumber: sc.number,
                    productionPageUid: matchingPage?.uid,
                    pageBeatUid: pb.uid,
                    scriptUnitIndex,
                    dialogueLineIndex,
                    identifier: u.identifier,
                    speakerName: u.speakerName,
                    classification: 'unresolvedSpeaker',
                    severity: 'warning',
                    message: u.classification === 'nonCharacterVoice'
                      ? `Non-character voice: ${u.speakerName}`
                      : u.source === 'panel.characterPositions'
                      ? `Unresolved panel reference: ${u.speakerName}`
                      : `Unresolved dialogue speaker: ${u.speakerName}`,
                    sourceArtifactId: selectedIssue.gndsArtifactId,
                    sourcePass: u.textExcerpt || '0.9W'
                  });
                }
              }

              // 3. Malformed/normalized identifiers reported (info)
              if (res.normalizedIdentifiers && res.normalizedIdentifiers.length > 0) {
                for (const n of res.normalizedIdentifiers) {
                  warningList.push({
                    scope: 'page',
                    showId: currentShow.id,
                    issueId: selectedIssue.uid,
                    actNumber: act.number,
                    sceneNumber: sc.number,
                    productionPageUid: matchingPage?.uid,
                    pageBeatUid: pb.uid,
                    identifier: n.original,
                    speakerName: n.charName,
                    classification: 'other',
                    severity: 'info',
                    message: `Malformed identifier ${n.original} normalized to ${n.charName}`,
                    sourceArtifactId: selectedIssue.gndsArtifactId,
                    sourcePass: '0.9G'
                  });
                }
              }
            } catch (err) {
              console.error('Preflight resolve error:', err);
            }
          }
        }
      }

      if (active) {
        setAllPreflightWarnings(warningList);
        setPreflightChecked(true);
        setPreflightChecking(false);
      }
    };

    checkRefs();

    return () => {
      active = false;
    };
  }, [currentShow, selectedIssue]);

  const currentPageWarnings = useMemo(() => {
    if (!focusedPage) return [];
    return allPreflightWarnings.filter(w =>
      w.productionPageUid === focusedPage.productionPage.uid ||
      w.pageBeatUid === focusedPage.pageBeat.uid
    );
  }, [allPreflightWarnings, focusedPage]);

  const issueSummaryWarnings = useMemo(() => {
    if (!focusedPage) return allPreflightWarnings;
    return allPreflightWarnings.filter(w =>
      w.productionPageUid !== focusedPage.productionPage.uid &&
      w.pageBeatUid !== focusedPage.pageBeat.uid
    );
  }, [allPreflightWarnings, focusedPage]);

  const handleGenerateIssue = async () => {
    const actionName = 'Generate Issue';
    console.info('[UI_CLICK]', {
      action: actionName,
      timestamp: new Date().toISOString(),
      disabled: !!issueGenRunning,
      busy: issueGenRunning,
      selectedIssueUid,
      hasCurrentShow: !!currentShow,
    });
    console.info('[HANDLER_ENTER]', actionName);

    if (!currentShow || !selectedIssueUid || !selectedIssue) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `Cannot generate: missing show context or selected issue.`
        }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'missing requirements');
      return;
    }

    const blockingWarnings = allPreflightWarnings.filter(w => w.severity === 'blocking');
    if (preflightChecked && blockingWarnings.length > 0) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: 'Generation Blocked: Required character assets are missing for this issue.'
        }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'preflight check failed because of missing references');
      return;
    }
    
    const est = estimateIssueImages(selectedIssue, false);
    const confirmed = await confirmProceed(
      actionName,
      `Generate issue ${selectedIssue.issueCode} — ${est.imageCalls} image calls. Proceed?`
    );

    console.info('[PLAN_ISSUE_CONFIRM_RESULT]', {
      action: actionName,
      confirmed,
      type: typeof confirmed,
    });

    if (confirmed === undefined) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_err_open_issue',
          type: 'error',
          message: 'Confirmation dialog failed to open'
        }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'confirmation UI error or aborted render');
      return;
    }

    if (confirmed !== true) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_dc_issue',
          type: 'info',
          message: `${actionName} stopped: confirmation was not accepted.`
        }
      });
      console.info('[HANDLER_GUARD_FAIL]', actionName, 'confirmation declined');
      return;
    }

    // Resolve manifest order + page map.
    try {
      const manifest = await getIssueManifest(currentShow.id, selectedIssue.uid);
      const order = manifest?.pageOrder ?? [];
      const pages = await getProductionPagesForIssue(currentShow.id, selectedIssue.uid);
      const pagesByUid = Object.fromEntries(pages.map(p => [p.uid, p]));

      issueGenAbort.current = new AbortController();
      setIssueGenRunning(true);
      setIssueGenProgress(null);
      
      const res = await runIssueGeneration(
        currentShow,
        selectedIssue.uid,
        order,
        pagesByUid,
        {
          skipApproved: true,
          signal: issueGenAbort.current.signal,
          onProgress: setIssueGenProgress,
          dispatch
        }
      );
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'success',
          message: `Issue run: ${res.generated} generated` +
            `, ${res.skipped} skipped` +
            (res.failed ? `, ${res.failed} failed` : '')
        }
      });
      console.info('[HANDLER_SUCCESS]', actionName);
      dispatch({ type: 'RELOAD_SHOW' });
      loadShowVersions();
    } catch (e: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `Issue generation failed: ${e.message}`
        }
      });
      console.error('[HANDLER_FAIL]', actionName, e);
    } finally {
      setIssueGenRunning(false);
      setIssueGenProgress(null);
      issueGenAbort.current = null;
      console.info('[HANDLER_COMPLETE]', actionName);
    }
  };

  const handleGenerateAllIssues = async () => {
    const actionName = 'Generate All Issues';
    console.info('[UI_CLICK]', {
      action: actionName,
      timestamp: new Date().toISOString(),
      disabled: !!issueGenRunning,
      busy: issueGenRunning,
      selectedIssueUid,
      hasCurrentShow: !!currentShow,
    });
    console.info('[HANDLER_ENTER]', actionName);

    if (!currentShow || promotedIssues.length === 0) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `Cannot generate all: missing show context or promoted issues.`
        }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'missing requirements');
      return;
    }
    
    const est = estimateShow(currentShow, false);
    const confirmed = await confirmProceed(
      actionName,
      `Generate all issues — ${est.imageCalls} image calls. Proceed?`
    );

    console.info('[PLAN_ISSUE_CONFIRM_RESULT]', {
      action: actionName,
      confirmed,
      type: typeof confirmed,
    });

    if (confirmed === undefined) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_all_err_open_all',
          type: 'error',
          message: 'Confirmation dialog failed to open'
        }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'confirmation UI error or aborted render');
      return;
    }

    if (confirmed !== true) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_all_dc_all',
          type: 'info',
          message: `${actionName} stopped: confirmation was not accepted.`
        }
      });
      console.info('[HANDLER_GUARD_FAIL]', actionName, 'confirmation declined');
      return;
    }

    issueGenAbort.current = new AbortController();
    setIssueGenRunning(true);
    setIssueGenProgress(null);
    try {
      let totalGen = 0;
      let totalSkid = 0;
      let totalFail = 0;

      for (let i = 0; i < promotedIssues.length; i++) {
        if (issueGenAbort.current.signal?.aborted) break;
        const iss = promotedIssues[i];

        // Resolve manifest order + page map.
        const manifest = await getIssueManifest(currentShow.id, iss.uid);
        const order = manifest?.pageOrder ?? [];
        const pages = await getProductionPagesForIssue(currentShow.id, iss.uid);
        const pagesByUid = Object.fromEntries(pages.map(p => [p.uid, p]));

        const res = await runIssueGeneration(
          currentShow,
          iss.uid,
          order,
          pagesByUid,
          {
            skipApproved: true,
            skipExisting: true,
            signal: issueGenAbort.current.signal,
            onProgress: (prog) => {
              setIssueGenProgress({
                ...prog,
                address: `[${iss.issueCode}] ${prog.address}`
              });
            },
            dispatch
          }
        );

        totalGen += res.generated;
        totalSkid += res.skipped;
        totalFail += res.failed;
      }

      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'success',
          message: `Generate all issues run completed: ${totalGen} generated` +
            `, ${totalSkid} skipped` +
            (totalFail ? `, ${totalFail} failed` : '')
        }
      });
      console.info('[HANDLER_SUCCESS]', actionName);
      dispatch({ type: 'RELOAD_SHOW' });
      loadShowVersions();
    } catch (e: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: `All issues generation failed: ${e.message}`
        }
      });
      console.error('[HANDLER_FAIL]', actionName, e);
    } finally {
      setIssueGenRunning(false);
      setIssueGenProgress(null);
      issueGenAbort.current = null;
      console.info('[HANDLER_COMPLETE]', actionName);
    }
  };

  const cancelIssueGen = () => {
    console.info('[UI_CLICK]', {
      action: 'Cancel Issue Generation',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy: issueGenRunning,
      selectedIssueUid,
      hasCurrentShow: !!currentShow,
    });
    console.info('[HANDLER_ENTER]', 'Cancel Issue Generation');
    if (issueGenAbort.current) {
      issueGenAbort.current.abort();
      console.info('[HANDLER_SUCCESS]', 'Cancel Issue Generation');
    } else {
      console.warn('[HANDLER_GUARD_FAIL]', 'Cancel Issue Generation', 'no active controller found');
    }
  };

  if (!currentShow) {
    return (
      <div className="flex-grow flex items-center justify-center p-8 text-center bg-[#070707] text-white">
        <span className="text-xs uppercase font-mono tracking-widest text-white/50 animate-pulse">
          Loading Cinematic Show context...
        </span>
      </div>
    );
  }

  // If no promoted issues exist, show call-to-action
  if (promotedIssues.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center h-full bg-[#070707] text-white p-8">
        <AlertTriangle size={36} className="text-amber-400 animate-bounce mb-3" />
        <p className="text-white/60 text-sm font-bold uppercase tracking-wider">
          No promoted issues yet.
        </p>
        <p className="text-white/60 text-xs mt-2 text-center max-w-md leading-relaxed">
          Run GNDS and use Promote to Production to enable the Scene Workbench.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={workbenchRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-grow flex flex-col h-full bg-[#070707] overflow-hidden text-white relative outline-none"
    >
      {/* Top Header Selector Bar */}
      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-black/40 z-20 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-white/60 tracking-wider">Comic Issue:</span>
          <select
            value={selectedIssueUid || ''}
            onChange={(e) => setSelectedIssueUid(e.target.value || null)}
            className="bg-[#121316] text-xs border border-white/15 text-white rounded px-2 py-1 font-semibold focus:outline-none focus:border-amber-500/50 cursor-pointer"
          >
            {promotedIssues.map((issue) => (
              <option key={issue.uid} value={issue.uid}>
                {issue.issueCode} — {issue.title}
              </option>
            ))}
          </select>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-emerald-500/20 bg-emerald-500/5 text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-emerald-400/60 select-none shrink-0">
            Production
          </span>
        </div>
        
        {/* Detect episodes not yet promoted and let them know */}
        <div className="flex items-center gap-4">
          {unpromoted.length > 0 && (
            <div className="text-[10px] text-white/60 font-mono hidden md:block">
              Pending Promotion: <span className="text-amber-400 font-semibold">{unpromoted.map(ep => ep.title || ep.id).join(', ')}</span>
            </div>
          )}

          {!issueGenRunning ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleGenerateIssue()}
                className="px-3 py-1.5 text-[11px] font-bold rounded bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 transition-colors cursor-pointer"
              >
                Generate Issue
              </button>
              <button
                onClick={() => handleGenerateAllIssues()}
                className="px-3 py-1.5 text-[11px] font-bold rounded bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-colors cursor-pointer"
              >
                Generate All Issues
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-white/70">
                {issueGenProgress
                  ? `Page ${issueGenProgress.index + 1}/${issueGenProgress.total} — ${issueGenProgress.phase} (${issueGenProgress.address})`
                  : 'Starting…'}
              </span>
              <button
                onClick={cancelIssueGen}
                className="px-2 py-1 text-[10px] rounded bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 transition-colors cursor-pointer"
              >
                Stop
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace splits into 3 columns */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0 bg-black/25">
        {focusedPage ? (
          <>
            {/* Left Column: Quick Navigation Deck */}
            <div className="flex-[3] min-w-[280px] max-w-[340px] flex flex-col border-r border-white/10 overflow-hidden bg-[#0c0d10] h-full select-none">
              <div className="p-3 border-b border-white/10 bg-black/20 flex items-center gap-2">
                <Layers className="w-4 h-4 text-white/60" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-white/70">
                  Issue Outline ({filmstripPages.length} Pages)
                </span>
              </div>

              {/* Scrollable List of Pages in current manifest */}
              <div className="flex-grow overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                {filmstripPages.map((p) => {
                  const isActive = focusedPage.productionPage.uid === p.productionPage.uid;
                  const calculatedStatusRes = getProductionPageStatus({
                    page: p.productionPage,
                    pageBeat: p.pageBeat,
                    imageVersions: showVersions,
                    preflightWarnings: allPreflightWarnings,
                    panelPlans: p.pageBeat.panelPlans
                  });
                  return (
                    <button
                      key={p.productionPage.uid}
                      onClick={() => setFocusedPage(p.productionPage.uid)}
                      className={`w-full text-left p-2 rounded transition-all duration-150 flex items-start gap-2.5 outline-none
                        ${isActive 
                          ? 'bg-amber-500/10 border border-amber-500/30 text-white' 
                          : 'border border-transparent text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider leading-none mt-0.5 shrink-0 px-1 py-0.5 rounded
                        ${isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/60'}`}>
                        P.{p.pageNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-bold text-white/90 truncate capitalize block">
                            {p.sceneTitle || 'Scene context'}
                          </span>
                          <span 
                            title={calculatedStatusRes.reason}
                            className={`text-[10px] font-black uppercase font-mono tracking-widest shrink-0 border rounded px-1 cursor-help
                              ${calculatedStatusRes.status === 'APPROVED' 
                                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' 
                                : calculatedStatusRes.status === 'BLOCKED'
                                ? 'text-red-400 border-red-500/20 bg-red-500/5'
                                : calculatedStatusRes.status === 'GENERATED'
                                ? 'text-blue-400 border-blue-500/20 bg-blue-500/5'
                                : calculatedStatusRes.status === 'PARTIAL'
                                ? 'text-purple-400 border-purple-500/20 bg-purple-500/5'
                                : 'text-amber-500 border-amber-500/20 bg-amber-500/5'}`}
                          >
                            {calculatedStatusRes.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/60 truncate mt-0.5 font-sans leading-normal">
                          {p.pageBeat.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Collapsed Scene Location Details */}
              <div className="p-3 border-t border-white/10 bg-black/35 space-y-1.5 shrink-0 select-none">
                <div className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/70">Production Location</span>
                </div>
                <div className="text-[10px] font-mono leading-relaxed space-y-0.5">
                  <div className="text-white/60">ACT: <span className="text-white/90 font-medium">{focusedPage.actTitle || 'Act default'}</span></div>
                  <div className="text-white/60">SCENE: <span className="text-white/90 font-medium">{focusedPage.sceneTitle || 'Scene default'}</span></div>
                  <div className="text-white/60">BEAT TYPE: <span className="text-amber-400 uppercase tracking-widest font-bold">{focusedPage.pageBeat.beatType}</span></div>
                </div>
                {/* Dropdown for setting anchor */}
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <div className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Setting Anchor</div>
                  {focusedPage.sceneUid && (
                    <select
                      value={focusedPage.settingAnchorId || ''}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        actions.updateSettingAnchorId(
                          focusedPage.sceneUid!,
                          selectedIssueUid!,
                          val
                        );
                      }}
                      className="w-full bg-white/5 border border-white/10 text-white text-[10px] rounded p-1 outline-none cursor-pointer hover:bg-white/10"
                    >
                      <option value="" className="bg-[#070707] text-white/50">-- Unassigned --</option>
                      {(currentShow?.settingAnchors ?? []).map((anchor) => (
                        <option key={anchor.id} value={anchor.id} className="bg-[#070707] text-white">
                          {anchor.name} {anchor.assetId ? '⬡' : '◌'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Page Asset Versions (collapsible list of drafts) */}
              {focusedPageVersions.length > 0 && (
                <div className="p-3 border-t border-white/10 bg-[#0d0e11] flex flex-col gap-1.5 shrink-0 select-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/60">
                      Page Draft Versions
                    </span>
                    <span className="text-[9px] bg-white/5 border border-white/10 px-1 rounded text-white/50 font-mono">
                      {focusedPageVersions.length}
                    </span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-white/10">
                    {focusedPageVersions.map((ver) => {
                      const isActive = focusedPageActiveVersion?.uid === ver.uid;
                      const isApproved = ver.status === 'approved';
                      return (
                        <div
                          key={ver.uid}
                          className={`flex items-center justify-between p-1.5 rounded border text-[10px]
                            ${isActive
                              ? 'bg-amber-400/5 border-amber-400/20 text-white'
                              : 'bg-black/30 border-white/5 text-white/60'
                            }`}
                        >
                          <span className="font-mono text-[9px] text-white">
                            {ver.uid.slice(0, 8)} — {ver.variantType.toUpperCase()}
                          </span>
                          {isApproved ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-1 rounded-sm">
                                Approved
                              </span>
                              <button
                                onClick={() => actions.unapproveImage(ver.uid)}
                                disabled={actions.isRunning}
                                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                              >
                                Unapprove
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => actions.approveImage(ver.uid)}
                              disabled={actions.isRunning}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


            </div>

            {/* Middle Column: Staging Platform & Horizontally scrollable filmstrip */}
            <div className="flex-[5] min-w-[420px] flex flex-col overflow-hidden bg-black/40 relative h-full">
              <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden items-stretch bg-[#0a0a0a]">
                
                {/* Visual Status Banner line for active ProductionPage */}
                <div className="px-3 py-1.5 bg-neutral-900/60 border border-white/10 rounded flex items-center justify-between shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-white/80 uppercase tracking-wider">
                      Page Slot: <span className="text-white font-extrabold">P.{focusedPage.pageNumber}</span>
                    </span>
                    <span className="text-white/30 font-mono text-[11px]">|</span>
                    <span className="text-[10px] font-mono text-white/60">ID: {focusedPage.productionPage.uid.slice(0, 8)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Preflight Diagnostics & Issue Warnings trigger button */}
                    <button
                      onClick={() => setIsDiagnosticsOpen(true)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm border transition-all cursor-pointer ${
                        allPreflightWarnings.length > 0
                          ? 'text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Diagnostics {allPreflightWarnings.length > 0 ? `(${allPreflightWarnings.length})` : 'OK'}
                    </button>

                    {(() => {
                      const focusedStatusRes = getProductionPageStatus({
                        page: focusedPage?.productionPage,
                        pageBeat: focusedPage?.pageBeat,
                        imageVersions: showVersions,
                        preflightWarnings: allPreflightWarnings,
                        panelPlans: focusedPage?.pageBeat.panelPlans
                      });
                      return (
                        <span 
                          title={focusedStatusRes.reason}
                          className={`flex items-center gap-1 text-[9px] font-black border px-1.5 py-0.5 rounded-sm uppercase tracking-widest cursor-help
                            ${focusedStatusRes.status === 'APPROVED'
                              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : focusedStatusRes.status === 'BLOCKED'
                              ? 'text-red-400 border-red-500/20 bg-red-500/10'
                              : focusedStatusRes.status === 'GENERATED'
                              ? 'text-blue-400 border-blue-500/20 bg-blue-500/10'
                              : focusedStatusRes.status === 'PARTIAL'
                              ? 'text-purple-400 border-purple-500/20 bg-purple-500/10'
                              : 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                            }`}
                        >
                          {focusedStatusRes.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                          {focusedStatusRes.status}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Setting Anchor quick-controller sub-bar (DA-031 responsive fallback) */}
                <div className="px-3 py-1.5 bg-neutral-900/40 border border-white/5 rounded flex flex-wrap items-center justify-between gap-2 shrink-0 select-none font-sans">
                  <div className="flex flex-wrap items-center gap-4 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">Location Anchor:</span>
                      {focusedPage.sceneUid && (
                        <select
                          value={focusedPage.settingAnchorId || ''}
                          onChange={(e) => {
                            const val = e.target.value || undefined;
                            actions.updateSettingAnchorId(
                              focusedPage.sceneUid!,
                              selectedIssueUid!,
                              val
                            );
                          }}
                          className="bg-black/40 border border-white/10 text-white text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer hover:bg-white/10 select-none max-w-[150px] truncate"
                        >
                          <option value="" className="bg-[#070707] text-white/50">-- Unassigned --</option>
                          {(currentShow?.settingAnchors ?? []).map((anchor) => (
                            <option key={anchor.id} value={anchor.id} className="bg-[#070707] text-white">
                              {anchor.name} {anchor.assetId ? '⬡' : '◌'}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Panels overriding selector inline */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 shrink-0">
                        Panels Override:
                      </span>
                      {(['Auto', 1, 2, 3, 4, 5, 6] as const).map(n => {
                        const isActive = n === 'Auto'
                          ? !focusedPage.pageBeat?.panelCountOverride
                          : focusedPage.pageBeat?.panelCountOverride === n;
                        return (
                          <button
                            key={n}
                            onClick={() => actions.updatePageBeat({
                              panelCountOverride: n === 'Auto' ? undefined : n as any
                            })}
                            className={`w-8 h-4.5 text-[9px] font-bold rounded-sm border transition-all cursor-pointer flex items-center justify-center
                              ${isActive
                                ? 'bg-amber-400 border-amber-400 text-black font-semibold'
                                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white/85'
                              }`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Quick-create / status action button */}
                  <div className="flex items-center gap-2">
                    {(() => {
                      const sceneSetting = focusedPage.sceneTitle || 'Unknown Location';
                      const existingAnchor = (currentShow?.settingAnchors ?? []).find(
                        a => a.name.toLowerCase() === sceneSetting.toLowerCase()
                      );
                      
                      if (!focusedPage.settingAnchorId) {
                        if (existingAnchor) {
                          return (
                            <button
                              onClick={() => {
                                actions.updateSettingAnchorId(
                                  focusedPage.sceneUid!,
                                  selectedIssueUid!,
                                  existingAnchor.id
                                );
                              }}
                              className="text-[9px] font-bold text-amber-400 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 px-2 py-0.5 rounded cursor-pointer"
                            >
                              Auto-Assign '{existingAnchor.name}'
                            </button>
                          );
                        } else {
                          const handleQuickCreate = () => {
                            const newId = 'set-' + Date.now();
                            const newAnchor = {
                              id: newId,
                              name: sceneSetting,
                              shortName: sceneSetting.substring(0, 15),
                              physicalDescription: `The setting for scene: ${sceneSetting}`,
                              interiorExterior: 'interior' as const,
                            };
                            const updated = [...(currentShow?.settingAnchors ?? []), newAnchor];
                            dispatch({ type: 'UPDATE_SHOW', updates: { settingAnchors: updated } });
                            actions.updateSettingAnchorId(
                              focusedPage.sceneUid!,
                              selectedIssueUid!,
                              newId
                            );
                            dispatch({ type: 'ADD_TOAST', toast: {
                              id: Date.now().toString(), type: 'success',
                              message: `Created and assigned Setting Anchor: ${sceneSetting}`
                            }});
                          };
                          return (
                            <button
                              onClick={handleQuickCreate}
                              className="text-[9px] font-bold text-emerald-400 border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15 px-2 py-0.5 rounded cursor-pointer"
                            >
                              ＋ Quick-Create '{sceneSetting}'
                            </button>
                          );
                        }
                      } else {
                        const currentAnchor = (currentShow?.settingAnchors ?? []).find(
                          a => a.id === focusedPage.settingAnchorId
                        );
                        if (currentAnchor) {
                          return (
                            <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/80">
                              {currentAnchor.assetId ? '⬡ Reference Image Locked' : '○ Assigned (No reference image)'}
                            </span>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Primary split-screen panel: Prompt Preview on Left, Page Canvas on Right */}
                <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
                  {/* Left Prompt preview panel (DA-082) */}
                  <div className="flex-1 min-w-[320px] max-w-[420px] h-full flex flex-col">
                    <WorkbenchPromptPanel
                      show={currentShow}
                      pageBeat={focusedPage.pageBeat}
                      page={focusedPage.productionPage}
                      activeVersion={focusedPage.activeImageVersion}
                      refCounts={promptRefCounts}
                      continuity={continuity}
                      onToggleContinuity={setContinuity}
                    />
                  </div>
                  {/* Right Canvas */}
                  <div className="flex-1 h-full min-w-0 flex flex-col relative">
                    <WorkbenchPageImage
                      entry={focusedPage.activeImageVersion}
                      productionPageUid={focusedPage.productionPage.uid}
                      actions={actions}
                      page={focusedPage.productionPage}
                      pageBeat={focusedPage.pageBeat}
                    />
                  </div>
                </div>
              </div>

              {/* Production Filmstrip at the bottom */}
              <WorkbenchFilmstrip
                show={currentShow}
                pages={filmstripPages}
                focusedPage={focusedPage}
                onPageSelect={setFocusedPage}
              />
            </div>

            {/* Right Column: Narrative Detail Deck */}
            <div className="flex-[4] min-w-[280px] max-w-[420px] border-l border-white/10 bg-[#0d0e11] flex flex-col h-full overflow-hidden text-white">
              
              {/* Tab Header Selector */}
              <div className="border-b border-white/10 bg-black/25 flex items-stretch shrink-0 h-10 select-none">
                <button
                  type="button"
                  onClick={() => setActiveRightTab('narrative')}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest font-black transition-all focus:outline-none cursor-pointer
                    ${activeRightTab === 'narrative'
                      ? 'bg-[#15161d] text-amber-400 border-b-2 border-amber-500'
                      : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                    }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Script & Narrative
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('panels')}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest font-black transition-all focus:outline-none cursor-pointer
                    ${activeRightTab === 'panels'
                      ? 'bg-[#15161d] text-amber-400 border-b-2 border-amber-500'
                      : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Panel Layouts
                </button>
              </div>

              {activeRightTab === 'narrative' ? (
                /* Scrollable details view */
                <div className="flex-grow overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-white/10">
                  
                  {/* 1. Description */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] uppercase tracking-widest font-black text-white/50 select-none">
                      Story Beat Description
                    </h4>
                    <div className="p-3 bg-white/[0.02] border border-white/10 rounded text-xs text-white/90 leading-relaxed font-sans select-text">
                      {focusedPage.pageBeat.description || 'No descriptive notes mapped to this page beat.'}
                    </div>
                    {focusedPage.pageBeat.visualNote && (
                      <div className="mt-2 text-[10px] font-mono text-white/60">
                        Visual: <span className="text-white/80 select-text">{focusedPage.pageBeat.visualNote}</span>
                      </div>
                    )}
                  </div>

                  {/* 2. Direction */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] uppercase tracking-widest font-black text-white/50 select-none">
                      Staging & Direction Note
                    </h4>
                    <div className="p-3 bg-neutral-900 border-l-2 border-amber-500/40 rounded-r text-xs text-white/80 italic leading-relaxed select-text">
                      {focusedPage.pageBeat.direction || 'No custom camera or layout direction is stashed.'}
                    </div>
                  </div>

                  {/* 3. Comic Script / Dialogues */}
                  <div className="space-y-2">
                    {(() => {
                      const resolveScriptEntries = (script: any) => {
                        if (!script) return [];
                        if (script.entries?.length) return script.entries;
                        return script.lines ?? [];
                      };
                      const scriptEntries = resolveScriptEntries(focusedPage.pageBeat.script);

                      return (
                        <>
                          <h4 className="text-[10px] uppercase tracking-widest font-black text-white/50 select-none flex items-center justify-between">
                            <span>Dialogue lines</span>
                            {scriptEntries.length > 0 && (
                              <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-white/10 text-white/70 tracking-normal normal-case">
                                {scriptEntries.length} Entries
                              </span>
                            )}
                          </h4>

                          {scriptEntries.length > 0 ? (
                            <div className="space-y-2 select-text">
                              {scriptEntries.map((entry: any, idx: number) => {
                                const isCaption = entry.kind === "caption";
                                if (isCaption) {
                                  return (
                                    <div key={entry.fid || idx} className="p-2.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 rounded transition-colors duration-150">
                                      <p className="text-xs text-white/50 italic leading-relaxed font-sans">
                                        [CAPTION] {entry.text}
                                      </p>
                                    </div>
                                  );
                                }

                                const handleVal = entry.characterHandle || '';
                                const speakerDisplay = getSpeakerDisplayLabel(handleVal, currentShow, entry);
                                const classification = getSpeakerClassification(handleVal, currentShow, entry);
                                
                                const isMapped = !!(currentShow && currentShow.unresolvedSpeakerMapping && (
                                  currentShow.unresolvedSpeakerMapping[handleVal] || 
                                  currentShow.unresolvedSpeakerMapping[handleVal.toLowerCase()]
                                ));

                                let isMissingPortrait = false;
                                if (classification === 'resolvedCharacter' || isMapped) {
                                  const resolvedRef = handleVal;
                                  const charRes = resolveCanonicalCharacters(currentShow, [resolvedRef]);
                                  isMissingPortrait = charRes.resolvedCharacters.length > 0 && 
                                    !charRes.resolvedCharacters[0].portraitAssetId && 
                                    !charRes.resolvedCharacters[0].visualAnchorAssetId;
                                }

                                // Let's decide chip labels and colors
                                let chipLabel = 'resolved';
                                let chipClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

                                if (isMissingPortrait) {
                                  chipLabel = 'missing portrait';
                                  chipClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
                                } else if (isMapped) {
                                  chipLabel = 'mapped';
                                  chipClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                                } else if (classification === 'nonCharacterVoice') {
                                  chipLabel = 'non-character voice';
                                  chipClass = 'bg-white/10 text-white/60 border border-white/10';
                                } else if (classification === 'unresolvedSpeaker') {
                                  chipLabel = 'unresolved speaker';
                                  chipClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                                }

                                return (
                                  <div key={entry.fid || idx} className="p-2.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 rounded transition-colors duration-150">
                                    <div className="flex items-center justify-between gap-2 mb-1.5 select-none">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[12px] font-bold text-amber-300 font-sans" title={handleVal ? `Raw ID/handle: ${handleVal}` : undefined}>
                                          {speakerDisplay}{entry.parenthetical ? ` (${entry.parenthetical})` : ''}
                                        </span>
                                      </div>
                                      
                                      {/* Small diagnostic chip */}
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded-xs font-mono uppercase tracking-wider ${chipClass}`}>
                                        {chipLabel}
                                      </span>
                                    </div>
                                    <p className="text-xs text-white/90 leading-relaxed font-sans">
                                      {entry.text}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-white/50 italic py-4 select-none">
                              No script entries for this page beat.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* 4. Page Beat Editor */}
                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <button
                      onClick={() => setIsEditorCollapsibleOpen(!isEditorCollapsibleOpen)}
                      type="button"
                      className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest font-black text-white/50 select-none hover:text-white transition-colors outline-none"
                    >
                      <span>Page Beat Editor</span>
                      {isEditorCollapsibleOpen ? (
                        <ChevronDown size={14} className="text-white/60" />
                      ) : (
                        <ChevronRight size={14} className="text-white/60" />
                      )}
                    </button>
                    {isEditorCollapsibleOpen && (
                      <div className="mt-2 bg-[#121316]/20 rounded border border-white/5">
                        <WorkbenchPageBeatEditor
                          pageBeat={focusedPage.pageBeat}
                          show={currentShow}
                          updatePageBeat={actions.updatePageBeat}
                        />
                      </div>
                    )}
                  </div>

                  {/* 5. Scene Pool Integration (DA-028) */}
                  <div className="pt-4 border-t border-white/10">
                    <WorkbenchScenePool
                      show={currentShow}
                      focusedPageUid={focusedPage.productionPage.uid}
                      issueUid={selectedIssueUid || undefined}
                      dispatch={dispatch}
                    />
                  </div>

                </div>
              ) : (
                /* Panels layout tab: full-column height panel list */
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 select-none">
                  <WorkbenchPanelPlanView pageBeat={focusedPage.pageBeat} updatePageBeat={actions.updatePageBeat} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/40">
            <span className="text-white/60 text-xs font-mono uppercase tracking-[0.2em] mb-2 block animate-pulse">
              Deriving active page selection...
            </span>
          </div>
        )}
      </div>

      {isDiagnosticsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsDiagnosticsOpen(false)} />
          <div className="glass p-6 w-full max-w-2xl relative space-y-4 border-white/20 bg-[#0c0c0e]/95 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${allPreflightWarnings.length > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Diagnostics & Preflight Warnings
                </h2>
              </div>
              <button 
                onClick={() => setIsDiagnosticsOpen(false)} 
                className="p-1 hover:bg-white/10 rounded transition-colors text-white/75 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin scrollbar-thumb-white/10 text-left">
              {/* Current Page Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/90">
                    Current Page Slot (P.{focusedPage?.pageNumber}) Preflight
                  </h3>
                  <span className="text-[10px] font-mono text-white/60">
                    {currentPageWarnings.length} Warnings
                  </span>
                </div>

                {currentPageWarnings.length === 0 ? (
                  <div className="p-3 bg-emerald-950/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Page is clean and validated for issue generation (unresolved speaker labels will render in default Casing).</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Section 1: Blocking Errors */}
                    {(() => {
                      const blockers = currentPageWarnings.filter(w => w.severity === 'blocking');
                      if (blockers.length === 0) return null;
                      return (
                        <div className="space-y-1.5 bg-red-950/20 p-3 rounded-lg border border-red-500/20">
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest font-mono block mb-1">
                            ⚠️ Missing Required Cast Portrait Assets:
                          </span>
                          {blockers.map((w, index) => (
                            <div key={index} className="text-xs text-white/90 leading-relaxed font-sans flex items-start gap-1.5">
                              <span className="text-red-400 font-bold">•</span>
                              <span>{w.message}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Section 2: Unresolved Speakers with interactive quick-resolve */}
                    {(() => {
                      const unresolved = currentPageWarnings.filter(w => w.classification === 'unresolvedSpeaker');
                      if (unresolved.length === 0) return null;
                      return (
                        <div className="space-y-2 bg-amber-950/10 p-3 rounded-lg border border-amber-500/20">
                          <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest font-mono block mb-1">
                            ⚠️ Unresolved Dialogue Speakers:
                          </span>
                          <div className="space-y-3">
                            {unresolved.map((w, index) => (
                              <div key={index} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
                                  <span className="font-mono text-[10px] font-black text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    {w.identifier}
                                  </span>
                                  
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      if (val === 'nonCharacterVoice') {
                                        dispatch({
                                          type: 'UPDATE_SHOW',
                                          updates: {
                                            unresolvedSpeakerSettings: {
                                              ...(currentShow?.unresolvedSpeakerSettings ?? {}),
                                              [w.identifier]: 'nonCharacterVoice',
                                              [w.identifier.toLowerCase()]: 'nonCharacterVoice',
                                            }
                                          }
                                        });
                                      } else {
                                        dispatch({
                                          type: 'UPDATE_SHOW',
                                          updates: {
                                            unresolvedSpeakerMapping: {
                                              ...(currentShow?.unresolvedSpeakerMapping ?? {}),
                                              [w.identifier]: val,
                                              [w.identifier.toLowerCase()]: val,
                                            }
                                          }
                                        });
                                      }
                                    }}
                                    className="bg-black border border-white/25 text-white/90 text-xs rounded px-2.5 py-1.5 outline-none cursor-pointer hover:border-white/40 focus:border-amber-500/50 select-none max-w-[220px]"
                                  >
                                    <option value="">-- Quick Resolve --</option>
                                    <option value="nonCharacterVoice">Ignore Label (Non-Character Voice)</option>
                                    <optgroup label="Map to Cast Member">
                                      {(currentShow?.characters ?? []).map(char => (
                                        <option key={char.id} value={char.id}>
                                          {char.name || char.handle}
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                </div>
                                
                                <div className="text-[10px] text-white/60 space-y-0.5 leading-snug font-sans">
                                  <div>Source: Act {w.actNumber} Scene {w.sceneNumber} / PageBeat {w.pageBeatUid?.slice(-4)}</div>
                                  {w.sourcePass && w.sourcePass !== '0.9W' && w.sourcePass !== '0.9G' && (
                                    <div className="italic text-white/60 pl-2 border-l border-white/15 mt-1 line-clamp-3 font-sans">
                                      "{w.sourcePass}"
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Section 3: Generalized Normalization feedback */}
                    {(() => {
                      const normalized = currentPageWarnings.filter(w => w.classification === 'other');
                      if (normalized.length === 0) return null;
                      return (
                        <div className="space-y-1 bg-emerald-950/10 p-3 rounded-lg border border-emerald-500/20">
                          <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest font-mono block mb-1">
                            ✓ Standard Identification Pairings:
                          </span>
                          {normalized.map((w, index) => (
                            <div key={index} className="text-[11px] text-white/80 leading-relaxed font-sans flex items-center justify-between gap-1.5 py-0.5">
                              <span className="font-mono text-white/70">{w.identifier}</span>
                              <span className="text-white/60 font-mono text-[10px] uppercase">is normalized to</span>
                              <span className="font-bold text-emerald-300">{w.speakerName}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Other Pages/Issue Sections */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between border-b border-white/5 pb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/90">
                    Other Pages / Unselected Slots ({issueSummaryWarnings.length} Warnings)
                  </h3>
                </div>

                {issueSummaryWarnings.length === 0 ? (
                  <p className="text-xs text-white/60 font-mono leading-relaxed">
                    ✓ All other page slots in this issue are clear.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/15">
                    {issueSummaryWarnings.map((w, index) => {
                      const displayAddress = filmstripPages.find(p => p.productionPage.uid === w.productionPageUid)?.pageBeat.address || w.pageBeatUid || 'unassigned';
                      let badgeLabel = 'info';
                      let badgeStyle = 'text-blue-300 bg-blue-500/10 border-blue-500/30';

                      if (w.severity === 'blocking') {
                        badgeLabel = 'blocking';
                        badgeStyle = 'text-red-400 bg-red-500/10 border-red-500/30';
                      } else if (w.classification === 'unresolvedSpeaker') {
                        badgeLabel = 'unresolved';
                        badgeStyle = 'text-amber-300 bg-amber-500/10 border-amber-500/30';
                      }

                      return (
                        <button
                          key={index}
                          onClick={() => {
                            if (w.productionPageUid) {
                              setFocusedPage(w.productionPageUid);
                              setIsDiagnosticsOpen(false);
                            }
                          }}
                          className="w-full text-left p-3 rounded-lg border border-white/5 bg-black/40 hover:bg-white/5 transition-all text-xs cursor-pointer group focus:outline-none flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-1.5 text-white/70">
                            <span className="font-mono text-xs text-amber-300 font-bold uppercase tracking-wider group-hover:text-amber-400 group-hover:underline">
                              {displayAddress}
                            </span>
                            
                            <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${badgeStyle}`}>
                              {badgeLabel}
                            </span>
                          </div>
                          <span className="text-white/80 leading-relaxed text-[11px] font-sans">
                            {w.message}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 flex justify-end shrink-0">
              <button 
                onClick={() => setIsDiagnosticsOpen(false)} 
                className="px-4 py-2 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase tracking-widest rounded transition-all cursor-pointer"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}

      {workbenchConfirm && (
        <ConfirmModal
          isOpen={workbenchConfirm.isOpen}
          title={workbenchConfirm.title}
          body={workbenchConfirm.body}
          confirmLabel={workbenchConfirm.confirmLabel}
          onConfirm={workbenchConfirm.onConfirm}
          onCancel={workbenchConfirm.onCancel}
        />
      )}
    </div>
  );
};

export default SceneWorkbench;
