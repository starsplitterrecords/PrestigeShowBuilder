import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { DataCleanupModal } from './DataCleanupModal';
import { Database, Save, Check, ChevronLeft, Home, FolderTree } from 'lucide-react';
import { FULLSCREEN_VIEWS } from '../types/models';

const Header: React.FC = () => {
  const { state, dispatch, save } = useStore();
  const { currentShow, isSaving, isDirty } = state;
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);

  if (!currentShow) return null;

  const showHomeButton = state.view !== 'dashboard' && FULLSCREEN_VIEWS.includes(state.view);

  return (
    <header className="h-16 border-b border-white/70 bg-[#0a0a0a] flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
      <div className="flex items-center gap-4 md:gap-6">
        <button 
          onClick={() => dispatch({ type: 'TOGGLE_MOBILE_MENU' })}
          className="lg:hidden text-white hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          ☰
        </button>
        <button 
          onClick={() => dispatch({ type: 'CLOSE_SHOW' })}
          className="text-white hover:text-white text-[10px] uppercase tracking-[0.2em] font-black min-h-[44px] flex items-center gap-1"
        >
          <ChevronLeft size={16} />
          <span className="hidden md:inline">Vault</span>
        </button>

        {showHomeButton && (
          <>
            <div className="h-4 w-px bg-white/50" />
            <button 
              onClick={() => dispatch({ type: 'SET_VIEW', view: 'dashboard' })}
              className="text-white hover:text-white text-[10px] uppercase tracking-[0.2em] font-black min-h-[44px] flex items-center gap-1"
            >
              <Home size={14} />
              <span className="hidden md:inline">Series</span>
            </button>
          </>
        )}

        <div className="h-4 w-px bg-white/50" />
        <h1 className="text-lg md:text-xl font-bold text-white truncate max-w-[150px] sm:max-w-xs md:max-w-md">
          {currentShow.titleSuggestion || currentShow.name}
        </h1>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {state.generationMode === 'free' && (
          <span className="px-2 py-0.5 bg-amber-400/20 border border-amber-400/40 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-300">
            Free Mode
          </span>
        )}
        <div className="flex items-center gap-3">
          {isSaving ? (
            <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-amber-400 animate-pulse font-black">Saving...</span>
          ) : isDirty ? (
            <span className="hidden lg:inline text-[10px] uppercase tracking-widest text-white/70 italic font-medium">Unsaved Changes</span>
          ) : (
            <span className="hidden lg:inline text-[10px] uppercase tracking-widest text-emerald-400 flex items-center gap-1 font-black">
              <Check size={10} /> Saved
            </span>
          )}

          <button
            onClick={() => save()}
            disabled={isSaving || !isDirty}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${
              isDirty 
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400 hover:bg-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                : 'bg-white/5 border border-white/10 text-white/60 cursor-not-allowed'
            }`}
            title={isDirty ? "Save changes to production storage" : "All changes saved"}
          >
            <Check className={`w-3.5 h-3.5 ${isDirty ? 'hidden' : 'block'}`} />
            <Save className={`w-3.5 h-3.5 ${isDirty ? 'block' : 'hidden'}`} />
            <span className="hidden lg:inline">Save</span>
          </button>
        </div>

        <button
          onClick={() => dispatch({ type: 'TOGGLE_FORCE_SHOW_TREE' })}
          className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${
            state.forceShowTree
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
          title="Force Sidebar Tree View visibility on all screens"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>{state.forceShowTree ? "Hide Tree" : "Show Tree"}</span>
        </button>

        <button
          onClick={() => setIsCleanupOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-sm
                     text-[10px] font-black uppercase tracking-widest text-white/60
                     hover:bg-white/10 hover:text-white transition-all"
          title="Show Data Cleanup"
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Cleanup</span>
        </button>

        <button
          onClick={() => {
            if (state.view === 'workbench') {
              dispatch({ type: 'SET_VIEW', view: 'dashboard' });
            } else {
              dispatch({ type: 'SET_VIEW', view: 'workbench' });
            }
          }}
          className={`px-3 py-1.5 border rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${
            state.view === 'workbench'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-amber-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
          }`}
          title={state.view === 'workbench' ? "Switch to standard dashboard and legacy panels" : "Switch to Scene Workbench full-screen view"}
        >
          {state.view === 'workbench' ? 'LEGACY: PANELS' : 'Scene Workbench'}
        </button>
      </div>

      {isCleanupOpen && (
        <DataCleanupModal
          onApply={(next) => {
            dispatch({ type: 'UPDATE_SHOW', updates: next });
            void save(next);
          }}
          onCancel={() => setIsCleanupOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;
