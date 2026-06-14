import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStore } from '../StoreContext';
import {
  createVpsRun,
  getActiveVpsRun,
  getVpsRecordsByRun,
  markVpsRecordEdited,
} from '../vps/storage';
import { runVpsPass, runVpsPassForPage, VpsProgress } from '../vps/executor';
import { Loader2 } from 'lucide-react';
import { applyEnvironmentDesign } from '../vps/applyEnvironmentDesign';
import { applyPageDirection, applyAllPageDirection } from '../vps/applyPageDirection';
import ConfirmModal from './ConfirmModal';

function Dot({ label, state }: { label: string; state?: 'pending' | 'running' | 'done' | 'error' }) {
  let dotColor = 'bg-white/20';
  let dotAnimation = '';
  let labelColor = 'text-white/60'; // D185: tertiary levels use minimum text-white/60.

  if (state === 'running') {
    dotColor = 'bg-sky-400';
    dotAnimation = 'animate-ping';
    labelColor = 'text-sky-400';
  } else if (state === 'done') {
    dotColor = 'bg-emerald-400';
    labelColor = 'text-emerald-400';
  } else if (state === 'error') {
    dotColor = 'bg-red-400';
    labelColor = 'text-red-400';
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        {state === 'running' && (
          <span className={`${dotAnimation} absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`}></span>
      </span>
      <span className={`text-[10px] font-mono tracking-widest uppercase font-bold ${labelColor}`}>{label}</span>
    </span>
  );
}
import {
  VpsRun,
  VpsRecord,
  VpsRecordType,
  EnvironmentDesignPayload,
  PageDirectionPayload,
} from '../vps/types';
import { estimateShow, estimateIssueDirection } from '../vps/estimateRun';

export default function VisualPlanningPanel() {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  const issues = useMemo(
    () => currentShow?.issues ?? [], [currentShow]);
  const [issueUid, setIssueUid] = useState<string | null>(
    issues[0]?.uid ?? null);
  const [vpsStorageError, setVpsStorageError] = useState<string | null>(null);
  const [run, setRun] = useState<VpsRun | null>(null);
  const [records, setRecords] = useState<VpsRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);  // pass id ('env' or 'page')

  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<VpsProgress | null>(null);
  const [issueStatus, setIssueStatus] = useState<Record<string, {
    env: 'pending' | 'running' | 'done' | 'error';
    page: 'pending' | 'running' | 'done' | 'error';
    pagesDone: number;
    pagesTotal: number;
  }>>({});
  const abort = useRef<AbortController | null>(null);
  const runAttemptIdRef = useRef<string | null>(null);
  const userCancelledRef = useRef<Record<string, boolean>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const [vpsConfirm, setVpsConfirm] = useState<{
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
        issueUid,
        hasCurrentShow: !!currentShow,
      });

      try {
        setVpsConfirm({
          isOpen: true,
          title: 'Confirm Operation',
          body: message,
          confirmLabel: 'Proceed',
          onConfirm: () => {
            setVpsConfirm(null);
            console.info('[PLAN_ISSUE_CONFIRM_RESULT]', {
              action: actionName,
              confirmed: true,
              type: 'boolean',
            });
            resolve(true);
          },
          onCancel: () => {
            setVpsConfirm(null);
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
            id: Date.now() + '_confirm_err',
            type: 'error',
            message: 'Confirmation dialog failed to open'
          }
        });
        resolve(undefined);
      }
    });
  };

  const stopCurrentRun = () => {
    console.info('[UI_CLICK]', {
      action: 'Stop Current Run',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_stop_click', type: 'info', message: 'Clicked Stop' }
    });
    console.info('[HANDLER_ENTER]', 'Stop Current Run');

    const attemptId = runAttemptIdRef.current;
    if (attemptId) {
      userCancelledRef.current[attemptId] = true;
      const controller = abortControllersRef.current[attemptId];
      if (controller) {
        controller.abort();
        console.info('[HANDLER_SUCCESS]', 'Stop Current Run - aborted controller');
        dispatch({
          type: 'ADD_TOAST',
          toast: { id: Date.now() + '_stop_success', type: 'success', message: 'Abort controller triggered' }
        });
      } else {
        console.warn('[HANDLER_GUARD_FAIL]', 'Stop Current Run', 'no controller found');
        dispatch({
          type: 'ADD_TOAST',
          toast: { id: Date.now() + '_stop_fail', type: 'error', message: 'No controller found to abort.' }
        });
      }
    } else {
      console.warn('[HANDLER_GUARD_FAIL]', 'Stop Current Run', 'no run active');
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_stop_fail_active', type: 'error', message: 'No active run to stop.' }
      });
    }
  };

  // Sync existing database records status on load
  useEffect(() => {
    if (!currentShow || issues.length === 0) return;
    const initial: typeof issueStatus = {};
    for (const iss of issues) {
      initial[iss.uid] = {
        env: 'pending',
        page: 'pending',
        pagesDone: 0,
        pagesTotal: iss.acts.flatMap((a: any) => a.scenes).flatMap((s: any) => s.pageBeats).filter((pb: any) => pb.productionPageUid).length
      };
    }

    const promises = issues.map(async (iss) => {
      try {
        const r = await getActiveVpsRun(currentShow.id, iss.uid);
        if (r) {
          const loadedRecords = await getVpsRecordsByRun(r.id);
          const envDone = loadedRecords.some(rec => rec.recordType === VpsRecordType.ENVIRONMENT_DESIGN);
          const pageRecs = loadedRecords.filter(rec => rec.recordType === VpsRecordType.PAGE_DIRECTION);
          initial[iss.uid] = {
            env: envDone ? 'done' : (r.phaseProgress.environment === 'failed' ? 'error' : (r.phaseProgress.environment === 'running' ? 'running' : 'pending')),
            page: (r.phaseProgress.page_direction === 'complete') ? 'done' : (r.phaseProgress.page_direction === 'failed' ? 'error' : (r.phaseProgress.page_direction === 'running' ? 'running' : 'pending')),
            pagesDone: pageRecs.length,
            pagesTotal: iss.acts.flatMap((a: any) => a.scenes).flatMap((s: any) => s.pageBeats).filter((pb: any) => pb.productionPageUid).length
          };
        }
      } catch (err: any) {
        console.error("IndexedDB error during VPS initialization sync:", err);
        setVpsStorageError("VPS storage is not ready. Refresh the app once so the local database can upgrade, then try again.");
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now() + '_init_vps_err',
            type: 'error',
            message: 'VPS storage is not ready. Refresh the app once so the local database can upgrade, then try again.'
          }
        });
      }
    });

    Promise.all(promises).then(() => {
      setIssueStatus(prev => ({
        ...initial,
        ...prev
      }));
    });
  }, [issues, currentShow?.id]);

  // Keep selected issue in sync when issue list changes or initial load
  useEffect(() => {
    if (issues.length > 0 && !issueUid) {
      setIssueUid(issues[0].uid);
    }
  }, [issues, issueUid]);

  // Load or create the run for the selected issue.
  useEffect(() => {
    if (!currentShow || !issueUid) {
      setRun(null);
      setRecords([]);
      return;
    }
    getActiveVpsRun(currentShow.id, issueUid)
      .then(r => {
        setRun(r);
        if (!r) {
          setRecords([]);
        }
      })
      .catch((err) => {
        console.error("IndexedDB error while getting active VPS run:", err);
        setVpsStorageError("VPS storage is not ready. Refresh the app once so the local database can upgrade, then try again.");
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now() + '_get_vps_err',
            type: 'error',
            message: 'VPS storage is not ready. Refresh the app once so the local database can upgrade, then try again.'
          }
        });
        setRun(null);
        setRecords([]);
      });
  }, [currentShow?.id, issueUid]);

  const refreshRecords = useCallback(async (r: VpsRun) => {
    try {
      const recs = await getVpsRecordsByRun(r.id);
      setRecords(recs);
    } catch (err: any) {
      console.error("IndexedDB error while refreshing VPS records:", err);
      setVpsStorageError("VPS storage is not ready. Refresh the app once so the local database can upgrade, then try again.");
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    if (run) {
      refreshRecords(run);
    }
  }, [run, refreshRecords]);

  const ensureRun = async (): Promise<VpsRun> => {
    if (run) return run;
    try {
      const r = await createVpsRun(currentShow!.id, issueUid!);
      setRun(r);
      return r;
    } catch (err: any) {
      console.error("IndexedDB error while ensuring/creating VPS run:", err);
      setVpsStorageError("VPS storage is not ready. Refresh the app once so the local database can upgrade, then try again.");
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_create_vps_err',
          type: 'error',
          message: 'VPS storage is not ready. Refresh the app once so the local database can upgrade, then try again.'
        }
      });
      throw err;
    }
  };

  const persist = (updated: any) => {
    dispatch({
      type: 'UPDATE_SHOW',
      updates: {
        settingAnchors: updated.settingAnchors,
        issues: updated.issues
      }
    });
  };

  const runPass = async (passId: 'env' | 'page') => {
    const actionName = passId === 'env' ? 'Run Environment Design' : 'Run Page Direction';
    console.info('[UI_CLICK]', {
      action: actionName,
      timestamp: new Date().toISOString(),
      disabled: !!busy,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });

    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: Date.now() + '_enter_' + passId,
        type: 'info',
        message: `Clicked ${actionName}`
      }
    });
    console.info('[HANDLER_ENTER]', actionName);

    if (!currentShow) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_nf_' + passId, type: 'error', message: 'VPS storage not ready: no active show loaded.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'missing currentShow');
      return;
    }

    // 1. VPS storage / DB readiness verification
    try {
      const db = await import('../storage/db').then(m => m.openDB());
      if (!db.objectStoreNames.contains('vps_runs') || !db.objectStoreNames.contains('vps_records')) {
        dispatch({
          type: 'ADD_TOAST',
          toast: { id: Date.now() + '_missing_store_' + passId, type: 'error', message: 'Missing vps_runs/vps_records object store.' }
        });
        console.warn('[HANDLER_GUARD_FAIL]', actionName, 'Missing vps_runs/vps_records object store.');
        return;
      }
    } catch (dbErr: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_storage_not_ready_' + passId, type: 'error', message: 'VPS storage not ready.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'VPS storage not ready.', dbErr);
      return;
    }

    // 2. Active promoted issue check
    if (!issueUid) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_ni_' + passId, type: 'error', message: 'No promoted issue selected.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'missing issueUid');
      return;
    }

    // 3. Issue found in current show check
    const activeIssue = issues.find(i => i.uid === issueUid);
    if (!activeIssue) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_anf_' + passId, type: 'error', message: 'Issue not found in current show.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, `activeIssue not found for UID: ${issueUid}`);
      return;
    }

    // 4. Production pages found verification
    const totalPages = activeIssue.acts
      ?.flatMap((a: any) => a.scenes ?? [])
      ?.flatMap((s: any) => s.pageBeats ?? [])
      ?.filter((pb: any) => pb.productionPageUid).length ?? 0;

    if (totalPages === 0) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_np_' + passId, type: 'error', message: 'No production pages found.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'No production pages found.');
      return;
    }

    const est = estimateIssueDirection(activeIssue);
    const calls = passId === 'env' ? est.envCalls : est.pageCalls;
    const confirmed = await confirmProceed(
      'Plan Issue',
      `Run ${passId === 'env' ? 'Environment Design' : 'Page Direction'} for ${activeIssue.issueCode} — ${calls} Pro calls. Proceed?`
    );
    if (confirmed === false) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_dc_' + passId, type: 'info', message: 'Proceed confirmation declined.' }
      });
      console.info('[HANDLER_GUARD_FAIL]', actionName, 'confirmation declined');
      return;
    } else if (confirmed === undefined) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_err_' + passId, type: 'error', message: 'Confirmation dialog failed to open' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', actionName, 'confirmation UI error or aborted render');
      return;
    }

    const attemptId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    runAttemptIdRef.current = attemptId;
    userCancelledRef.current[attemptId] = false;

    const controller = new AbortController();
    abortControllersRef.current[attemptId] = controller;
    abort.current = controller;

    setLive(null);
    setBusy(passId);

    try {
      const r = await ensureRun();
      const onProgress = (ev: VpsProgress) => {
        if (runAttemptIdRef.current === attemptId) {
          setLive(ev);
        }
      };

      const res = await runVpsPass(r.id, passId, currentShow, {
        signal: controller.signal,
        onProgress
      });

      if (runAttemptIdRef.current === attemptId) {
        if (!res.success) {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: Date.now() + '_err_res_' + passId,
              type: 'error',
              message: `VPS ${passId} failed: ${res.error}`
            }
          });
          console.error('[HANDLER_FAIL]', actionName, res.error);
        } else {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: Date.now() + '_success_' + passId,
              type: 'success',
              message: `VPS ${passId} completed successfully! Created/updated ${res.records} records.`
            }
          });
          console.info('[HANDLER_SUCCESS]', actionName, `records: ${res.records}`);
        }
      }
      await refreshRecords(r);
      const fresh = await getActiveVpsRun(currentShow.id, issueUid);
      setRun(fresh);
    } catch (e: any) {
      const isUserAborted = userCancelledRef.current[attemptId];
      if (runAttemptIdRef.current === attemptId) {
        if ((e.name === 'AbortError' || e.message === 'AbortError') && isUserAborted) {
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_abort_info_' + passId, type: 'info', message: 'Run cancelled by user.' }
          });
          console.info('[HANDLER_ABORTED]', actionName, 'aborted by user close/stop action');
        } else {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: Date.now() + '_catch_err_' + passId,
              type: 'error',
              message: `VPS ${passId} error: ${e.message || String(e)}`
            }
          });
          console.error('[HANDLER_FAIL]', actionName, e);
        }
      }
    } finally {
      if (runAttemptIdRef.current === attemptId) {
        setBusy(null);
        setLive(null);
        abort.current = null;
        console.info('[HANDLER_COMPLETE]', actionName);
      }
    }
  };

  const applyEnv = async (rec: VpsRecord) => {
    console.info('[UI_CLICK]', {
      action: 'Apply Environment Design',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_ae_enter', type: 'info', message: 'Clicked Apply Environment Design' }
    });
    console.info('[HANDLER_ENTER]', 'Apply Environment Design');

    if (!currentShow) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_ae_nocs', type: 'error', message: 'Cannot apply environment: No active show loaded.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Apply Environment Design', 'missing currentShow');
      return;
    }
    try {
      const updated = await applyEnvironmentDesign(rec, currentShow);
      persist(updated);
      if (run) await refreshRecords(run);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_ae_success',
          type: 'success',
          message: 'Environments applied to show anchors.'
        }
      });
      console.info('[HANDLER_SUCCESS]', 'Apply Environment Design');
    } catch (e: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_ae_err',
          type: 'error',
          message: `Applying environment design failed: ${e.message || String(e)}`
        }
      });
      console.error('[HANDLER_FAIL]', 'Apply Environment Design', e);
    }
  };

  const applyAllPages = async () => {
    console.info('[UI_CLICK]', {
      action: 'Apply All Page Directions',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_aap_enter', type: 'info', message: 'Clicked Apply All Page Directions' }
    });
    console.info('[HANDLER_ENTER]', 'Apply All Page Directions');

    if (!currentShow) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_aap_nocs', type: 'error', message: 'Cannot apply: No active show loaded.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Apply All Page Directions', 'missing currentShow');
      return;
    }
    if (!run) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_aap_norun', type: 'error', message: 'Cannot apply: No active VPS planning run exists for this issue.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Apply All Page Directions', 'missing run');
      return;
    }
    try {
      const updated = await applyAllPageDirection(run.id, currentShow);
      persist(updated);
      await refreshRecords(run);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_aap_success',
          type: 'success',
          message: 'Page directions applied to all pages.'
        }
      });
      console.info('[HANDLER_SUCCESS]', 'Apply All Page Directions');
    } catch (e: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_aap_err',
          type: 'error',
          message: `Applying page directions failed: ${e.message || String(e)}`
        }
      });
      console.error('[HANDLER_FAIL]', 'Apply All Page Directions', e);
    }
  };

  const applyOnePage = async (rec: VpsRecord) => {
    console.info('[UI_CLICK]', {
      action: 'Apply One Page Direction',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_aop_enter', type: 'info', message: 'Clicked Apply Page Direction' }
    });
    console.info('[HANDLER_ENTER]', 'Apply One Page Direction');

    if (!currentShow) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_aop_nocs', type: 'error', message: 'Cannot apply page direction: No active show loaded.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Apply One Page Direction', 'missing currentShow');
      return;
    }
    try {
      const updated = await applyPageDirection(rec, currentShow);
      persist(updated);
      if (run) await refreshRecords(run);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_aop_success',
          type: 'success',
          message: 'Page direction applied to page.'
        }
      });
      console.info('[HANDLER_SUCCESS]', 'Apply One Page Direction');
    } catch (e: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_aop_err',
          type: 'error',
          message: `Applying page direction failed: ${e.message || String(e)}`
        }
      });
      console.error('[HANDLER_FAIL]', 'Apply One Page Direction', e);
    }
  };

  // Derived records
  const envRecord = useMemo(() => records.find(
    r => r.recordType === VpsRecordType.ENVIRONMENT_DESIGN
  ), [records]);

  const pageRecords = useMemo(() => records
    .filter(r => r.recordType === VpsRecordType.PAGE_DIRECTION)
    .sort((a, b) => a.createdAt - b.createdAt), [records]);

  const pagesApplied = useMemo(() => pageRecords.filter(r => r.applied).length, [pageRecords]);
  const stalePages = useMemo(() => pageRecords.filter(r => r.stale), [pageRecords]);

  const handleReRunStale = async () => {
    console.info('[UI_CLICK]', {
      action: 'Re-run Stale Pages',
      timestamp: new Date().toISOString(),
      disabled: !!busy,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_rrs_enter', type: 'info', message: 'Clicked Re-run stale pages' }
    });
    console.info('[HANDLER_ENTER]', 'Re-run Stale Pages');

    if (!currentShow) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_rrs_nocs', type: 'error', message: 'Cannot re-run: No active show loaded.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Re-run Stale Pages', 'missing currentShow');
      return;
    }
    if (!issueUid) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_rrs_noiss', type: 'error', message: 'Cannot re-run: No issue is selected.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Re-run Stale Pages', 'missing issueUid');
      return;
    }
    if (!run) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_rrs_norun', type: 'error', message: 'Cannot re-run: No active VPS run found to execute stale pages.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Re-run Stale Pages', 'missing run');
      return;
    }

    const attemptId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    runAttemptIdRef.current = attemptId;
    userCancelledRef.current[attemptId] = false;

    const controller = new AbortController();
    abortControllersRef.current[attemptId] = controller;
    abort.current = controller;

    setLive(null);
    setBusy('page-rerun');

    try {
      let successCount = 0;
      for (const rec of stalePages) {
        if (controller.signal.aborted) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
        if (!rec.scopeKey) continue;
        const res = await runVpsPassForPage(run.id, rec.scopeKey, {
          signal: controller.signal
        });
        if (!res.success) {
          throw new Error(res.error || `Failed on page ${rec.scopeKey}`);
        }
        successCount++;
        await refreshRecords(run);
      }
      if (runAttemptIdRef.current === attemptId) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now() + '_rrs_success',
            type: 'success',
            message: `Successfully re-ran ${successCount} stale page directions!`
          }
        });
        console.info('[HANDLER_SUCCESS]', 'Re-run Stale Pages', `count: ${successCount}`);
      }
      const fresh = await getActiveVpsRun(currentShow.id, issueUid);
      setRun(fresh);
    } catch (e: any) {
      const isUserAborted = userCancelledRef.current[attemptId];
      if (runAttemptIdRef.current === attemptId) {
        if ((e.name === 'AbortError' || e.message === 'AbortError') && isUserAborted) {
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_rrs_abort', type: 'info', message: 'Run cancelled by user.' }
          });
          console.info('[HANDLER_ABORTED]', 'Re-run Stale Pages', 'cancelled by user stop button close');
        } else {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: Date.now() + '_rrs_err',
              type: 'error',
              message: `VPS stale re-run error: ${e.message || String(e)}`
            }
          });
          console.error('[HANDLER_FAIL]', 'Re-run Stale Pages', e);
        }
      }
    } finally {
      if (runAttemptIdRef.current === attemptId) {
        setBusy(null);
        setLive(null);
        abort.current = null;
        console.info('[HANDLER_COMPLETE]', 'Re-run Stale Pages');
      }
    }
  };

  const planAllIssues = async () => {
    console.info('[UI_CLICK]', {
      action: 'Plan All Issues',
      timestamp: new Date().toISOString(),
      disabled: running || !!busy,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_pai_enter', type: 'info', message: 'Clicked Plan All Issues' }
    });
    console.info('[HANDLER_ENTER]', 'Plan All Issues');

    if (!currentShow) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_pai_nocs', type: 'error', message: 'Cannot plan all: No active show loaded.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Plan All Issues', 'missing currentShow');
      return;
    }
    if (issues.length === 0) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_pai_noissues', type: 'error', message: 'Cannot plan all: The current show contains no issues to plan.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Plan All Issues', 'issues.length === 0');
      return;
    }
    const est = estimateShow(currentShow, false);
    const confirmed = await confirmProceed(
      'Plan All Issues',
      `Plan all ${issues.length} issues — ${est.envCalls + est.pageCalls} Pro calls. Proceed?`
    );
    if (confirmed === false) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_pai_declined', type: 'info', message: 'Proceed confirmation declined.' }
      });
      console.info('[HANDLER_GUARD_FAIL]', 'Plan All Issues', 'confirmation declined');
      return;
    } else if (confirmed === undefined) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_pai_err', type: 'error', message: 'Confirmation dialog failed to open' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Plan All Issues', 'confirmation UI error or aborted render');
      return;
    }

    const attemptId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    runAttemptIdRef.current = attemptId;
    userCancelledRef.current[attemptId] = false;

    const controller = new AbortController();
    abortControllersRef.current[attemptId] = controller;
    abort.current = controller;

    setRunning(true);
    setBusy('plan-all');
    setLive(null);

    try {
      const initialStatus: Record<string, { env: 'pending'|'running'|'done'|'error'; page: 'pending'|'running'|'done'|'error'; pagesDone: number; pagesTotal: number }> = {};
      for (const iss of issues) {
        initialStatus[iss.uid] = {
          env: 'pending',
          page: 'pending',
          pagesDone: 0,
          pagesTotal: iss.acts.flatMap((a: any) => a.scenes).flatMap((s: any) => s.pageBeats).filter((pb: any) => pb.productionPageUid).length
        };
      }
      setIssueStatus(initialStatus);

      for (const iss of issues) {
        if (controller.signal.aborted) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }

        let r = await getActiveVpsRun(currentShow.id, iss.uid);
        if (!r) {
          r = await createVpsRun(currentShow.id, iss.uid);
        }

        const onProgress = (ev: VpsProgress) => {
          if (runAttemptIdRef.current === attemptId) {
            setLive(ev);
            setIssueStatus(s => {
              const cur = s[iss.uid] ?? {
                env: 'pending',
                page: 'pending',
                pagesDone: 0,
                pagesTotal: 0
              };
              if (ev.pass === 'env') {
                cur.env = ev.phase === 'env-done' ? 'done' : (ev.phase === 'error' ? 'error' : 'running');
              }
              if (ev.pass === 'page') {
                if (ev.phase === 'error') {
                  cur.page = 'error';
                } else {
                  cur.page = 'running';
                  cur.pagesTotal = ev.total;
                  if (ev.phase === 'page-done') {
                    cur.pagesDone = ev.index + 1;
                  }
                }
              }
              return { ...s, [iss.uid]: { ...cur } };
            });

            if (issueUid === iss.uid) {
              refreshRecords(r!);
            }
          }
        };

        const envRes = await runVpsPass(r.id, 'env', currentShow, {
          signal: controller.signal,
          onProgress
        });
        if (!envRes.success) {
          setIssueStatus(s => ({
            ...s,
            [iss.uid]: {
              ...(s[iss.uid] ?? { env: 'pending', page: 'pending', pagesDone: 0, pagesTotal: 0 }),
              env: 'error'
            }
          }));
          throw new Error(`Encountered error designing environment for ${iss.issueCode}: ${envRes.error}`);
        }

        if (controller.signal.aborted) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }

        const pageRes = await runVpsPass(r.id, 'page', currentShow, {
          signal: controller.signal,
          onProgress
        });
        if (!pageRes.success) {
          setIssueStatus(s => ({
            ...s,
            [iss.uid]: {
              ...(s[iss.uid] ?? { env: 'done', page: 'pending', pagesDone: 0, pagesTotal: 0 }),
              page: 'error'
            }
          }));
          throw new Error(`Encountered error planning page direction for ${iss.issueCode}: ${pageRes.error}`);
        }

        setIssueStatus(s => ({
          ...s,
          [iss.uid]: {
            ...(s[iss.uid] ?? { env: 'done', page: 'pending', pagesDone: 0, pagesTotal: 0 }),
            env: 'done',
            page: 'done'
          }
        }));

        if (issueUid === iss.uid) {
          const fresh = await getActiveVpsRun(currentShow.id, iss.uid);
          setRun(fresh);
        }
      }

      if (runAttemptIdRef.current === attemptId) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now() + '_pai_success',
            type: 'success',
            message: `Successfully planned environment and page directions for all issues.`
          }
        });
        console.info('[HANDLER_SUCCESS]', 'Plan All Issues');
      }
    } catch (err: any) {
      const isUserAborted = userCancelledRef.current[attemptId];
      if (runAttemptIdRef.current === attemptId) {
        if ((err.name === 'AbortError' || err.message === 'AbortError') && isUserAborted) {
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_pai_abort', type: 'info', message: 'Run cancelled by user.' }
          });
          console.info('[HANDLER_ABORTED]', 'Plan All Issues', 'cancelled by user close/stop');
        } else {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: Date.now() + '_pai_err',
              type: 'error',
              message: `Plan All Issues failed: ${err.message || String(err)}`
            }
          });
          console.error('[HANDLER_FAIL]', 'Plan All Issues', err);
        }
      }
    } finally {
      if (runAttemptIdRef.current === attemptId) {
        setRunning(false);
        setLive(null);
        setBusy(null);
        abort.current = null;
        console.info('[HANDLER_COMPLETE]', 'Plan All Issues');
      }
    }
  };

  const planSelectedIssue = async () => {
    console.info('[UI_CLICK]', {
      action: 'Plan Selected Issue',
      timestamp: new Date().toISOString(),
      disabled: running || !!busy,
      busy,
      selectedIssueUid: issueUid,
      hasCurrentShow: !!currentShow,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_psi_enter', type: 'info', message: 'Clicked Plan Selected Issue' }
    });
    console.info('[HANDLER_ENTER]', 'Plan Selected Issue');

    if (!currentShow) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_psi_nocs', type: 'error', message: 'Cannot plan selected: No active show loaded.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Plan Selected Issue', 'missing currentShow');
      return;
    }
    const targetIssue = issues.find(i => i.uid === issueUid) || issues[0];
    if (!targetIssue) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_psi_noiss', type: 'error', message: 'Cannot plan selected: No selected issue found.' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Plan Selected Issue', 'no active issue found');
      return;
    }

    const est = estimateIssueDirection(targetIssue);
    const confirmed = await confirmProceed(
      'Plan Selected Issue',
      `Plan selected issue ${targetIssue.issueCode} — ${est.envCalls + est.pageCalls} Pro calls. Proceed?`
    );
    if (confirmed === false) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_psi_declined', type: 'info', message: 'Proceed confirmation declined.' }
      });
      console.info('[HANDLER_GUARD_FAIL]', 'Plan Selected Issue', 'confirmation declined');
      return;
    } else if (confirmed === undefined) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_psi_err', type: 'error', message: 'Confirmation dialog failed to open' }
      });
      console.warn('[HANDLER_GUARD_FAIL]', 'Plan Selected Issue', 'confirmation UI error or aborted render');
      return;
    }

    const attemptId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
    runAttemptIdRef.current = attemptId;
    userCancelledRef.current[attemptId] = false;

    const controller = new AbortController();
    abortControllersRef.current[attemptId] = controller;
    abort.current = controller;

    setRunning(true);
    setBusy('plan-selected');
    setLive(null);

    try {
      setIssueStatus(s => ({
        ...s,
        [targetIssue.uid]: {
          env: 'pending',
          page: 'pending',
          pagesDone: 0,
          pagesTotal: targetIssue.acts.flatMap((a: any) => a.scenes).flatMap((s: any) => s.pageBeats).filter((pb: any) => pb.productionPageUid).length
        }
      }));

      if (controller.signal.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }

      let r = await getActiveVpsRun(currentShow.id, targetIssue.uid);
      if (!r) {
        r = await createVpsRun(currentShow.id, targetIssue.uid);
      }

      const onProgress = (ev: VpsProgress) => {
        if (runAttemptIdRef.current === attemptId) {
          setLive(ev);
          setIssueStatus(s => {
            const cur = s[targetIssue.uid] ?? {
              env: 'pending',
              page: 'pending',
              pagesDone: 0,
              pagesTotal: 0
            };
            if (ev.pass === 'env') {
              cur.env = ev.phase === 'env-done' ? 'done' : (ev.phase === 'error' ? 'error' : 'running');
            }
            if (ev.pass === 'page') {
              if (ev.phase === 'error') {
                cur.page = 'error';
              } else {
                cur.page = 'running';
                cur.pagesTotal = ev.total;
                if (ev.phase === 'page-done') {
                  cur.pagesDone = ev.index + 1;
                }
              }
            }
            return { ...s, [targetIssue.uid]: { ...cur } };
          });

          if (issueUid === targetIssue.uid) {
            refreshRecords(r!);
          }
        }
      };

      const envRes = await runVpsPass(r.id, 'env', currentShow, {
        signal: controller.signal,
        onProgress
      });
      if (!envRes.success) {
        setIssueStatus(s => ({
          ...s,
          [targetIssue.uid]: {
            ...(s[targetIssue.uid] ?? { env: 'pending', page: 'pending', pagesDone: 0, pagesTotal: 0 }),
            env: 'error'
          }
        }));
        throw new Error(`Encountered error designing environment for ${targetIssue.issueCode}: ${envRes.error}`);
      }

      if (controller.signal.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }

      const pageRes = await runVpsPass(r.id, 'page', currentShow, {
        signal: controller.signal,
        onProgress
      });
      if (!pageRes.success) {
        setIssueStatus(s => ({
          ...s,
          [targetIssue.uid]: {
            ...(s[targetIssue.uid] ?? { env: 'done', page: 'pending', pagesDone: 0, pagesTotal: 0 }),
            page: 'error'
          }
        }));
        throw new Error(`Encountered error planning page direction for ${targetIssue.issueCode}: ${pageRes.error}`);
      }

      setIssueStatus(s => ({
        ...s,
        [targetIssue.uid]: {
          ...(s[targetIssue.uid] ?? { env: 'done', page: 'pending', pagesDone: 0, pagesTotal: 0 }),
          env: 'done',
          page: 'done'
        }
      }));

      if (issueUid === targetIssue.uid) {
        const fresh = await getActiveVpsRun(currentShow.id, targetIssue.uid);
        setRun(fresh);
      }

      if (runAttemptIdRef.current === attemptId) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now() + '_psi_success',
            type: 'success',
            message: `Successfully planned environment and page directions for ${targetIssue.issueCode}.`
          }
        });
        console.info('[HANDLER_SUCCESS]', 'Plan Selected Issue');
      }
    } catch (err: any) {
      const isUserAborted = userCancelledRef.current[attemptId];
      if (runAttemptIdRef.current === attemptId) {
        if ((err.name === 'AbortError' || err.message === 'AbortError') && isUserAborted) {
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_psi_abort', type: 'info', message: 'Run cancelled by user.' }
          });
          console.info('[HANDLER_ABORTED]', 'Plan Selected Issue', 'cancelled by user close/stop');
        } else {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: Date.now() + '_psi_err',
              type: 'error',
              message: `Plan Selected Issue failed: ${err.message || String(err)}`
            }
          });
          console.error('[HANDLER_FAIL]', 'Plan Selected Issue', err);
        }
      }
    } finally {
      if (runAttemptIdRef.current === attemptId) {
        setRunning(false);
        setLive(null);
        setBusy(null);
        abort.current = null;
        console.info('[HANDLER_COMPLETE]', 'Plan Selected Issue');
      }
    }
  };

  if (!currentShow) {
    return (
      <div className="flex-grow flex items-center justify-center p-8 text-center bg-[#070707] text-white">
        <span className="text-xs uppercase font-mono tracking-widest text-white/50 animate-pulse">
          Loading Visual Planning context...
        </span>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center h-full bg-[#070707] text-white p-8">
        <p className="text-white/60 text-sm font-bold uppercase tracking-wider">
          No promoted issues yet.
        </p>
        <p className="text-white/60 text-xs mt-2 text-center max-w-md leading-relaxed">
          Promote an issue from the PSB4 pipeline first, then plan its visual rendering here.
        </p>
      </div>
    );
  }

  // Active planning issue details
  const activeIssue = issues.find(i => i.uid === issueUid) || issues[0];

  return (
    <div className="h-full flex flex-col bg-[#070707] text-white overflow-hidden">
      {vpsStorageError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2.5 flex items-center gap-3 text-red-500 font-medium shrink-0">
          <span className="text-xs">
            ⚠️ {vpsStorageError}
          </span>
        </div>
      )}
      {/* Upper Header Selector Bar */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 z-20 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase text-white/60 tracking-wider">Visual Planning:</span>
          <select
            value={issueUid || ''}
            onChange={(e) => setIssueUid(e.target.value || null)}
            className="bg-[#121316] text-xs border border-white/15 text-white rounded px-2 py-1 font-semibold focus:outline-none focus:border-sky-500/50 cursor-pointer"
          >
            {issues.map((issue) => (
              <option key={issue.uid} value={issue.uid}>
                {issue.issueCode} — {issue.title}
              </option>
            ))}
          </select>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-sky-500/20 bg-sky-500/5 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-sky-400 select-none shrink-0">
            VPS Panel
          </span>

          {(!running && !busy) ? (
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <button
                onClick={planSelectedIssue}
                className="px-3 py-1 text-[11px] font-bold rounded bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 transition-colors cursor-pointer"
              >
                Plan Selected Issue
              </button>
              <button
                onClick={planAllIssues}
                className="px-3 py-1 text-[11px] font-bold rounded bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 transition-colors cursor-pointer"
              >
                Plan All Issues
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 ml-3 text-[11px] text-white/80 font-mono bg-[#14151a] px-2.5 py-1 rounded border border-white/10 shrink-0">
              <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
              <span>
                {live
                  ? `[${live.pass === 'env' ? 'env' : 'page'}] ${live.address || 'page'}` + (live.total ? ` (${live.index + 1}/${live.total})` : '')
                  : (busy === 'env' ? 'Environment Design…' : (busy === 'page' ? 'Page Direction…' : (busy === 'page-rerun' ? 'Re-running stale…' : 'Starting run…')))}
              </span>
              <button
                type="button"
                onClick={stopCurrentRun}
                className="px-2 py-0.5 text-[10px] font-sans font-bold rounded bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 cursor-pointer ml-1.5"
              >
                Stop
              </button>
            </div>
          )}
        </div>

        {/* Phase progress indicators */}
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] font-bold">
          <span className={run?.phaseProgress.environment === 'complete' ? 'text-emerald-400' : 'text-white/60'}>
            Environment ({run?.phaseProgress.environment || 'pending'})
          </span>
          <span className="text-white/45">→</span>
          <span className={run?.phaseProgress.page_direction === 'complete' ? 'text-emerald-400' : 'text-white/60'}>
            Page Direction ({run?.phaseProgress.page_direction || 'pending'})
          </span>
        </div>
      </div>

      {/* Main content scroll area */}
      <div className="flex-grow overflow-y-auto px-6 py-6 space-y-6 max-w-5xl w-full mx-auto">
        
        {/* Soft hint warning of sequence */}
        <div className="text-[11px] bg-sky-950/20 border border-sky-500/10 rounded px-3 py-2 text-sky-300 leading-relaxed">
          💡 <span className="font-semibold">Planning Workflow:</span> Apply environment descriptions first before generating Page Direction so character staging can be correctly grounded on the generated locations.
        </div>

        {/* ── SEQUENTIAL ALL-ISSUES RUNNER STATUS ── */}
        <section className="border border-white/10 rounded-lg bg-white/[0.01] p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <h2 className="text-[13px] font-bold text-white uppercase tracking-wider">
                Pipeline Runner Status
              </h2>
              <p className="text-[10px] text-white/70 mt-1 font-mono">
                Visual Planning sequential pipeline status tracker across all promoted issues.
              </p>
            </div>

            {/* Live line status + Stop controller: */}
            {(!running && !busy) ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={planSelectedIssue}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 transition-colors cursor-pointer"
                >
                  Plan Selected Issue
                </button>
                <button
                  onClick={planAllIssues}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 transition-colors cursor-pointer"
                >
                  Plan All Issues
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-[11px] text-white/90 font-mono bg-black/40 px-3 py-1.5 rounded border border-white/10 shadow-lg">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                <span>
                  {live
                    ? `${live.pass === 'env' ? 'Designing environments' : `Directing ${live.address || 'page'}`}` + (live.total ? ` (${live.index + 1}/${live.total})` : '')
                    : (busy === 'env' ? 'Environment Design…' : (busy === 'page' ? 'Page Direction…' : (busy === 'page-rerun' ? 'Re-running stale…' : 'Starting visual planner...')))}
                </span>
                <button
                  type="button"
                  onClick={stopCurrentRun}
                  className="px-2 py-0.5 text-[10px] font-sans font-bold rounded bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 transition-colors cursor-pointer ml-1.5 animate-pulse"
                >
                  Stop
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {issues.map(iss => {
              const st = issueStatus[iss.uid];
              const isSelected = issueUid === iss.uid;
              return (
                <div
                  key={iss.uid}
                  className={`flex items-center justify-between px-3 py-2.5 border rounded-lg transition-all ${
                    isSelected
                      ? 'border-sky-500/40 bg-sky-500/[0.04]'
                      : 'border-white/5 bg-black/20 hover:border-white/10'
                  }`}
                  onClick={() => !running && setIssueUid(iss.uid)}
                  style={{ cursor: running ? 'default' : 'pointer' }}
                >
                  <span className={`text-xs font-semibold ${isSelected ? 'text-sky-300' : 'text-white/90'}`}>
                    {iss.issueCode} — {iss.title}
                  </span>
                  <span className="flex items-center gap-3 font-mono">
                    <Dot label="env" state={st?.env} />
                    <Dot label="pages" state={st?.page} />
                    {st && st.pagesTotal > 0 && (
                      <span className="text-white/70 text-[10px] font-mono font-bold">
                        {st.pagesDone}/{st.pagesTotal}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PHASE 1: ENVIRONMENT DESIGN ── */}
        <section className="border border-white/10 rounded-lg bg-white/[0.01] p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <h2 className="text-[13px] font-bold text-sky-300 uppercase tracking-wider">
                1 · Environment Design
              </h2>
              <p className="text-[10px] text-white/50 mt-1">
                Generates canonical descriptions and mood properties for all distinct locations in the issue.
              </p>
            </div>
            <button
              disabled={!!busy}
              onClick={() => runPass('env')}
              className="px-3 py-1.5 text-[11px] font-bold rounded bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {busy === 'env' ? 'Designing Environments…' : envRecord ? 'Recheck / Re-run' : 'Run Environment Design'}
            </button>
          </div>

          {envRecord ? (
            <EnvReview
              record={envRecord}
              onEdit={markVpsRecordEdited}
              onApply={() => applyEnv(envRecord)}
              onRefresh={() => run && refreshRecords(run)}
            />
          ) : (
            <div className="text-[11px] font-mono text-white/60 py-3 text-center">
              No environment design records. Click Run Environment Design to analyze settings.
            </div>
          )}
        </section>

        {/* ── PHASE 2: PAGE DIRECTION ── */}
        <section className="border border-white/10 rounded-lg bg-white/[0.01] p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <h2 className="text-[13px] font-bold text-sky-300 uppercase tracking-wider">
                2 · Page Direction
              </h2>
              <p className="text-[10px] text-white/50 mt-1">
                Produces detailed sequential layout directives (camera angles, character blocking, prop listings) page by page.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={!!busy}
                onClick={() => runPass('page')}
                className="px-3 py-1.5 text-[11px] font-bold rounded bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {busy === 'page' ? 'Composing Panels…' : pageRecords.length ? 'Re-run All Pages' : 'Run Page Direction'}
              </button>

              {stalePages.length > 0 && (
                <button
                  disabled={!!busy}
                  onClick={handleReRunStale}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/30 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer animate-pulse"
                >
                  {busy === 'page-rerun' ? 'Re-running stale…' : `Re-run stale pages (${stalePages.length})`}
                </button>
              )}

              {pageRecords.length > 0 && (
                <button
                  onClick={applyAllPages}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors cursor-pointer"
                >
                  Apply All Page Directions ({pagesApplied}/{pageRecords.length})
                </button>
              )}
            </div>
          </div>

          {pageRecords.length > 0 ? (
            <div className="space-y-3">
              {pageRecords.map(rec => (
                <PageReview
                  key={rec.id}
                  record={rec}
                  onApply={() => applyOnePage(rec)}
                  onEdit={markVpsRecordEdited}
                  onRefresh={() => run && refreshRecords(run)}
                />
              ))}
            </div>
          ) : (
            <div className="text-[11px] font-mono text-white/60 py-3 text-center">
              No page direction records. Run Page Direction to synthesize panel plans.
            </div>
          )}
        </section>
      </div>

      {vpsConfirm && (
        <ConfirmModal
          isOpen={vpsConfirm.isOpen}
          title={vpsConfirm.title}
          body={vpsConfirm.body}
          confirmLabel={vpsConfirm.confirmLabel}
          onConfirm={vpsConfirm.onConfirm}
          onCancel={vpsConfirm.onCancel}
        />
      )}
    </div>
  );
}

// ── SUB-COMPONENT: ENVREVIEW ──
interface EnvReviewProps {
  record: VpsRecord;
  onEdit: (id: string, payload: any) => Promise<any>;
  onApply: () => void;
  onRefresh: () => void;
}

function EnvReview({ record, onEdit, onApply, onRefresh }: EnvReviewProps) {
  const { dispatch } = useStore();
  const payload = record.payload as EnvironmentDesignPayload;
  const [draft, setDraft] = useState<EnvironmentDesignPayload>(payload);

  useEffect(() => {
    setDraft(payload);
  }, [record.id, payload]);

  const editDesc = (i: number, v: string) => {
    setDraft(d => {
      const environments = (d.environments || []).map((e, idx) =>
        idx === i ? { ...e, visualDescription: v } : e
      );
      return { ...d, environments };
    });
  };

  const saveEdits = async () => {
    console.info('[UI_CLICK]', {
      action: 'Save Environment Descriptions Edits',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy: null,
      selectedIssueUid: null,
      hasCurrentShow: true,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_se_enter', type: 'info', message: 'Clicked Save descriptions edits' }
    });
    console.info('[HANDLER_ENTER]', 'Save Environment Descriptions Edits');

    try {
      await onEdit(record.id, draft);
      onRefresh();
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_se_success',
          type: 'success',
          message: 'Saved environment descriptions edits successfully.'
        }
      });
      console.info('[HANDLER_SUCCESS]', 'Save Environment Descriptions Edits');
    } catch (e: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_se_err',
          type: 'error',
          message: `Failed to save visual description edits: ${e.message || String(e)}`
        }
      });
      console.error('[HANDLER_FAIL]', 'Save Environment Descriptions Edits', e);
    }
  };

  const environments = draft.environments || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {environments.map((env, i) => (
          <div key={i} className="bg-black/40 border border-white/5 rounded-lg p-3 space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-white tracking-wide">
                  {env.settingName}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-sm uppercase tracking-widest font-mono font-bold ` +
                  (env.source === 'reused'
                    ? 'text-amber-400 bg-amber-400/5 border border-amber-400/10'
                    : 'text-emerald-400 bg-emerald-400/5 border border-emerald-400/10')}>
                  {env.source}
                </span>
              </div>
              <textarea
                value={env.visualDescription || ''}
                onChange={e => editDesc(i, e.target.value)}
                disabled={env.source === 'reused'}
                rows={4}
                placeholder="Enter visual generation description..."
                className="w-full bg-black/50 border border-white/10 rounded p-2 text-[11px] text-white/80 leading-relaxed focus:outline-none focus:border-sky-500/40 disabled:opacity-50"
              />
            </div>
            <div className="text-[10px] text-white/60 font-mono pt-1">
              📌 {env.mood || 'neutral'} · {env.interiorExterior || 'interior'}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={saveEdits}
          className="px-3 py-1 text-[10px] uppercase font-bold rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
        >
          Save descriptions edits
        </button>
        <button
          onClick={() => {
            console.info('[UI_CLICK]', {
              action: 'Apply Environments',
              timestamp: new Date().toISOString(),
              disabled: false,
              busy: null,
              selectedIssueUid: null,
              hasCurrentShow: true,
            });
            console.info('[HANDLER_ENTER]', 'Apply Environments');
            onApply();
          }}
          className="px-3 py-1 text-[10px] uppercase font-bold rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors cursor-pointer"
        >
          {record.applied ? 'Re-apply environments' : 'Apply environments'}
        </button>
        {record.applied && (
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider inline-flex items-center gap-1 font-mono">
            ● Applied
          </span>
        )}
      </div>
    </div>
  );
}

// ── SUB-COMPONENT: PAGEREVIEW ──
interface PageReviewProps {
  record: VpsRecord;
  onApply: () => void;
  onEdit: (id: string, payload: any) => Promise<any>;
  onRefresh: () => void;
}

function PageReview({ record, onApply, onEdit, onRefresh }: PageReviewProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const pd = record.payload as PageDirectionPayload;

  const [draft, setDraft] = useState<PageDirectionPayload>(() => {
    const raw = record.payload as PageDirectionPayload;
    return {
      ...raw,
      pageComposition: raw.pageComposition || {
        layoutName: raw.panels?.length === 1 ? 'SPLASH' : (raw.panels?.length === 2 ? 'EQUAL_CONFRONTATION' : (raw.panels?.length === 3 ? 'DIALOGUE_ROW' : 'FOUR-PANEL 2x2 GRID')),
        focalPanelIndex: 0,
        isSplash: raw.panels?.length === 1,
        compositionNote: ''
      }
    };
  });

  useEffect(() => {
    const raw = record.payload as PageDirectionPayload;
    setDraft({
      ...raw,
      pageComposition: raw.pageComposition || {
        layoutName: raw.panels?.length === 1 ? 'SPLASH' : (raw.panels?.length === 2 ? 'EQUAL_CONFRONTATION' : (raw.panels?.length === 3 ? 'DIALOGUE_ROW' : 'FOUR-PANEL 2x2 GRID')),
        focalPanelIndex: 0,
        isSplash: raw.panels?.length === 1,
        compositionNote: ''
      }
    });
  }, [record.id, record.payload]);

  const setPanel = (i: number, patch: any) => setDraft(d => ({
    ...d, panels: d.panels.map((pl, idx) =>
      idx === i ? { ...pl, ...patch } : pl) }));

  const setBlock = (pi: number, bi: number, patch: any) =>
    setDraft(d => ({ ...d, panels: d.panels.map((pl, idx) =>
      idx !== pi ? pl : { ...pl, blocking: pl.blocking.map((b, j) =>
        j === bi ? { ...b, ...patch } : b) }) }));

  const setRegister = (patch: any) => setDraft(d => ({
    ...d, pageRegister: { ...d.pageRegister, ...patch } }));

  const setComposition = (patch: any) => setDraft(d => ({
    ...d, pageComposition: { ...d.pageComposition, ...patch } }));

  const { dispatch } = useStore();

  const save = async () => {
    console.info('[UI_CLICK]', {
      action: 'Save Page Direction Edits',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy: null,
      selectedIssueUid: null,
      hasCurrentShow: true,
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now() + '_pds_enter', type: 'info', message: 'Clicked Save Page Direction' }
    });
    console.info('[HANDLER_ENTER]', 'Save Page Direction Edits');

    try {
      await onEdit(record.id, draft);
      setEditing(false);
      onRefresh();
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_pds_success',
          type: 'success',
          message: 'Saved page direction edits successfully.'
        }
      });
      console.info('[HANDLER_SUCCESS]', 'Save Page Direction Edits');
    } catch (e: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now() + '_pds_err',
          type: 'error',
          message: `Failed to save page direction edits: ${e.message || String(e)}`
        }
      });
      console.error('[HANDLER_FAIL]', 'Save Page Direction Edits', e);
    }
  };

  const cancel = () => {
    console.info('[UI_CLICK]', {
      action: 'Cancel Page Direction Edits',
      timestamp: new Date().toISOString(),
      disabled: false,
      busy: null,
      selectedIssueUid: null,
      hasCurrentShow: true,
    });
    console.info('[HANDLER_ENTER]', 'Cancel Page Direction Edits');

    const raw = record.payload as PageDirectionPayload;
    setDraft({
      ...raw,
      pageComposition: raw.pageComposition || {
        layoutName: raw.panels?.length === 1 ? 'SPLASH' : (raw.panels?.length === 2 ? 'EQUAL_CONFRONTATION' : (raw.panels?.length === 3 ? 'DIALOGUE_ROW' : 'FOUR-PANEL 2x2 GRID')),
        focalPanelIndex: 0,
        isSplash: raw.panels?.length === 1,
        compositionNote: ''
      }
    });
    setEditing(false);
    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: Date.now() + '_pdc_cancel',
        type: 'info',
        message: 'Editing page direction cancelled.'
      }
    });
    console.info('[HANDLER_SUCCESS]', 'Cancel Page Direction Edits');
  };

  const panels = editing ? (draft.panels || []) : (pd?.panels || []);
  const directCount = panels.filter(p => p.directAddress).length;
  const count = draft.panels?.length || 1;

  const getLayoutOptionsByCount = (c: number): string[] => {
    if (c === 1) return ['SPLASH', 'SINGLE PANEL', 'FULL_PAGE_COMPOSITE'];
    if (c === 2) return ['WIDE_TIGHT', 'EQUAL_CONFRONTATION', 'CINEMATIC_STRIP', 'ASYMMETRIC_WEIGHT', 'TIGHT_WIDE', 'TWO-PANEL VERTICAL SPLIT', 'TWO-PANEL EQUAL STACK', 'TWO-PANEL CINEMATIC', 'TWO-PANEL ASYMMETRIC'];
    if (c === 3) return ['ACTION_SEQUENCE', 'DIALOGUE_ROW', 'FEATURE_DETAIL', 'ESCALATION', 'TRIPTYCH_H', 'TRIPTYCH_V', 'WIDE_SPLIT', 'SPLIT_WIDE', 'THREE-PANEL SEQUENCE', 'THREE-PANEL FOCUS', 'THREE-PANEL ESCALATION'];
    if (c === 4) return ['GRID_2x2', 'FEATURE_STRIP', 'MAGAZINE', 'FOUR-PANEL 2x2 GRID', 'FOUR-PANEL FEATURE'];
    return ['SPLASH'];
  };

  const options = [...getLayoutOptionsByCount(count)];
  const currentLayoutName = draft.pageComposition?.layoutName;
  if (currentLayoutName && !options.includes(currentLayoutName)) {
    options.push(currentLayoutName);
  }

  return (
    <div className="border border-white/5 bg-black/20 rounded-lg overflow-hidden">
      <button
        onClick={() => {
          console.info('[UI_CLICK]', {
            action: 'Toggle Page Review Expansion',
            timestamp: new Date().toISOString(),
            disabled: false,
            busy: null,
            selectedIssueUid: null,
            hasCurrentShow: true,
          });
          setOpen(o => !o);
        }}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-[11px] font-semibold text-white/80 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-white/50">{open ? '▼' : '▶'}</span>
          <span>
            Page Beat <code className="text-[10px] font-mono text-sky-300 ml-1">({record.scopeKey?.substring(0, 8)})</code>
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/10"></span>
          <span className="text-white/60">{panels.length} panel{panels.length !== 1 ? 's' : ''}</span>
          {directCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase tracking-wider font-bold text-amber-400">
              {directCount} direct-address
            </span>
          )}
          {record.authorEdited && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] uppercase tracking-wider font-bold text-amber-400">
              edited
            </span>
          )}
          {record.stale && (
            <span className="px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-[10px] uppercase tracking-wider font-bold text-amber-300">
              stale · {record.staleReason || 'content-changed'}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3">
          {record.applied && (
            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-emerald-400">
              applied
            </span>
          )}
          <span
            onClick={e => {
              e.stopPropagation();
              console.info('[UI_CLICK]', {
                action: 'Apply Single Page Direction Button',
                timestamp: new Date().toISOString(),
                disabled: false,
                busy: null,
                selectedIssueUid: null,
                hasCurrentShow: true,
              });
              console.info('[HANDLER_ENTER]', 'Apply Single Page Direction Button');
              onApply();
            }}
            className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 cursor-pointer transition-colors"
          >
            {record.applied ? 're-apply' : 'apply'}
          </span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-4 space-y-4 bg-black/40 border-t border-white/[0.02]">
          {/* Header toolbar for saving and editing */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
              {editing ? 'Editing Page Direction Draft' : 'Page Direction Review'}
            </span>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={save}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 cursor-pointer transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancel}
                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    console.info('[UI_CLICK]', {
                      action: 'Edit Page Direction',
                      timestamp: new Date().toISOString(),
                      disabled: false,
                      busy: null,
                      selectedIssueUid: null,
                      hasCurrentShow: true,
                    });
                    console.info('[HANDLER_ENTER]', 'Edit Page Direction');
                    setEditing(true);
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {editing ? (
            /* EDIT MODE */
            <div className="space-y-4">
              {/* Page registers edit */}
              <div className="space-y-3 p-3 bg-white/[0.02] border border-white/5 rounded">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Page Register:</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase">Lighting</label>
                    <input
                      type="text"
                      value={draft.pageRegister?.lighting || ''}
                      onChange={e => setRegister({ lighting: e.target.value })}
                      className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase">Mood</label>
                    <input
                      type="text"
                      value={draft.pageRegister?.mood || ''}
                      onChange={e => setRegister({ mood: e.target.value })}
                      className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase">Emotional Register</label>
                    <input
                      type="text"
                      value={draft.pageRegister?.emotionalRegister || ''}
                      onChange={e => setRegister({ emotionalRegister: e.target.value })}
                      className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase">Env Detail</label>
                    <select
                      value={draft.pageRegister?.environmentalDetail || 'moderate'}
                      onChange={e => setRegister({ environmentalDetail: e.target.value })}
                      className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none focus:border-sky-500/50 cursor-pointer"
                    >
                      <option value="sparse">Sparse</option>
                      <option value="moderate">Moderate</option>
                      <option value="rich">Rich</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Page composition edit */}
              <div className="space-y-3 p-3 bg-white/[0.02] border border-white/5 rounded">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Page Composition:</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase">Layout Name</label>
                    <select
                      value={draft.pageComposition?.layoutName || ''}
                      onChange={e => setComposition({ layoutName: e.target.value })}
                      className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none focus:border-sky-500/50 cursor-pointer"
                    >
                      {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase">Focal Panel</label>
                    <select
                      value={draft.pageComposition?.focalPanelIndex ?? 0}
                      onChange={e => setComposition({ focalPanelIndex: parseInt(e.target.value, 10) })}
                      className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none focus:border-sky-500/50 cursor-pointer"
                    >
                      {Array.from({ length: count }).map((_, idx) => (
                        <option key={idx} value={idx}>Panel {idx + 1}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      id={`isSplash-${record.id}`}
                      type="checkbox"
                      checked={draft.pageComposition?.isSplash || false}
                      onChange={e => setComposition({ isSplash: e.target.checked })}
                      className="w-4 h-4 bg-[#121316] border border-white/15 text-sky-500 rounded focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor={`isSplash-${record.id}`} className="text-[10px] font-bold text-white/60 uppercase cursor-pointer select-none">
                      Is Splash Page
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/60 uppercase">Composition Note</label>
                    <input
                      type="text"
                      value={draft.pageComposition?.compositionNote || ''}
                      onChange={e => setComposition({ compositionNote: e.target.value })}
                      className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Panels edit */}
              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Panels:</div>
                {draft.panels.map((pl, i) => (
                  <div key={i} className="bg-white/[0.015] border border-white/5 rounded p-3 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                      <span className="text-xs font-bold text-sky-300 uppercase tracking-wide">
                        Panel {i + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <input
                            id={`direct-address-${record.id}-${i}`}
                            type="checkbox"
                            checked={pl.directAddress || false}
                            onChange={e => setPanel(i, { directAddress: e.target.checked })}
                            className="w-3.5 h-3.5"
                          />
                          <label htmlFor={`direct-address-${record.id}-${i}`} className="text-[10px] font-bold uppercase tracking-wider text-white/60 cursor-pointer">
                            Direct Address
                          </label>
                        </div>
                        {pl.directAddress && (
                          <input
                            type="text"
                            placeholder="Direct address rationale..."
                            value={pl.directAddressRationale || ''}
                            onChange={e => setPanel(i, { directAddressRationale: e.target.value })}
                            className="bg-[#121316] border border-white/15 text-white rounded p-0.5 px-1 text-[10px] focus:outline-none focus:border-sky-500/50"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-white/60 uppercase">Shot Type</label>
                        <input
                          type="text"
                          value={pl.shotType || ''}
                          onChange={e => setPanel(i, { shotType: e.target.value })}
                          className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-white/60 uppercase">Action Description</label>
                        <textarea
                          value={pl.action || ''}
                          onChange={e => setPanel(i, { action: e.target.value })}
                          rows={2}
                          className="w-full bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-white/60 uppercase">Relational Staging</label>
                        <textarea
                          value={pl.relationalStaging || ''}
                          onChange={e => setPanel(i, { relationalStaging: e.target.value })}
                          rows={2}
                          className="w-full bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-white/60 uppercase">Foreground</label>
                          <input
                            type="text"
                            value={pl.foreground || ''}
                            onChange={e => setPanel(i, { foreground: e.target.value })}
                            className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-white/60 uppercase">Midground</label>
                          <input
                            type="text"
                            value={pl.midground || ''}
                            onChange={e => setPanel(i, { midground: e.target.value })}
                            className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-white/60 uppercase">Background</label>
                          <input
                            type="text"
                            value={pl.background || ''}
                            onChange={e => setPanel(i, { background: e.target.value })}
                            className="bg-[#121316] border border-white/15 text-white rounded p-1 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* dialogue list & caption list indexes read-only info */}
                    <div className="text-[10px] font-mono text-white/60 bg-white/[0.02] border border-white/5 rounded p-1.5 flex flex-col gap-0.5">
                      <div>
                        <span className="text-white/60 font-semibold uppercase">Dialogue indices:</span>{' '}
                        {pl.dialogueIndices && pl.dialogueIndices.length > 0 ? `[${pl.dialogueIndices.join(', ')}]` : 'none'}
                      </div>
                      <div>
                        <span className="text-white/60 font-semibold uppercase">Caption indices:</span>{' '}
                        {pl.captionIndices && pl.captionIndices.length > 0 ? `[${pl.captionIndices.join(', ')}]` : 'none'}
                      </div>
                      <div className="text-[9px] text-amber-300 font-sans mt-1 select-none leading-relaxed">
                        ⚠️ Dialogue/Caption allocation indices are locked and cannot be edited manually to preserve dialogue script integrity. Re-run Page Direction if you need to re-allocate dialogues.
                      </div>
                    </div>

                    {/* Character blocking edit */}
                    {pl.blocking && pl.blocking.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Character Blocking:</div>
                        <div className="grid grid-cols-1 gap-2">
                          {pl.blocking.map((b, bIdx) => (
                            <div key={bIdx} className="bg-black/20 border border-white/5 rounded p-2 text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sky-400">{b.handle}</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-white/50 uppercase">Zone:</span>
                                    <select
                                      value={b.zone || 'middle-center'}
                                      onChange={e => setBlock(i, bIdx, { zone: e.target.value })}
                                      className="bg-[#121316] border border-white/15 text-white rounded text-[10px] p-0.5 focus:outline-none cursor-pointer"
                                    >
                                      {['top-left','top-center','top-right',
                                        'middle-left','middle-center','middle-right',
                                        'bottom-left','bottom-center','bottom-right'].map(z => (
                                        <option key={z} value={z}>{z}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-white/50 uppercase">Depth:</span>
                                    <select
                                      value={b.depth || 'midground'}
                                      onChange={e => setBlock(i, bIdx, { depth: e.target.value })}
                                      className="bg-[#121316] border border-white/15 text-white rounded text-[10px] p-0.5 focus:outline-none cursor-pointer"
                                    >
                                      {['foreground', 'midground', 'background'].map(d => (
                                        <option key={d} value={d}>{d}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-white/50 uppercase font-mono text-[9px]">Facing</span>
                                  <input
                                    type="text"
                                    value={b.facing || ''}
                                    onChange={e => setBlock(i, bIdx, { facing: e.target.value })}
                                    className="bg-[#121316] border border-white/15 text-white rounded p-0.5 px-1 text-[10px] focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-white/50 uppercase font-mono text-[9px]">Facial Expression</span>
                                  <input
                                    type="text"
                                    value={b.facialExpression || ''}
                                    onChange={e => setBlock(i, bIdx, { facialExpression: e.target.value })}
                                    className="bg-[#121316] border border-white/15 text-white rounded p-0.5 px-1 text-[10px] focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-white/50 uppercase font-mono text-[9px]">Body Language</span>
                                  <input
                                    type="text"
                                    value={b.bodyLanguage || ''}
                                    onChange={e => setBlock(i, bIdx, { bodyLanguage: e.target.value })}
                                    className="bg-[#121316] border border-white/15 text-white rounded p-0.5 px-1 text-[10px] focus:outline-none"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-white/50 uppercase font-mono text-[9px]">In Response To</span>
                                  <input
                                    type="text"
                                    value={b.inResponseTo || ''}
                                    onChange={e => setBlock(i, bIdx, { inResponseTo: e.target.value })}
                                    className="bg-[#121316] border border-white/15 text-white rounded p-0.5 px-1 text-[10px] focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* VIEW MODE (ORIGINAL STATIC OR EXPANDED VERSION) */
            <>
              {/* Page registers */}
              <div className="flex flex-wrap gap-4 p-2 bg-white/[0.01] rounded border border-white/5 text-[10px] font-mono text-white/70">
                <div><span className="text-white/60">LIGHTING:</span> {pd.pageRegister?.lighting || 'default'}</div>
                <div><span className="text-white/60">MOOD:</span> {pd.pageRegister?.mood || 'default'}</div>
                <div><span className="text-white/60">EMOTIONAL REGISTER:</span> {pd.pageRegister?.emotionalRegister || 'default'}</div>
                <div><span className="text-white/60">ENVIRONMENT DETAIL:</span> {pd.pageRegister?.environmentalDetail || 'default'}</div>
              </div>

              {/* Page composition */}
              <div className="flex flex-wrap gap-4 p-2 bg-white/[0.01] rounded border border-white/5 text-[10px] font-mono text-white/70">
                <div><span className="text-white/60">LAYOUT:</span> {pd.pageComposition?.layoutName || 'SPLASH'}</div>
                <div><span className="text-white/60">FOCAL PANEL:</span> Panel {(pd.pageComposition?.focalPanelIndex ?? 0) + 1}</div>
                <div><span className="text-white/60">IS SPLASH:</span> {pd.pageComposition?.isSplash ? 'YES' : 'NO'}</div>
                {pd.pageComposition?.compositionNote && (
                  <div><span className="text-white/60">COMPOSITION NOTE:</span> {pd.pageComposition.compositionNote}</div>
                )}
              </div>

              {/* Panels */}
              <div className="space-y-2">
                {panels.map((pl, i) => (
                  <div key={i} className="bg-white/[0.015] hover:bg-white/[0.03] transition-colors border border-white/5 rounded p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-white/90">
                        Panel {i + 1} · <span className="text-sky-300 font-mono uppercase text-[10px]">{pl.shotType || 'medium'}</span>
                      </div>
                      {pl.directAddress && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/5 border border-amber-400/10 px-1 rounded-sm">
                          direct address
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-white/70 leading-relaxed font-sans">
                      {pl.action}
                    </div>

                    {pl.relationalStaging && (
                      <div className="text-[10px] text-sky-200/70 leading-relaxed">
                        <span className="font-bold text-sky-400/70 font-mono text-[10px] uppercase">Staging:</span> {pl.relationalStaging}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-[10px] text-white/60 pt-1 border-t border-white/[0.02]">
                      <div><span className="font-bold uppercase tracking-wider text-white/60">FG:</span> {pl.foreground || 'none'}</div>
                      <div><span className="font-bold uppercase tracking-wider text-white/60">MG:</span> {pl.midground || 'none'}</div>
                      <div><span className="font-bold uppercase tracking-wider text-white/60">BG:</span> {pl.background || 'none'}</div>
                    </div>

                    {/* blocking list */}
                    {pl.blocking && pl.blocking.length > 0 && (
                      <div className="pt-2 space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Character Blocking:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {pl.blocking.map((b, bIdx) => (
                            <div key={bIdx} className="bg-white/[0.01] rounded px-2 py-1 text-[10px] text-white/70 border border-white/[0.02]">
                              <span className="font-bold text-sky-300/80">{b.handle}</span> → <span className="font-mono text-[10px] text-white/60">{b.zone} ({b.depth})</span>
                              <div className="text-[10px] leading-tight text-white/60 mt-0.5">
                                <i>{b.facialExpression}</i> ({b.bodyLanguage})
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
