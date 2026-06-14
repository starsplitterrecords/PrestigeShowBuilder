import React, { useState, useEffect } from 'react';
import { useStore } from '../../StoreContext';
import { NodePath } from '../../types/models';
import { resolveLines } from '../../domainUtils';
import { Lock } from 'lucide-react';
import { exportEpisodeText, exportActText, exportSceneText, exportBeatText } from '../../utils/assembleComponentText';

const HierarchyTree: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow, activePath, view } = state;

  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([activePath.seasonIdx !== undefined ? activePath.seasonIdx : 0]));
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set([`${activePath.seasonIdx}-${activePath.episodeIdx}`]));
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set([`${activePath.seasonIdx}-${activePath.episodeIdx}-${activePath.actIdx}`]));
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(
    new Set([`${activePath.seasonIdx}-${activePath.episodeIdx}-${activePath.actIdx}-${activePath.sceneIdx}`])
  );

  useEffect(() => {
    if (activePath.beatIdx !== undefined || activePath.sceneIdx !== undefined || activePath.actIdx !== undefined || activePath.episodeIdx !== undefined) {
      const { seasonIdx: s, episodeIdx: e, actIdx: a, sceneIdx: sc } = activePath;
      if (s !== undefined) {
        setExpandedSeasons(prev => new Set([...prev, s]));
        if (e !== undefined) {
          setExpandedEpisodes(prev => new Set([...prev, `${s}-${e}`]));
          if (a !== undefined) {
            setExpandedActs(prev => new Set([...prev, `${s}-${e}-${a}`]));
            if (sc !== undefined) {
              setExpandedScenes(prev => new Set([...prev, `${s}-${e}-${a}-${sc}`]));
            }
          }
        }
      }
    }
  }, [activePath.beatIdx, activePath.sceneIdx, activePath.actIdx, activePath.episodeIdx, activePath.seasonIdx]);

  if (!currentShow) return null;

  const toggleSeason = (sIdx: number) => {
    const newSet = new Set(expandedSeasons);
    if (newSet.has(sIdx)) newSet.delete(sIdx);
    else newSet.add(sIdx);
    setExpandedSeasons(newSet);
  };

  const toggleEpisode = (sIdx: number, eIdx: number) => {
    const key = `${sIdx}-${eIdx}`;
    const newSet = new Set(expandedEpisodes);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedEpisodes(newSet);
  };

  const toggleAct = (sIdx: number, eIdx: number, aIdx: number) => {
    const key = `${sIdx}-${eIdx}-${aIdx}`;
    const newSet = new Set(expandedActs);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedActs(newSet);
  };

  const toggleScene = (sIdx: number, eIdx: number, aIdx: number, scIdx: number) => {
    const key = `${sIdx}-${eIdx}-${aIdx}-${scIdx}`;
    const newSet = new Set(expandedScenes);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedScenes(newSet);
  };

  const navigateTo = (view: string, path: Partial<NodePath>) => {
    dispatch({ type: 'SET_VIEW', view: view as any, path: path as NodePath });
  };

  return (
    <div className="space-y-1">
      {currentShow.seasons?.map((season, sIdx) => {
        const seasonBeats = (season.episodes ?? []).flatMap(ep => (ep.acts ?? []).flatMap(act => (act.scenes ?? []).flatMap(scene => scene.cinematicBeats ?? [])));
        const hasLockedBeats = seasonBeats.length > 0 && seasonBeats.every(beat => beat.locked);
        
        return (
          <div key={season.id || `season-${sIdx}`} className="text-xs uppercase tracking-widest font-bold">
            <div 
              className={`flex items-center justify-between cursor-pointer py-1 px-4 hover:bg-white/30 ${activePath.seasonIdx === sIdx && view === 'season' ? 'text-amber-500' : 'text-white'}`}
              onClick={() => {
                toggleSeason(sIdx);
                navigateTo('season', { seasonIdx: sIdx, episodeIdx: undefined, actIdx: undefined, sceneIdx: undefined, beatIdx: undefined });
              }}
            >
              <div className="flex items-center">
                <span className="w-4">{expandedSeasons.has(sIdx) ? '▼' : '▶'}</span>
                Season {season.number || sIdx + 1}
              </div>
              {hasLockedBeats && <Lock size={10} className="text-amber-500/70 mr-1" />}
            </div>

          {expandedSeasons.has(sIdx) && season.episodes?.map((episode, eIdx) => {
            const hasMissingBeats = episode.acts?.some(act => act.scenes?.some(scene => !scene.cinematicBeats || scene.cinematicBeats.length === 0));
            const epBeats = (episode.acts ?? []).flatMap(act => (act.scenes ?? []).flatMap(scene => scene.cinematicBeats ?? []));
            const hasLockedBeats = epBeats.length > 0 && epBeats.every(beat => beat.locked);
            
            return (
              <div key={episode.id} className="ml-4">
                <div 
                  className={`flex items-center justify-between cursor-pointer py-1 px-4 hover:bg-white/30 ${activePath.seasonIdx === sIdx && activePath.episodeIdx === eIdx && view === 'episode' ? 'text-amber-500' : 'text-white'}`}
                  onClick={() => {
                    toggleEpisode(sIdx, eIdx);
                    navigateTo('episode', { seasonIdx: sIdx, episodeIdx: eIdx, actIdx: undefined, sceneIdx: undefined, beatIdx: undefined });
                  }}
                >
                  <div className="flex items-center">
                    <span className="w-4">{expandedEpisodes.has(`${sIdx}-${eIdx}`) ? '▼' : '▶'}</span>
                    Ep {episode.number || eIdx + 1}
                  </div>
                  <div className="flex items-center gap-1">
                    {hasLockedBeats && <Lock size={10} className="text-amber-500/70 mr-1" />}
                    <button
                      title="Export episode text"
                      onClick={e => {
                        e.stopPropagation();
                        const text = exportEpisodeText(currentShow, sIdx, eIdx);
                        const blob = new Blob([text], { type: "text/plain" });
                        const url  = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${currentShow.showCode}-Ep${eIdx+1}.txt`;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="w-4 h-4 flex items-center justify-center rounded-sm text-[10px]
                                 font-black bg-white/20 text-white/80 hover:bg-white/40
                                 hover:text-white transition-all"
                    >T</button>
                    {hasMissingBeats && <span className="text-amber-500 text-xs" title="Missing beats">⚠</span>}
                  </div>
                </div>

                {expandedEpisodes.has(`${sIdx}-${eIdx}`) && episode.acts?.map((act, aIdx) => {
                  const actBeats = (act.scenes ?? []).flatMap(scene => scene.cinematicBeats ?? []);
                  const hasLockedBeats = actBeats.length > 0 && actBeats.every(beat => beat.locked);
                  
                  return (
                    <div key={act.id} className="ml-4">
                      <div 
                        className={`flex items-center justify-between cursor-pointer py-1 px-4 hover:bg-white/30 ${activePath.seasonIdx === sIdx && activePath.episodeIdx === eIdx && activePath.actIdx === aIdx && view === 'episode' ? 'text-amber-500' : 'text-white'}`}
                        onClick={() => {
                          toggleAct(sIdx, eIdx, aIdx);
                          navigateTo('episode', { seasonIdx: sIdx, episodeIdx: eIdx, actIdx: aIdx, sceneIdx: undefined, beatIdx: undefined });
                        }}
                      >
                        <div className="flex items-center">
                          <span className="w-4">{expandedActs.has(`${sIdx}-${eIdx}-${aIdx}`) ? '▼' : '▶'}</span>
                          Act {act.number || aIdx + 1}
                        </div>
                        <div className="flex items-center gap-1">
                          {hasLockedBeats && <Lock size={10} className="text-amber-500/70 mr-1" />}
                          <button
                            title="Export act text"
                            onClick={e => {
                              e.stopPropagation();
                              const text = exportActText(currentShow, sIdx, eIdx, aIdx);
                              const blob = new Blob([text], { type: "text/plain" });
                              const url  = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${currentShow.showCode}-S${sIdx+1}E${eIdx+1}A${aIdx+1}.txt`;
                              document.body.appendChild(a); a.click(); document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            className="w-4 h-4 flex items-center justify-center rounded-sm text-[10px]
                                       font-black bg-white/20 text-white/80 hover:bg-white/40
                                       hover:text-white transition-all"
                          >T</button>
                        </div>
                      </div>

                    {expandedActs.has(`${sIdx}-${eIdx}-${aIdx}`) && act.scenes?.map((scene, scIdx) => {
                      const sceneHasLines = (scene.cinematicBeats ?? []).some(beat => resolveLines(beat).length > 0);
                      const sceneBeats = scene.cinematicBeats ?? [];
                      const hasLockedBeats = sceneBeats.length > 0 && sceneBeats.every(beat => beat.locked);

                      return (
                        <div key={scene.id} className="ml-4">
                          <div
                            className={`flex items-center justify-between cursor-pointer py-1 px-4 hover:bg-white/30 ${
                              activePath.sceneIdx === scIdx && activePath.episodeIdx === eIdx && 
                              activePath.actIdx === aIdx && view === 'workbench' ? 'text-amber-500' : 'text-white'
                            }`}
                            onClick={() => {
                              toggleScene(sIdx, eIdx, aIdx, scIdx);
                              navigateTo('workbench', { seasonIdx: sIdx, episodeIdx: eIdx, actIdx: aIdx, sceneIdx: scIdx, beatIdx: undefined });
                            }}
                          >
                            <div className="flex items-center">
                              <span className="w-4">{expandedScenes.has(`${sIdx}-${eIdx}-${aIdx}-${scIdx}`) ? '▼' : '▶'}</span>
                              Sc {scene.number || scIdx + 1}
                            </div>
                            <div className="flex items-center gap-1">
                              {hasLockedBeats && <Lock size={10} className="text-amber-500/70 mr-1" />}
                              {(!scene.cinematicBeats || scene.cinematicBeats.length === 0) && (
                                <span className="text-amber-500 text-xs mr-1" title="No beats">⚠</span>
                              )}
                              <button
                                title="Export scene text"
                                onClick={e => {
                                  e.stopPropagation();
                                  const text = exportSceneText(currentShow, sIdx, eIdx, aIdx, scIdx);
                                  const blob = new Blob([text], { type: "text/plain" });
                                  const url  = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${currentShow.showCode}-S${sIdx+1}E${eIdx+1}A${aIdx+1}Sc${scIdx+1}.txt`;
                                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                }}
                                className="w-4 h-4 flex items-center justify-center rounded-sm text-[10px]
                                           font-black bg-white/20 text-white/80 hover:bg-white/40
                                           hover:text-white transition-all"
                              >T</button>
                              <span className={`w-4 h-4 flex items-center justify-center rounded-sm text-[10px] font-black ${
                                sceneHasLines ? 'bg-green-500/30 text-green-400' : 'bg-white/30 text-white/90'
                              }`} title="Lines">L</span>
                            </div>
                          </div>
                         
                          {expandedScenes.has(`${sIdx}-${eIdx}-${aIdx}-${scIdx}`) && (
                            <div className="ml-4">
                              {(scene.cinematicBeats ?? []).length === 0 ? (
                                <div className="py-1 px-4 text-white text-xs">No beats</div>
                              ) : (
                                (scene.cinematicBeats ?? []).map((beat, bIdx) => {
                                  const isActiveBeat = activePath.beatIdx === bIdx && 
                                    activePath.sceneIdx === scIdx && activePath.actIdx === aIdx && 
                                    activePath.episodeIdx === eIdx && view === 'workbench';
                                  
                                  const hasLines = resolveLines(beat).length > 0;
                                  const isLastBeat = bIdx === (scene.cinematicBeats ?? []).length - 1;
                                  const isFirstBeat = bIdx === 0;

                                  return (
                                    <div
                                      key={beat.id}
                                      className={`flex items-center justify-between cursor-pointer py-1 px-4 hover:bg-white/30 ${
                                        isActiveBeat ? 'text-amber-500' : 'text-white'
                                      }`}
                                      onClick={() => navigateTo('workbench', { 
                                        seasonIdx: sIdx, episodeIdx: eIdx, actIdx: aIdx, sceneIdx: scIdx, beatIdx: bIdx 
                                      })}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs">B{bIdx + 1}</span>
                                        {beat.locked && <Lock size={10} className="text-amber-500/70" />}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          title="Export beat text"
                                          onClick={e => {
                                            e.stopPropagation();
                                            const text = exportBeatText(currentShow, sIdx, eIdx, aIdx, scIdx, bIdx);
                                            const blob = new Blob([text], { type: "text/plain" });
                                            const url  = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = `${currentShow.showCode}-${beat.fid}.txt`;
                                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                          }}
                                          className="w-4 h-4 flex items-center justify-center rounded-sm text-[10px]
                                                     font-black bg-white/20 text-white/80 hover:bg-white/40
                                                     hover:text-white transition-all"
                                        >T</button>
                                        <span className={`w-4 h-4 flex items-center justify-center rounded-sm text-[10px] font-black ${
                                          hasLines ? 'bg-green-500/30 text-green-400' : 'bg-white/30 text-white/90'
                                        }`} title="Lines">L</span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
        );
      })}
    </div>
  );
};

export default HierarchyTree;
