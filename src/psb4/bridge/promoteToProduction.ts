import { Show, Episode } from '../../types/show';
import { Psb4Artifact, SceneStructurePayload } from '../types';
import {
  Issue, ProductionAct, ProductionScene, PageBeat,
  ProductionPage, IssueManifest, PromotionRecord, UID
} from '../../types/production';
import { generateUID } from '../../domainUtils';
import { resolveCharacter } from '../../domainUtils';
import { VaultStorage } from '../../storage/VaultStorage';
import { pageContentHash, scriptFingerprint } from '../../vps/contentHash';
import { getActiveVpsRun, markVpsRecordsStale } from '../../vps/storage';

export interface PromotionResult {
  issue: Issue;
  pages: ProductionPage[];
  manifest: IssueManifest;
  record: PromotionRecord;
}

export async function promoteToProduction(
  show: Show,
  artifact: Psb4Artifact             // SCENE_STRUCTURE
): Promise<PromotionResult> {
  if (!artifact.episodeId) {
    throw new Error('Artifact has no episodeId — cannot promote.');
  }
  const payload = artifact.payload as SceneStructurePayload;
  if (!payload?.acts?.length) {
    throw new Error('Artifact payload is empty or invalid.');
  }

  // Find the source Episode.
  let sourceEpisode: Episode | null = null;
  for (const s of show.seasons) {
    const ep = s.episodes.find(
      e => e.id === artifact.episodeId || e.fid === artifact.episodeId
    );
    if (ep) { sourceEpisode = ep; break; }
  }
  if (!sourceEpisode) {
    throw new Error(`Episode not found: ${artifact.episodeId}`);
  }

  // Derive issue number from episode number or existing issues count.
  const issueNumber = sourceEpisode.number
    ?? (show.issues?.length ?? 0) + 1;
  const issueCode = `${show.showCode ?? 'SH'}-I${String(issueNumber).padStart(2,'0')}`;
  
  const priorIssue = (show.issues ?? []).find(
    i => i.issueCode === issueCode || i.legacyEpisodeId === sourceEpisode.id
  );
  const issueUid: UID = priorIssue?.uid ?? generateUID();

  const priorByFid = new Map<string, { pb: PageBeat; pageUid?: string }>();
  if (priorIssue) {
    for (const act of priorIssue.acts) {
      for (const sc of act.scenes) {
        for (const pb of sc.pageBeats) {
          const fid = (pb as any).sourceBeatFid ?? pb.address;
          priorByFid.set(fid, { pb, pageUid: pb.productionPageUid });
        }
      }
    }
  }

  // PromotionRecord: maps old beatFid → new PageBeat UID.
  const beatFidToPageBeatUid: Record<string, UID> = {};

  // Build hierarchy from payload.
  const acts: ProductionAct[] = payload.acts.map((pAct, aIdx) => {
    const actUid: UID = generateUID();
    const scenes: ProductionScene[] = pAct.scenes.map((pScene, scIdx) => {
      const sceneUid: UID = generateUID();
      const pageBeats: PageBeat[] = pScene.beats.map((pBeat, bIdx) => {
        const pbUid: UID = generateUID();
        const address = `${issueCode}-A${aIdx+1}-SC${String(scIdx+1).padStart(2,'0')}-PB${String(bIdx+1).padStart(2,'0')}`;

        // Map character handles to IDs. Only keep resolved roster characters.
        const characterIds: string[] = [];
        for (const h of pBeat.characterHandles ?? []) {
          const c = resolveCharacter(show, h);
          if (c) {
            characterIds.push(c.id);
          }
        }

        // Build script from payload if present.
        const hasScript = Array.isArray(pBeat.script) && pBeat.script.length > 0;
        const script = hasScript ? {
          gndsSourceId: `${artifact.id}-${bIdx}`,
          aiGenerated: true,
          entries: pBeat.script!.map((e, si) => {
            const fid = `${address}-SE${si}`;
            if (e.kind === 'caption') {
              return { kind: 'caption' as const, fid,
                text: e.text ?? '', style: e.captionStyle ?? 'grey',
                characterHandle: e.characterHandle };
            }

            const resolvedChar = e.characterHandle ? resolveCharacter(show, e.characterHandle) : undefined;
            const finalHandle = resolvedChar ? (resolvedChar.handle || `@${resolvedChar.id}`) : undefined;

            return { 
              fid, 
              characterHandle: finalHandle ?? 'UNKNOWN',
              text: e.text ?? '', 
              parenthetical: e.parenthetical,
              isDone: false,
              speakerName: e.speakerName || e.characterName
            };
          }),
          lines: [],
        } : undefined;

        // Record old FID mapping if the source beat had one.
        const baseFid = pBeat.legacyFid ?? pBeat.sourceBeatFid;
        const legacyFid = baseFid ? `${baseFid}::${address}` : address;
        if (legacyFid) beatFidToPageBeatUid[legacyFid] = pbUid;

        const fid = (pBeat as any).fid ?? legacyFid;

        const pageBeat: PageBeat = {
          uid: pbUid,
          address,
          number: bIdx + 1,
          description: pBeat.description ?? '',
          beatType: pBeat.beatType ?? 'DIALOGUE',
          characterIds,
          subtext: pBeat.subtext ?? '',
          visualNote: pBeat.visualNote ?? '',
          direction: pBeat.direction ?? '',
          script,
          gndsSource: pBeat.source ?? 'new',
          visualDirection: undefined,
          panelPlans: undefined,
          panelProps: undefined,
          panelPlanStale: false,
        };

        (pageBeat as any).sourceBeatFid = fid;

        const newHash = pageContentHash(pageBeat);
        pageBeat.contentHash = newHash;
        pageBeat.scriptFingerprint = scriptFingerprint(pageBeat);

        const prior = priorByFid.get(fid);
        if (prior && prior.pb.contentHash === newHash) {
          // Unchanged page — carry forward applied direction.
          pageBeat.visualDirection = prior.pb.visualDirection;
          pageBeat.panelPlans = prior.pb.panelPlans;
          pageBeat.panelProps = prior.pb.panelProps;
          pageBeat.panelPlanStale = prior.pb.panelPlanStale ?? false;
        }
        // Remember the desired stable page uid for the page-build step.
        (pageBeat as any).__reusePageUid = prior?.pageUid;

        return pageBeat;
      });

      // Seed dialogue-free beats with the scene's character union so
      // silent / TABLEAU pages keep a character anchor for reference
      // attachment. Fallback only — beats that already resolved are
      // left untouched. The resolver dedupes by character id, so an
      // over-inclusive union costs nothing.
      const sceneCharIds = Array.from(
        new Set(pageBeats.flatMap(pb => pb.characterIds ?? []))
      );
      pageBeats.forEach(pb => {
        if (!pb.characterIds || pb.characterIds.length === 0) {
          pb.characterIds = [...sceneCharIds];
        }
      });

      const settingStr = (pScene.setting ?? '').toLowerCase().trim();
      const matchedAnchor = ((show as any).settingAnchors ?? []).find((a: any) =>
        a.name.toLowerCase() === settingStr ||
        (a.shortName?.toLowerCase() === settingStr)
      );

      return {
        uid: sceneUid,
        number: pScene.sceneNumber,
        title: pScene.title ?? `Scene ${pScene.sceneNumber}`,
        setting: pScene.setting ?? '',
        dramaticWant: pScene.dramaticWant ?? '',
        sceneFunction: pScene.function ?? '',
        pageBeats,
        settingAnchorId: matchedAnchor?.id,
      };
    });

    return {
      uid: actUid,
      number: pAct.actNumber,
      title: pAct.title ?? `Act ${pAct.actNumber}`,
      scenes,
    };
  });

  // Collect all PageBeats in order.
  const allPageBeats = acts.flatMap(a => a.scenes.flatMap(s => s.pageBeats));

  // Build ProductionPage for each PageBeat.
  const pages: ProductionPage[] = allPageBeats.map(pb => {
    const reusedUid = (pb as any).__reusePageUid;
    const priorPage = reusedUid ? (show.productionPages ?? []).find(pg => pg.uid === reusedUid) : null;
    return {
      uid: reusedUid ?? generateUID(),
      showId: show.id,
      issueUid,
      pageBeatUid: pb.uid,
      source: 'gnds' as const,
      status: priorPage ? priorPage.status : ('planned' as const),
      approvedImageVersionUid: priorPage ? priorPage.approvedImageVersionUid : undefined,
      createdAt: priorPage ? priorPage.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
  });

  // Wire PageBeat.productionPageUid back to each page.
  // (PageBeat is already built — update via lookup)
  const pageByBeatUid = Object.fromEntries(pages.map(pg => [pg.pageBeatUid, pg.uid]));
  allPageBeats.forEach(pb => { pb.productionPageUid = pageByBeatUid[pb.uid]; });

  // Build IssueManifest.
  const manifest: IssueManifest = {
    uid: generateUID(),
    showId: show.id,
    issueUid,
    pageOrder: pages.map(pg => pg.uid),
    updatedAt: Date.now(),
  };

  // Build Issue.
  const issue: Issue = {
    uid: issueUid,
    showId: show.id,
    legacyEpisodeId: sourceEpisode.id,
    issueCode,
    number: issueNumber,
    title: sourceEpisode.title ?? `Issue ${issueNumber}`,
    arcSummary: sourceEpisode.summary ?? '',
    acts,
    gndsArtifactId: artifact.id,
    promotedAt: Date.now(),
    status: 'active',
  };

  // Build PromotionRecord.
  const record: PromotionRecord = {
    uid: generateUID(),
    showId: show.id,
    legacyEpisodeId: sourceEpisode.id,
    issueUid,
    gndsArtifactId: artifact.id,
    promotedAt: Date.now(),
    beatFidToPageBeatUid,
  };

  // Persist via DA-002 storage helper.
  await VaultStorage.writePromotion(
    show.id, issue, pages, manifest, record, sourceEpisode.id
  );

  // After writePromotion succeeds, flag changed vps records as stale
  const vpsRun = await getActiveVpsRun(show.id, issueUid);
  if (vpsRun) {
    const changedPageUids = new Set<string>();
    for (const act of issue.acts) {
      for (const sc of act.scenes) {
        for (const pb of sc.pageBeats) {
          const pr = priorByFid.get((pb as any).sourceBeatFid ?? pb.address);
          if (!pr || pr.pb.contentHash !== pb.contentHash) {
            if (pb.productionPageUid) changedPageUids.add(pb.productionPageUid);
          }
        }
      }
    }
    if (changedPageUids.size > 0) {
      await markVpsRecordsStale(vpsRun.id, [...changedPageUids], 'content-changed');
    }
  }

  return { issue, pages, manifest, record };
}
