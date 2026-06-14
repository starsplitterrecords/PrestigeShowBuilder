import { getArtifactsByType } from '../../psb4/storage';
import { ArtifactType, ScenePoolPayload, Psb4Artifact } from '../../psb4/types';
import { createManualPageBeat, ProductionPage } from '../../types/production';
import { Show } from '../../types/show';
import { generateUID } from '../../domainUtils';
import { openDB } from '../../storage/db';

export interface PoolSceneEntry {
  artifactId: string;
  sceneIndex: number;
  title: string;
  characters: string[];
  placementSuggestion: string;
  emotionalFunction: string;
  lengthNote: string;
  fullVersion: string;
  compressedVersion: string;
  singlePanelVersion: string;
}

export async function loadScenePool(
  showId: string
): Promise<PoolSceneEntry[]> {
  let artifacts: Psb4Artifact[] = [];
  try {
    artifacts = await getArtifactsByType(
      showId, ArtifactType.SCENE_POOL_ENTRY
    );
  } catch (err) {
    console.warn('Error loading via getArtifactsByType:', err);
  }

  if (!artifacts || artifacts.length === 0) {
    try {
      const dbLocal = await openDB();
      artifacts = await new Promise<Psb4Artifact[]>((resolve, reject) => {
        const tx = dbLocal.transaction('psb4_artifacts', 'readonly');
        const store = tx.objectStore('psb4_artifacts');
        const index = store.index('by-show-type');
        const getAllReq = index.getAll([showId, ArtifactType.SCENE_POOL_ENTRY]);
        getAllReq.onsuccess = () => resolve(getAllReq.result || []);
        getAllReq.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn('Error loading via by-show-type index fallback:', err);
    }
  }

  const entries: PoolSceneEntry[] = [];
  for (const art of artifacts) {
    const payload = art.payload as ScenePoolPayload;
    if (payload && Array.isArray(payload.scenes)) {
      payload.scenes.forEach((sc, idx) => {
        entries.push({
          artifactId: art.id,
          sceneIndex: idx,
          ...sc,
        });
      });
    }
  }
  return entries;
}

export async function insertPoolSceneIntoIssue(
  show: Show,
  entry: PoolSceneEntry,
  version: 'full' | 'compressed' | 'single',
  afterPageUid: string,
  issueUid: string,
  dispatch: (a: any) => void
): Promise<void> {
  const manifest = (show.issueManifests ?? [])
    .find(m => m.issueUid === issueUid);
  if (!manifest) return;

  const description = version === 'full'
    ? entry.fullVersion
    : version === 'compressed'
      ? entry.compressedVersion
      : entry.singlePanelVersion;

  const pageBeat = createManualPageBeat(
    entry.title, description, version
  );
  
  const newPage: ProductionPage = {
    uid: generateUID(),
    showId: show.id,
    issueUid,
    pageBeatUid: pageBeat.uid,
    source: 'manual',
    status: 'planned',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  pageBeat.productionPageUid = newPage.uid;

  // Insert into manifest after afterPageUid.
  const insertIdx = manifest.pageOrder.indexOf(afterPageUid);
  const newOrder = [...manifest.pageOrder];
  
  if (insertIdx === -1) {
    // If not found, append to end
    newOrder.push(newPage.uid);
  } else {
    newOrder.splice(insertIdx + 1, 0, newPage.uid);
  }

  // Find the Issue and insert the PageBeat at the right scene.
  // For simplicity, append to the last scene in the last act.
  const updatedIssues = (show.issues ?? []).map(iss => {
    if (iss.uid !== issueUid) return iss;
    if (iss.acts.length === 0) return iss;
    const lastActIdx = iss.acts.length - 1;
    const lastAct = iss.acts[lastActIdx];
    if (lastAct.scenes.length === 0) return iss;
    const lastSceneIdx = lastAct.scenes.length - 1;

    return {
      ...iss,
      acts: iss.acts.map((act, ai) => {
        if (ai !== lastActIdx) return act;
        return {
          ...act,
          scenes: act.scenes.map((sc, si) => {
            if (si !== lastSceneIdx) return sc;
            return {
              ...sc,
              pageBeats: [...(sc.pageBeats ?? []), pageBeat],
            };
          }),
        };
      }),
    };
  });

  dispatch({
    type: 'UPDATE_SHOW',
    updates: {
      issues: updatedIssues,
      productionPages: [...(show.productionPages ?? []), newPage],
      issueManifests: (show.issueManifests ?? []).map(m =>
        m.uid === manifest.uid
          ? { ...m, pageOrder: newOrder, updatedAt: Date.now() }
          : m
      ),
    },
  });
}
