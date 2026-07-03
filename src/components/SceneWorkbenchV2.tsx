import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../StoreContext';
import { ImageVersion, PageBeat } from '../types/production';
import { Show } from '../types/show';
import { getImageVersionsForShow } from '../storage/VaultStorage';
import { resolveCanonicalCharacters } from '../domainUtils';
import { buildFinalPageBeat, validateFinalPage } from '../ai/imageGeneration/finalPageContract';
import { useWorkbenchSelection } from './workbench/useWorkbenchSelection';
import { WorkbenchFilmstrip } from './workbench/WorkbenchFilmstrip';
import { WorkbenchPromptPanel } from './workbench/WorkbenchPromptPanel';
import { WorkbenchPageImage } from './workbench/WorkbenchPageImage';
import { useProductionPageActions } from '../hooks/production/useProductionPageActions';
import { loadPageBeatLockedRefs, loadPriorPageRefs, loadSettingAnchorRef } from '../hooks/production/productionPageRefs';
import { resolveProductionCharacterRefs } from '../hooks/production/productionCharacterRefs';

interface ContractGate {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const scriptEntriesOf = (pb: PageBeat): any[] => {
  const script: any = pb.script;
  if (!script) return [];
  if (Array.isArray(script.entries)) return script.entries;
  if (Array.isArray(script.lines)) return script.lines;
  return [];
};

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const resolveCharacterStrict = (show: Show, ref: string) => {
  const normalized = ref.trim().toLowerCase();
  return (show.characters ?? []).find((character) => {
    const candidates = [character.id, character.handle, character.name]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return candidates.some(candidate => candidate.trim().toLowerCase() === normalized);
  });
};

function validateExplicitFinalPageInputs(pb: PageBeat, show: Show): string[] {
  const errors: string[] = [];
  const entries = scriptEntriesOf(pb);
  const plans = pb.panelPlans ?? [];

  if (!Array.isArray(pb.panelPlans) || plans.length === 0) {
    errors.push('V2 requires an explicit panel plan; it will not infer panels from line count, splash flags, or narrative text.');
  }

  if (!hasText(pb.layoutName)) {
    errors.push('V2 requires an explicit page layoutName; it will not derive a grid layout from panel count.');
  }

  if (!hasText(pb.visualNote) && !plans.every(plan => hasText(plan.action))) {
    errors.push('V2 requires explicit visual action text for every panel, or a page visualNote; it will not substitute dialogue or beat type.');
  }

  if (pb.panelPlanStale) {
    errors.push('Panel plan is marked stale. Refresh or approve the plan before using V2 generation.');
  }

  const referencedScriptIndexes = new Set<number>();
  plans.forEach((plan, panelIndex) => {
    if (!hasText(plan.shotType)) errors.push(`Panel ${panelIndex + 1} is missing shotType.`);
    if (!hasText(plan.action)) errors.push(`Panel ${panelIndex + 1} is missing action.`);
    if (!Array.isArray(plan.dialogueIndices)) errors.push(`Panel ${panelIndex + 1} is missing dialogueIndices.`);
    if (!Array.isArray(plan.captionIndices)) errors.push(`Panel ${panelIndex + 1} is missing captionIndices.`);
    [...(plan.dialogueIndices ?? []), ...(plan.captionIndices ?? [])].forEach((entryIndex) => {
      if (!Number.isInteger(entryIndex) || entryIndex < 0 || entryIndex >= entries.length) {
        errors.push(`Panel ${panelIndex + 1} references invalid script entry index ${entryIndex}.`);
      } else if (referencedScriptIndexes.has(entryIndex)) {
        errors.push(`Script entry ${entryIndex} is assigned to more than one panel.`);
      } else {
        referencedScriptIndexes.add(entryIndex);
      }
    });
  });

  entries.forEach((entry, entryIndex) => {
    if (!hasText(entry?.text)) return;
    if (!referencedScriptIndexes.has(entryIndex)) {
      errors.push(`Script entry ${entryIndex} has renderable text but is not assigned to a panel.`);
    }
  });

  const canonical = resolveCanonicalCharacters(show, pb.characterIds ?? []);
  if (canonical.unresolvedIdentifiers.length > 0) {
    errors.push(`Unresolved page character id(s): ${canonical.unresolvedIdentifiers.join(', ')}.`);
  }
  if (canonical.malformedIdentifiersNormalized.length > 0) {
    errors.push(`Malformed character id(s) require manual cleanup before V2: ${canonical.malformedIdentifiersNormalized.join(', ')}.`);
  }

  plans.forEach((plan, panelIndex) => {
    for (const cp of plan.characterPositions ?? []) {
      if (!hasText(cp.characterHandle)) {
        errors.push(`Panel ${panelIndex + 1} has a staged character without characterHandle.`);
      } else if (!resolveCharacterStrict(show, cp.characterHandle)) {
        errors.push(`Panel ${panelIndex + 1} references unknown staged character "${cp.characterHandle}".`);
      }
      if (!hasText(cp.zone)) errors.push(`Panel ${panelIndex + 1} staged character ${cp.characterHandle || '(unknown)'} is missing zone.`);
      if (!hasText(cp.depth)) errors.push(`Panel ${panelIndex + 1} staged character ${cp.characterHandle || '(unknown)'} is missing depth.`);
    }
  });

  return errors;
}

const SceneWorkbenchV2: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const initialIssueUid = useMemo(() => currentShow?.issues?.[0]?.uid ?? null, [currentShow]);
  const [selectedIssueUid, setSelectedIssueUid] = useState<string | null>(initialIssueUid);
  const [showVersions, setShowVersions] = useState<ImageVersion[]>([]);
  const [continuity, setContinuity] = useState(false);
  const [promptRefCounts, setPromptRefCounts] = useState({ characterRefs: 0, settingRefs: 0, lockedRefs: 0, priorPages: 0 });

  useEffect(() => setSelectedIssueUid(initialIssueUid), [initialIssueUid]);

  useEffect(() => {
    if (!currentShow?.id) {
      setShowVersions([]);
      return;
    }
    getImageVersionsForShow(currentShow.id).then(setShowVersions).catch((err) => console.error('[WorkbenchV2] Failed to load image versions:', err));
  }, [currentShow?.id]);

  const imageVersionsByPage = useMemo(() => {
    const map = new Map<string, ImageVersion[]>();
    for (const version of showVersions) {
      const list = map.get(version.productionPageUid) ?? [];
      list.push(version);
      map.set(version.productionPageUid, list);
    }
    return map;
  }, [showVersions]);

  const { filmstripPages, focusedPage, setFocusedPage } = useWorkbenchSelection(currentShow ?? undefined, selectedIssueUid, imageVersionsByPage);
  const actions = useProductionPageActions(focusedPage?.productionPage ?? null, focusedPage?.pageBeat ?? null, focusedPage?.settingAnchorId, continuity);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!focusedPage || !currentShow) {
        setPromptRefCounts({ characterRefs: 0, settingRefs: 0, lockedRefs: 0, priorPages: 0 });
        return;
      }
      const [refResolution, lockedRefs, priorRefs, settingRef] = await Promise.all([
        resolveProductionCharacterRefs({ pageBeat: focusedPage.pageBeat, show: currentShow }),
        loadPageBeatLockedRefs(focusedPage.pageBeat, focusedPage.settingAnchorId, currentShow),
        continuity ? loadPriorPageRefs(focusedPage.productionPage, currentShow, 1, 0) : Promise.resolve([]),
        loadSettingAnchorRef(focusedPage.settingAnchorId, currentShow),
      ]);
      if (!cancelled) {
        setPromptRefCounts({
          characterRefs: refResolution.loadedRefs.length,
          settingRefs: settingRef.imageRef ? 1 : 0,
          lockedRefs: lockedRefs.length,
          priorPages: priorRefs.length,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [focusedPage, currentShow, continuity]);

  const gate: ContractGate = useMemo(() => {
    if (!currentShow || !focusedPage) return { ok: false, errors: ['Select a promoted issue page.'], warnings: [] };
    const explicitErrors = validateExplicitFinalPageInputs(focusedPage.pageBeat, currentShow);
    const { contract, problems } = buildFinalPageBeat(currentShow, focusedPage.pageBeat, focusedPage.productionPage.issueUid, focusedPage.sceneUid ?? '');
    const preflight = validateFinalPage(contract, problems, promptRefCounts);
    return {
      ok: explicitErrors.length === 0 && preflight.ok && preflight.warnings.length === 0,
      errors: [...explicitErrors, ...preflight.errors],
      warnings: preflight.warnings,
    };
  }, [currentShow, focusedPage, promptRefCounts]);

  if (!currentShow) return null;

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#070707] text-white overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 bg-black/40 flex items-center gap-3 shrink-0">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">Scene Workbench V2</div>
          <div className="text-[11px] text-white/50">Strict final-page contract gate: no repair, guessing, raw prompt bypass, or fallback preview.</div>
        </div>
        <div className="flex-1" />
        <select
          value={selectedIssueUid ?? ''}
          onChange={(event) => setSelectedIssueUid(event.target.value || null)}
          className="bg-black border border-white/15 rounded px-3 py-2 text-xs font-mono text-white"
        >
          {(currentShow.issues ?? []).map(issue => (
            <option key={issue.uid} value={issue.uid}>{issue.issueCode || `Issue ${issue.number}`} — {issue.title}</option>
          ))}
        </select>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'workbench' })}
          className="px-3 py-2 border border-white/15 rounded text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/10"
        >
          Legacy V1
        </button>
      </div>

      <div className="shrink-0 border-b border-white/10">
        <WorkbenchFilmstrip show={currentShow} pages={filmstripPages} focusedPage={focusedPage} onPageSelect={setFocusedPage} />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(280px,36%)_1fr]">
        <div className="min-h-0 border-r border-white/10">
          {focusedPage && gate.ok ? (
            <WorkbenchPromptPanel
              show={currentShow}
              pageBeat={focusedPage.pageBeat}
              page={focusedPage.productionPage}
              activeVersion={focusedPage.activeImageVersion}
              refCounts={promptRefCounts}
              continuity={continuity}
              onToggleContinuity={setContinuity}
              settingAnchorId={focusedPage.settingAnchorId}
            />
          ) : (
            <div className="h-full p-5 overflow-y-auto bg-[#120d0d]">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300 mb-3">Prompt preview locked</div>
              <p className="text-sm text-white/70 mb-4">V2 only assembles a prompt after the selected page satisfies the explicit final-page input contract.</p>
              <div className="space-y-2 font-mono text-[11px]">
                {gate.errors.map((error, index) => <div key={`e-${index}`} className="text-red-200 bg-red-950/30 border border-red-400/20 rounded p-2">✕ {error}</div>)}
                {gate.warnings.map((warning, index) => <div key={`w-${index}`} className="text-amber-200 bg-amber-950/30 border border-amber-400/20 rounded p-2">! {warning}</div>)}
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex flex-col">
          {focusedPage ? (
            <>
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-3 bg-black/30">
                <div className="text-xs font-mono text-white/70 flex-1">{focusedPage.pageBeat.address ?? focusedPage.productionPage.uid}</div>
                <button
                  disabled={!gate.ok || actions.isRunning}
                  onClick={() => actions.generateImage()}
                  className="px-4 py-2 rounded bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-35 disabled:cursor-not-allowed hover:bg-emerald-500"
                  title={gate.ok ? 'Generate using the validated final-page contract' : 'Resolve V2 contract blockers before generating'}
                >
                  {actions.isRunning ? 'Generating…' : 'Generate final page'}
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <WorkbenchPageImage entry={focusedPage.activeImageVersion} productionPageUid={focusedPage.productionPage.uid} actions={gate.ok ? actions : undefined} page={focusedPage.productionPage} pageBeat={focusedPage.pageBeat} />
              </div>
            </>
          ) : (
            <div className="h-full grid place-items-center text-white/40 text-sm">No pages available for this issue.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SceneWorkbenchV2;
