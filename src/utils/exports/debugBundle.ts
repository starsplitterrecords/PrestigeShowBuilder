import JSZip from 'jszip';
import { openDB } from '../../storage/db';
import { ShowStorage } from '../../storage/ShowStorage';
import { AssetStorage } from '../../storage/AssetStorage';
import { getAllPassSpecs } from '../../psb4/passes/registry';
import { computePassStatuses } from '../../psb4/ui/utils/passStatus';
import { ArtifactType } from '../../psb4/types';
import type { 
  Psb4Run, 
  Psb4Artifact, 
  Psb4ConsoleEntry, 
  NormalizedSource, 
  Psb4Corpus,
  SceneScriptPayload,
  SegmentationPlanPayload,
  WrittenScene
} from '../../psb4/types';
import type { Show } from '../../types/show';
import type { PageBeat, ImageVersion, Issue } from '../../types/production';
import { resolveCanonicalCharacters } from '../../domainUtils';

// Generic helper to fetch all items of an IndexedDB store
async function fetchAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  if (!db.objectStoreNames.contains(storeName)) {
    return [];
  }
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}

// Main generation function for Debug Bundle ZIP
export async function generatePsb4DebugBundle(showId: string): Promise<Blob> {
  const show = await ShowStorage.getById(showId);
  if (!show) {
    throw new Error(`Show not found for ID: ${showId}`);
  }

  const warnings: string[] = [];

  // 1. Recover standard stores filtered conservatively by showId or matching reference
  const allRuns = await fetchAllFromStore<Psb4Run>('psb4_runs');
  const showRuns = allRuns.filter(r => r.showId === showId);
  const runIds = new Set(showRuns.map(r => r.id));

  const allArtifacts = await fetchAllFromStore<Psb4Artifact>('psb4_artifacts');
  const showArtifacts = allArtifacts.filter(a => a.showId === showId || runIds.has(a.runId));

  const allConsoleEntries = await fetchAllFromStore<Psb4ConsoleEntry>('psb4_console_entries');
  const showConsoleEntries = allConsoleEntries.filter(c => c.showId === showId || runIds.has(c.runId));

  const allSources = await fetchAllFromStore<NormalizedSource>('psb4_source');
  const showSources = allSources.filter(s => s.showId === showId || runIds.has(s.runId));

  const allCorpora = await fetchAllFromStore<Psb4Corpus>('psb4_corpus');
  const showCorpora = allCorpora.filter(c => c.showId === showId || runIds.has(c.runId));

  const allImageVersions = await fetchAllFromStore<any>('production_image_versions');
  const showImageVersions = allImageVersions.filter(i => i.showId === showId);

  const allVpsRuns = await fetchAllFromStore<any>('vps_runs');
  const showVpsRuns = allVpsRuns.filter(vr => vr.showId === showId);
  const vpsRunIds = new Set<string>(showVpsRuns.map(vr => vr.id));

  const allVpsRecords = await fetchAllFromStore<any>('vps_records');
  const showVpsRecords = allVpsRecords.filter(rec => vpsRunIds.has(rec.runId));

  // 2. Identify assets referenced across show entity and production structures
  const assetIds = new Set<string>();
  const assetReferencesMap = new Map<string, Array<{ role: string; detail: string }>>();

  const addAssetRef = (id: string | undefined | null, role: string, detail: string) => {
    if (!id) return;
    assetIds.add(id);
    const existing = assetReferencesMap.get(id) || [];
    existing.push({ role, detail });
    assetReferencesMap.set(id, existing);
  };

  // Add character assets
  for (const c of show.characters || []) {
    addAssetRef(c.portraitAssetId, 'character.portrait', `Character: ${c.name || c.handle}`);
    addAssetRef(c.visualAnchorAssetId, 'character.visualAnchor', `Character: ${c.name || c.handle}`);
  }

  // Add setting assets
  for (const s of show.settingAnchors || []) {
    addAssetRef(s.assetId, 'settingAnchor', `Setting: ${s.name}`);
  }

  // Add locked references
  for (const lr of show.lockedReferences || []) {
    addAssetRef(lr.assetId, `lockedReference.${lr.type}`, `Locked Ref: ${lr.label || lr.id}`);
  }

  // Add cover anchor
  if (show.coverAnchorAssetId) {
    addAssetRef(show.coverAnchorAssetId, 'coverAnchor', 'Show Cover Anchor');
  }

  // Add comic gallery
  for (const entry of show.comicGallery || []) {
    addAssetRef(entry.assetId, `comicGallery.${entry.status}`, `Gallery Entry: ${entry.beatFid || 'unassigned'}`);
  }

  // Add actual production image version assets
  for (const iv of showImageVersions) {
    addAssetRef(iv.assetId, `productionImage.${iv.status}`, `Page version: ${iv.productionPageUid}`);
    if (Array.isArray(iv.panelAssetIds)) {
      iv.panelAssetIds.forEach((pid: string) => {
        addAssetRef(pid, 'productionPanel', `Panel under page version: ${iv.productionPageUid}`);
      });
    }
  }

  // 3. Build manifests & health diagnostic summaries
  // Character reference manifest
  const characterManifest: any[] = [];
  for (const c of show.characters || []) {
    const portraitExists = c.portraitAssetId ? await AssetStorage.exists(c.portraitAssetId) : false;
    const anchorExists = c.visualAnchorAssetId ? await AssetStorage.exists(c.visualAnchorAssetId) : false;
    const hasUsableReference = portraitExists || anchorExists;
    const hasReferenceIdButMissingAsset = 
      (!!c.portraitAssetId && !portraitExists) || (!!c.visualAnchorAssetId && !anchorExists);

    const warnMsgs: string[] = [];
    if (!!c.portraitAssetId && !portraitExists) {
      warnMsgs.push(`Portrait asset ${c.portraitAssetId} is missing from db`);
    }
    if (!!c.visualAnchorAssetId && !anchorExists) {
      warnMsgs.push(`Visual anchor asset ${c.visualAnchorAssetId} is missing from db`);
    }

    characterManifest.push({
      characterId: c.id,
      handle: c.handle,
      displayName: c.name,
      portraitAssetId: c.portraitAssetId || null,
      visualAnchorAssetId: c.visualAnchorAssetId || null,
      hasUsableReference,
      hasReferenceIdButMissingAsset,
      warnings: warnMsgs
    });
  }

  // File system asset packing and manifest construction
  const zip = new JSZip();
  const assetsFolder = zip.folder('assets')!;
  const packedAssetsManifest: any[] = [];

  for (const id of assetIds) {
    const blob = await AssetStorage.getBlob(id);
    const mimeType = blob?.type || 'image/png';
    const size = blob?.size ?? null;
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const zipPath = `assets/${id}.${ext}`;
    const refs = assetReferencesMap.get(id) || [];

    if (blob) {
      try {
        const buf = await blob.arrayBuffer();
        assetsFolder.file(`${id}.${ext}`, buf);
      } catch (e: any) {
        warnings.push(`Failed to pack asset binary data for ID ${id}: ${e.message}`);
      }
    } else {
      warnings.push(`Asset ${id} is referenced but could not be loaded from storage.`);
    }

    packedAssetsManifest.push({
      assetId: id,
      filename: blob ? zipPath : null,
      mimeType,
      size,
      referencedBy: refs,
      binaryDataIncluded: !!blob
    });
  }

  // Story pipeline health summary
  const pipelineSpecs = getAllPassSpecs();
  const passStatuses = showRuns.length > 0
    ? computePassStatuses(showRuns[0], showArtifacts, showConsoleEntries, [], null, show)
    : {};

  const storyPipelineHealth: any[] = [];
  for (const spec of pipelineSpecs) {
    const passId = spec.id;
    const outputType = spec.outputArtifactType;
    const computedStatus = passStatuses[passId] || 'pending';

    // Scoped historical data
    const passArtifacts = showArtifacts.filter(a => a.createdByPass === passId && a.artifactType === outputType);
    const passConsoleEntries = showConsoleEntries.filter(c => c.pass === passId);
    const passRuns = showRuns.filter(r => r.currentPass === passId);

    // Latest Run & Artifact details
    const latestArt = [...passArtifacts].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    const latestRun = [...passRuns].sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    const errors = passConsoleEntries.filter(c => c.error !== null);
    const latestError = [...errors].sort((a, b) => b.createdAt - a.createdAt)[0] || null;

    const historicalErrorsExist = errors.length > 0;
    const sortedEntries = [...passConsoleEntries].sort((a, b) => a.createdAt - b.createdAt);
    let successExistsAfterError = false;
    if (historicalErrorsExist) {
      const firstErrorIdx = sortedEntries.findIndex(c => c.error !== null);
      successExistsAfterError = sortedEntries.slice(firstErrorIdx + 1).some(c => c.error === null && !!c.output);
    }

    let blockerReason = '';
    const missingReqs = spec.requires.filter(reqType => !showArtifacts.some(a => a.artifactType === reqType));
    if (missingReqs.length > 0) {
      blockerReason = `Blocked by missing requires: ${missingReqs.join(', ')}`;
    }

    const details = (passStatuses as any)?._details?.[passId] || {};
    storyPipelineHealth.push({
      passId,
      outputArtifactType: outputType,
      computedStatus: details.status || computedStatus,
      reason: details.reason || blockerReason || null,
      latestArtifactId: details.latestArtifactId || latestArt?.id || null,
      latestArtifactCreatedAt: latestArt?.createdAt || null,
      latestRunId: details.latestRunId || latestRun?.id || null,
      latestRunStatus: latestRun?.status || null,
      latestError: details.latestError || (latestError?.error || null),
      historicalErrorsExist,
      successExistsAfterError: successExistsAfterError || !!details.latestSuccessAfterError,
      artifactCount: passArtifacts.length,
      warningCount: passConsoleEntries.reduce((total, c) => total + ((c.output?.warning || c.output?.warningText || JSON.stringify(c).includes('warning')) ? 1 : 0), 0),
      blockerReason: details.reason || blockerReason || null,
      artifactsCounted: details.artifactsCounted || [],
      consoleEntriesCounted: details.consoleEntriesCounted || [],
      runsCounted: details.runsCounted || [],
      expectedCountSource: details.expectedCountSource || 'show-definition'
    });
  }

  // Specific 0.9W screenplay diagnostics
  const targetStructureArt = showArtifacts
    .filter(a => a.artifactType === ArtifactType.SCENE_STRUCTURE)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  let expectedScenesCount = 0;
  let expectedCountSource = 'show-definition';

  if (targetStructureArt && targetStructureArt.payload && Array.isArray((targetStructureArt.payload as any).acts)) {
    const acts = (targetStructureArt.payload as any).acts;
    for (const act of acts) {
      if (act && Array.isArray(act.scenes)) {
        expectedScenesCount += act.scenes.length;
      }
    }
    expectedCountSource = `gnds-artifact-${targetStructureArt.id}`;
  } else {
    expectedScenesCount = show.seasons?.[0]?.episodes?.[0]?.acts?.reduce(
      (sum, act) => sum + (act.scenes?.length ?? 0), 0
    ) ?? 0;
  }

  const latestW = showArtifacts
    .filter(a => a.artifactType === ArtifactType.SCENE_SCRIPT)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const wPayload = latestW?.payload as SceneScriptPayload | undefined;
  const rawScenes = wPayload?.scenes || [];

  const scenesMissingScreenplay = rawScenes.filter(s => !s.screenplay).map(s => `Act ${s.actNumber} Scene ${s.sceneNumber}: ${s.title}`);
  const scenesWithEmptyScreenplay = rawScenes.filter(s => s.screenplay && !s.screenplay.trim()).map(s => `Act ${s.actNumber} Scene ${s.sceneNumber}: ${s.title}`);
  const hasScriptArrays = rawScenes.some(s => Array.isArray(s.script) && s.script.length > 0);

  const test09WDiagnostics = {
    screenplayScenesExpected: expectedScenesCount,
    screenplayScenesPresent: rawScenes.length,
    scenesMissingScreenplay,
    scenesWithEmptyScreenplay,
    scriptArraysPresent: hasScriptArrays,
    scriptArraysRequired: true
  };

  // Specific 0.9G segmentations & 12D output checks
  const latestG = showArtifacts
    .filter(a => (a.artifactType === ArtifactType.SCENE_STRUCTURE || a.artifactType === ArtifactType.SEGMENTATION_PLAN) && a.createdByPass === '0.9G')
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const gPayload = latestG?.payload as any;
  const gScenes: any[] = [];
  if (gPayload) {
    if (Array.isArray(gPayload.acts)) {
      for (const act of gPayload.acts) {
        if (act && Array.isArray(act.scenes)) {
          for (const sc of act.scenes) {
            gScenes.push({
              actNumber: act.actNumber,
              sceneNumber: sc.sceneNumber,
              pageBeats: sc.pageBeats || sc.beats || []
            });
          }
        }
      }
    } else if (Array.isArray(gPayload.scenes)) {
      for (const sc of gPayload.scenes) {
        gScenes.push({
          actNumber: sc.actNumber,
          sceneNumber: sc.sceneNumber,
          pageBeats: sc.pageBeats || sc.beats || []
        });
      }
    }
  }

  let isPageBeatMissingUnitIndices = false;
  let hasDeadUnitIndices = false;
  let hasDialogueLinkageProblems = false;

  const sceneAudits: any[] = [];

  for (const gs of gScenes) {
    const ws = rawScenes.find(s => s.actNumber === gs.actNumber && s.sceneNumber === gs.sceneNumber);
    const expectedUnitsCount = ws?.script?.length ?? 0;

    const coveredIndices = new Set<number>();
    let invalidIndicesCount = 0;
    let pageBeatScriptPopulated = true;
    let dialogueUnitsPreserved = true;

    const resolvedCharacterIds = new Set<string>();
    const resolvedCharacterHandles = new Set<string>();
    const unresolvedSpeakerNames = new Set<string>();

    const pageBeats = gs.pageBeats || [];
    for (const pb of pageBeats) {
      if (!Array.isArray(pb.unitIndices) || pb.unitIndices.length === 0) {
        isPageBeatMissingUnitIndices = true;
      } else if (ws?.script) {
        pb.unitIndices.forEach((idx: number) => {
          if (idx < 0 || idx >= ws.script!.length) {
            invalidIndicesCount++;
            hasDeadUnitIndices = true;
          } else {
            coveredIndices.add(idx);
          }
        });
      }

      const scriptEntries = pb.script?.entries || pb.script || [];
      if (pb.beatType === 'DIALOGUE') {
        if (scriptEntries.length === 0) {
          hasDialogueLinkageProblems = true;
          pageBeatScriptPopulated = false;
        }
      }

      scriptEntries.forEach((entry: any) => {
        if (entry.kind === 'line') {
          if (entry.characterId) {
            resolvedCharacterIds.add(entry.characterId);
          }
          if (entry.characterHandle) {
            resolvedCharacterHandles.add(entry.characterHandle);
          }
          if (entry.speakerName && !entry.characterId) {
            unresolvedSpeakerNames.add(entry.speakerName);
          }
        }
      });
    }

    const missingIndices: number[] = [];
    for (let i = 0; i < expectedUnitsCount; i++) {
      if (!coveredIndices.has(i)) {
        missingIndices.push(i);
      }
    }

    sceneAudits.push({
      actNumber: gs.actNumber,
      sceneNumber: gs.sceneNumber,
      expectedUnits: expectedUnitsCount,
      coveredUnits: coveredIndices.size,
      missingUnits: missingIndices,
      invalidUnitIndices: invalidIndicesCount,
      pageBeatCount: pageBeats.length,
      pageBeatScriptPopulated,
      dialogueUnitsPreserved,
      resolvedCharacterIds: Array.from(resolvedCharacterIds),
      resolvedCharacterHandles: Array.from(resolvedCharacterHandles),
      unresolvedSpeakerNames: Array.from(unresolvedSpeakerNames)
    });
  }

  // Dialogue linkage checks on PageBeats in Active Issues
  let hasActiveDialogueSpeakerIssues = false;
  let totalActiveDialogueBeatsCount = 0;
  let failedActiveDialogueBeatsCount = 0;

  for (const iss of show.issues || []) {
    for (const act of iss.acts || []) {
      for (const sc of act.scenes || []) {
        for (const pb of sc.pageBeats || []) {
          if (pb.beatType === 'DIALOGUE') {
            totalActiveDialogueBeatsCount++;
            const scriptEntries = pb.script?.entries || [];
            if (scriptEntries.length === 0) {
              hasDialogueLinkageProblems = true;
              failedActiveDialogueBeatsCount++;
            }
            // Check character mapping
            const hasSpeakers = scriptEntries.some(e => e.characterHandle);
            if (hasSpeakers && (!pb.characterIds || pb.characterIds.length === 0)) {
              hasActiveDialogueSpeakerIssues = true;
            }
          }
        }
      }
    }
  }

  const test09GDiagnostics = {
    scenesExpected: expectedScenesCount,
    scenesSegmented: gScenes.length,
    allPageBeatsHaveUnitIndices: !isPageBeatMissingUnitIndices,
    allUnitIndicesResolveCorrectly: !hasDeadUnitIndices,
    pageBeatScriptPopulated: !hasDialogueLinkageProblems,
    activeDialogueBeatsCount: totalActiveDialogueBeatsCount,
    failedActiveDialogueBeatsCount,
    hasActiveDialogueSpeakerIssues,
    sceneAudits
  };

  // Specific image version references & safety preflight checks
  const preflightPages: any[] = [];
  for (const iss of show.issues || []) {
    for (const act of iss.acts || []) {
      for (const sc of act.scenes || []) {
        for (const pb of sc.pageBeats || []) {
          const charIdsInBeat = pb.characterIds || [];
          const resResult = resolveCanonicalCharacters(show, charIdsInBeat);

          // Canonical three preflight block conditions
          const isMissingPortraitsOrAnchors = resResult.missingReferenceAssets.length > 0;
          const hasUnresolved = resResult.unresolvedIdentifiers.length > 0;
          const hasNoResolvedButSelected = charIdsInBeat.length > 0 && resResult.resolvedCharacters.length === 0;

          const shouldHaveBeenBlocked = charIdsInBeat.length > 0 && (
            hasNoResolvedButSelected ||
            hasUnresolved ||
            isMissingPortraitsOrAnchors
          );

          // Check if images are generated for this pageUid
          const pgUid = pb.productionPageUid;
          const versions = showImageVersions.filter(v => v.productionPageUid === pgUid);
          const hasGeneratedDrafts = versions.length > 0;

          const unsafeGenerationDetected = hasGeneratedDrafts && shouldHaveBeenBlocked;

          const warnings: string[] = [];
          if (hasNoResolvedButSelected) {
            warnings.push(`Selected character IDs are present, but none resolve to characters.`);
          }
          if (hasUnresolved) {
            warnings.push(`Unresolved selected character identifiers: ${resResult.unresolvedIdentifiers.join(', ')}`);
          }
          if (isMissingPortraitsOrAnchors) {
            warnings.push(`Members lack landscape portraits or anchors: ${resResult.missingReferenceAssets.map(c => c.handle || c.id).join(', ')}`);
          }

          preflightPages.push({
            pageBeatUid: pb.uid,
            address: pb.address,
            characterIds: charIdsInBeat,
            resolvedCharactersCount: resResult.resolvedCharacters.length,
            missingReferencesCount: resResult.missingReferenceAssets.length + resResult.unresolvedIdentifiers.length,
            shouldHaveBeenBlocked,
            hasGeneratedDrafts,
            unsafeGenerationDetected,
            warnings
          });
        }
      }
    }
  }

  const swPreflightSummary = {
    totalPagesChecked: preflightPages.length,
    pagesUnsafeDueToMissingRefs: preflightPages.filter(pg => pg.unsafeGenerationDetected).length,
    pagesShouldHaveBeenBlocked: preflightPages.filter(pg => pg.shouldHaveBeenBlocked).length,
    details: preflightPages
  };

  // 4. Status Summary export
  const defaultEpisodeIds = show.seasons?.[0]?.episodes?.map(e => e.id) || [];
  const statusSummary = {
    showId,
    showCode: show.showCode,
    episodesCount: defaultEpisodeIds.length,
    computedStatuses: passStatuses,
    analyzedRunsCount: showRuns.length,
    analyzedArtifactsCount: showArtifacts.length,
    analyzedConsoleEntriesCount: showConsoleEntries.length,
    rawInputs: {
      activeRunId: showRuns[0]?.id || null,
      activeRunStatus: showRuns[0]?.status || null,
      scopeEpisodeIds: showRuns[0]?.scopeEpisodeIds || [],
      defaultEpisodeIds
    }
  };

  // 5. Structure ZIP folder layout & write files
  zip.file('show.json', JSON.stringify(show, null, 2));
  zip.file('asset-manifest.json', JSON.stringify(packedAssetsManifest, null, 2));
  zip.file('character-reference-manifest.json', JSON.stringify(characterManifest, null, 2));

  const psb4Folder = zip.folder('psb4')!;
  psb4Folder.file('runs.json', JSON.stringify(showRuns, null, 2));
  psb4Folder.file('artifacts.json', JSON.stringify(showArtifacts, null, 2));
  psb4Folder.file('console-entries.json', JSON.stringify(showConsoleEntries, null, 2));
  // Keep original structures and don't fail if empty
  psb4Folder.file('source.json', JSON.stringify(showSources, null, 2));
  psb4Folder.file('corpus.json', JSON.stringify(showCorpora, null, 2));

  const productionFolder = zip.folder('production')!;
  productionFolder.file('image-versions.json', JSON.stringify(showImageVersions, null, 2));
  productionFolder.file('sw-preflight-summary.json', JSON.stringify(swPreflightSummary, null, 2));

  const vpsFolder = zip.folder('vps')!;
  vpsFolder.file('runs.json', JSON.stringify(showVpsRuns, null, 2));
  vpsFolder.file('records.json', JSON.stringify(showVpsRecords, null, 2));

  const healthFolder = zip.folder('health')!;
  healthFolder.file('story-pipeline-health.json', JSON.stringify({
    summary: {
      expectedScenesCount,
      totalRunsAnalyzed: showRuns.length,
      totalArtifactsAnalyzed: showArtifacts.length
    },
    passHealth: storyPipelineHealth,
    diagnostics_0_9W: test09WDiagnostics,
    diagnostics_0_9G: test09GDiagnostics
  }, null, 2));
  healthFolder.file('status-summary.json', JSON.stringify(statusSummary, null, 2));

  const buildDateStr = new Date().toISOString();
  healthFolder.file('export-notes.txt', `Prestige Show Builder 4 Diagnostic Debug Bundle
Export Date: ${buildDateStr}
Show Identifier: ${showId}
Show Code: ${show.showCode || 'N/A'}
Show Title: ${show.titleSuggestion || show.name}
Total Exported Runs: ${showRuns.length}
Total Exported Artifacts: ${showArtifacts.length}
Total Exported Console Entries: ${showConsoleEntries.length}
Warnings Detected: ${warnings.length}
${warnings.length > 0 ? '\nWARNINGS DETAIL:\n' + warnings.map((w, i) => `${i + 1}. ${w}`).join('\n') : '\nNo critical warnings detected during bundle generation.'}
`);

  zip.file('manifest.json', JSON.stringify({
    exportType: 'psb4-debug-bundle',
    exportedAt: buildDateStr,
    showId,
    showTitle: show.titleSuggestion || show.name,
    projectId: (show as any).projectId || null,
    appVersion: '4.0.0-Prestige',
    storesIncluded: {
      show: true,
      assets: true,
      psb4_runs: true,
      psb4_artifacts: true,
      psb4_console_entries: true,
      psb4_source: true,
      psb4_corpus: true,
      production_image_versions: true,
      vps_runs: true,
      vps_records: true
    },
    recordCounts: {
      psb4_runs: showRuns.length,
      psb4_artifacts: showArtifacts.length,
      psb4_console_entries: showConsoleEntries.length,
      production_image_versions: showImageVersions.length
    },
    warnings
  }, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
