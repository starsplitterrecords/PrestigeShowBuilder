import React, { useEffect } from 'react';
import { useStore } from '../../StoreContext';
import { NodePath } from '../../types/models';

const Breadcrumb: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow, activePath, view } = state;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentShow) return;
      
      const { seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx } = activePath;
      if (seasonIdx === undefined || episodeIdx === undefined || actIdx === undefined || sceneIdx === undefined) return;
      
      const act = currentShow.seasons[seasonIdx]?.episodes[episodeIdx]?.acts[actIdx];
      const scene = act?.scenes[sceneIdx];
      if (!act || !scene) return;

      if (e.key === '[') {
        if (beatIdx !== undefined && beatIdx > 0) {
          dispatch({ type: 'SET_VIEW', view: 'workbench', path: { ...activePath, beatIdx: beatIdx - 1 } as NodePath });
        }
      } else if (e.key === ']') {
        if (beatIdx !== undefined && beatIdx < (scene.cinematicBeats?.length || 0) - 1) {
          dispatch({ type: 'SET_VIEW', view: 'workbench', path: { ...activePath, beatIdx: beatIdx + 1 } as NodePath });
        }
      } else if (e.key === '{') {
        if (sceneIdx > 0) {
          dispatch({ type: 'SET_VIEW', view: 'workbench', path: { ...activePath, sceneIdx: sceneIdx - 1, beatIdx: undefined } as NodePath });
        }
      } else if (e.key === '}') {
        if (sceneIdx < (act.scenes?.length || 0) - 1) {
          dispatch({ type: 'SET_VIEW', view: 'workbench', path: { ...activePath, sceneIdx: sceneIdx + 1, beatIdx: undefined } as NodePath });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentShow, activePath, dispatch]);

  if (!currentShow) return null;

  // Only show breadcrumb in production/episode views where activePath is relevant
  const validViews = ['season', 'episode', 'workbench'];
  if (!validViews.includes(view)) return null;

  const { seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx } = activePath;

  const segments = [];
  
  if (seasonIdx !== undefined) {
    const s = currentShow.seasons[seasonIdx];
    segments.push({ label: `Season ${s?.number || seasonIdx + 1}`, view: 'season', path: { seasonIdx, episodeIdx: undefined, actIdx: undefined, sceneIdx: undefined, beatIdx: undefined } as NodePath });
  }
  
  if (episodeIdx !== undefined) {
    const e = currentShow.seasons[seasonIdx!]?.episodes?.[episodeIdx];
    segments.push({ label: `Episode ${e?.number || episodeIdx + 1}`, view: 'episode', path: { seasonIdx, episodeIdx, actIdx: undefined, sceneIdx: undefined, beatIdx: undefined } as NodePath });
  }
  
  if (actIdx !== undefined) {
    const a = currentShow.seasons[seasonIdx!]?.episodes?.[episodeIdx!]?.acts?.[actIdx];
    segments.push({ label: `Act ${a?.number || actIdx + 1}`, view: 'episode', path: { seasonIdx, episodeIdx, actIdx, sceneIdx: undefined, beatIdx: undefined } as NodePath });
  }
  
  if (sceneIdx !== undefined) {
    const sc = currentShow.seasons[seasonIdx!]?.episodes?.[episodeIdx!]?.acts?.[actIdx!]?.scenes?.[sceneIdx];
    segments.push({ label: `Scene ${sc?.number || sceneIdx + 1}`, view: 'workbench', path: { seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx: undefined } as NodePath });
  }
  
  if (beatIdx !== undefined) {
    segments.push({ label: `Page Beat ${beatIdx + 1}`, view: 'workbench', path: { seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx } as NodePath });
  }

  return (
    <div className="w-full h-8 flex items-center px-4 md:px-12 border-b border-white/60 bg-[#0a0a0a] text-[10px] uppercase tracking-widest font-bold text-white" title="Shortcuts: [ ] for beats, { } for scenes">
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="mx-2 text-white/50">&gt;</span>}
          {i === segments.length - 1 ? (
            <span className="text-white">{seg.label}</span>
          ) : (
            <button 
              onClick={() => dispatch({ type: 'SET_VIEW', view: seg.view as any, path: seg.path })}
              className="hover:text-amber-500 transition-colors"
            >
              {seg.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Breadcrumb;
