import { Show } from '../../types/show';
import { PageBeat, ProductionPage } from '../../types/production';
import { AssetStorage } from '../../storage';
import {
  getImageVersionsForPage
} from '../../storage/VaultStorage';
import {
  loadPortraits,
  loadBeatLockedReferences
} from '../comic/generationUtils';
import { pageBeatToComicBeat }
  from './useProductionPageActions';

import { resolveProductionCharacterRefs } from './productionCharacterRefs';

export interface PageRef {
  dataUri: string;
  label: string;
  description?: string;
  isCharacter: boolean;
  assetId: string;
}

// ── Character portraits ──────────────────────────────────────────────
// Load portrait images for all characters in the beat.
export async function loadCharacterRefs(
  pageBeat: PageBeat,
  show: Show,
  dispatch: (a: any) => void
): Promise<PageRef[]> {
  const resolution = await resolveProductionCharacterRefs({ pageBeat, show, dispatch });
  return resolution.loadedRefs.map(p => ({
    dataUri: p.dataUri,
    label: p.characterName,
    isCharacter: true,
    assetId: p.assetId
  }));
}

// ── Setting Anchor Reference (DA-031) ─────────────────────────────────
export async function loadSettingAnchorRef(
  settingAnchorId: string | undefined,
  show: Show
): Promise<{ imageRef: PageRef | null; settingNote: string | null }> {
  if (!settingAnchorId) return { imageRef: null, settingNote: null };

  const anchor = (show.settingAnchors ?? [])
    .find(a => a.id === settingAnchorId);
  if (!anchor) return { imageRef: null, settingNote: null };

  // Build the text description regardless of whether an image exists.
  // This ensures even unimaged anchors enforce visual consistency.
  const descParts: string[] = [];
  if (anchor.physicalDescription)
    descParts.push(anchor.physicalDescription);
  if (anchor.visualDescription)
    descParts.push(anchor.visualDescription);
  if (anchor.mood)
    descParts.push(`Mood: ${anchor.mood}.`);

  const settingNote = descParts.length > 0
    ? `LOCATION — ${anchor.name}: ${descParts.join(' ')}`
    : null;

  // If the anchor has a reference image, load it.
  if (!anchor.assetId) return { imageRef: null, settingNote };

  const dataUri = await AssetStorage.getDataUri(anchor.assetId);
  if (!dataUri) return { imageRef: null, settingNote };

  return {
    imageRef: {
      dataUri,
      assetId: anchor.assetId,
      label: `${anchor.name}`,
      description:
        'SETTING REFERENCE: Use this image as the source of truth for ' +
        'architecture, layout, materials, lighting feel, and environmental ' +
        'continuity. Preserve the recognizable location. Add only the ' +
        'characters, props, action, panel-specific changes, and readable ' +
        'text explicitly requested by the page prompt.',
      isCharacter: false,
    },
    settingNote,
  };
}

// ── Beat locked references ───────────────────────────────────────────
// Load locked reference images for the beat's characters and scene setting.
// settingAnchorId now passed directly from FilmstripItem.
export async function loadPageBeatLockedRefs(
  pageBeat: PageBeat,
  settingAnchorId: string | undefined,
  show: Show
): Promise<PageRef[]> {
  if (!show.lockedReferences?.length) return [];
  const sceneShim = { settingAnchorId } as any;
  const shimBeat = pageBeatToComicBeat(pageBeat);
  return loadBeatLockedReferences(show, sceneShim, shimBeat);
}

// ── Prior page references ─────────────────────────────────────────────
// Load approved images from the 2 pages before and 1 after this page
// in the IssueManifest. Provides visual continuity to the model.
export async function loadPriorPageRefs(
  page: ProductionPage,
  show: Show,
  priorWindow = 2,
  followingWindow = 1
): Promise<PageRef[]> {
  const manifest = (show.issueManifests ?? [])
    .find(m => m.issueUid === page.issueUid);
  if (!manifest) return [];

  const currentIdx = manifest.pageOrder.indexOf(page.uid);
  if (currentIdx === -1) return [];

  // Build a lookup: ProductionPage uid → scene uid.
  // Only pages in the same scene as the current page are valid references.
  const pageToScene = new Map<string, string>();
  for (const issue of show.issues ?? []) {
    for (const act of issue.acts) {
      for (const scene of act.scenes) {
        for (const pb of scene.pageBeats) {
          if (pb.productionPageUid) {
            pageToScene.set(pb.productionPageUid, scene.uid);
          }
        }
      }
    }
  }

  const currentSceneUid = pageToScene.get(page.uid);

  const windowUids = manifest.pageOrder.filter((uid, idx) =>
    idx !== currentIdx &&
    idx >= currentIdx - priorWindow &&
    idx <= currentIdx + followingWindow &&
    // Only include pages from the same scene.
    // If currentSceneUid is undefined (manual page, no scene),
    // fall back to position-only — no scene to respect.
    (currentSceneUid === undefined || pageToScene.get(uid) === currentSceneUid)
  );

  const refs: PageRef[] = [];
  for (const pageUid of windowUids) {
    // Find the best non-archived ImageVersion for this adjacent page.
    const rawVersions = await getImageVersionsForPage(pageUid);
    const versions = rawVersions
      .filter(v => v.status !== 'archived')
      .sort((a, b) => {
        // Prefer approved, then lettered, then most recent.
        const score = (v: typeof a) =>
          v.status === 'approved' ? 100 :
          (v.variantType === 'lettered' || v.variantType === 'final') ? 10 : 0;
        return score(b) - score(a) || b.createdAt - a.createdAt;
      });

    const best = versions[0];
    if (!best) continue;

    const dataUri = await AssetStorage.getDataUri(best.assetId);
    if (!dataUri) continue;

    const pageNum = manifest.pageOrder.indexOf(pageUid) + 1;
    refs.push({
      dataUri,
      label: `Page ${pageNum}`,
      isCharacter: false,
      assetId: best.assetId,
    });
  }
  return refs;
}
