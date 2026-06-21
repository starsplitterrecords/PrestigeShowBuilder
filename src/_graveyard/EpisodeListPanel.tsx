import React from 'react';
import { useStore } from '../StoreContext';

const EpisodeListPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  if (!currentShow) return null;

  const allEpisodes = currentShow.seasons.flatMap((season, sIdx) => 
    season.episodes.map((ep, eIdx) => ({ ...ep, sIdx, eIdx, seasonNumber: season.number }))
  );

  const handleSelectEpisode = (sIdx: number, eIdx: number) => {
    dispatch({ type: 'SET_VIEW', view: 'episode-detail', path: { seasonIdx: sIdx, episodeIdx: eIdx } });
  };

  return (
    <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-12 animate-in fade-in duration-500">
      <header className="border-b border-white/70 pb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Episode Manifest</h2>
          <p className="text-[10px] text-white uppercase tracking-widest font-black">Global Production Inventory</p>
        </div>
      </header>

      <div className="space-y-4">
        {allEpisodes.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-white/70 rounded-sm">
            <p className="text-[10px] uppercase tracking-widest text-white/60">No episodes drafted in any season.</p>
          </div>
        ) : (
          allEpisodes.map((ep) => (
            <button
              key={ep.id}
              onClick={() => handleSelectEpisode(ep.sIdx, ep.eIdx)}
              className="w-full text-left glass p-6 group hover:border-amber-500/30 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-8">
                <div className="shrink-0 text-center">
                  <div className="text-[10px] text-white/90 uppercase tracking-widest font-black">Season</div>
                  <div className="text-xl font-mono text-white">{ep.seasonNumber}</div>
                </div>
                <div className="shrink-0 text-center">
                  <div className="text-[10px] text-white/90 uppercase tracking-widest font-black">Episode</div>
                  <div className="text-xl font-mono text-amber-500">{ep.number}</div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-500 transition-colors">{ep.title}</h3>
                  <p className="text-xs text-white line-clamp-1">{ep.oneLiner}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-white/90 uppercase tracking-widest font-black">Structure</div>
                  <div className="text-[10px] text-white font-mono">{ep.acts.length} Acts</div>
                </div>
                <span className="text-[10px] text-white/90 group-hover:text-white transition-colors">VIEW →</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default EpisodeListPanel;
