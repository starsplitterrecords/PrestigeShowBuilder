import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { DataCleanupModal } from './DataCleanupModal';
import { Database, Save, Check, ChevronLeft, Home, Cloud, AlertTriangle, RefreshCw, FolderTree } from 'lucide-react';
import { FULLSCREEN_VIEWS } from '../types/models';
import { VaultStorage } from '../storage/VaultStorage';
 
const Header: React.FC = () => {
  const { state, dispatch, save } = useStore();
  const { currentShow, isSaving, isDirty } = state;
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
 
  if (!currentShow) return null;
 
  const handleApplyRestore = async () => {
    setIsConfirmRestoreOpen(false);
    if (!currentShow) return;
 
    setIsRestoring(true);
    try {
      const fresh = await VaultStorage.pullFromCloud(currentShow.id);
      if (!fresh) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Date.now().toString(),
            type: 'error',
            message: 'Failed to restore: No cloud record found or Firestore was empty.'
          }
        });
        return;
      }
 
      // Re-stamp local sync timestamp
      if ((fresh as any).cloudLastModified) {
        await VaultStorage.setLocalSyncMeta(fresh.id, (fresh as any).cloudLastModified);
      }
 
      dispatch({ type: 'LOAD_SHOW_SUCCESS', show: fresh });
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'success',
          message: 'Recovered show: Successfully restored the last cloud-saved state.'
        }
      });
    } catch (err) {
      console.error("[Header] Emergency restore error:", err);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          type: 'error',
          message: err instanceof Error ? err.message : 'An error occurred during restoration.'
        }
      });
    } finally {
      setIsRestoring(false);
    }
  };
 
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
          onClick={() => setIsConfirmRestoreOpen(true)}
          disabled={isRestoring}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-950/20 border border-red-500/30 rounded-sm
                     text-[10px] font-black uppercase tracking-widest text-red-100
                     hover:bg-red-500/20 hover:text-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Bypass local IndexedDB and restore latest show backup from Cloud Firestore"
        >
          {isRestoring ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-red-400" />
          )}
          <span>Restore last cloud version</span>
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
            // DA-092: persist immediately so a destructive repair (e.g. issue
            // dedup) survives reload without requiring a manual SAVE.
            void save(next);
          }}
          onCancel={() => setIsCleanupOpen(false)}
        />
      )}
 
      {isConfirmRestoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070707]/90 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0c0d0f] border border-red-500/30 p-6 rounded-sm space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 shrink-0">
                <AlertTriangle size={24} />
              </span>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Restore show from cloud storage?
                </h4>
                <p className="text-[10px] text-red-400 font-mono font-bold uppercase tracking-widest mt-0.5">
                  WARNING: Destructive Operation
                </p>
              </div>
            </div>
 
            <div className="text-xs text-white/95 leading-relaxed bg-[#140a0c] border border-red-900/20 p-4 rounded-sm space-y-2">
              <p>
                Are you sure you want to pull the <span className="text-red-400 font-bold">last cloud-saved version</span> of this show?
              </p>
              <p className="text-white/80 font-light leading-relaxed">
                This will overwrite and entirely discard all unsaved local changes and re-seed your workspace IndexedDB with the latest copy preserved on Firestore cloud storage.
              </p>
              <p className="text-white/70 text-[11px] italic font-light">
                Only do this if you need to recover from a corrupted local state, data erasure or an accidental local wipe.
              </p>
            </div>
 
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsConfirmRestoreOpen(false)}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest rounded transition-all active:scale-95"
              >
                No, Keep Local
              </button>
              <button
                onClick={handleApplyRestore}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest rounded transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <Cloud size={12} />
                Yes, Restore From Cloud
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
 
export default Header;
