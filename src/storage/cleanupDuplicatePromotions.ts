import { ShowStorage } from './ShowStorage';
import type { Show } from '../types/show';
import type { Issue, ProductionPage, IssueManifest,
  PromotionRecord } from '../types/production';

export interface PromotionCleanupReport {
  issuesBefore: number; issuesAfter: number;
  pagesBefore: number; pagesAfter: number;
  manifestsRemoved: number; recordsRemoved: number;
  imageVersionsBefore: number; imageVersionsAfter: number;
}

// Pure: collapse duplicate promotions in a Show.
export function dedupePromotions(
  show: Show
): { show: Show; report: PromotionCleanupReport } {
  const issuesBefore = (show.issues ?? []).length;
  const pagesBefore = (show.productionPages ?? []).length;
  const ivBefore = (show.imageVersions ?? []).length;

  // 1. Newest issue per uid.
  const issueByUid = new Map<string, Issue>();
  for (const iss of show.issues ?? []) {
    const cur = issueByUid.get(iss.uid);
    if (!cur || (iss.promotedAt ?? 0) >= (cur.promotedAt ?? 0))
      issueByUid.set(iss.uid, iss);
  }
  const issues = Array.from(issueByUid.values());

  // 2. Page uids referenced by surviving issues' beats.
  const livePageUids = new Set<string>();
  for (const iss of issues)
    for (const act of iss.acts ?? [])
      for (const sc of act.scenes ?? [])
        for (const pb of sc.pageBeats ?? [])
          if (pb.productionPageUid)
            livePageUids.add(pb.productionPageUid);

  // Newest page per uid, kept only if still referenced.
  const pageByUid = new Map<string, ProductionPage>();
  for (const pg of show.productionPages ?? []) {
    if (!livePageUids.has(pg.uid)) continue;
    const cur = pageByUid.get(pg.uid);
    if (!cur || (pg.updatedAt ?? 0) >= (cur.updatedAt ?? 0))
      pageByUid.set(pg.uid, pg);
  }
  const productionPages = Array.from(pageByUid.values());
  const livePageSet = new Set(productionPages.map(p => p.uid));

  // 3. Newest manifest / record per issueUid (surviving issues only).
  const manByIssue = new Map<string, IssueManifest>();
  for (const m of show.issueManifests ?? []) {
    const cur = manByIssue.get(m.issueUid);
    if (!cur || (m.updatedAt ?? 0) >= (cur.updatedAt ?? 0))
      manByIssue.set(m.issueUid, m);
  }
  const issueManifests = Array.from(manByIssue.values())
    .filter(m => issueByUid.has(m.issueUid));

  const recByIssue = new Map<string, PromotionRecord>();
  for (const r of show.promotionRecords ?? []) {
    const cur = recByIssue.get(r.issueUid);
    if (!cur || (r.promotedAt ?? 0) >= (cur.promotedAt ?? 0))
      recByIssue.set(r.issueUid, r);
  }
  const promotionRecords = Array.from(recByIssue.values())
    .filter(r => issueByUid.has(r.issueUid));

  // 4. Keep only image versions whose page survives.
  const imageVersions = (show.imageVersions ?? [])
    .filter(v => livePageSet.has(v.productionPageUid));

  const cleaned: Show = {
    ...show, issues, productionPages,
    issueManifests, promotionRecords, imageVersions,
  };
  return {
    show: cleaned,
    report: {
      issuesBefore, issuesAfter: issues.length,
      pagesBefore, pagesAfter: productionPages.length,
      manifestsRemoved:
        (show.issueManifests ?? []).length - issueManifests.length,
      recordsRemoved:
        (show.promotionRecords ?? []).length - promotionRecords.length,
      imageVersionsBefore: ivBefore,
      imageVersionsAfter: imageVersions.length,
    },
  };
}

// Load → dedupe → persist (local + cloud).
export async function runPromotionCleanup(
  showId: string
): Promise<PromotionCleanupReport> {
  const show = await ShowStorage.getById(showId);
  if (!show) throw new Error(`Show not found: ${showId}`);
  const { show: cleaned, report } = dedupePromotions(show);
  await ShowStorage.saveOne(cleaned, true);
  return report;
}
