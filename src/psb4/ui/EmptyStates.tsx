import React from 'react';
import { useStore } from '../../StoreContext';

export const NoShowSelected: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] border border-white/10 rounded-lg p-12 bg-[#070707] text-center" id="psb4_noshow_selected">
      <p className="text-[11px] text-white/60 tracking-widest uppercase font-mono mb-3">
        System Operational
      </p>
      <h2 className="text-xl font-sans font-medium tracking-tight text-white mb-2">
        No Show Selected
      </h2>
      <p className="text-xs text-white/70 max-w-md mx-auto leading-relaxed">
        Select an active show from the sidebar hierarchy of the Prestige Show Builder to initialize or resume a PSB4 production run.
      </p>
    </div>
  );
};

export const NoExportFound: React.FC = () => {
  const { dispatch } = useStore();

  const handleGoToExport = () => {
    dispatch({ type: 'SET_VIEW', view: 'export' });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] border border-white/10 rounded-lg p-12 bg-[#070707] text-center" id="psb4_no_export_found">
      <p className="text-[11px] text-white/60 tracking-widest uppercase font-mono mb-3 text-amber-500">
        Prerequisite Missing
      </p>
      <h2 className="text-xl font-sans font-medium tracking-tight text-white mb-2">
        PSB3 Teleplay Export Needed
      </h2>
      <p className="text-xs text-white/70 max-w-md mx-auto leading-relaxed mb-6">
        PSB4 coordinates high-fidelity character, arc, and narrative reconstruction. This process requires an active PSB3 season export to act as its source teleplay.
      </p>
      <button
        onClick={handleGoToExport}
        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium tracking-wide text-xs uppercase rounded transition-colors duration-150"
      >
        Go to Export Panel
      </button>
    </div>
  );
};
