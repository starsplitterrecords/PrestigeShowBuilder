import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { VaultStorage } from '../storage';
import { sanitizeShow } from '../domainUtils';
import { signInWithGoogle, signOut } from '../firebase';
import QuickStartModal from './QuickStartModal';
import ConfirmModal from './ConfirmModal';
import StorageAuditModal from './StorageAuditModal';
import { VaultDeduplicateModal } from './VaultDeduplicateModal';
import { RefreshCw, AlertCircle, CheckCircle2, CloudUpload } from 'lucide-react';
import { SyncStatus, ShowSummary } from '../types/models';

const SyncBadge: React.FC<{ summary: ShowSummary }> = ({ summary }) => {
  const localSync = summary.localLastSyncedAt ?? 0;
  const cloudMod = summary.cloudLastModified ?? 0;
  const localMod = summary.lastModified ?? 0;

  let status: SyncStatus = 'synced';
  if (cloudMod > localSync && localMod > localSync) status = 'conflict';
  else if (cloudMod > localSync) status = 'cloud-newer';
  else if (localMod > localSync) status = 'local-newer';

  if (status === 'conflict') {
    return (
      <div className="flex items-center gap-1 text-red-400" title="Conflict: Cloud is newer but you have local changes.">
        <AlertCircle size={10} />
        <span className="text-[10px] uppercase tracking-widest font-black">Conflict</span>
      </div>
    );
  }
  if (status === 'cloud-newer') {
    return (
      <div className="flex items-center gap-1 text-amber-400" title="Update Available: Cloud has a newer version.">
        <RefreshCw size={10} />
        <span className="text-[10px] uppercase tracking-widest font-black">Update</span>
      </div>
    );
  }
  if (status === 'local-newer') {
    return (
      <div className="flex items-center gap-1 text-blue-400" title="Local Changes: Cloud is out of date.">
        <CloudUpload size={10} />
        <span className="text-[10px] uppercase tracking-widest font-black">Unpushed</span>
      </div>
    );
  }
  if (localSync > 0) {
    return (
      <div className="flex items-center gap-1 text-emerald-400/80" title="Synced with Cloud">
        <CheckCircle2 size={10} />
        <span className="text-[10px] uppercase tracking-widest font-black">Synced</span>
      </div>
    );
  }
  return null;
};

const VaultView: React.FC = () => {
  const { state, dispatch } = useStore();
  const { summaries, isLoading, user } = state;
  const [isQuickStartOpen, setQuickStartOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isExportingVault, setIsExportingVault] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ signedIn: boolean; count: number } | null>(null);
  const [isDeduplicateOpen, setIsDeduplicateOpen] = useState(false);

  React.useEffect(() => {
    const checkCloud = async () => {
      if (user && summaries.length === 0) {
        const status = await VaultStorage.getCloudSummaryStatus();
        setCloudStatus(status);
      } else {
        setCloudStatus(null);
      }
    };
    checkCloud();
  }, [user, summaries.length]);

  const handleLoad = async (id: string) => {
    dispatch({ type: 'LOAD_SHOW_START' });
    try {
      const show = await VaultStorage.getById(id);
      if (show) {
        dispatch({ type: 'LOAD_SHOW_SUCCESS', show: sanitizeShow(show) });
      } else {
        // Reset isLoading — LOAD_SHOW_START set it to true
        dispatch({ type: 'HYDRATE_LIST', summaries: state.summaries });
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Math.random().toString(),
          type: 'error',
          message: 'Failed to load show: Not found in vault.',
        }});
      }
    } catch (e) {
      // Reset isLoading on error
      dispatch({ type: 'HYDRATE_LIST', summaries: state.summaries });
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Math.random().toString(),
        type: 'error',
        message: 'Vault access error. Please refresh.',
      }});
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      dispatch({ type: 'DELETE_SHOW', id: deleteConfirmId });
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        await VaultStorage.importVault(file);
        const newSummaries = await VaultStorage.getSummaries();
        dispatch({ type: 'HYDRATE_LIST', summaries: newSummaries });
        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: "Vault bundle imported successfully." } });
      } catch (err: any) {
        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: `Import failed: ${err.message || "Invalid bundle"}` } });
      }
    };
    input.click();
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: "Logged in successfully." } });
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        // Silently handle common user-driven cancellations
        console.log("Sign-in cancelled by user.");
      } else {
        console.error("Login error:", err);
        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: "Login failed." } });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: "Logged out successfully." } });
    } catch (err) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: "Logout failed." } });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Preparing upload...');
    try {
      await VaultStorage.syncLocalToCloud((status, current, total) => {
        setSyncStatus(`${status} (${current}/${total})`);
      });
      const newSummaries = await VaultStorage.getSummaries();
      dispatch({ type: 'HYDRATE_LIST', summaries: newSummaries });
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: "Local changes uploaded to cloud successfully." } });
    } catch (err) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: "Upload failed." } });
    } finally {
      setIsSyncing(false);
      setSyncStatus('');
    }
  };

  const handleRestore = async () => {
    if (!user) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: "Sign in to restore from cloud." } });
      return;
    }
    setIsRestoring(true);
    try {
      const result = await VaultStorage.rehydrateSummariesFromCloud();
      const newSummaries = await VaultStorage.getSummaries();
      dispatch({ type: 'HYDRATE_LIST', summaries: newSummaries });
      
      if (result.restored > 0) {
        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: `Restored ${result.restored} series summaries from cloud.` } });
      } else {
        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'info', message: "No cloud summaries found." } });
      }
    } catch (err) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: "Restore failed." } });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRepair = async () => {
    setIsRepairing(true);
    setSyncStatus('Backfilling summaries...');
    try {
      await VaultStorage.backfillSummaries();
      if (user) {
        await VaultStorage.syncLocalToCloud((status, current, total) => {
          setSyncStatus(`${status} (${current}/${total})`);
        });
      }
      const newSummaries = await VaultStorage.getSummaries();
      dispatch({ type: 'HYDRATE_LIST', summaries: newSummaries });
      
      // Refresh audit report
      const report = await VaultStorage.auditStorage();
      setAuditReport(report);
      
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: "Vault repair complete." } });
    } catch (err) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: "Repair failed." } });
    } finally {
      setIsRepairing(false);
      setSyncStatus('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white/90 text-xs uppercase tracking-widest animate-pulse font-black">Accessing Vault...</div>
      </div>
    );
  }

  const duplicateNamesSet = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const summary of summaries) {
      let nameNorm = (summary.name || '');
      if (nameNorm.endsWith(' (Restored)')) {
        nameNorm = nameNorm.slice(0, -11);
      }
      nameNorm = nameNorm.trim().toLowerCase();
      if (nameNorm) {
        counts.set(nameNorm, (counts.get(nameNorm) || 0) + 1);
      }
    }
    const dups = new Set<string>();
    for (const [nameNorm, count] of counts.entries()) {
      if (count >= 2) {
        dups.add(nameNorm);
      }
    }
    return dups;
  }, [summaries]);

  const sortedSummaries = [...summaries].sort((a, b) => 
    (b.lastModified || b.createdAt || 0) - (a.lastModified || a.createdAt || 0)
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <QuickStartModal isOpen={isQuickStartOpen} onClose={() => setQuickStartOpen(false)} />
      <VaultDeduplicateModal isOpen={isDeduplicateOpen} onClose={() => setIsDeduplicateOpen(false)} />
      <StorageAuditModal 
        isOpen={isAuditOpen} 
        onClose={() => setIsAuditOpen(false)} 
        report={auditReport} 
        onRepair={handleRepair}
        isRepairing={isRepairing}
        onDeleteOrphan={(id) => {
          setAuditReport((prev: any) => ({
            ...prev,
            orphans: prev.orphans.filter((oid: string) => oid !== id)
          }));
        }}
      />
      <ConfirmModal 
        isOpen={!!deleteConfirmId}
        title="Purge Production?"
        body="This will permanently delete this series and all its associated assets from your local vault. This action cannot be undone."
        isDangerous={true}
        confirmLabel="Purge"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
      
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter text-white">Prestige Show Builder</h1>
        <p className="text-amber-500 text-[10px] uppercase tracking-[0.4em] font-black">AI-Powered Narrative Development Engine</p>
        
        <div className="pt-4">
          {user ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                {user.photoURL && <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />}
                <span className="text-[10px] text-white/70 uppercase tracking-widest font-bold">{user.displayName || user.email}</span>
                <button 
                  onClick={handleLogout}
                  className="text-amber-500 hover:text-amber-400 text-[10px] uppercase tracking-widest font-black ml-2"
                >
                  Sign Out
                </button>
              </div>
              <p className="text-[10px] text-white/60 uppercase tracking-widest">Cloud Sync Active</p>
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="text-amber-500 hover:text-amber-400 text-[10px] uppercase tracking-widest font-black border border-amber-500/30 px-3 py-1 rounded-full disabled:opacity-50"
                >
                  {isSyncing ? (syncStatus || "Uploading...") : "Upload Local Changes to Cloud"}
                </button>
                <p className="text-[10px] text-white/60 uppercase tracking-widest max-w-[300px] text-center leading-tight">
                  Uploads local series and assets to cloud. Does not restore erased local data. Use Restore Local Vault from Cloud to recover after data loss.
                </p>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="bg-amber-500 text-black px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-black hover:bg-amber-400 transition-all disabled:opacity-50"
            >
              {isLoggingIn ? "Signing In..." : "Sign In with Google for Cloud Sync"}
            </button>
          )}
        </div>
      </div>

      {cloudStatus && cloudStatus.count > 0 && (
        <div className="max-w-xl mx-auto bg-amber-500/5 border border-amber-500/20 p-6 rounded-sm text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="text-amber-500 text-[10px] uppercase tracking-[0.2em] font-bold">
            Local data appears empty. {cloudStatus.count} series found in cloud.
          </p>
          <button 
            onClick={handleRestore}
            disabled={isRestoring}
            className="bg-amber-500 text-black px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-black hover:bg-amber-400 transition-all disabled:opacity-50"
          >
            {isRestoring ? "Restoring..." : "Restore Vault List from Cloud"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-6">
        <button 
          onClick={() => setQuickStartOpen(true)}
          className="bg-white text-black px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-black hover:bg-neutral-200 transition-all shadow-2xl shadow-white/10"
        >
          Initialize New Series
        </button>
        {user && (
          <button 
            onClick={handleRestore}
            disabled={isRestoring}
            className="border border-amber-500/70 bg-amber-500/10 text-amber-500 px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-bold hover:bg-amber-500/20 transition-all"
          >
            {isRestoring ? 'Restoring...' : 'Restore Local Vault from Cloud'}
          </button>
        )}
        <button 
          onClick={handleImport}
          className="border border-white/70 bg-white/30 text-white px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-bold hover:bg-white/50 hover:text-white transition-all"
        >
          Import Vault ZIP
        </button>
        <button 
          onClick={async () => {
            if (isExportingVault) return;
            setIsExportingVault(true);
            try {
              const blob = await VaultStorage.exportVault();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `prestige_vault_bundle_${new Date().toISOString().split('T')[0]}.zip`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: 'Vault bundle exported successfully.' } });
            } catch (e) {
              console.error('Vault export failed:', e);
              dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: 'Export failed. Check console for details.' } });
            } finally {
              setIsExportingVault(false);
            }
          }}
          className="border border-white/70 bg-white/30 text-white px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-bold hover:bg-white/50 hover:text-white transition-all"
        >
          {isExportingVault ? 'Exporting...' : 'Export Vault ZIP'}
        </button>
        <button 
          onClick={async () => {
            if (isAuditing) return;
            setIsAuditing(true);
            try {
              const report = await VaultStorage.auditStorage();
              setAuditReport(report);
              setIsAuditOpen(true);
            } catch (e) {
              console.error('Storage audit failed:', e);
              dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: 'Audit failed. Check console for details.' } });
            } finally {
              setIsAuditing(false);
            }
          }}
          className="border border-white/70 bg-white/30 text-white px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-bold hover:bg-white/50 hover:text-white transition-all"
        >
          {isAuditing ? 'Auditing...' : 'Storage Audit'}
        </button>
        {duplicateNamesSet.size > 0 && (
          <button 
            onClick={() => setIsDeduplicateOpen(true)}
            className="border-2 border-red-500 bg-red-500/10 text-red-500 px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-black hover:bg-red-500/20 transition-all shadow-lg"
          >
            Fix Duplicates ({duplicateNamesSet.size})
          </button>
        )}
      </div>

      <p className="text-[10px] text-white/60 text-center max-w-lg mx-auto leading-relaxed uppercase tracking-wider font-medium">
        Vault export restores show data, character portraits, locked references, and cover anchors.
        It does not fully restore comic/video gallery image blobs due to browser-based ZIP storage size limits.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedSummaries.length === 0 ? (
          <div className="col-span-full py-24 text-center border border-dashed border-white/70 rounded-sm space-y-6">
            {!user ? (
              <p className="text-white/50 text-[10px] uppercase tracking-widest">Sign in to sync or restore your vault.</p>
            ) : cloudStatus && cloudStatus.count > 0 ? (
              <div className="space-y-4">
                <p className="text-white/50 text-[10px] uppercase tracking-widest">Local data is empty. Restore your vault list from cloud.</p>
                <button 
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="text-amber-500 hover:text-amber-400 text-[10px] uppercase tracking-widest font-black border border-amber-500/30 px-4 py-2 rounded-full"
                >
                  Restore from Cloud
                </button>
              </div>
            ) : (
              <p className="text-white/50 text-[10px] uppercase tracking-widest">No local or cloud vault data found.</p>
            )}
          </div>
        ) : (
          sortedSummaries.map(summary => (
            <div 
              key={summary.id}
              onClick={() => handleLoad(summary.id)}
              className="glass p-8 group cursor-pointer hover:border-amber-500/30 transition-all relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDeleteClick(e, summary.id)}
                  className="text-white/90 hover:text-red-500 text-xs font-bold uppercase tracking-widest"
                >
                  Delete
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-white uppercase tracking-widest font-black block mb-2">Draft v{summary.draftVersion}</span>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-bold text-white group-hover:text-amber-500 transition-colors line-clamp-1">
                        {summary.titleSuggestion || summary.name}
                      </h3>
                      {duplicateNamesSet.has((summary.name || '').trim().toLowerCase()) && (
                        <div title="Duplicate series name detected">
                          <AlertCircle 
                            className="text-amber-500 shrink-0" 
                            size={16} 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <SyncBadge summary={summary} />
                </div>
                
                <p className="text-white text-xs leading-relaxed line-clamp-3 h-12">
                  {summary.premise || "No premise defined."}
                </p>
              </div>

              <div className="flex justify-between items-center text-[10px] text-white uppercase tracking-widest font-bold pt-4 border-t border-white/70">
                <span>Created: {new Date(summary.createdAt).toLocaleDateString()}</span>
                <span>Modified: {new Date(summary.lastModified || summary.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VaultView;
