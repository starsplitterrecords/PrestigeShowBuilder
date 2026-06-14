import React, { useState, useEffect } from 'react';
import { useStore } from '../StoreContext';
import { RefreshCw, AlertCircle, CheckCircle2, CloudUpload } from 'lucide-react';
import { VaultStorage } from '../storage/VaultStorage';
import { SyncStatus } from '../types/models';

const SyncStatusStrip: React.FC = () => {
  const { state, dispatch } = useStore();
  const { isSaving, view, currentShow } = state;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    if (!currentShow) return;
    
    const checkSync = async () => {
      const status = await VaultStorage.getSyncStatus(currentShow);
      setSyncStatus(status);
    };

    checkSync();
    const interval = setInterval(checkSync, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [currentShow, isSaving, view]);

  const handlePull = async () => {
    if (!currentShow) return;
    setIsPulling(true);
    console.log("[Sync] Pull starting", { showId: currentShow.id });
    
    try {
      // D262: use pullFromCloud which bypasses local cache.
      // getById would have returned the local copy unchanged.
      const fresh = await VaultStorage.pullFromCloud(currentShow.id);
      console.log("[Sync] Pull fetched", {
        ok: !!fresh,
        cloudLastModified: (fresh as any)?.cloudLastModified,
      });

      if (!fresh) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(),
          type: 'warning',
          // @ts-expect-error LEGACY: title does not exist in type 'Toast'
          title: 'Pull failed',
          message: 'Could not fetch latest from cloud. It may have been deleted or permissions changed.',
        }});
        return;
      }

      // Re-stamp localLastSyncedAt strictly against cloudLastModified to prevent skew
      if ((fresh as any).cloudLastModified) {
        await VaultStorage.setLocalSyncMeta(fresh.id, (fresh as any).cloudLastModified);
      }

      dispatch({ type: 'LOAD_SHOW_SUCCESS', show: fresh });
      setSyncStatus('synced');
      
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'success',
        // @ts-expect-error LEGACY: title does not exist in type 'Toast'
        title: 'Sync Complete',
        message: 'Successfully pulled the latest version from cloud.',
      }});
    } catch (err) {
      console.error("[Sync] Pull error", err);
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'error',
        // @ts-expect-error LEGACY: title does not exist in type 'Toast'
        title: 'Pull failed',
        message: String(err),
      }});
    } finally {
      setIsPulling(false);
    }
  };

  if (!currentShow) return null;

  return (
    <div className="flex items-center gap-4">
      {isSaving || isPulling ? (
        <div className="flex items-center gap-1.5 animate-pulse">
          <RefreshCw size={10} className="text-amber-500 animate-spin" />
          <span className="text-[10px] uppercase tracking-widest font-black text-amber-500">
            {isPulling ? 'Pulling' : 'Syncing'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {syncStatus === 'cloud-newer' || syncStatus === 'conflict' ? (
            <button 
              onClick={handlePull}
              className="flex items-center gap-1.5 bg-red-400/20 border border-red-500/50 px-2 py-0.5 rounded-full hover:bg-red-500/20 transition-colors"
              title={syncStatus === 'conflict' ? "Conflict detected! Cloud is newer and you have local changes." : "Cloud version is newer. Pull required."}
            >
              <AlertCircle size={10} className="text-red-400" />
              <span className="text-[10px] uppercase tracking-widest font-black text-red-400">
                {syncStatus === 'conflict' ? 'Conflict' : 'Update Available'}
              </span>
              <RefreshCw size={8} className="text-white/70 ml-1" />
            </button>
          ) : syncStatus === 'local-newer' ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <CloudUpload size={10} className="text-amber-400" />
              <span className="text-[10px] uppercase tracking-widest font-black text-amber-400">Local Changes</span>
            </div>
          ) : syncStatus === 'error' ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <AlertCircle size={10} className="text-red-400" />
              <span className="text-[10px] uppercase tracking-widest font-black text-red-500">Sync Error</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 opacity-70">
              <CheckCircle2 size={10} className="text-emerald-400" />
              <span className="text-[10px] uppercase tracking-widest font-black text-white/90">Cloud Saved</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SyncStatusStrip;
