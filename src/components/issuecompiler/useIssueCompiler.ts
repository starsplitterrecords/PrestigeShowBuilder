import { Show } from '../../types/show';
import { IssueManifest, ProductionPage, PageBeat, ImageVersion } from '../../types/production';

export interface CompilerPage {
  pageNumber: number;
  productionPage: ProductionPage;
  pageBeat: PageBeat;
  approvedImage: ImageVersion | null;
  isCover: boolean;
}

export function useIssueCompiler(show: Show, issueUid: string, imageVersions: ImageVersion[]) {
  const manifest = (show.issueManifests ?? [])
    .find(m => m.issueUid === issueUid);
  const issue = (show.issues ?? [])
    .find(i => i.uid === issueUid);

  if (!manifest || !issue) return { pages: [], manifest: null, issue: null };

  // PageBeat lookup.
  const pbLookup: Record<string, PageBeat> = {};
  for (const act of issue.acts) {
    for (const sc of act.scenes) {
      for (const pb of sc.pageBeats) pbLookup[pb.uid] = pb;
    }
  }

  const productionPages = show.productionPages ?? [];

  const pages: CompilerPage[] = manifest.pageOrder.map((uid, idx) => {
    const page = productionPages.find(pg => pg.uid === uid);
    if (!page) return null;
    const beat = pbLookup[page.pageBeatUid];
    const approved = imageVersions.find(
      v => v.productionPageUid === uid && v.status === 'approved'
    ) ?? null;
    return {
      pageNumber: idx + 1,
      productionPage: page,
      pageBeat: beat,
      approvedImage: approved,
      isCover: manifest.coverPageUid === uid,
    };
  }).filter((p): p is CompilerPage => p !== null);

  return { pages, manifest, issue };
}
