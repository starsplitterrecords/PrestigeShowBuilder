import React, { useState } from 'react';
import { useStore } from '../../StoreContext';
import { ChevronRight, ChevronDown, CheckCircle2, Circle, AlertCircle, Zap, Download } from 'lucide-react';
import MobileGenerationSheet from './MobileGenerationSheet';
import MobileExportSheet, { ExportTarget } from './MobileExportSheet';

const MobileHierarchy: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  
  const [genContext, setGenContext] = useState<{ scope: 'show' | 'episode' | 'scene' | 'beat'; label: string; sIdx?: number; eIdx?: number; aIdx?: number; scIdx?: number } | null>(null);
  const [exportSheet, setExportSheet] = useState<{ open: boolean; target: ExportTarget | null }>({
    open: false,
    target: null,
  });

  if (!currentShow) return null;

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <header className="space-y-1">
        <h2 className="text-[11px] uppercase tracking-[0.3em] font-black text-white/60">Production Hierarchy</h2>
        <p className="text-2xl font-light text-white">Project Tree</p>
      </header>

      <div className="space-y-4">
        {currentShow.seasons.map((season, sIdx) => (
          <div key={season.id} className="space-y-2">
            <button 
              onClick={() => toggle(season.id)}
              className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl active:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-0.5 rounded-sm">S0{season.number || sIdx + 1}</span>
                <span className="text-sm font-bold">Season {season.number || sIdx + 1}</span>
              </div>
              {expanded[season.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>

            {expanded[season.id] && (
              <div className="pl-4 space-y-3 mt-2 border-l border-white/10 ml-4">
                {(season.episodes || []).map((episode, eIdx) => (
                  <div key={episode.id} className="space-y-2">
                    <div 
                      onClick={() => toggle(episode.id)}
                      className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 cursor-pointer active:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-white/60">E{eIdx + 1}</span>
                        <span className="text-xs font-medium truncate max-w-[150px]">{episode.title || 'Untitled'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setGenContext({ scope: 'episode', label: episode.title, sIdx, eIdx });
                           }}
                           className="p-2 bg-amber-500/10 text-amber-500 rounded-lg active:scale-90 transition-transform"
                           aria-label="Smart Fill"
                         >
                           <Zap size={14} />
                         </button>
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setExportSheet({
                               open: true,
                               target: {
                                 kind: 'teleplay-episode',
                                 sIdx, eIdx,
                                 label: `${episode.title} — Teleplay`
                               }
                             });
                           }}
                           className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg active:scale-90 transition-transform"
                           aria-label="Export teleplay"
                         >
                           <Download size={14} />
                         </button>
                         {expanded[episode.id] ? <ChevronDown size={14} className="text-white/60 ml-1" /> : <ChevronRight size={14} className="text-white/60 ml-1" />}
                      </div>
                    </div>

                    {expanded[episode.id] && (
                      <div className="pl-4 space-y-1 mt-1 border-l border-white/5 ml-3">
                         {episode.acts.flatMap((act, aIdx) => [
                           <div key={`act-${act.id}`} className="flex items-center justify-between p-1 pl-2 border-l border-white/20 mt-4 mb-1 first:mt-1">
                             <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/70">Act {aIdx + 1}</span>
                             <button 
                               onClick={() => setExportSheet({
                                 open: true,
                                 target: {
                                   kind: 'teleplay-act',
                                   sIdx, eIdx, aIdx,
                                   label: `S${sIdx+1}E${eIdx+1} Act ${aIdx + 1} — Teleplay`
                                 }
                               })}
                               className="p-1 px-2 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                             >
                               <Download size={10} />
                               <span>Act TXT</span>
                             </button>
                           </div>,
                           ...act.scenes.map((scene, scIdx) => {
                             const sceneId = `${episode.id}-${scene.id}`;
                             const isExpanded = expanded[sceneId];
                             
                             return (
                               <div key={sceneId} className="space-y-1">
                                 <div 
                                   onClick={() => toggle(sceneId)}
                                   className="w-full flex items-center justify-between p-2 py-2.5 rounded-md hover:bg-white/5 active:bg-white/5 transition-colors cursor-pointer"
                                 >
                                   <span className="text-[10px] text-white/70 truncate max-w-[130px]">
                                     Scene {scIdx + 1}: {scene.title || `Untitled`}
                                   </span>
                                   <div className="flex items-center gap-1">
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setGenContext({ scope: 'scene', label: scene.title, sIdx, eIdx, aIdx, scIdx });
                                       }}
                                       className="p-1.5 bg-amber-500/10 text-amber-500 rounded-md active:scale-90 transition-transform"
                                       aria-label="Smart Fill"
                                     >
                                       <Zap size={12} />
                                     </button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         setExportSheet({
                                           open: true,
                                           target: {
                                             kind: 'teleplay-scene',
                                             sIdx, eIdx, aIdx, scIdx,
                                             label: `${scene.title} — Teleplay`
                                           }
                                         });
                                       }}
                                       className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-md active:scale-90 transition-transform"
                                       aria-label="Export teleplay"
                                     >
                                       <Download size={12} />
                                     </button>
                                     {isExpanded ? <ChevronDown size={12} className="text-white/60 ml-1" /> : <ChevronRight size={12} className="text-white/60 ml-1" />}
                                   </div>
                                 </div>

                                 {isExpanded && (
                                   <div className="pl-4 space-y-1 py-1 mb-2">
                                     {scene.cinematicBeats.map((beat, bIdx) => {
                                       const galleryEntry = currentShow.comicGallery?.find(g => g.beatFid === beat.fid && g.status !== 'archived');
                                       const status = galleryEntry?.status || 'missing';

                                       return (
                                         <button 
                                           key={beat.id}
                                           onClick={() => dispatch({ 
                                             type: 'SET_VIEW', 
                                             view: 'm-beat-review', 
                                             path: { seasonIdx: sIdx, episodeIdx: eIdx, actIdx: aIdx, sceneIdx: scIdx, beatIdx: bIdx } 
                                           })}
                                           className="w-full flex items-center justify-between p-2 px-3 bg-white/5 rounded-sm border border-white/5 active:scale-95 transition-all mb-1"
                                         >
                                           <div className="flex items-center gap-3">
                                             <span className="text-[10px] font-mono text-white/60">{bIdx + 1}</span>
                                             <span className="text-[10px] font-medium text-white/90 line-clamp-1 text-left">{beat.description}</span>
                                           </div>
                                           {status === 'approved' ? (
                                             <CheckCircle2 size={12} className="text-emerald-500" />
                                           ) : status === 'draft' ? (
                                             <AlertCircle size={12} className="text-amber-500" />
                                           ) : (
                                             <Circle size={10} className="text-white/60" />
                                           )}
                                         </button>
                                       );
                                     })}
                                   </div>
                                 )}
                               </div>
                             );
                           })
                         ])}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {genContext && (
        <MobileGenerationSheet 
          isOpen={!!genContext}
          onClose={() => setGenContext(null)}
          context={genContext!}
        />
      )}

      <MobileExportSheet 
        isOpen={exportSheet.open}
        target={exportSheet.target}
        onClose={() => setExportSheet({ open: false, target: null })}
      />
    </div>
  );
};

export default MobileHierarchy;
