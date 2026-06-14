import React from 'react';
import { useStore } from '../../StoreContext';
import { useProductionPipeline } from '../../hooks/useProductionPipeline';
import { Zap, Sparkles, BookOpen, Film, X } from 'lucide-react';

interface MobileGenerationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    scope: 'show' | 'episode' | 'scene' | 'beat';
    sIdx?: number;
    eIdx?: number;
    aIdx?: number;
    scIdx?: number;
    bIdx?: number;
    label?: string;
  };
}

const MobileGenerationSheet: React.FC<MobileGenerationSheetProps> = ({ isOpen, onClose, context }) => {
  const { dispatch } = useStore();
  const { run } = useProductionPipeline();

  if (!isOpen) return null;

  const handleRun = (task: string) => {
    // Logic to run specific pipeline task based on context
    // For now, let's just trigger the main 'run' with the scope
    run({ 
      scope: context.scope, 
      seasonIdx: context.sIdx, 
      episodeIdx: context.eIdx, 
      actIdx: context.aIdx, 
      sceneIdx: context.scIdx, 
      beatIdx: context.bIdx 
    } as any, false);
    onClose();
    dispatch({ type: 'ADD_TOAST', toast: { id: Date.now().toString(), type: 'info', message: `Generation started for ${context.label || context.scope}` } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-[#111] border-t border-white/10 rounded-t-3xl p-6 pb-12 animate-in slide-in-from-bottom-full duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500">Smart Fill Trigger</h3>
            <p className="text-lg font-bold text-white">Target: {context.label || context.scope}</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => handleRun('ignite')}
            className="flex items-center justify-between p-5 bg-amber-500 text-black rounded-2xl active:scale-95 transition-all group"
          >
            <div className="flex items-center gap-4">
              <Zap size={24} fill="currentColor" />
              <div className="text-left">
                <h4 className="text-sm font-black uppercase tracking-tight">Full Ignite</h4>
                <p className="text-[10px] opacity-60 font-medium">Expand all missing structure & text</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => handleRun('script')}
            className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl active:scale-95 transition-all text-left"
          >
            <div className="flex items-center gap-4 text-white/80">
              <BookOpen size={24} />
              <div>
                <h4 className="text-sm font-bold">Script Polish</h4>
                <p className="text-[10px] text-white/60 uppercase tracking-widest">Punch-up dialogue & beats</p>
              </div>
            </div>
            <Sparkles size={16} className="text-amber-500" />
          </button>

          <button 
            disabled={context.scope !== 'beat' && context.scope !== 'scene'}
            onClick={() => handleRun('panels')}
            className={`flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl transition-all text-left
              ${context.scope !== 'beat' && context.scope !== 'scene' ? 'opacity-20' : 'active:scale-95 hover:bg-white/10'}
            `}
          >
            <div className="flex items-center gap-4 text-white/80">
              <Film size={24} />
              <div>
                <h4 className="text-sm font-bold">Panel Synthesis</h4>
                <p className="text-[10px] text-white/60 uppercase tracking-widest">Generate comic visualizations</p>
              </div>
            </div>
          </button>
        </div>
        
        <p className="mt-8 text-center text-[10px] text-white/60 uppercase tracking-widest leading-relaxed">
          Running AI generation consumes tokens. <br/> Process will run in background.
        </p>
      </div>
    </div>
  );
};

export default MobileGenerationSheet;
