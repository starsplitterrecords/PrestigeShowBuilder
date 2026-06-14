import React from 'react';
import { useStore } from '../StoreContext';
import { useProductionPipeline } from '../hooks/useProductionPipeline';

const PipelineHUD: React.FC = () => {
  const { state } = useStore();
  const { pipeline } = state;
  const { cancel, confirm, abortNow } = useProductionPipeline();

  if (!pipeline.isRunning) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-amber-500 text-black flex items-center px-6 z-50 font-black uppercase tracking-widest text-[10px]">
      <div className="flex-1 flex items-center gap-4">
        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
        <span>{pipeline.currentTask}: {pipeline.subTask}</span>
      </div>
      {pipeline.progress.total > 0 && (
        <div className="flex items-center gap-4">
          <span>{pipeline.progress.current} / {pipeline.progress.total}</span>
          <div className="w-32 h-2 bg-black/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${(pipeline.progress.current / pipeline.progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex gap-2 ml-6">
        {pipeline.pendingConfirmation && (
          <button
            onClick={confirm}
            className="px-4 py-1 bg-white hover:bg-white/90 text-black text-[9px] font-black uppercase tracking-widest rounded-sm transition-all shadow-lg animate-bounce"
          >
            Continue Production
          </button>
        )}
        <button
          onClick={cancel}
          className="px-4 py-1 bg-black/10 hover:bg-black/20 text-black text-[9px] font-black uppercase tracking-widest rounded-sm transition-all"
        >
          Stop After Current
        </button>
        <button
          onClick={abortNow}
          className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-black uppercase tracking-widest rounded-sm transition-all"
        >
          Abort Now
        </button>
      </div>
    </div>
  );
};

export default PipelineHUD;
