import React, { ReactNode } from 'react';
import { useStore } from '../../StoreContext';
import MobileNav from './MobileNav';
import MobilePipelineWatcher from './MobilePipelineWatcher';
import SyncStatusStrip from '../SyncStatusStrip';
import { Save, Check } from 'lucide-react';

interface MobileShellProps {
  children: ReactNode;
}

const MobileShell: React.FC<MobileShellProps> = ({ children }) => {
  const { state, save } = useStore();
  const { currentShow, isSaving, isDirty } = state;

  const handleSave = async () => {
    if (isSaving || !isDirty) return;
    await save();
  };

  return (
    <div className="h-screen bg-[#070707] text-white flex flex-col font-sans overflow-hidden">
      {/* HEADER */}
      <header className="px-5 pt-4 pb-3 border-b border-white/5 bg-[#070707] flex-shrink-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />
            <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 truncate">
              {currentShow?.name || 'Untitled'}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <SyncStatusStrip />
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                isSaving
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400/80 animate-pulse'
                  : isDirty
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                  : 'bg-white/5 border border-white/10 text-white/60'
              }`}
              aria-label={isDirty ? 'Save changes' : 'All changes saved'}
            >
              {isSaving ? (
                <>
                  <Save className="w-3 h-3" />
                  <span>Saving</span>
                </>
              ) : isDirty ? (
                <>
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  <span>Saved</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col pt-2 pb-24 px-5">
        {children}
      </main>

      {/* OVERLAYS */}
      <MobilePipelineWatcher />

      {/* NAVIGATION */}
      <MobileNav />
    </div>
  );
};

export default MobileShell;
