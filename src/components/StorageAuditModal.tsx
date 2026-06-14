import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssetStorage } from '../storage/AssetStorage';
import { runPromotionCleanup } from '../storage/cleanupDuplicatePromotions';
import { useLightbox } from '../hooks/useLightbox';
import ImageLightbox from './ImageLightbox';

interface AuditReport {
  shows: { id: string; name: string }[];
  summaries: { id: string; name: string }[];
  assets: { id: string; type: string; size: number }[];
  orphans: string[];
}

interface StorageAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AuditReport | null;
  onRepair?: () => void;
  isRepairing?: boolean;
  onDeleteOrphan?: (id: string) => void;
}

const OrphanItem: React.FC<{ id: string; onDelete: (id: string) => void; onOpenLightbox: (url: string, id: string) => void }> = ({ id, onDelete, onOpenLightbox }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let activeUrl: string | null = null;
    const load = async () => {
      const u = await AssetStorage.getBlobUrl(id);
      if (u) {
        setUrl(u);
        activeUrl = u;
      }
    };
    load();
    return () => {
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [id]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await AssetStorage.delete(id);
      onDelete(id);
    } catch (err) {
      console.error("Failed to delete orphan:", id, err);
      setIsDeleting(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.png`;
    a.click();
  };

  return (
    <div 
      className="group relative aspect-square bg-white/5 border border-white/10 rounded-sm overflow-hidden hover:border-amber-500/50 transition-all cursor-pointer"
      onClick={() => url && onOpenLightbox(url, id)}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-2">
        <span className="text-[10px] font-mono text-white/90 break-all text-center">{id}</span>
        
        <button
          onClick={handleDownload}
          className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-sm transition-colors"
        >
          Save
        </button>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-sm transition-colors"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

const StorageAuditModal: React.FC<StorageAuditModalProps> = ({ isOpen, onClose, report, onRepair, isRepairing, onDeleteOrphan }) => {
  const [localOrphans, setLocalOrphans] = useState<string[]>([]);
  const { lightbox, openLightbox, closeLightbox } = useLightbox();
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<{ showId: string; showName: string; report: any } | null>(null);
  const [cleaningId, setCleaningId] = useState<string | null>(null);

  const handleCleanupDuplicatePromotions = async (showId: string, showName: string) => {
    if (cleaningId) return;
    setCleaningId(showId);
    try {
      const reportRes = await runPromotionCleanup(showId);
      setCleanupReport({ showId, showName, report: reportRes });
    } catch (err) {
      console.error("Cleanup failed:", err);
      alert(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCleaningId(null);
    }
  };

  useEffect(() => {
    if (report) {
      setLocalOrphans(report.orphans);
    }
  }, [report]);

  if (!report) return null;

  const handleDelete = (id: string) => {
    setLocalOrphans(prev => prev.filter(oid => oid !== id));
    if (onDeleteOrphan) onDeleteOrphan(id);
  };

  const handleDeleteAll = async () => {
    const toDelete = [...localOrphans];
    try {
      for (const id of toDelete) {
        await AssetStorage.delete(id);
        if (onDeleteOrphan) onDeleteOrphan(id);
      }
      setLocalOrphans([]);
    } catch (err) {
      console.error("Failed to delete all orphans:", err);
    }
    setShowDeleteAllModal(false);
  };

  const totalSize = report.assets.reduce((sum, a) => sum + a.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[80vh] bg-[#0a0a0a] border border-white/20 rounded-sm shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-white">Storage Audit Report</h2>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
                  Database: PrestigeVault_v2 • Total Assets: {report.assets.length} • Total Size: {formatSize(totalSize)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {onRepair && (
                  <button
                    onClick={onRepair}
                    disabled={isRepairing}
                    className="text-amber-500 hover:text-amber-400 transition-colors uppercase text-[10px] font-black tracking-widest border border-amber-500/30 px-3 py-1 rounded-sm disabled:opacity-50"
                  >
                    {isRepairing ? 'Repairing...' : 'Repair Vault'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-white/50 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                  <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Productions</div>
                  <div className="text-2xl font-black text-white">{report.shows.length}</div>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                  <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Summaries</div>
                  <div className="text-2xl font-black text-white">{report.summaries.length}</div>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                  <div className="text-[10px] text-white/50 uppercase tracking-widest mb-1">Total Assets</div>
                  <div className="text-2xl font-black text-white">{report.assets.length}</div>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
                  <div className="text-[10px] text-amber-500 uppercase tracking-widest mb-1">Orphaned Assets</div>
                  <div className="text-2xl font-black text-amber-500">{localOrphans.length}</div>
                </div>
              </div>

              {/* Productions List */}
              <section className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/70 border-b border-white/10 pb-2">
                  Active Productions ({report.shows.length})
                </h3>
                {report.shows.length === 0 ? (
                  <p className="text-[10px] text-white/60 uppercase italic">No productions found in database.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {report.shows.map(s => (
                      <div key={s.id} className="p-3 bg-white/5 border border-white/5 rounded-sm flex items-center justify-between gap-4">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] text-white font-medium truncate">{s.name || 'Untitled'}</span>
                          <span className="text-[9px] font-mono text-white/50 truncate mt-0.5">{s.id}</span>
                        </div>
                        <button
                          onClick={() => handleCleanupDuplicatePromotions(s.id, s.name || 'Untitled')}
                          disabled={cleaningId === s.id}
                          className="text-amber-500 hover:text-amber-400 font-extrabold uppercase text-[9px] tracking-widest border border-amber-500/30 hover:border-amber-500/65 px-2 py-1 rounded-sm shrink-0 transition-colors disabled:opacity-50"
                        >
                          {cleaningId === s.id ? 'Cleaning...' : 'Deduplicate'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Orphans List */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-500">
                    Orphaned Assets ({localOrphans.length})
                  </h3>
                  {localOrphans.length > 0 && (
                    <button
                      onClick={() => setShowDeleteAllModal(true)}
                      className="text-[11px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors border border-red-500/30 px-2 py-0.5 rounded-sm"
                    >
                      Delete All
                    </button>
                  )}
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  These are images or videos that exist in your local database but are not linked to any current production. 
                  They may be from deleted shows or failed generations.
                </p>
                {localOrphans.length === 0 ? (
                  <p className="text-[10px] text-white/60 uppercase italic">No orphaned assets found.</p>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-96 overflow-y-auto custom-scrollbar p-1">
                    {localOrphans.map(id => (
                      <OrphanItem key={id} id={id} onDelete={handleDelete} onOpenLightbox={openLightbox as any} />
                    ))}
                  </div>
                )}
              </section>

              {/* Technical Note */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-sm">
                <p className="text-xs text-amber-400 leading-relaxed">
                  <span className="font-black uppercase">Note:</span> If your productions are missing from the list above, 
                  they have been purged by the browser's storage management. This report only shows what is 
                  currently physically present in this browser's IndexedDB.
                </p>
              </div>
            </div>
          </motion.div>

          {lightbox.src && (
            <ImageLightbox
              src={lightbox.src}
              caption={lightbox.caption}
              onClose={closeLightbox}
            />
          )}

          {/* Delete All Orphans Modal */}
          {showDeleteAllModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDeleteAllModal(false)} />
              <div className="relative bg-[#0a0a0a] border border-white/20 p-8 max-w-md w-full rounded-sm shadow-2xl">
                <h2 className="text-xl font-black uppercase tracking-widest text-white mb-4">Delete All Orphans</h2>
                <p className="text-sm text-white/70 mb-6 leading-relaxed">
                  This will permanently delete all <span className="text-red-400 font-bold">{localOrphans.length}</span> orphaned assets.
                  <br /><br />
                  These assets are not linked to any production. They cannot be recovered.
                  <br /><br />
                  <span className="text-white font-bold uppercase tracking-widest text-xs">This cannot be undone.</span>
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={handleDeleteAll}
                    className="flex-1 py-3 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-sm hover:bg-red-500 transition-colors"
                  >
                    Delete All {localOrphans.length} Assets
                  </button>
                  <button
                    onClick={() => setShowDeleteAllModal(false)}
                    className="flex-1 py-3 bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-sm hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Promotion Cleanup Complete Modal */}
          {cleanupReport && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setCleanupReport(null)} />
              <div className="relative bg-[#0d0d0d] border border-white/20 p-6 max-w-md w-full rounded-sm shadow-2xl space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-emerald-400 border-b border-white/10 pb-2">Promotion Cleanup Complete</h2>
                <div className="space-y-1">
                  <span className="text-[10px] text-white/50 uppercase tracking-wider font-mono">Production</span>
                  <p className="text-xs text-white font-bold font-mono">{cleanupReport.showName}</p>
                </div>
                <div className="space-y-2 border-y border-white/10 py-4 font-mono text-xs text-white/80">
                  <div className="flex justify-between">
                    <span>Issues Count:</span>
                    <span>{cleanupReport.report.issuesBefore} → {cleanupReport.report.issuesAfter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Production Pages:</span>
                    <span className={cleanupReport.report.pagesBefore > cleanupReport.report.pagesAfter ? "text-amber-400 font-bold" : ""}>
                      {cleanupReport.report.pagesBefore} → {cleanupReport.report.pagesAfter}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manifests Removed:</span>
                    <span>{cleanupReport.report.manifestsRemoved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Records Removed:</span>
                    <span>{cleanupReport.report.recordsRemoved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Image Versions:</span>
                    <span>{cleanupReport.report.imageVersionsBefore} → {cleanupReport.report.imageVersionsAfter}</span>
                  </div>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed uppercase tracking-wider">
                  Duplicate issues, redundant historical records, and orphaned pages/images have been cleaned successfully.
                </p>
                <button
                  onClick={() => setCleanupReport(null)}
                  className="w-full py-2.5 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-sm hover:bg-emerald-500 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default StorageAuditModal;
