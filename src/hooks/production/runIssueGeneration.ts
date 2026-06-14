// runIssueGeneration.ts — DA-077
// Bulk issue generation on the one-pass contract path. Each page goes through
// canonical resolution → FinalPageBeat contract → preflight → ONE model call
// that returns the finished, lettered page. The two-pass lettering option is
// removed entirely.

import { Show } from '../../types/show';
import { Issue, ProductionPage, PageBeat, ImageVersion }
  from '../../types/production';
import {
  findCanonicalPageBeat, buildFinalPageBeat, validateFinalPage,
} from '../../ai/imageGeneration/finalPageContract';
import { generateFinalComicPage }
  from '../../ai/imageGeneration/generateFinalComicPage';
import { loadSettingAnchorRef } from './productionPageRefs';
import { resolveProductionCharacterRefs } from './productionCharacterRefs';
import { writeImageVersion, updateProductionPage, getImageVersionsForPage, deleteUnapprovedVersionsForPage }
  from '../../storage/ProductionStorage';
import { AssetStorage } from '../../storage';
import { generateUID } from '../../domainUtils';

export interface IssueGenProgress {
  index: number;          // 0-based position in the run
  total: number;
  pageUid: string;
  address: string;        // PageBeat.address, for display
  phase: 'generating' | 'done' | 'skipped' | 'error';
  error?: string;
}

export interface IssueGenOptions {
  skipApproved: boolean;  // leave approved/lettered pages untouched
  skipExisting?: boolean; // skip pages that already have a draft
  onProgress?: (p: IssueGenProgress) => void;
  signal?: AbortSignal;   // cooperative cancel
  dispatch?: (a: any) => void;
}

export interface IssueGenResult {
  generated: number; skipped: number; failed: number;
}

// Resolve a ProductionPage uid → its PageBeat by walking the issue.
function findPageBeat(
  issue: Issue, pageUid: string
): { pb: PageBeat; sceneUid: string; settingAnchorId?: string } | null {
  for (const act of issue.acts) {
    for (const sc of act.scenes) {
      const pb = sc.pageBeats.find(b => b.productionPageUid === pageUid);
      if (pb) return { pb, sceneUid: sc.uid, settingAnchorId: sc.settingAnchorId };
    }
  }
  return null;
}

export async function runIssueGeneration(
  show: Show,
  issueUid: string,
  manifestPageOrder: string[],   // ProductionPage uids, publication order
  pagesByUid: Record<string, ProductionPage>,
  options: IssueGenOptions
): Promise<IssueGenResult> {
  const issue = (show.issues ?? []).find(i => i.uid === issueUid);
  const result: IssueGenResult = { generated: 0, skipped: 0, failed: 0 };
  if (!issue) return result;

  // Running continuity window — refs from pages generated in THIS run.
  const priorRefs: { dataUri: string; label: string;
    assetId: string }[] = [];
  const WINDOW = 3;  // last N pages as continuity references

  const total = manifestPageOrder.length;
  for (let i = 0; i < total; i++) {
    if (options.signal?.aborted) break;
    const pageUid = manifestPageOrder[i];
    const page = pagesByUid[pageUid];

    const found = findPageBeat(issue, pageUid);
    const emit = (phase: IssueGenProgress['phase'],
      error?: string) => options.onProgress?.(
        { index: i, total, pageUid,
          address: found?.pb.address ?? pageUid, phase, error });

    if (!found || !page) { result.skipped++; emit('skipped'); continue; }

    // Respect already-finished pages.
    if (options.skipApproved &&
        (page.status === 'approved' || page.status === 'lettered' ||
         page.status === 'exported')) {
      result.skipped++; emit('skipped');
      // Still feed an approved page forward for continuity if we can.
      const bestVerUid = page.approvedImageVersionUid;
      try {
        const versions = await getImageVersionsForPage(page.uid);
        const ver = (bestVerUid && versions.find(v => v.uid === bestVerUid))
          || versions.find(v => v.status === 'approved')
          || versions[0];
        if (ver) {
          const dataUri = await AssetStorage.getDataUri(ver.assetId);
          if (dataUri) {
            priorRefs.push({
              dataUri,
              label: `prior page ${found.pb.address}`,
              assetId: ver.assetId,
            });
          }
        }
      } catch { /* non-fatal */ }
      continue;
    }

    if (options.skipExisting) {
      const existing = await getImageVersionsForPage(page.uid);
      if (existing.length) {
        result.skipped++;
        emit('skipped');
        const latest = [...existing].sort((a, b) => b.createdAt - a.createdAt)[0];
        const uri = await AssetStorage.getDataUri(latest.assetId);
        if (uri) {
          priorRefs.push({
            dataUri: uri,
            label: `prior page ${found.pb.address}`,
            assetId: latest.assetId,
          });
        }
        continue;
      }
    }

    try {
      emit('generating');
      const { pb, sceneUid, settingAnchorId } = found;

      // Canonical resolution — duplicate uids / address-twins block (spec §2).
      const canonical = findCanonicalPageBeat(show, pb.uid);
      if (canonical.errors.length > 0) {
        throw new Error(canonical.errors[0]);
      }

      // Overwrite semantics: a generated-but-unapproved page gets its
      // prior drafts cleared so the run replaces, not stacks.
      await deleteUnapprovedVersionsForPage(page.uid);

      const dispatchLog = options.dispatch;
      // Hard-gate character references before generation.
      const refResolution = await resolveProductionCharacterRefs({
        pageBeat: pb,
        show,
        dispatch: dispatchLog,
      });

      if (refResolution.missing.length > 0) {
        const names = refResolution.missing.map(m => m.characterName).join(', ');
        throw new Error(
          `Cannot generate ${pb.address}: missing required character reference image(s): ${names}`
        );
      }

      // Load setting anchor reference.
      const settingRef = await loadSettingAnchorRef(settingAnchorId, show);

      const charRefs = refResolution.loadedRefs;

      const allCharRefs = [
        ...(settingRef.imageRef ? [settingRef.imageRef] : []),
        ...charRefs,
      ].map(r => ({
        dataUri: r.dataUri,
        label: r.label,
        description: (r as any).description,
        isCharacter: (r as any).isCharacter,
        assetId: r.assetId,
      }));

      const settingPrefix = (!settingRef.imageRef && settingRef.settingNote)
        ? settingRef.settingNote + '\n' : '';

      // Contract + preflight (spec §4, §5, §9).
      const windowedPriors = priorRefs.slice(-WINDOW);
      const { contract, problems } = buildFinalPageBeat(
        show, pb, canonical.issueUid, canonical.sceneUid || sceneUid);
      const preflight = validateFinalPage(contract, problems, {
        characterRefs: charRefs.length,
        settingRefs: settingRef.imageRef ? 1 : 0,
        lockedRefs: 0,
        priorPages: windowedPriors.length,
      });
      preflight.warnings.forEach(w =>
        dispatchLog?.({ type: 'PIPELINE_LOG', log: `⚠️ ${pb.address}: ${w}` }));
      if (!preflight.ok) {
        throw new Error(preflight.errors[0]);
      }

      if (dispatchLog) {
        dispatchLog({
          type: 'PIPELINE_LOG',
          log: [
            `PAGE IMAGE PREFLIGHT: ${pb.address}`,
            `Required characters: ${refResolution.required.map(m => m.characterName).join(', ') || 'none'}`,
            `Character refs loaded: ${charRefs.map(m => m.characterName).join(', ') || 'none'}`,
            `Character ref inline parts: ${charRefs.length}`,
            `Prior page refs: ${windowedPriors.length}`,
            `Setting refs: ${settingRef.imageRef ? 1 : 0}`,
            `Silent page: ${contract.silentPage ? 'yes' : 'no'}`,
          ].join('\n'),
        });
      }

      // ONE model call → finished, lettered page (spec §1, §8).
      const gen = await generateFinalComicPage(
        show, contract, windowedPriors, allCharRefs, {
          mode: 'paid',
          directorNote: settingPrefix || undefined,
          requiredCharacterAssetIds: refResolution.loadedRefs.map(r => r.assetId),
        });
      if (!gen?.assetId) { result.failed++; emit('error', 'no asset');
        continue; }

      const finalVersion: ImageVersion = {
        uid: generateUID(), showId: show.id,
        productionPageUid: page.uid, assetId: gen.assetId,
        variantType: 'final', status: 'draft', createdAt: Date.now(),
        metadata: gen.metadata,
      };
      await writeImageVersion(show.id, finalVersion);
      await updateProductionPage(show.id, page.uid,
        { status: 'generated' });
      result.generated++;

      // Feed this freshly generated page forward for continuity.
      const dataUri = await AssetStorage.getDataUri(gen.assetId);
      if (dataUri) priorRefs.push(
        { dataUri, label: `prior page ${pb.address}`,
          assetId: gen.assetId });

      emit('done');
    } catch (e) {
      result.failed++;
      emit('error', e instanceof Error ? e.message : String(e));
      // Continue to the next page; one failure does not stop the run.
    }
  }

  return result;
}
