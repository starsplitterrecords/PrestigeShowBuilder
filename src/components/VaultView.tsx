import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { VaultStorage } from '../storage';
import { sanitizeShow } from '../domainUtils';
import QuickStartModal from './QuickStartModal';
import ConfirmModal from './ConfirmModal';
import StorageAuditModal from './StorageAuditModal';
import { VaultDeduplicateModal } from './VaultDeduplicateModal';
import { AlertCircle } from 'lucide-react';

const VaultView: React.FC = () => {
  const { state, dispatch } = useStore();
  const { summaries, isLoading } = state;
  const [isQuickStartOpen, setQuickStartOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isExportingVault, setIsExportingVault] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isDeduplicateOpen, setIsDeduplicateOpen] = useState(false);

  const handleLoad = async (id: string) => {
    dispatch({ type: 'LOAD_SHOW_START' });
    try {
      const show = await VaultStorage.getById(id);
      if (show) {
        dispatch({ type: 'LOAD_SHOW_SUCCESS', show: sanitizeShow(show) });
      } else {
        dispatch({ type: 'HYDRATE_LIST', summaries: state.summaries });
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Math.random().toString(),
          type: 'error',
          message: 'Failed to load show: Not found in vault.',
        }});
      }
    } catch (e) {
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

  const handleRepair = async () => {
    setIsRepairing(true);
    try {
      await VaultStorage.backfillSummaries();
      const newSummaries = await VaultStorage.getSummaries();
      dispatch({ type: 'HYDRATE_LIST', summaries: newSummaries });
      
      const report = await VaultStorage.auditStorage();
      setAuditReport(report);
      
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: "Vault repair complete." } });
    } catch (err) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: "Repair failed." } });
    } finally {
      setIsRepairing(false);
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
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        <button 
          onClick={() => setQuickStartOpen(true)}
          className="bg-white text-black px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-black hover:bg-neutral-200 transition-all shadow-2xl shadow-white/10"
        >
          Initialize New Series
        </button>
        <button 
          onClick={handleImport}
          className="border border-white/70 bg-white/30 text-white px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-bold hover:bg-white/50 hover:text-white transition-all hover:cursor-pointer"
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
          className="border border-white/70 bg-white/30 text-white px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-bold hover:bg-white/50 hover:text-white transition-all hover:cursor-pointer"
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
          className="border border-white/70 bg-white/30 text-white px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-bold hover:bg-white/50 hover:text-white transition-all hover:cursor-pointer"
        >
          {isAuditing ? 'Auditing...' : 'Storage Audit'}
        </button>
        {duplicateNamesSet.size > 0 && (
          <button 
            onClick={() => setIsDeduplicateOpen(true)}
            className="border-2 border-red-500 bg-red-500/10 text-red-500 px-8 py-4 rounded-sm text-xs uppercase tracking-[0.2em] font-black hover:bg-red-500/20 transition-all shadow-lg text-red-500"
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
            <p className="text-white/50 text-[10px] uppercase tracking-widest">No local vault data found.</p>
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
                  className="text-white/90 hover:text-red-500 text-xs font-bold uppercase tracking-widest opacity-80 hover:opacity-100"
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
