import React, { useEffect, useState } from 'react';
import { useStore } from '../../StoreContext';
import { AssetStorage } from '../../storage';
import { CinematicBeat, Scene } from '../../types/models';
import MobileApprovalControls from './MobileApprovalControls';
import { Image, Type, Info, Zap, Download } from 'lucide-react';

import MobileGenerationSheet from './MobileGenerationSheet';
import MobileExportSheet, { ExportTarget } from './MobileExportSheet';

const MobileBeatReview: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow, activePath } = state;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenSheetOpen, setIsGenSheetOpen] = useState(false);
  const [exportSheet, setExportSheet] = useState<{ open: boolean; target: ExportTarget | null }>({
    open: false,
    target: null,
  });

  const { seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx } = activePath;

  const beat: CinematicBeat | undefined = currentShow?.seasons?.[seasonIdx]?.episodes?.[episodeIdx!]?.acts?.[actIdx!]?.scenes?.[sceneIdx!]?.cinematicBeats?.[beatIdx!];
  const scene: Scene | undefined = currentShow?.seasons?.[seasonIdx]?.episodes?.[episodeIdx!]?.acts?.[actIdx!]?.scenes?.[sceneIdx!];

  const canonicalEntry = currentShow?.comicGallery?.find(
    g => g.beatFid === beat?.fid && g.status !== 'archived'
  );

  useEffect(() => {
    let url: string | null = null;
    const load = async () => {
      if (canonicalEntry?.assetId) {
        url = await AssetStorage.getBlobUrl(canonicalEntry.assetId);
        setImageUrl(url);
      } else {
        setImageUrl(null);
      }
    };
    load();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [canonicalEntry?.assetId]);

  if (!beat || !scene) return (
    <div className="flex items-center justify-center h-[60vh] text-white/50 text-xs font-black uppercase tracking-widest">
      No beat selected
    </div>
  );

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex items-center justify-between bg-white/5 -mx-5 px-5 py-4 border-b border-white/10">
        <button 
           onClick={() => dispatch({ type: 'SET_VIEW', view: 'm-hierarchy' })}
           className="text-[10px] font-black uppercase tracking-widest text-amber-500"
        >
          ← Back to Tree
        </button>
        <span className="text-[10px] font-mono text-white/70 uppercase tracking-widest">
           S{seasonIdx+1} E{episodeIdx!+1} Sc{sceneIdx!+1} Beat{beatIdx!+1}
        </span>
      </header>

      {/* IMAGE PREVIEW */}
      <div className="relative aspect-[3/4] w-full bg-white/5 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Beat visualization" 
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
             <Image size={48} className="text-white/60" />
             <p className="text-[10px] uppercase font-black tracking-widest text-white/60">No Visualization Generated Yet</p>
             <button 
               onClick={() => setIsGenSheetOpen(true)}
               className="flex items-center gap-2 bg-amber-500 text-black px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
             >
               <Zap size={16} />
               <span>Generate This Beat</span>
             </button>
          </div>
        )}
        
        {canonicalEntry?.status === 'approved' && (
          <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-lg">
            <span className="text-[9px] font-black uppercase tracking-widest text-white">Approved</span>
          </div>
        )}
      </div>

      <div className="space-y-8 px-1">
        {/* SCRIPT SECTION */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Type size={14} className="text-white/60" />
            <h3 className="text-[10px] uppercase font-black tracking-widest text-white/60">Script & Narration</h3>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            {beat.script?.entries?.length ? (
              beat.script.entries.map((entry: any, i: number) => (
                <div key={i} className="space-y-1">
                   {entry.kind === 'caption' ? (
                     <div className="text-[10px] uppercase tracking-widest font-black text-amber-500 opacity-60">[Caption]</div>
                   ) : (
                     <div className="text-[10px] uppercase tracking-widest font-black text-white/60">{entry.characterHandle}</div>
                   )}
                   <p className="text-sm font-medium text-white/90 leading-relaxed italic line-clamp-3">"{entry.text}"</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-white/60 italic">No script entries authored.</p>
            )}
          </div>
        </section>

        {/* SUBTEXT SECTION */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-white/60" />
            <h3 className="text-[10px] uppercase font-black tracking-widest text-white/60">Subtext & Intent</h3>
          </div>
          <div className="p-1 px-2 border-l-2 border-white/10 ml-1">
            <p className="text-sm text-white/60 leading-relaxed font-light">{beat.subtext || "No subtext anchor."}</p>
          </div>
        </section>

        {/* APPROVAL CONTROLS */}
        {canonicalEntry && (
          <MobileApprovalControls entry={canonicalEntry} />
        )}

        {/* NEW: Export current scene */}
        <div className="pt-4 border-t border-white/5">
          <button 
            onClick={() => setExportSheet({
              open: true,
              target: {
                kind: 'teleplay-scene',
                sIdx: seasonIdx,
                eIdx: episodeIdx!,
                aIdx: actIdx!,
                scIdx: sceneIdx!,
                label: `${scene.title} — Teleplay`
              }
            })}
            className="w-full flex items-center justify-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 active:scale-95 transition-all"
          >
            <Download size={14} />
            <span>Export Scene Teleplay (.txt)</span>
          </button>
        </div>
      </div>
      
      <div className="h-10" />

      <MobileGenerationSheet 
        isOpen={isGenSheetOpen}
        onClose={() => setIsGenSheetOpen(false)}
        context={{ 
          scope: 'beat', 
          label: `Beat ${beatIdx! + 1}`,
          sIdx: seasonIdx,
          eIdx: episodeIdx,
          aIdx: actIdx,
          scIdx: sceneIdx,
          bIdx: beatIdx
        }}
      />

      <MobileExportSheet 
        isOpen={exportSheet.open}
        target={exportSheet.target}
        onClose={() => setExportSheet({ open: false, target: null })}
      />
    </div>
  );
};

export default MobileBeatReview;
