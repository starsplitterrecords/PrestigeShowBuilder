import React, { useEffect } from 'react';
import { X, History } from 'lucide-react';
import { Psb4Run } from '../types';
import { HistoryList } from './HistoryList';

interface Psb4RunHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  runs: Psb4Run[];
  onRefresh: () => void;
  onViewRun: (run: Psb4Run) => void;
}

export const Psb4RunHistoryDrawer: React.FC<Psb4RunHistoryDrawerProps> = ({
  isOpen,
  onClose,
  runs,
  onRefresh,
  onViewRun,
}) => {
  // Listen for Escape key to close the drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={onClose}
      id="run_history_drawer_overlay"
    >
      <div 
        className="w-full max-w-lg h-full bg-[#0a0a0a] border-l border-white/10 flex flex-col shadow-2xl relative text-left"
        onClick={(e) => e.stopPropagation()}
        id="run_history_drawer_panel"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#0e0e0e] shrink-0">
          <div className="flex items-center gap-2">
            <History size={16} className="text-amber-400" />
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              Prior Runs
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/5 text-white/60 hover:text-white rounded transition"
            id="run_history_drawer_close_btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content - Scrollable list */}
        <div className="flex-1 overflow-y-auto p-5">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-white/40">
              <History size={24} className="mb-2 opacity-50" />
              <p className="text-[11px] uppercase tracking-widest font-mono">No prior runs found</p>
            </div>
          ) : (
            <HistoryList
              runs={runs}
              onRefresh={onRefresh}
              onViewRun={(run) => {
                onViewRun(run);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
