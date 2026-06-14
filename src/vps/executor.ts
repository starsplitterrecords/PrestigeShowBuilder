import { openDB } from '../storage/db';
import { VaultStorage } from '../storage/VaultStorage';
import {
  VpsRun, VpsRecord, VpsRecordType
} from './types';
import { VPS_PASSES } from './registry';
import { getVpsPrompt } from './prompts';
import { getVpsParser } from './parsers';
import {
  updateVpsRunPhase, writeVpsRecord, getVpsRecord
} from './storage';
import { callGemini } from '../psb4/console';
import { ConversationTurn } from '../psb4/types';
import { resolveCharacter } from '../domainUtils';
import { ProductionScene, PageBeat } from '../types/production';
import { UID } from '../types/production';
import { envRegisterGuidance, pageRegisterGuidance } from './registerGuidance';

// The scene's environment description, from the applied anchor.
function resolveSceneEnvironment(
  scene: ProductionScene, anchors: any[]
): string {
  const a = scene.settingAnchorId
    ? anchors.find(x => x.id === scene.settingAnchorId)
    : anchors.find(x =>
        x.name?.toLowerCase() === (scene.setting ?? '').toLowerCase());
  return a?.visualDescription || a?.physicalDescription || '';
}

// Re-derive a compact history turn from an already-edited record so
// later pages in the scene still 'see' it without re-calling.
function appendPageHistory(
  history: ConversationTurn[], rec: VpsRecord
): ConversationTurn[] {
  const pd = rec.payload;
  if (!pd || !pd.panels) return history;
  const summary = pd.panels.map((pl: any, i: number) =>
    `panel ${i + 1}: ${pl.shotType || ''} — ${pl.action || ''}`).join('; ');
  return [
    ...history,
    { role: 'user', parts: [{ text: '(prior page, author-edited)' }] },
    { role: 'model', parts: [{ text: summary }] },
  ];
}

// Per-page context drawn entirely from the promoted contract.
function assemblePageSlots(
  pb: PageBeat, scene: ProductionScene,
  envDesc: string, show: any
): Record<string, string> {
  // Characters present, with their visual anchors for grounding.
  const chars = (pb.characterIds ?? [])
    .map(id => resolveCharacter(show, id))
    .filter(Boolean)
    .map((c: any) =>
      `${c.handle || c.name} (${c.name}): ` +
      `${c.visualAnchor || c.physicalDescription || c.role || ''}`)
    .join('\n');

  // The dialogue/captions on this page, indexed so the director can
  // allocate each to a panel by index.
  const entries = pb.script?.entries ?? [];
  const scriptBlock = entries.map((e: any, i: number) => {
    const isCap = e.kind === 'caption';
    const who = isCap ? 'CAPTION'
      : (e.characterHandle || 'UNKNOWN');
    return `[${i}] ${who}: ${e.text ?? ''}`;
  }).join('\n');

  return {
    PAGE_ADDRESS: pb.address,
    BEAT_TYPE: pb.beatType,
    BEAT_DESCRIPTION: pb.description ?? '',
    SUBTEXT: pb.subtext ?? '',
    AUTHOR_VISUAL_NOTE: pb.visualNote ?? '',
    AUTHOR_DIRECTION: pb.direction ?? '',
    SCENE_CONTEXT:
      `Scene ${scene.number}: ${scene.title}. ` +
      `Want: ${scene.dramaticWant}. Function: ${scene.sceneFunction}.`,
    ENVIRONMENT: envDesc || '(environment not yet specified)',
    CHARACTERS_PRESENT: chars || '(none listed)',
    SCRIPT_BLOCK: scriptBlock || '(silent page — no dialogue)',
    PANEL_COUNT_HINT: pb.panelCountOverride
      ? String(pb.panelCountOverride) : '',
    REGISTER_GUIDANCE: pageRegisterGuidance(show.register),
  };
}

export interface VpsProgress {
  issueUid: string;
  pass: 'env' | 'page';
  phase: 'running' | 'page-done' | 'env-done' | 'error';
  scopeKey?: string | null;   // ProductionPage uid for page steps
  address?: string;           // PageBeat.address, for display
  index: number;              // 0-based position within the pass
  total: number;              // total units in this pass
  recordId?: string;          // id of the record just written
  error?: string;
}

export async function runVpsPass(
  runIdOrRun: string | VpsRun,
  passId: string,
  showOrOptions?: any,
  optionsParam?: {
    forceRegenerate?: boolean;
    modelOverride?: string;
    onProgress?: (ev: VpsProgress) => void;
    signal?: AbortSignal;
  }
): Promise<{ success: boolean; records: number; error?: string }> {
  let showRef: any = null;
  let options: {
    forceRegenerate?: boolean;
    modelOverride?: string;
    onProgress?: (ev: VpsProgress) => void;
    signal?: AbortSignal;
  } = {};

  if (showOrOptions && (showOrOptions.issues || typeof showOrOptions.id === 'string')) {
    showRef = showOrOptions;
    options = optionsParam || {};
  } else if (showOrOptions) {
    options = showOrOptions;
  }

  const runId = typeof runIdOrRun === 'string' ? runIdOrRun : runIdOrRun.id;
  const dbLocal = await openDB();
  const run = await new Promise<VpsRun | null>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_runs', 'readonly');
    const store = tx.objectStore('vps_runs');
    const req = store.get(runId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!run) {
    return { success: false, records: 0, error: `Run ${runId} not found` };
  }

  const spec = VPS_PASSES[passId];
  if (!spec) {
    return { success: false, records: 0, error: `Pass ${passId} not registered in VPS` };
  }

  // Load show and find active promoted issue
  const show = showRef || await VaultStorage.getById(run.showId);
  if (!show) {
    return { success: false, records: 0, error: `Show ${run.showId} not found` };
  }

  const issue = (show.issues ?? []).find((i: any) => i.uid === run.issueUid);
  if (!issue) {
    return { success: false, records: 0, error: `Issue ${run.issueUid} not found inside show` };
  }

  const template = getVpsPrompt(spec.promptTemplateId);
  if (!template) {
    return { success: false, records: 0, error: `Prompt template ${spec.promptTemplateId} not found` };
  }

  const parser = getVpsParser(spec.parserId);
  if (!parser) {
    return { success: false, records: 0, error: `Parser ${spec.parserId} not found` };
  }

  const model = options.modelOverride || spec.defaultModel;

  // ---- ISSUE SCOPE (DA-040) -------------------------------------------
  if (spec.scope === 'issue') {
    await updateVpsRunPhase(run.id, {
      currentPass: spec.id,
      currentPhase: spec.phase,
      phaseProgress: {
        ...run.phaseProgress,
        [spec.phase!]: 'running',
      } as any,
    });

    options.onProgress?.({
      issueUid: issue.uid,
      pass: 'env',
      phase: 'running',
      scopeKey: null,
      address: 'Environment',
      index: 0,
      total: 1,
    });

    const distinctSettingsMap = new Map<string, { settingName: string; settingAnchorId?: string }>();
    for (const act of issue.acts) {
      for (const scene of act.scenes) {
        const settingName = scene.setting || '';
        if (!settingName) continue;
        const key = settingName.toLowerCase().trim();
        if (!distinctSettingsMap.has(key)) {
          distinctSettingsMap.set(key, {
            settingName,
            settingAnchorId: scene.settingAnchorId,
          });
        }
      }
    }
    const settingsArray = Array.from(distinctSettingsMap.values());
    const settingsText = settingsArray.map((s: any) => `- Name: "${s.settingName}"${s.settingAnchorId ? ` (Anchor ID: ${s.settingAnchorId})` : ''}`).join('\n');

    const slots = {
      SETTINGS_LIST: settingsText,
      REGISTER_GUIDANCE: envRegisterGuidance(show.register),
    };

    const promptText = template.render(slots);
    let parsed: any = null, lastErr = '', raw = '';

    for (let a = 0; a < 3 && !parsed; a++) {
      if (options.signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      try {
        const resp = await callGemini({
          model,
          temperature: spec.defaultTemperature,
          prompt: promptText,
        });
        raw = resp.text;
        const r = parser.parse(raw);
        if (r.ok === false) {
          throw new Error(r.error);
        }
        parsed = r.payload;
      } catch (e: any) {
        if (e.name === 'AbortError' || e.message === 'AbortError') {
          throw e;
        }
        lastErr = e instanceof Error ? e.message : String(e);
        await new Promise(res => setTimeout(res, 600));
      }
    }

    if (!parsed) {
      await updateVpsRunPhase(run.id, {
        phaseProgress: {
          ...run.phaseProgress,
          [spec.phase!]: 'failed',
        } as any,
      });
      options.onProgress?.({
        issueUid: issue.uid,
        pass: 'env',
        phase: 'error',
        scopeKey: null,
        address: 'Environment',
        index: 0,
        total: 1,
        error: `VPS env fail: ${lastErr}`,
      });
      return { success: false, records: 0, error: `VPS env fail: ${lastErr}` };
    }

    const writtenRecord = await writeVpsRecord({
      runId: run.id,
      showId: show.id,
      issueUid: issue.uid,
      recordType: spec.outputRecordType,
      scopeKey: null,
      payload: parsed,
      payloadVersion: spec.outputPayloadVersion,
      createdByPass: spec.id,
      consoleEntryId: null,
    });

    await updateVpsRunPhase(run.id, {
      phaseProgress: {
        ...run.phaseProgress,
        [spec.phase!]: 'complete',
      } as any,
    });

    options.onProgress?.({
      issueUid: issue.uid,
      pass: 'env',
      phase: 'env-done',
      scopeKey: null,
      address: 'Environment',
      index: 0,
      total: 1,
      recordId: writtenRecord.id,
    });

    return { success: true, records: 1 };
  }

  // ---- PAGE SCOPE (DA-041) --------------------------------------------
  if (spec.scope === 'page') {
    await updateVpsRunPhase(run.id, {
      currentPass: spec.id,
      currentPhase: spec.phase,
      phaseProgress: {
        ...run.phaseProgress,
        [spec.phase!]: 'running',
      } as any,
    });

    const anchors = (show as any).settingAnchors ?? [];
    let written = 0;

    const total = issue.acts
      .flatMap((a: any) => a.scenes)
      .flatMap((s: any) => s.pageBeats)
      .filter((pb: any) => pb.productionPageUid).length;
    let index = 0;

    for (const act of issue.acts) {
      for (const scene of act.scenes) {
        let history: ConversationTurn[] = [];
        const envDesc = resolveSceneEnvironment(scene, anchors);

        for (const pb of scene.pageBeats) {
          if (options.signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
          }
          const pageUid = pb.productionPageUid;
          if (!pageUid) continue;

          const prior = await getVpsRecord(
            run.id, spec.outputRecordType, pageUid);
          if (prior && !options.forceRegenerate && (prior.applied || (prior.authorEdited && !prior.applied))) {
            history = appendPageHistory(history, prior);
            index++;
            continue;
          }

          options.onProgress?.({
            issueUid: issue.uid,
            pass: 'page',
            phase: 'running',
            scopeKey: pageUid,
            address: pb.address,
            index,
            total,
          });

          const slots = assemblePageSlots(
            pb, scene, envDesc, show);
          const promptText = template.render(slots);

          let parsed: any = null, lastErr = '', raw = '';
          for (let a = 0; a < 3 && !parsed; a++) {
            if (options.signal?.aborted) {
              throw new DOMException('The user aborted a request.', 'AbortError');
            }
            try {
              const resp = await callGemini({
                model,
                temperature: spec.defaultTemperature,
                prompt: promptText,
                history,
              });
              raw = resp.text;
              const r = parser.parse(raw);
              if (r.ok === false) throw new Error(r.error);
              parsed = r.payload;
            } catch (e: any) {
              if (e.name === 'AbortError' || e.message === 'AbortError') {
                throw e;
              }
              lastErr = e instanceof Error ? e.message : String(e);
              await new Promise(res => setTimeout(res, 600));
            }
          }
          if (!parsed) {
            await updateVpsRunPhase(run.id, {
              phaseProgress: {
                ...run.phaseProgress,
                [spec.phase!]: 'failed',
              } as any,
            });
            options.onProgress?.({
              issueUid: issue.uid,
              pass: 'page',
              phase: 'error',
              scopeKey: pageUid,
              address: pb.address,
              index,
              total,
              error: `VPS page ${pb.address} failed: ${lastErr}`,
            });
            return {
              success: false,
              records: written,
              error: `VPS page ${pb.address} failed: ${lastErr}`,
            };
          }

          const writtenRec = await writeVpsRecord({
            runId: run.id,
            showId: show.id,
            issueUid: issue.uid,
            recordType: spec.outputRecordType,
            scopeKey: pageUid,
            payload: parsed,
            payloadVersion: spec.outputPayloadVersion,
            createdByPass: spec.id,
            consoleEntryId: null,
          });
          written++;

          const summary = (parsed.panels ?? []).map((pl: any, n: number) =>
            `panel ${n + 1}: ${pl.shotType || ''} — ${pl.action || ''}` +
            (pl.relationalStaging ? ` [${pl.relationalStaging}]` : '')
          ).join('; ');

          history = [
            ...history,
            { role: 'user', parts: [{ text: `Directed page ${pb.address}.` }] },
            { role: 'model', parts: [{ text: summary }] },
          ];

          options.onProgress?.({
            issueUid: issue.uid,
            pass: 'page',
            phase: 'page-done',
            scopeKey: pageUid,
            address: pb.address,
            index: index++,
            total,
            recordId: writtenRec.id,
          });
        }
      }
    }

    await updateVpsRunPhase(run.id, {
      phaseProgress: {
        ...run.phaseProgress,
        [spec.phase!]: 'complete',
      } as any,
    });
    return { success: true, records: written };
  }

  return { success: false, records: 0,
    error: `Unknown scope ${spec.scope}` };
}

export async function runVpsPassForPage(
  runId: string,
  pageUid: string,
  options: { modelOverride?: string; signal?: AbortSignal } = {}
): Promise<{ success: boolean; records: number; error?: string }> {
  const dbLocal = await openDB();
  const run = await new Promise<VpsRun | null>((resolve, reject) => {
    const tx = dbLocal.transaction('vps_runs', 'readonly');
    const store = tx.objectStore('vps_runs');
    const req = store.get(runId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!run) {
    return { success: false, records: 0, error: `Run ${runId} not found` };
  }

  // Page pass spec is always 'page'
  const spec = VPS_PASSES['page'];
  if (!spec) {
    return { success: false, records: 0, error: `Page pass 'page' not registered in VPS` };
  }

  const show = await VaultStorage.getById(run.showId);
  if (!show) {
    return { success: false, records: 0, error: `Show ${run.showId} not found` };
  }

  const issue = (show.issues ?? []).find(i => i.uid === run.issueUid);
  if (!issue) {
    return { success: false, records: 0, error: `Issue ${run.issueUid} not found inside show` };
  }

  const template = getVpsPrompt(spec.promptTemplateId);
  if (!template) {
    return { success: false, records: 0, error: `Prompt template ${spec.promptTemplateId} not found` };
  }

  const parser = getVpsParser(spec.parserId);
  if (!parser) {
    return { success: false, records: 0, error: `Parser ${spec.parserId} not found` };
  }

  const model = options.modelOverride || spec.defaultModel;
  const anchors = (show as any).settingAnchors ?? [];

  // Find the PageBeat and ProductionScene
  let targetPb: PageBeat | null = null;
  let targetScene: ProductionScene | null = null;

  for (const act of issue.acts) {
    for (const scene of act.scenes) {
      const pb = scene.pageBeats.find(p => p.productionPageUid === pageUid);
      if (pb) {
        targetPb = pb;
        targetScene = scene;
        break;
      }
    }
    if (targetPb) break;
  }

  if (!targetPb || !targetScene) {
    return { success: false, records: 0, error: `Page ${pageUid} not found in issue` };
  }

  // Build preceding history of the scene for continuity
  let history: ConversationTurn[] = [];
  const envDesc = resolveSceneEnvironment(targetScene, anchors);

  for (const pbInScene of targetScene.pageBeats) {
    if (pbInScene.productionPageUid === pageUid) {
      break;
    }
    const pageUidInScene = pbInScene.productionPageUid;
    if (!pageUidInScene) continue;

    const prior = await getVpsRecord(run.id, spec.outputRecordType, pageUidInScene);
    if (prior) {
      history = appendPageHistory(history, prior);
    }
  }

  const slots = assemblePageSlots(targetPb, targetScene, envDesc, show);
  const promptText = template.render(slots);

  let parsed: any = null, lastErr = '', raw = '';
  for (let a = 0; a < 3 && !parsed; a++) {
    if (options.signal?.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }
    try {
      const resp = await callGemini({
        model,
        temperature: spec.defaultTemperature,
        prompt: promptText,
        history,
      });
      raw = resp.text;
      const r = parser.parse(raw);
      if (r.ok === false) throw new Error(r.error);
      parsed = r.payload;
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message === 'AbortError') {
        throw e;
      }
      lastErr = e instanceof Error ? e.message : String(e);
      await new Promise(res => setTimeout(res, 600));
    }
  }

  if (!parsed) {
    return {
      success: false,
      records: 0,
      error: `VPS page stale re-run for ${targetPb.address} failed: ${lastErr}`,
    };
  }

  await writeVpsRecord({
    runId: run.id,
    showId: show.id,
    issueUid: issue.uid,
    recordType: spec.outputRecordType,
    scopeKey: pageUid,
    payload: parsed,
    payloadVersion: spec.outputPayloadVersion,
    createdByPass: spec.id,
    consoleEntryId: null,
  });

  return { success: true, records: 1 };
}
