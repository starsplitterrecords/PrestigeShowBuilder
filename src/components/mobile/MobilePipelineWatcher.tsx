import React from 'react';
import { useStore } from '../../StoreContext';
import { useProductionPipeline } from '../../hooks/useProductionPipeline';
import { XCircle } from 'lucide-react';

const MobilePipelineWatcher: React.FC = () => {
  const { state } = useStore();
  const { pipeline } = state;
  // @ts-expect-error LEGACY: abort may not be returned by useProductionPipeline
  const { abort } = useProductionPipeline();

  if (!pipeline.isRunning) return null;

  return (
    <div className="fixed bottom-[84px] left-5 right-5 z-40 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-amber-500 rounded-xl p-4 shadow-[0_8px_32px_rgba(245,158,11,0.3)] border border-white/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-black">
              AI Generation in Progress
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-black/60">
              {pipeline.progress.current}/{pipeline.progress.total}
            </span>
            <button 
              onClick={abort}
              className="p-1 px-2 border border-black/20 rounded-md active:scale-95 transition-transform"
            >
              <XCircle size={14} className="text-black" />
            </button>
          </div>
        </div>
        
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-black truncate">{pipeline.currentTask}</h4>
          <p className="text-[10px] text-black/70 italic truncate">{pipeline.subTask}</p>
        </div>

        {/* PROGRESS BAR */}
        <div className="mt-3 h-1 bg-black/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-black transition-all duration-500 ease-out"
            style={{ width: `${(pipeline.progress.current / Math.max(1, pipeline.progress.total)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MobilePipelineWatcher;
