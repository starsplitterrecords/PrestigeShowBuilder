import React from 'react';
import { useStore } from '../../StoreContext';
import { ComicGalleryEntry } from '../../types/models';
import { CheckCircle2, Archive } from 'lucide-react';
import { VaultStorage } from '../../storage/VaultStorage';
import { SyncBlockedError } from '../../storage/SyncBlockedError';
import { signInWithGoogle } from '../../firebase';

interface MobileApprovalControlsProps {
  entry: ComicGalleryEntry;
}

const MobileApprovalControls: React.FC<MobileApprovalControlsProps> = ({ entry }) => {
  const { currentShow } = useStore().state;
  const { dispatch } = useStore();

  const handleToggleApprove = async () => {
    if (!currentShow) return;
    const isApproved = entry.status === 'approved';
    const nextStatus = isApproved ? 'draft' as const : 'approved' as const;

    const newGallery = (currentShow.comicGallery || []).map(g => {
      if (nextStatus === 'approved' && g.beatFid === entry.beatFid && g.assetId !== entry.assetId && g.status !== 'archived') {
        return { ...g, status: 'archived' as const };
      }
      if (g.assetId === entry.assetId) {
        return { ...g, status: nextStatus };
      }
      return g;
    });

    const updatedShow = { ...currentShow, comicGallery: newGallery };

    try {
      // Direct call to saveOne with forceCloud=true to trigger sync check
      await VaultStorage.saveOne(updatedShow, true);
      dispatch({ type: 'UPDATE_SHOW', updates: { comicGallery: newGallery } });
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'success',
        message: nextStatus === 'approved' ? "Page added to canon." : "Page reverted to draft."
      }});
    } catch (err: any) {
      if (err instanceof SyncBlockedError) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: `login-${Date.now()}`,
          type: 'warning',
          message: "Sign in required to save canon changes.",
          action: { label: 'Log In', onClick: () => signInWithGoogle() }
        }});
      } else {
        console.error("Save failure:", err);
      }
    }
  };

  const handleArchive = () => {
    if (!currentShow) return;
    const newGallery = (currentShow.comicGallery || []).map(g => 
      g.assetId === entry.assetId ? { ...g, status: 'archived' as const } : g
    );
    dispatch({ type: 'UPDATE_SHOW', updates: { comicGallery: newGallery } });
    dispatch({ type: 'ADD_TOAST', toast: {
      id: Date.now().toString(),
      type: 'info',
      message: "Version moved to archives."
    }});
  };

  return (
    <div className="fixed bottom-24 left-5 right-5 flex gap-3 z-20 animate-in slide-in-from-bottom-2 duration-500">
      <button 
        onClick={handleToggleApprove}
        className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl border transition-all active:scale-95 shadow-xl font-bold uppercase tracking-widest text-[10px]
          ${entry.status === 'approved' 
            ? 'bg-emerald-500 text-white border-white/20' 
            : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
          }
        `}
      >
        <CheckCircle2 size={18} />
        <span>{entry.status === 'approved' ? 'Canonized' : 'Approve for Canon'}</span>
      </button>

      <button 
        onClick={handleArchive}
        className="w-16 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-white/60 active:scale-95 transition-all shadow-xl"
      >
        <Archive size={20} />
      </button>
    </div>
  );
};

export default MobileApprovalControls;
