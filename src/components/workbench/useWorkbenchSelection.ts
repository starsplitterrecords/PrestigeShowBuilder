import { useState, useMemo, useEffect, useRef } from 'react';
import { Show } from '../../types/show';
import { ProductionPage, PageBeat, ImageVersion } from '../../types/production';

export interface FilmstripItem {
  productionPage: ProductionPage;
  pageBeat: PageBeat;
  activeImageVersion: ImageVersion | null;
  allImageVersions: ImageVersion[];
  pageNumber: number;   // 1-based position in manifest
  sceneUid?: string;    // Extra helper properties
  actUid?: string;      // Extra helper properties
  sceneTitle?: string;  // Extra helper properties
  actTitle?: string;    // Extra helper properties
  settingAnchorId?: string; // from ProductionScene
}

export function getProductionFilmstrip(
  show: Show,
  issueUid: string,
  imageVersionsByPage: Map<string, ImageVersion[]>
): FilmstripItem[] {
  const manifest = (show.issueManifests ?? [])
    .find(m => m.issueUid === issueUid);
  if (!manifest) return [];

  const issue = (show.issues ?? []).find(i => i.uid === issueUid);
  if (!issue) return [];

  // Build PageBeat lookup from Issue hierarchy.
  const pageBeatLookup: Record<string, { beat: PageBeat; sceneUid: string; actUid: string; sceneTitle: string; actTitle: string; settingAnchorId?: string }> = {};
  for (const act of issue.acts) {
    for (const scene of act.scenes) {
      for (const pb of scene.pageBeats) {
        pageBeatLookup[pb.uid] = {
          beat: pb,
          sceneUid: scene.uid,
          actUid: act.uid,
          sceneTitle: scene.title,
          actTitle: act.title,
          settingAnchorId: scene.settingAnchorId
        };
      }
    }
  }

  const pages = show.productionPages ?? [];

  return manifest.pageOrder.map((pageUid, idx): FilmstripItem | null => {
    const page = pages.find(pg => pg.uid === pageUid);
    if (!page) return null;
    const lookup = pageBeatLookup[page.pageBeatUid];
    if (!lookup) return null;

    const pageVersions = (imageVersionsByPage.get(pageUid) ?? []).filter(
      v => v.status !== 'archived'
    );
    // Active version: approved first, then most recent draft.
    const active = pageVersions.find(v => v.status === 'approved')
      ?? pageVersions.slice().sort((a, b) => b.createdAt - a.createdAt)[0]
      ?? null;

    return {
      productionPage: page,
      pageBeat: lookup.beat,
      activeImageVersion: active,
      allImageVersions: pageVersions,
      pageNumber: idx + 1,
      sceneUid: lookup.sceneUid,
      actUid: lookup.actUid,
      sceneTitle: lookup.sceneTitle,
      actTitle: lookup.actTitle,
      settingAnchorId: lookup.settingAnchorId,
    };
  }).filter((item): item is FilmstripItem => item !== null);
}

export function useWorkbenchSelection(
  show: Show | undefined,
  issueUid: string | null,
  imageVersionsByPage: Map<string, ImageVersion[]>
) {
  const filmstripPages = useMemo(() => {
    if (!show || !issueUid) return [];
    return getProductionFilmstrip(show, issueUid, imageVersionsByPage);
  }, [show, issueUid, imageVersionsByPage]);

  const [selectedPageUid, setSelectedPageUid] = useState<string | null>(null);

  useEffect(() => {
    if (show?.id) {
      setSelectedPageUid(null);
      hasInitialized.current = false;
    }
  }, [show?.id, issueUid]);

  // Local narrow selections for right-pane context mapping
  const [selectedPanelIndex, setSelectedPanelIndex] = useState<number | null>(null);
  const [selectedScriptEntryIndex, setSelectedScriptEntryIndex] = useState<number | null>(null);

  const hasInitialized = useRef(false);
  // Default focus of the first page when view loads and no selection is present
  useEffect(() => {
    if (hasInitialized.current) return;
    if (filmstripPages.length > 0 && !selectedPageUid) {
      setSelectedPageUid(filmstripPages[0].productionPage.uid);
      hasInitialized.current = true;
    } else if (selectedPageUid) {
      hasInitialized.current = true;
    }
  }, [filmstripPages, selectedPageUid]);

  const focusedPage = useMemo(() => {
    if (!selectedPageUid || filmstripPages.length === 0) {
      return filmstripPages[0] || null;
    }
    return filmstripPages.find(p => p.productionPage.uid === selectedPageUid) || filmstripPages[0] || null;
  }, [filmstripPages, selectedPageUid]);

  const setFocusedPage = (pageUid: string) => {
    setSelectedPageUid(pageUid);
    setSelectedPanelIndex(null);
    setSelectedScriptEntryIndex(null);
  };

  const resetSelection = () => {
    setSelectedPanelIndex(null);
    setSelectedScriptEntryIndex(null);
  };

  const focusPreviousPage = () => {
    if (filmstripPages.length === 0) return;
    const currentIndex = filmstripPages.findIndex(p => p.productionPage.uid === selectedPageUid);
    const nextIdx = currentIndex === -1 ? 0 : (currentIndex - 1 + filmstripPages.length) % filmstripPages.length;
    setFocusedPage(filmstripPages[nextIdx].productionPage.uid);
  };

  const focusNextPage = () => {
    if (filmstripPages.length === 0) return;
    const currentIndex = filmstripPages.findIndex(p => p.productionPage.uid === selectedPageUid);
    const nextIdx = currentIndex === -1 ? 0 : (currentIndex + 1) % filmstripPages.length;
    setFocusedPage(filmstripPages[nextIdx].productionPage.uid);
  };

  const focusFirstPage = () => {
    if (filmstripPages.length > 0) {
      setFocusedPage(filmstripPages[0].productionPage.uid);
    }
  };

  const focusLastPage = () => {
    if (filmstripPages.length > 0) {
      setFocusedPage(filmstripPages[filmstripPages.length - 1].productionPage.uid);
    }
  };

  const focusFirstPageInCurrentScene = () => {
    if (filmstripPages.length === 0 || !focusedPage) return;
    const sUid = focusedPage.sceneUid;
    const firstScenePage = filmstripPages.find(p => p.sceneUid === sUid);
    if (firstScenePage) {
      setFocusedPage(firstScenePage.productionPage.uid);
    }
  };

  const focusLastPageInCurrentScene = () => {
    if (filmstripPages.length === 0 || !focusedPage) return;
    const sUid = focusedPage.sceneUid;
    let lastScenePage = focusedPage;
    for (let i = filmstripPages.length - 1; i >= 0; i--) {
      const p = filmstripPages[i];
      if (p.sceneUid === sUid) {
        lastScenePage = p;
        break;
      }
    }
    setFocusedPage(lastScenePage.productionPage.uid);
  };

  const focusPreviousSceneFirstPage = () => {
    if (filmstripPages.length === 0 || !focusedPage) return;
    const sUid = focusedPage.sceneUid;
    const firstCurrentSceneIdx = filmstripPages.findIndex(p => p.sceneUid === sUid);
    if (firstCurrentSceneIdx > 0) {
      const prevPage = filmstripPages[firstCurrentSceneIdx - 1];
      const firstPrevScenePage = filmstripPages.find(p => p.sceneUid === prevPage.sceneUid);
      if (firstPrevScenePage) {
        setFocusedPage(firstPrevScenePage.productionPage.uid);
      }
    }
  };

  const focusNextSceneFirstPage = () => {
    if (filmstripPages.length === 0 || !focusedPage) return;
    const sUid = focusedPage.sceneUid;
    let lastCurrentSceneIdx = -1;
    for (let i = filmstripPages.length - 1; i >= 0; i--) {
      const p = filmstripPages[i];
      if (p.sceneUid === sUid) {
        lastCurrentSceneIdx = i;
        break;
      }
    }
    if (lastCurrentSceneIdx !== -1 && lastCurrentSceneIdx < filmstripPages.length - 1) {
      const nextPage = filmstripPages[lastCurrentSceneIdx + 1];
      const firstNextScenePage = filmstripPages.find(p => p.sceneUid === nextPage.sceneUid);
      if (firstNextScenePage) {
        setFocusedPage(firstNextScenePage.productionPage.uid);
      }
    }
  };

  return {
    filmstripPages,
    focusedPage,
    selectedPanelIndex,
    setSelectedPanelIndex,
    selectedScriptEntryIndex,
    setSelectedScriptEntryIndex,
    setFocusedPage,
    resetSelection,
    focusPreviousPage,
    focusNextPage,
    focusFirstPage,
    focusLastPage,
    focusFirstPageInCurrentScene,
    focusLastPageInCurrentScene,
    focusPreviousSceneFirstPage,
    focusNextSceneFirstPage
  };
}
