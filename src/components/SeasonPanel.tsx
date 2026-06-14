import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { useProductionPipeline } from '../hooks/useProductionPipeline';
import AutoResizingTextarea from './shared/AutoResizingTextarea';
import { suggestField } from '../geminiService';
import { Season, Episode, Show } from '../types/models';
import { rewriteFids, resolveLines } from '../domainUtils';
import { moveEpisode } from '../utils/hierarchyMoveOps';

const episodeHasContent = (episode: Episode): boolean =>
  episode.acts.some(act =>
    act.scenes.some(sc => sc.cinematicBeats.length > 0)
  );

const getEpisodeContentSummary = (episode: Episode, show: Show): string => {
  const actCount = episode.acts.length;
  const sceneCount = episode.acts.reduce(
    (n, act) => n + act.scenes.length, 0
  );
  const beatCount = episode.acts.reduce(
    (n, act) => n + act.scenes.reduce(
      (m, sc) => m + sc.cinematicBeats.length, 0
    ), 0
  );
  const allFids = new Set(
    episode.acts.flatMap(act =>
      act.scenes.flatMap(sc => sc.cinematicBeats.map(b => b.fid))
    )
  );
  const comicCount = (show.comicGallery ?? []).filter(
    e => allFids.has(e.beatFid)
  ).length;
  const parts = [
    `${actCount} act${actCount !== 1 ? "s" : ""}`,
    `${sceneCount} scene${sceneCount !== 1 ? "s" : ""}`,
    `${beatCount} beat${beatCount !== 1 ? "s" : ""}`,
  ];
  if (comicCount) parts.push(
    `${comicCount} comic image${comicCount !== 1 ? "s" : ""}`
  );
  return parts.join(", ");
};

const SeasonPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow, activePath } = state;
  const { run, nukeAndRebuild, isRunning } = useProductionPipeline();
  const [isAutofilling, setIsAutofilling] = useState<Record<string, boolean>>({});
  const [confirmNukeSeason, setConfirmNukeSeason] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ idx: number; summary: string } | null>(null);

  if (!currentShow) return null;

  const season = currentShow.seasons[activePath.seasonIdx];
  if (!season) return (
    <div className="p-12 text-center">
      <button 
        onClick={() => run({ scope: 'season', sIdx: activePath.seasonIdx })}
        disabled={isRunning}
        className="bg-amber-500 text-black px-8 py-4 rounded-sm text-xs font-black uppercase tracking-widest"
      >
        {isRunning ? 'Synthesizing Season...' : 'Initialize Season 1'}
      </button>
    </div>
  );

  const handleUpdateSeason = (updates: Partial<Season>) => {
    if (!currentShow) return;
    const seasons = [...currentShow.seasons];
    seasons[activePath.seasonIdx] = { ...season, ...updates };
    dispatch({ type: 'UPDATE_SHOW', updates: { seasons } });
  };

  const handleInsertEpisode = (insertAtIdx: number) => {
    if (!currentShow || activePath.seasonIdx === undefined) return;
    
    const sIdx = activePath.seasonIdx;

    const newEpisode: Episode = {
      id: Math.random().toString(36).substr(2, 9),
      number: insertAtIdx + 1,
      title: "Untitled Episode",
      oneLiner: "",
      summary: "",
      acts: []
    };

    let updated = structuredClone(currentShow) as Show;
    const episodes = updated.seasons[sIdx].episodes;
    episodes.splice(insertAtIdx, 0, newEpisode);
    
    // Re-number
    episodes.forEach((ep, i) => { ep.number = i + 1; });

    // Rewrite FIDs
    updated = rewriteFids(updated, {
      level: "episode",
      sIdx,
      threshold: insertAtIdx + 1,
      delta: 1
    });

    dispatch({ type: 'UPDATE_SHOW', updates: { 
      seasons: updated.seasons,
      comicGallery: updated.comicGallery,
      generationLog: updated.generationLog
    } });
  };

  const handleAutofill = async (field: keyof Season, label: string) => {
    if (!season || !currentShow) return;
    const key = `${season.id}-${field}`;
    setIsAutofilling(prev => ({ ...prev, [key]: true }));
    try {
      const context = `Season ${season.number} of ${currentShow.titleSuggestion || currentShow.name}\nShow Premise: ${currentShow.premise}`;
      const suggestion = await suggestField(currentShow, label, context);
      handleUpdateSeason({ [field]: suggestion });
    } finally {
      setIsAutofilling(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleGenerateEpisodes = () => {
    run({ scope: 'season', sIdx: activePath.seasonIdx });
  };

  const handleNukeSeason = () => {
    nukeAndRebuild({ scope: 'season', sIdx: activePath.seasonIdx });
  };

  const handleSelectEpisode = (eIdx: number) => {
    dispatch({ type: 'SET_VIEW', view: 'episode-detail', path: { seasonIdx: activePath.seasonIdx, episodeIdx: eIdx } });
  };

  const handleMoveEpisode = (idx: number, delta: -1 | 1) => {
    if (!currentShow || activePath.seasonIdx === undefined) return;
    const result = moveEpisode(currentShow, activePath.seasonIdx, idx, delta);
    if (!result) return;

    dispatch({ type: 'UPDATE_SHOW', updates: {
      seasons: result.seasons,
      comicGallery: result.comicGallery,
      generationLog: result.generationLog,
    }});
  };

  const handleDeleteEpisode = (eIdx: number) => {
    if (!currentShow) return;
    const sIdx = activePath.seasonIdx;
    const episode = season.episodes[eIdx];

    const doDelete = () => {
      // 1. Rewrite FIDs of sibling episodes and all their children
      let updated = rewriteFids(
        structuredClone(currentShow) as Show, {
          level: "episode", sIdx,
          threshold: eIdx + 2,
          delta: -1,
      });

      // 2. Splice the episode
      updated.seasons[sIdx].episodes.splice(eIdx, 1);
      updated.seasons[sIdx].episodes
        .forEach((ep, i) => { ep.number = i + 1; });

      // 3. Clean galleries for all beats in this episode
      const deletedFids = new Set(
        episode.acts.flatMap(act =>
          act.scenes.flatMap(sc =>
            sc.cinematicBeats.map(b => b.fid)
          )
        )
      );
      updated.comicGallery = (updated.comicGallery ?? [])
        .filter(e => !deletedFids.has(e.beatFid));
      updated.generationLog = (updated.generationLog ?? [])
        .filter(e => !deletedFids.has(e.beatFid));

      dispatch({ type: "UPDATE_SHOW", updates: {
        seasons: updated.seasons,
        comicGallery: updated.comicGallery,
        generationLog: updated.generationLog,
      }});

      // 4. Navigate to season view if inside the deleted episode
      if (activePath.episodeIdx === eIdx) {
        dispatch({ type: "SET_VIEW", view: "season",
          path: { seasonIdx: activePath.seasonIdx,
                  episodeIdx: undefined,
                  actIdx: undefined,
                  sceneIdx: undefined,
                  beatIdx: undefined } });
      }
      setDeleteConfirm(null);
    };

    if (!episodeHasContent(episode)) {
      doDelete();
    } else {
      setDeleteConfirm({
        idx: eIdx,
        summary: getEpisodeContentSummary(episode, currentShow),
      });
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-12 animate-in fade-in duration-500">
      <header className="flex items-end justify-between border-b border-white/70 pb-8">
        <div className="space-y-2">
          <span className="text-[10px] text-amber-500/60 uppercase tracking-[0.4em] font-black">Production Phase</span>
          <h1 className="text-4xl font-bold text-white">Season {season.number}</h1>
        </div>
        <div className="flex gap-2">
          {confirmNukeSeason ? (
            <button onClick={() => { setConfirmNukeSeason(false); handleNukeSeason(); }}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-sm text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all">
              Confirm Nuke Season
            </button>
          ) : (
            <button onClick={() => setConfirmNukeSeason(true)}
              className="px-4 py-2 bg-white/30 border border-white/70 rounded-sm text-[10px] font-black uppercase tracking-widest text-white/90 hover:text-red-400 hover:border-red-500/30 transition-all">
              ↻ Nuke Season
            </button>
          )}
          <button 
            onClick={handleGenerateEpisodes}
            disabled={isRunning}
            className="bg-white text-black px-6 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 disabled:opacity-50 transition-all"
          >
            {isRunning ? 'Synthesizing...' : 'AI Smart Fill Episodes'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <section className="lg:col-span-1 space-y-6">
          <div className="space-y-4">
            <label className="text-[10px] text-white uppercase tracking-widest font-black">Season Manifesto</label>
            <AutoResizingTextarea
              value={season.description || ''}
              onChange={(e) => handleUpdateSeason({ description: e.target.value })}
              onAutofill={() => handleAutofill('description', 'Season Manifesto')}
              isAutofilling={isAutofilling[`${season.id}-description`]}
              className="bg-white/30 border-white/70 text-sm text-white leading-relaxed"
              placeholder="The core theme and direction for this season..."
            />
          </div>
        </section>

        <section className="lg:col-span-2 space-y-6">
          <label className="text-[10px] text-white uppercase tracking-widest font-black">Episode Manifest</label>
          <div className="space-y-4">
            <InsertEpisodeButton onClick={() => handleInsertEpisode(0)} />
            {season.episodes.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/70 rounded-sm">
                <p className="text-[10px] uppercase tracking-widest text-white/60">No episodes drafted yet.</p>
              </div>
            ) : (
              season.episodes.map((ep, idx) => (
                <React.Fragment key={ep.id}>
                  <div className="relative group">
                    <button
                      onClick={() => handleSelectEpisode(idx)}
                      className="w-full text-left glass p-6 group hover:border-amber-500/30 transition-all flex items-center justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-amber-500/60">EP {ep.number}</span>
                          <h3 className="text-lg font-bold text-white group-hover:text-amber-500 transition-colors">{ep.title}</h3>
                        </div>
                        <p className="text-xs text-white line-clamp-1">{ep.oneLiner}</p>
                      </div>
                      <span className="text-[10px] text-white/90 group-hover:text-white transition-colors">VIEW →</span>
                    </button>

                    {/* Reorder arrows */}
                    <div className="absolute top-4 right-12 flex flex-col gap-1
                                    opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveEpisode(idx, -1); }}
                        disabled={idx === 0}
                        className="text-white/60 hover:text-white disabled:opacity-20
                                   transition-colors text-xs leading-none"
                        title="Move episode up"
                      >▲</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveEpisode(idx, 1); }}
                        disabled={idx === season.episodes.length - 1}
                        className="text-white/60 hover:text-white disabled:opacity-20
                                   transition-colors text-xs leading-none"
                        title="Move episode down"
                      >▼</button>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEpisode(idx); }}
                      className="absolute top-4 right-16 text-white/60 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Delete Episode"
                    >
                      ×
                    </button>
                  </div>
                  <InsertEpisodeButton onClick={() => handleInsertEpisode(idx + 1)} />
                </React.Fragment>
              ))
            )}
          </div>
        </section>
      </div>
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/80 backdrop-blur-sm p-8">
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-sm p-8
                          max-w-md w-full space-y-6">
            <h3 className="text-lg font-black uppercase tracking-widest text-white">
              Delete Episode?
            </h3>
            <p className="text-[11px] text-white/70 leading-relaxed">
              This episode contains: {deleteConfirm.summary}.
              <br />
              <span className="text-red-400">
                This cannot be undone.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest
                           text-white/70 hover:text-white border border-white/20
                           rounded-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const idx = deleteConfirm.idx;
                  setDeleteConfirm(null);
                  handleDeleteEpisode(idx);
                }}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest
                           bg-red-500/20 border border-red-500/40 text-red-400
                           hover:bg-red-500/30 rounded-sm transition-all"
              >
                Delete Episode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InsertEpisodeButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="relative flex items-center justify-center py-2 group">
    <div className="absolute inset-0 flex items-center" aria-hidden="true">
      <div className="w-full border-t border-amber-500/20 group-hover:border-amber-500/40 transition-colors"></div>
    </div>
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-3 py-1 bg-black border border-amber-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-500 hover:bg-amber-500 hover:text-black transition-all opacity-0 group-hover:opacity-100"
    >
      <span>+ Insert Episode</span>
    </button>
  </div>
);

export default SeasonPanel;
