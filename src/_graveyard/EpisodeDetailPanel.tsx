import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { ArrowLeft, Edit2, FileText, Layout, Play, Eye } from 'lucide-react';
import { Episode, Show } from '../types/models';

const EpisodeDetailPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow, activePath } = state;
  const [isEditing, setIsEditing] = useState(false);

  if (!currentShow) return null;

  const { seasonIdx, episodeIdx } = activePath;

  const season = seasonIdx !== undefined ? currentShow.seasons[seasonIdx] : null;
  const episode = (season && episodeIdx !== undefined) ? season.episodes[episodeIdx] : null;

  if (!season || !episode) {
    return (
      <div className="p-12 text-center max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="py-12 border border-dashed border-red-500/25 bg-red-500/5 rounded-sm">
          <p className="text-xs uppercase tracking-widest text-red-400 font-bold mb-2">Error: Episode Not Found</p>
          <p className="text-[11px] text-white/60 mb-6">The requested season or episode could not be retrieved from the current production state.</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', view: 'season' })}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-sm text-[10px] uppercase tracking-widest font-black transition-all"
            >
              Go to Season Board
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', view: 'episode' })}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-sm text-[10px] uppercase tracking-widest font-black transition-all"
            >
              Go to Episode Manifest
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateEpisodeField = (field: keyof Episode, value: any) => {
    if (!currentShow || seasonIdx === undefined || episodeIdx === undefined) return;
    const seasons = [...currentShow.seasons];
    const targetSeason = { ...seasons[seasonIdx] };
    const episodes = [...targetSeason.episodes];
    episodes[episodeIdx] = { ...episodes[episodeIdx], [field]: value };
    targetSeason.episodes = episodes;
    seasons[seasonIdx] = targetSeason;

    dispatch({ type: 'UPDATE_SHOW', updates: { seasons } });
  };

  return (
    <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      {/* Navigation breadcrumbs */}
      <nav className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-black text-white/50">
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'season', path: { seasonIdx } })}
          className="hover:text-amber-500 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={12} /> Season {season.number}
        </button>
        <span>/</span>
        <span className="text-white/80">Episode {episode.number} Detail</span>
      </nav>

      {/* Episode Header */}
      <header className="border-b border-white/20 pb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-sm text-[10px] font-black uppercase tracking-wider text-amber-500 font-mono">
              S{season.number} : EP{episode.number}
            </span>
            <span className="text-white/40 text-xs">ID: {episode.id}</span>
          </div>
          
          {isEditing ? (
            <input
              type="text"
              value={episode.title}
              onChange={(e) => handleUpdateEpisodeField('title', e.target.value)}
              className="text-3xl font-bold text-white bg-white/5 border border-white/20 rounded-sm px-3 py-1.5 w-full focus:outline-none focus:border-amber-500/50"
              placeholder="Episode Title"
            />
          ) : (
            <h1 className="text-3.5xl font-black text-white tracking-tight leading-none">
              {episode.title || 'Untitled Episode'}
            </h1>
          )}

          {isEditing ? (
            <textarea
              value={episode.oneLiner || ''}
              onChange={(e) => handleUpdateEpisodeField('oneLiner', e.target.value)}
              className="text-sm text-white/80 bg-white/5 border border-white/20 rounded-sm px-3 py-1.5 w-full focus:outline-none focus:border-amber-500/50"
              placeholder="One-liner description of this episode..."
              rows={2}
            />
          ) : (
            <p className="text-sm text-white/80 leading-relaxed font-medium">
              {episode.oneLiner || <em className="text-white/40">No one-liner provided yet.</em>}
            </p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 border rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${
              isEditing
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'border-white/40 text-white/90 hover:border-white/70'
            }`}
          >
            <Edit2 size={12} /> {isEditing ? 'Editing Mode' : 'Edit Fields'}
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'workbench', path: { seasonIdx, episodeIdx, actIdx: 0, sceneIdx: 0, beatIdx: 0 } })}
            className="px-4 py-2 bg-white text-black rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-neutral-200 transition-colors"
          >
            <Play size={12} fill="currentColor" /> Open Workbench
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Side: Summary & Side Meta */}
        <div className="lg:col-span-1 space-y-8">
          <div className="glass p-6 space-y-4 rounded-sm border border-white/10">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-[#9d9d9d] border-b border-white/10 pb-2 flex items-center gap-1.5">
              <FileText size={12} className="text-amber-500" /> Summary
            </h3>
            {isEditing ? (
              <textarea
                value={episode.summary || ''}
                onChange={(e) => handleUpdateEpisodeField('summary', e.target.value)}
                className="w-full text-xs text-white bg-white/5 border border-white/20 rounded-sm p-3 focus:outline-none focus:border-amber-500/50"
                placeholder="Write a fully detailed synopsis/summary of the episode..."
                rows={6}
              />
            ) : (
              <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">
                {episode.summary || <em className="text-white/30">No synopsis written for this episode. Click 'Edit Fields' to document one.</em>}
              </p>
            )}
          </div>

          <div className="glass p-6 space-y-5 rounded-sm border border-white/10">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-[#9d9d9d] border-b border-white/10 pb-2">
              Production Meta
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-bold">A-Story Goal</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={episode.aStory || ''}
                    onChange={(e) => handleUpdateEpisodeField('aStory', e.target.value)}
                    className="text-xs text-white bg-white/5 border border-white/20 rounded-sm px-2.5 py-1 w-full focus:outline-none"
                    placeholder="Primary narrative arc goal"
                  />
                ) : (
                  <span className="text-xs text-white/80">{episode.aStory || <em className="text-white/30">Not specified</em>}</span>
                )}
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-bold">B-Story Goal</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={episode.bStory || ''}
                    onChange={(e) => handleUpdateEpisodeField('bStory', e.target.value)}
                    className="text-xs text-white bg-white/5 border border-white/20 rounded-sm px-2.5 py-1 w-full focus:outline-none"
                    placeholder="Secondary narrative arc goal"
                  />
                ) : (
                  <span className="text-xs text-white/80">{episode.bStory || <em className="text-white/30">Not specified</em>}</span>
                )}
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-white/40 block mb-1 font-bold">End State</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={episode.endState || ''}
                    onChange={(e) => handleUpdateEpisodeField('endState', e.target.value)}
                    className="text-xs text-white bg-white/5 border border-white/20 rounded-sm px-2.5 py-1 w-full focus:outline-none"
                    placeholder="End-of-episode status quo modifier"
                  />
                ) : (
                  <span className="text-xs text-white/80">{episode.endState || <em className="text-white/30">Not specified</em>}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Structural Acts & Scenes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-[#9d9d9d] flex items-center gap-1.5">
              <Layout size={12} className="text-amber-500" /> Narrative Structure
            </h3>
            <span className="text-[10px] font-mono text-white/60">
              {episode.acts.length} Acts — {episode.acts.reduce((sum, act) => sum + act.scenes.length, 0)} Scenes total
            </span>
          </div>

          <div className="space-y-6">
            {episode.acts.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-white/10 rounded-sm bg-white/3">
                <p className="text-xs uppercase tracking-widest text-white/40">No structural acts configured.</p>
                <p className="text-[10px] text-white/30 mt-1">Use the Production Hub or Workbench to generate acts and scenes.</p>
              </div>
            ) : (
              episode.acts.map((act) => (
                <div key={act.id} className="border border-white/10 bg-white/3 p-5 rounded-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-500">
                      Act {act.number} Synopsis
                    </h4>
                    {act.fid && <span className="text-[9px] font-mono text-white/40">{act.fid}</span>}
                  </div>
                  <p className="text-xs text-white/80 leading-relaxed font-medium">
                    {act.summary || <em className="text-white/30">No Act summary available.</em>}
                  </p>

                  {/* Scene subset */}
                  <div className="mt-4 space-y-3 pl-4 border-l border-white/10">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-white/40">Scenes within Act {act.number}</h5>
                    {act.scenes.length === 0 ? (
                      <p className="text-[10px] text-white/40 italic">No scenes mapped.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {act.scenes.map((scene) => (
                          <div
                            key={scene.id}
                            className="p-3 bg-white/5 border border-white/5 rounded-sm hover:border-amber-500/20 transition-all flex items-start justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-amber-500 font-bold">SCENE {scene.number}</span>
                                <h6 className="text-[11px] font-bold text-white uppercase tracking-tight">{scene.title || 'Untitled'}</h6>
                              </div>
                              {scene.setting && (
                                <p className="text-[9px] text-[#9a9a9a] font-mono">Location: {scene.setting}</p>
                              )}
                              <p className="text-[10px] text-white/60 leading-normal line-clamp-2">{scene.summary}</p>
                            </div>
                            <button
                              onClick={() => {
                                // Find sIdx, eIdx, actIdx, sceneIdx and change view to workbench
                                const actIdx = episode.acts.findIndex(a => a.id === act.id);
                                const sceneIdx = act.scenes.findIndex(s => s.id === scene.id);
                                dispatch({
                                  type: 'SET_VIEW',
                                  view: 'workbench',
                                  path: { seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx: 0 }
                                });
                              }}
                              className="px-2 py-1 bg-white/5 border border-white/10 hover:border-white/30 rounded-sm text-[8px] font-black uppercase tracking-widest text-white/70 hover:text-white flex items-center gap-1 transition-all"
                              title="Go to Workbench Scene Editor"
                            >
                              <Eye size={10} /> Open
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default EpisodeDetailPanel;
