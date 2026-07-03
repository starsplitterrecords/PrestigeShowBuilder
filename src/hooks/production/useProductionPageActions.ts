import { useState, useEffect } from 'react';
import { useStore } from '../../StoreContext';
import { ProductionPage, ImageVersion, PageBeat } from '../../types/production';
import { CinematicBeat } from '../../types/models';
import { Show } from '../../types/show';
import { generateUID, resolveCanonicalCharacters } from '../../domainUtils';
import { buildStoredImageMetadata } from '../../ai/imageGeneration/storedImageMetadata';
import {
  writeImageVersion,
  updateProductionPage,
  getImageVersionsForPage,
  updateImageVersionStatus,
  deleteImageVersionsForPage
} from '../../storage/VaultStorage';
import { AssetStorage } from '../../storage';
import {
  findCanonicalPageBeat, buildFinalPageBeat, validateFinalPage
} from '../../ai/imageGeneration/finalPageContract';
import { generateFinalComicPage } from '../../ai/imageGeneration/generateFinalComicPage';
import { planBeatVisuals } from '../../ai/textGeneration/planBeatVisuals';
import { GoogleGenAI } from '@google/genai';
import { getApiKey } from '../../domainUtils';
import { withRetry } from '../../ai/geminiClient';
import {
  loadCharacterRefs,
  loadPageBeatLockedRefs,
  loadPriorPageRefs,
  loadSettingAnchorRef
} from './productionPageRefs';
import { resolveProductionCharacterRefs } from './productionCharacterRefs';
import { validatePanelIndices } from '../../vps/validatePanelIndices';


// Helper to log SW preflight parameters exactly as required by Requirement 8
function logSWPreflight(resolvedBeat: PageBeat, currentShow: Show, refResolution: any, dispatch?: any) {
  const originalIds = resolvedBeat.characterIds || [];
  const normalizedResult = resolveCanonicalCharacters(currentShow, originalIds);
  const normalizedIds = normalizedResult.resolvedCharacters.map(c => c.id);
  const resolvedIds = refResolution.loadedRefs.map((r: any) => r.characterId);
  const resolvedHandles = refResolution.loadedRefs.map((r: any) => {
    const res = resolveCanonicalCharacters(currentShow, [r.characterId]);
    return res.resolvedCharacters[0]?.handle || r.characterId;
  });
  const portraitAssetIds = refResolution.loadedRefs.map((r: any) => r.assetId);
  const attachedCount = refResolution.loadedRefs.length;

  const logLines = [
    `[SW PREFLIGHT] Starting generation/refresh for ${resolvedBeat.address || 'unknown'}:`,
    `  - original characterIds: ${JSON.stringify(originalIds)}`,
    `  - normalized characterIds: ${JSON.stringify(normalizedIds)}`,
    `  - resolved character IDs: ${JSON.stringify(resolvedIds)}`,
    `  - resolved handles: ${JSON.stringify(resolvedHandles)}`,
    `  - portrait/anchor asset IDs: ${JSON.stringify(portraitAssetIds)}`,
    `  - attached image part count: ${attachedCount}`
  ];

  for (const line of logLines) {
    console.log(line);
    if (dispatch) {
      dispatch({ type: 'PIPELINE_LOG', log: line });
    }
  }
}

// Adapter: map PageBeat fields to the shape generateComicPage expects.
// Only maps fields that planComicPage actually reads.
// Exported so productionPageRefs.ts can reuse it.
export function pageBeatToComicBeat(
  pb: PageBeat
): CinematicBeat {
  return {
    id: pb.uid,
    fid: pb.address,          // fid used for hash + fallback labels
    description: pb.description,
    beatType: pb.beatType as any,
    characterIds: pb.characterIds,
    visualDescription: pb.visualNote,  // visualNote → visualDescription
    direction: pb.direction,
    subtext: pb.subtext,
    script: pb.script as any,
    // Fields on PageBeat:
    panelPlans: pb.panelPlans,
    panelProps: pb.panelProps,
    panelPlanStale: pb.panelPlanStale ?? false,
    panelCountOverride: pb.panelCountOverride,
    visualDirection: pb.visualDirection,
    // Fields not on PageBeat — safe defaults:
    continuityAnchor: undefined,
    groundingEnsemble: undefined,
    // Required fields with empty defaults:
    lines: [],
    groundingNotes: '',
  } as unknown as CinematicBeat;
}

export function findPageBeatByUid(
  show: Show | null | undefined,
  pageBeatUid: string | null | undefined
): PageBeat | null {
  if (!show || !pageBeatUid) return null;
  for (const iss of show.issues ?? []) {
    for (const act of iss.acts ?? []) {
      for (const sc of act.scenes ?? []) {
        for (const pb of sc.pageBeats ?? []) {
          if (pb.uid === pageBeatUid) {
            return pb;
          }
        }
      }
    }
  }
  return null;
}

const getPageBeatScriptEntries = (pb?: PageBeat | null) => {
  const script: any = pb?.script;
  if (!script) return [];
  if (Array.isArray(script.entries) && script.entries.length) return script.entries;
  if (Array.isArray(script.lines) && script.lines.length) return script.lines;
  return [];
};

export function useProductionPageActions(
  page: ProductionPage | null,
  pageBeat: PageBeat | null,
  settingAnchorId?: string,
  // DA-102: defaults off. Previously generateImage/rerollImage/refineImage
  // all called loadPriorPageRefs unconditionally, attaching up to 3
  // adjacent same-scene pages regardless of any UI toggle. When true, only
  // the single previous page is attached — not the prior+following window.
  continuity: boolean = false
) {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const [isRunning, setIsRunning] = useState(false);
  const [isPendingUpdate, setIsPendingUpdate] = useState(false);
  const [pageVersions, setPageVersions] = useState<ImageVersion[]>([]);

  // Read fresh PageBeat from currentShow
  const freshPageBeat = pageBeat ? findPageBeatByUid(currentShow, page?.pageBeatUid ?? pageBeat.uid) : null;

  // Whenever currentShow or the resolved freshPageBeat matches our input pageBeat, we can clear the pending state
  useEffect(() => {
    if (!pageBeat || !freshPageBeat) {
      setIsPendingUpdate(false);
      return;
    }
    const closureStr = JSON.stringify(pageBeat);
    const storeStr = JSON.stringify(freshPageBeat);
    if (closureStr === storeStr) {
      setIsPendingUpdate(false);
    }
  }, [pageBeat, freshPageBeat]);

  // Load versions whenever the focused page changes.
  useEffect(() => {
    if (!page?.uid) { setPageVersions([]); return; }
    getImageVersionsForPage(page.uid)
      .then(setPageVersions)
      .catch(() => setPageVersions([]));
  }, [page?.uid]);

  // Reload versions after any write operation.
  const reloadVersions = async () => {
    if (!page?.uid) return;
    const versions = await getImageVersionsForPage(page.uid);
    setPageVersions(versions);
  };

  // ── Helpers ───────────────────────────────────────────────

  const getVersions = (): ImageVersion[] => {
    return pageVersions;
  };

  const getActiveVersion = (): ImageVersion | null => {
    const versions = getVersions();
    return versions.find(v => v.status === 'approved')
      ?? versions
        .filter(v => v.status === 'draft')
        .sort((a, b) => b.createdAt - a.createdAt)[0]
      ?? null;
  };

  const hasScript = getPageBeatScriptEntries(freshPageBeat || pageBeat).length > 0;
  const needsVisualBrief = !(freshPageBeat || pageBeat)?.visualNote?.trim()
    || ((freshPageBeat || pageBeat)?.visualNote?.trim()?.length ?? 0) < 30;

  // ── Actions ───────────────────────────────────────────────

  // Fill Visual Brief — generates concrete visual direction
  // from description + script. Writes to pageBeat.visualNote.
  const fillVisualBrief = async () => {
    const activeBeat = freshPageBeat || pageBeat;
    if (!page || !activeBeat || !currentShow) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'No focused production page is available.'
      }});
      return;
    }
    setIsRunning(true);
    try {
      const ai = new GoogleGenAI({ apiKey: getApiKey() });
      const chars = (currentShow.characters ?? [])
        .filter(c => activeBeat.characterIds.includes(c.id))
        .map(c => `${c.name}: ${c.physicalDescription || c.role}`)
        .join('\n');
      const scriptLines = getPageBeatScriptEntries(activeBeat)
        .map((e: any) => ('kind' in e && e.kind === 'caption')
          ? `[CAPTION] ${e.text}`
          : `${(e as any).characterHandle || 'Character'}: ${e.text}`
        ).join('\n');
      const prompt = [
        'Write 2-3 sentences of concrete comic panel direction.',
        'Focus on: composition, camera angle, character positions,',
        'lighting, key visual elements. Be specific and drawable.',
        '',
        'DIALOGUE LEAK PREVENTION: Dialogue, captions, signs, labels, and sound effects must only appear in explicit text-render fields. Do not copy dialogue or readable text into ACTION, FOREGROUND, MIDGROUND, BACKGROUND, STAGING, visual direction, camera direction, environmental detail, or prop descriptions. Visual fields must describe only what is seen, not text to render.',
        '',
        `Beat description: ${activeBeat.description}`,
        chars ? `Characters:\n${chars}` : '',
        scriptLines ? `Dialogue:\n${scriptLines}` : '',
        '',
        'Return only the visual direction text. No preamble.'
      ].filter(Boolean).join('\n');
      const res = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [{ text: prompt }] }
        })
      );
      const text = res.candidates?.[0]?.content?.parts
        ?.find((p: any) => p.text)?.text?.trim();
      if (!text) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(), type: 'error',
          message: 'No visual direction text generated.'
        }});
        return;
      }
      // Write back to pageBeat.visualNote in the Issue hierarchy.
      const updatedIssues = (currentShow.issues ?? []).map(iss => ({
        ...iss,
        acts: iss.acts.map(act => ({
          ...act,
          scenes: act.scenes.map(sc => ({
            ...sc,
            pageBeats: sc.pageBeats.map(pb =>
              pb.uid === activeBeat.uid
                ? { ...pb, visualNote: text }
                : pb
            )
          }))
        }))
      }));
      dispatch({ type: 'UPDATE_SHOW', updates: { issues: updatedIssues } });
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'success',
        message: 'Visual brief filled.'
      }});
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Visual brief failed: ${err.message}`
      }});
    } finally { setIsRunning(false); }
  };

  // Generate Image — always appends a new draft ImageVersion.
  // Never replaces approved versions.
  const generateImage = async (rawPromptOverride?: string) => {
    if (isPendingUpdate) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'Page beat updates are still processing. Please try again in a moment.'
      }});
      return;
    }
    const canonical = findCanonicalPageBeat(currentShow!, page?.pageBeatUid ?? pageBeat?.uid ?? '');
    if (canonical.errors.length > 0) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Date.now() + '_dup', type: 'error',
        message: canonical.errors[0] } });
      return;
    }
    const resolvedBeat = canonical.pb || pageBeat;
    if (!page || !resolvedBeat || !currentShow) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'No focused production page is available.'
      }});
      return;
    }
    if (resolvedBeat.panelPlans) {
      const v = validatePanelIndices(resolvedBeat);
      if (!v.fingerprintMatches) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now() + '',
            type: 'warning',
            message: 'Heads up: this page was edited after its visual direction. Dialogue placement may be off — re-run Page Direction for it.'
          }
        });
      }
    }
    setIsRunning(true);

    try {
      // Hard-gate character references before generation
      const refResolution = await resolveProductionCharacterRefs({
        pageBeat: resolvedBeat,
        show: currentShow,
        dispatch,
      });

      // Requirement 8: Preflight logging
      logSWPreflight(resolvedBeat, currentShow, refResolution, dispatch);

      // Requirement 6: Preflight Invariant Validations
      const originalIds = resolvedBeat.characterIds || [];
      if (originalIds.length > 0) {
        const resResult = resolveCanonicalCharacters(currentShow, originalIds);
        
        // 1. If pageBeat.characterIds is non-empty and resolvedCharactersCount is 0, block generation.
        if (resResult.resolvedCharacters.length === 0) {
          const errMsg = `Preflight block for ${resolvedBeat.address}: Character IDs are selected, but reference resolution returned zero resolved characters.`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_no_resolved', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }
        
        // 2. If any selected character identifier is unresolved, block generation.
        if (resResult.unresolvedIdentifiers.length > 0) {
          const names = resResult.unresolvedIdentifiers.join(', ');
          const errMsg = `Preflight block for ${resolvedBeat.address}: Not all selected character identifiers are resolved. Unresolved: ${names}`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_unresolved', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }

        // 3. If any resolved character lacks a usable portrait/visual anchor, block generation.
        if (resResult.missingReferenceAssets.length > 0) {
          const names = resResult.missingReferenceAssets.map(c => c.name || c.id).join(', ');
          const errMsg = `Preflight block for ${resolvedBeat.address}: Resolved character(s) lack a landscape portrait/visual anchor: ${names}`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_no_portrait', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }
      }

      if (refResolution.missing.length > 0) {
        const names = refResolution.missing.map(m => m.characterName).join(', ');
        const errMsg = `Cannot generate ${resolvedBeat.address}: missing required character reference image(s): ${names}`;
        dispatch({
          type: 'ADD_TOAST',
          toast: { id: Date.now() + '_missing_refs', type: 'error', message: errMsg }
        });
        setIsRunning(false);
        return;
      }

      // Load other visual references — locked scene refs, prior page continuity, and setting anchor.
      // DA-102: continuity defaults off; when on, previous page only.
      const [lockedRefs, priorRefs, settingRef] = await Promise.all([
        loadPageBeatLockedRefs(resolvedBeat, settingAnchorId, currentShow),
        continuity ? loadPriorPageRefs(page, currentShow, 1, 0) : Promise.resolve([]),
        loadSettingAnchorRef(settingAnchorId, currentShow),
      ]);

      const charRefs = refResolution.loadedRefs;

      const allCharRefs = [
        ...(settingRef.imageRef ? [settingRef.imageRef] : []),
        ...charRefs,
        ...lockedRefs
      ].map(r => ({
        dataUri: r.dataUri,
        label: r.label,
        description: (r as any).description,
        isCharacter: r.isCharacter,
        assetId: r.assetId
      }));
      const priorPageRefs = priorRefs.map(r => ({
        dataUri: r.dataUri,
        label: r.label,
        assetId: r.assetId
      }));
      const settingPrefix = settingRef.settingNote
        ? settingRef.settingNote + '\n'
        : '';
      const { contract, problems } = buildFinalPageBeat(
        currentShow, resolvedBeat, canonical.issueUid, canonical.sceneUid);
      const preflight = validateFinalPage(contract, problems, {
        characterRefs: charRefs.length,
        settingRefs: settingRef.imageRef ? 1 : 0,
        lockedRefs: lockedRefs.length,
        priorPages: priorPageRefs.length,
      });
      preflight.warnings.forEach(w =>
        dispatch({ type: 'PIPELINE_LOG', log: `⚠️ ${w}` }));
      if (!preflight.ok) {
        dispatch({ type: 'ADD_TOAST', toast: { id: Date.now() + '_preflight',
          type: 'error', message: preflight.errors[0] } });
        return;
      }
      const result = await generateFinalComicPage(
        currentShow, contract, priorPageRefs, allCharRefs, {
          mode: 'paid',
          directorNote: settingPrefix || undefined,
          requiredCharacterAssetIds: refResolution.loadedRefs.map(r => r.assetId),
          rawPromptOverride,
        });
      if (!result?.assetId) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(), type: 'error',
          message: 'Image generation returned no image asset.'
        }});
        return;
      }
      const version: ImageVersion = {
        uid: generateUID(),
        showId: currentShow.id,
        productionPageUid: page.uid,
        assetId: result.assetId,
        variantType: 'final',
        status: 'draft',
        createdAt: Date.now(),
        metadata: buildStoredImageMetadata(result),
      };
      await writeImageVersion(currentShow.id, version);
      await updateProductionPage(currentShow.id, page.uid, {
        status: 'generated'
      });
      await reloadVersions();
      dispatch({ type: 'RELOAD_SHOW' });
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Image generation failed: ${err.message}`
      }});
    } finally { setIsRunning(false); }
  };

  // Approve Image — sets the approved version and advances status.
  const approveImage = async (versionUid: string) => {
    if (!page || !currentShow) return;
    try {
      const currentVersions = await getImageVersionsForPage(page.uid);
      for (const v of currentVersions) {
        if (v.status === 'approved' && v.uid !== versionUid) {
          await updateImageVersionStatus(currentShow.id, v.uid, 'archived');
        }
      }
      await updateImageVersionStatus(currentShow.id, versionUid, 'approved');
      await updateProductionPage(currentShow.id, page.uid, {
        status: 'approved',
        approvedImageVersionUid: versionUid
      });
      await reloadVersions();
      dispatch({ type: 'RELOAD_SHOW' });
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Approval failed: ${err.message}`
      }});
    }
  };

  // Revoke an approval.
  const unapproveImage = async (versionUid: string) => {
    if (!currentShow || !page) return;
    setIsRunning(true);
    try {
      await updateImageVersionStatus(currentShow.id, versionUid, 'draft');
      await updateProductionPage(currentShow.id, page.uid, {
        status: 'generated',
        approvedImageVersionUid: undefined,
      });
      await reloadVersions();
      dispatch({ type: 'RELOAD_SHOW' });
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Unapproval failed: ${err.message}`
      }});
    } finally { setIsRunning(false); }
  };

  // A one-action reset for a focused page: wipe its versions and generate fresh.
  const clearAndRegenerate = async () => {
    if (!currentShow || !page) return;
    setIsRunning(true);
    try {
      await deleteImageVersionsForPage(page.uid);
      await updateProductionPage(currentShow.id, page.uid, {
        status: 'planned',
        approvedImageVersionUid: undefined
      });
      setPageVersions([]);
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Clear & Regenerate failed: ${err.message}`
      }});
      setIsRunning(false);
      return;
    }
    await generateImage();
  };

  // Reroll — generates a new image WITHOUT archiving approved versions.
  const rerollImage = async () => {
    if (isPendingUpdate) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'Page beat updates are still processing. Please try again in a moment.'
      }});
      return;
    }
    const canonical = findCanonicalPageBeat(currentShow!, page?.pageBeatUid ?? pageBeat?.uid ?? '');
    if (canonical.errors.length > 0) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Date.now() + '_dup', type: 'error',
        message: canonical.errors[0] } });
      return;
    }
    const resolvedBeat = canonical.pb || pageBeat;
    if (!page || !resolvedBeat || !currentShow) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'No focused production page is available.'
      }});
      return;
    }
    setIsRunning(true);
    try {
      // Hard-gate character references before generation
      const refResolution = await resolveProductionCharacterRefs({
        pageBeat: resolvedBeat,
        show: currentShow,
        dispatch,
      });

      // Requirement 8: Preflight logging
      logSWPreflight(resolvedBeat, currentShow, refResolution, dispatch);

      // Requirement 6: Preflight Invariant Validations
      const originalIds = resolvedBeat.characterIds || [];
      if (originalIds.length > 0) {
        const resResult = resolveCanonicalCharacters(currentShow, originalIds);
        
        // 1. If pageBeat.characterIds is non-empty and resolvedCharactersCount is 0, block generation.
        if (resResult.resolvedCharacters.length === 0) {
          const errMsg = `Preflight block for ${resolvedBeat.address}: Character IDs are selected, but reference resolution returned zero resolved characters.`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_no_resolved', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }
        
        // 2. If any selected character identifier is unresolved, block generation.
        if (resResult.unresolvedIdentifiers.length > 0) {
          const names = resResult.unresolvedIdentifiers.join(', ');
          const errMsg = `Preflight block for ${resolvedBeat.address}: Not all selected character identifiers are resolved. Unresolved: ${names}`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_unresolved', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }

        // 3. If any resolved character lacks a usable portrait/visual anchor, block generation.
        if (resResult.missingReferenceAssets.length > 0) {
          const names = resResult.missingReferenceAssets.map(c => c.name || c.id).join(', ');
          const errMsg = `Preflight block for ${resolvedBeat.address}: Resolved character(s) lack a landscape portrait/visual anchor: ${names}`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_no_portrait', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }
      }

      if (refResolution.missing.length > 0) {
        const names = refResolution.missing.map(m => m.characterName).join(', ');
        const errMsg = `Cannot reroll ${resolvedBeat.address}: missing required character reference image(s): ${names}`;
        dispatch({
          type: 'ADD_TOAST',
          toast: { id: Date.now() + '_missing_refs', type: 'error', message: errMsg }
        });
        setIsRunning(false);
        return;
      }

      // Load other visual references — locked scene refs, prior page continuity, and setting anchor.
      // DA-102: continuity defaults off; when on, previous page only.
      const [lockedRefs, priorRefs, settingRef] = await Promise.all([
        loadPageBeatLockedRefs(resolvedBeat, settingAnchorId, currentShow),
        continuity ? loadPriorPageRefs(page, currentShow, 1, 0) : Promise.resolve([]),
        loadSettingAnchorRef(settingAnchorId, currentShow),
      ]);

      const charRefs = refResolution.loadedRefs;

      const allCharRefs = [
        ...(settingRef.imageRef ? [settingRef.imageRef] : []),
        ...charRefs,
        ...lockedRefs
      ].map(r => ({
        dataUri: r.dataUri,
        label: r.label,
        description: (r as any).description,
        isCharacter: r.isCharacter,
        assetId: r.assetId
      }));
      const priorPageRefs = priorRefs.map(r => ({
        dataUri: r.dataUri,
        label: r.label,
        assetId: r.assetId
      }));
      const settingPrefix = settingRef.settingNote
        ? settingRef.settingNote + '\n'
        : '';
      const { contract, problems } = buildFinalPageBeat(
        currentShow, resolvedBeat, canonical.issueUid, canonical.sceneUid);
      const preflight = validateFinalPage(contract, problems, {
        characterRefs: charRefs.length,
        settingRefs: settingRef.imageRef ? 1 : 0,
        lockedRefs: lockedRefs.length,
        priorPages: priorPageRefs.length,
      });
      preflight.warnings.forEach(w =>
        dispatch({ type: 'PIPELINE_LOG', log: `⚠️ ${w}` }));
      if (!preflight.ok) {
        dispatch({ type: 'ADD_TOAST', toast: { id: Date.now() + '_preflight',
          type: 'error', message: preflight.errors[0] } });
        return;
      }
      const result = await generateFinalComicPage(
        currentShow, contract, priorPageRefs, allCharRefs, {
          mode: 'paid',
          directorNote: settingPrefix || undefined,
          requiredCharacterAssetIds: refResolution.loadedRefs.map(r => r.assetId),
        });
      if (!result?.assetId) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(), type: 'error',
          message: 'Reroll failed to produce an image asset.'
        }});
        return;
      }
      const version: ImageVersion = {
        uid: generateUID(),
        showId: currentShow.id,
        productionPageUid: page.uid,
        assetId: result.assetId,
        variantType: 'final',
        status: 'draft',
        createdAt: Date.now(),
        metadata: buildStoredImageMetadata(result),
      };
      await writeImageVersion(currentShow.id, version);
      await reloadVersions();
      dispatch({ type: 'RELOAD_SHOW' });
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Reroll failed: ${err.message}`
      }});
    } finally { setIsRunning(false); }
  };

  const generatePanelPlan = async () => {
    const freshActiveBeat = findPageBeatByUid(currentShow, page?.pageBeatUid ?? pageBeat?.uid);
    const resolvedBeat = freshActiveBeat || pageBeat;
    if (!page || !resolvedBeat || !currentShow) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'No focused production page is available.'
      }});
      return;
    }
    setIsRunning(true);
    try {
      const shimBeat = pageBeatToComicBeat(resolvedBeat);
      // planBeatVisuals needs a Scene-like object for context.
      // Build a minimal shim from the ProductionScene.
      let sceneShim: any = {};
      for (const iss of currentShow.issues ?? []) {
        for (const act of iss.acts) {
          for (const sc of act.scenes) {
            if (sc.pageBeats.some(pb => pb.uid === resolvedBeat.uid)) {
              sceneShim = {
                id: sc.uid,
                fid: sc.uid,
                title: sc.title,
                setting: sc.setting,
                settingAnchorId: (sc as any).settingAnchorId,
              };
            }
          }
        }
      }
      const { panels, props } = await planBeatVisuals(
        currentShow, shimBeat, sceneShim, state.generationMode
      );
      updatePageBeat({
        panelPlans: panels,
        panelProps: props,
        panelPlanStale: false
      });
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'success',
        message: `Panel plan generated: ${panels.length} panels` +
          (props.length
            ? `, ${props.length} prop${props.length > 1 ? 's' : ''} locked`
            : '')
      }});
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Panel plan failed: ${err.message}`
      }});
    } finally { setIsRunning(false); }
  };

  const refineImage = async (refinementNote?: string) => {
    if (isPendingUpdate) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'Page beat updates are still processing. Please try again in a moment.'
      }});
      return;
    }
    const canonical = findCanonicalPageBeat(currentShow!, page?.pageBeatUid ?? pageBeat?.uid ?? '');
    if (canonical.errors.length > 0) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Date.now() + '_dup', type: 'error',
        message: canonical.errors[0] } });
      return;
    }
    const resolvedBeat = canonical.pb || pageBeat;
    if (!page || !resolvedBeat || !currentShow) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'No focused production page is available.'
      }});
      return;
    }
    const approvedVersion = getVersions()
      .find(v => v.status === 'approved');
    if (!approvedVersion) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'Approve an image before refining.'
      }});
      return;
    }
    setIsRunning(true);
    try {
      // Load current approved image as revision reference.
      const revisionDataUri = await AssetStorage.getDataUri(
        approvedVersion.assetId
      );
      if (!revisionDataUri) throw new Error(
        'Could not load approved image for revision.'
      );

      // Hard-gate character references before generation
      const refResolution = await resolveProductionCharacterRefs({
        pageBeat: resolvedBeat,
        show: currentShow,
        dispatch,
      });

      // Requirement 8: Preflight logging
      logSWPreflight(resolvedBeat, currentShow, refResolution, dispatch);

      // Requirement 6: Preflight Invariant Validations
      const originalIds = resolvedBeat.characterIds || [];
      if (originalIds.length > 0) {
        const resResult = resolveCanonicalCharacters(currentShow, originalIds);
        
        // 1. If pageBeat.characterIds is non-empty and resolvedCharactersCount is 0, block generation.
        if (resResult.resolvedCharacters.length === 0) {
          const errMsg = `Preflight block for ${resolvedBeat.address}: Character IDs are selected, but reference resolution returned zero resolved characters.`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_no_resolved', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }
        
        // 2. If any selected character identifier is unresolved, block generation.
        if (resResult.unresolvedIdentifiers.length > 0) {
          const names = resResult.unresolvedIdentifiers.join(', ');
          const errMsg = `Preflight block for ${resolvedBeat.address}: Not all selected character identifiers are resolved. Unresolved: ${names}`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_unresolved', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }

        // 3. If any resolved character lacks a usable portrait/visual anchor, block generation.
        if (resResult.missingReferenceAssets.length > 0) {
          const names = resResult.missingReferenceAssets.map(c => c.name || c.id).join(', ');
          const errMsg = `Preflight block for ${resolvedBeat.address}: Resolved character(s) lack a landscape portrait/visual anchor: ${names}`;
          dispatch({
            type: 'ADD_TOAST',
            toast: { id: Date.now() + '_preflight_no_portrait', type: 'error', message: errMsg }
          });
          setIsRunning(false);
          return;
        }
      }

      if (refResolution.missing.length > 0) {
        const names = refResolution.missing.map(m => m.characterName).join(', ');
        const errMsg = `Cannot refine ${resolvedBeat.address}: missing required character reference image(s): ${names}`;
        dispatch({
          type: 'ADD_TOAST',
          toast: { id: Date.now() + '_missing_refs', type: 'error', message: errMsg }
        });
        setIsRunning(false);
        return;
      }

      // Load other visual references — locked scene refs, prior page continuity, and setting anchor.
      // DA-102: continuity defaults off; when on, previous page only.
      const [lockedRefs, priorRefs, settingRef] = await Promise.all([
        loadPageBeatLockedRefs(resolvedBeat, settingAnchorId, currentShow),
        continuity ? loadPriorPageRefs(page, currentShow, 1, 0) : Promise.resolve([]),
        loadSettingAnchorRef(settingAnchorId, currentShow),
      ]);

      const charRefs = refResolution.loadedRefs;

      const allCharRefs = [
        ...(settingRef.imageRef ? [settingRef.imageRef] : []),
        ...charRefs,
        ...lockedRefs
      ].map(r => ({
        dataUri: r.dataUri,
        label: r.label,
        description: (r as any).description,
        isCharacter: r.isCharacter,
        assetId: r.assetId
      }));

      const settingPrefix = settingRef.settingNote
        ? settingRef.settingNote + '\n'
        : '';

      const combinedNote = (settingPrefix + (refinementNote || '')).trim();

      const priorPageRefs = priorRefs.map(r => ({
        dataUri: r.dataUri, label: r.label,
        assetId: r.assetId
      }));

      const { contract, problems } = buildFinalPageBeat(
        currentShow, resolvedBeat, canonical.issueUid, canonical.sceneUid);
      const preflight = validateFinalPage(contract, problems, {
        characterRefs: charRefs.length,
        settingRefs: settingRef.imageRef ? 1 : 0,
        lockedRefs: lockedRefs.length,
        priorPages: priorPageRefs.length,
      });
      preflight.warnings.forEach(w =>
        dispatch({ type: 'PIPELINE_LOG', log: `⚠️ ${w}` }));
      if (!preflight.ok) {
        dispatch({ type: 'ADD_TOAST', toast: { id: Date.now() + '_preflight',
          type: 'error', message: preflight.errors[0] } });
        return;
      }

      const result = await generateFinalComicPage(
        currentShow, contract, priorPageRefs, allCharRefs, {
          mode: 'paid',
          directorNote: combinedNote || undefined,
          revisionImage: revisionDataUri,
          requiredCharacterAssetIds: refResolution.loadedRefs.map(r => r.assetId),
        });
      if (!result?.assetId) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(), type: 'error',
          message: 'Refinement failed to produce an image asset.'
        }});
        return;
      }
      const version: ImageVersion = {
        uid: generateUID(),
        showId: currentShow.id,
        productionPageUid: page.uid,
        assetId: result.assetId,
        variantType: 'final',
        status: 'draft',
        createdAt: Date.now(),
        metadata: buildStoredImageMetadata(result),
      };
      await writeImageVersion(currentShow.id, version);
      await reloadVersions();
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: `Refinement failed: ${err.message}`
      }});
    } finally { setIsRunning(false); }
  };

  const updatePageBeat = (updates: Partial<PageBeat>) => {
    if (!pageBeat || !currentShow) return;
    setIsPendingUpdate(true);
    let normalizedUpdates = { ...updates };
    if (normalizedUpdates.characterIds) {
      const res = resolveCanonicalCharacters(currentShow, normalizedUpdates.characterIds);
      normalizedUpdates.characterIds = res.resolvedCharacters.map(c => c.id);
    }
    const updatedIssues = (currentShow.issues ?? []).map(iss => ({
      ...iss,
      acts: iss.acts.map(act => ({
        ...act,
        scenes: act.scenes.map(sc => ({
          ...sc,
          pageBeats: sc.pageBeats.map(pb =>
            pb.uid === pageBeat.uid
              ? { ...pb, ...normalizedUpdates }
              : pb
          ),
        })),
      })),
    }));
    dispatch({ type: 'UPDATE_SHOW',
      updates: { issues: updatedIssues } });
  };

  const lockAsSettingAnchor = async () => {
    if (!settingAnchorId || !currentShow || !page) return;

    // Get the currently approved ImageVersion for this page.
    const approvedVersion = getVersions()
      .find(v => v.status === 'approved');
    if (!approvedVersion) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'Approve an image before locking it as a setting reference.'
      }});
      return;
    }

    const anchor = (currentShow.settingAnchors ?? [])
      .find(a => a.id === settingAnchorId);
    if (!anchor) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(), type: 'error',
        message: 'No setting anchor assigned to this scene.'
      }});
      return;
    }

    const updatedAnchors = (currentShow.settingAnchors ?? []).map(a =>
      a.id === settingAnchorId
        ? { ...a, assetId: approvedVersion.assetId }
        : a
    );

    dispatch({ type: 'UPDATE_SHOW',
      updates: { settingAnchors: updatedAnchors } });
    dispatch({ type: 'ADD_TOAST', toast: {
      id: Date.now().toString(), type: 'success',
      message: `Locked as setting reference: ${anchor.name}`
    }});
  };

  const updateSettingAnchorId = (
    sceneUid: string,
    issueUid: string,
    newAnchorId: string | undefined
  ) => {
    if (!currentShow) return;
    const updatedIssues = (currentShow.issues ?? []).map(iss => {
      if (iss.uid !== issueUid) return iss;
      return { ...iss, acts: iss.acts.map(act => ({
        ...act,
        scenes: act.scenes.map(sc =>
          sc.uid === sceneUid
            ? { ...sc, settingAnchorId: newAnchorId }
            : sc
        )
      }))};
    });
    dispatch({ type: 'UPDATE_SHOW',
      updates: { issues: updatedIssues } });
  };

  return {
    isRunning,
    isPendingUpdate,
    hasScript,
    needsVisualBrief,
    getVersions,
    getActiveVersion,
    fillVisualBrief,
    generateImage,
    approveImage,
    unapproveImage,
    clearAndRegenerate,
    rerollImage,
    updatePageBeat,
    generatePanelPlan,
    refineImage,
    lockAsSettingAnchor,
    settingAnchorIsSet: !!settingAnchorId,
    settingAnchorHasImage: !!(currentShow?.settingAnchors ?? []).find(
      a => a.id === settingAnchorId)?.assetId,
    updateSettingAnchorId
  };
}
