import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../StoreContext';
import { VaultStorage } from '../storage';
import { openDB, SHOW_STORE } from '../storage/db';
import { AlertTriangle, Check, Trash2, ShieldAlert, Loader } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface DuplicateShowInfo {
  summaryId: string;
  name: string;
  lastModified: number;
  createdAt: number;
  hasRestoredSuffix: boolean;
  fullShowLoaded: boolean;
  beatCount?: number;
  scriptCount?: number;
  galleryCount?: number;
}

interface DuplicateGroup {
  normalizedName: string;
  records: DuplicateShowInfo[];
  selectedCanonicalId?: string;
}

export const VaultDeduplicateModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useStore();
  const { summaries } = state;

  const [isLoading, setIsLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentProgressIndex, setCurrentProgressIndex] = useState(0);
  const [currentProgressName, setCurrentProgressName] = useState('');

  // Normalize name by removing " (Restored)" suffix, trimming and lowercasing
  const normalizeName = (name: string): string => {
    let s = name || '';
    if (s.endsWith(' (Restored)')) {
      s = s.slice(0, -11);
    }
    return s.trim().toLowerCase();
  };

  // Group and load information from local IndexedDB
  useEffect(() => {
    if (!isOpen) return;

    const loadGroupsData = async () => {
      setIsLoading(true);
      try {
        const db = await openDB();
        
        // Match name groups
        const nameToSummaries = new Map<string, typeof summaries>();
        for (const s of summaries) {
          const norm = normalizeName(s.name);
          if (!norm) continue;
          if (!nameToSummaries.has(norm)) {
            nameToSummaries.set(norm, []);
          }
          nameToSummaries.get(norm)!.push(s);
        }

        const groups: DuplicateGroup[] = [];

        for (const [norm, sumList] of nameToSummaries.entries()) {
          if (sumList.length < 2) continue;

          const records: DuplicateShowInfo[] = [];
          for (const sum of sumList) {
            let fullShowLoaded = false;
            let beatCount = 0;
            let scriptCount = 0;
            let galleryCount = 0;

            try {
              const tx = db.transaction(SHOW_STORE, 'readonly');
              const req = tx.objectStore(SHOW_STORE).get(sum.id);
              const fullShow = await new Promise<any>((resolve) => {
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
              });

              if (fullShow) {
                fullShowLoaded = true;
                galleryCount = fullShow.comicGallery ? fullShow.comicGallery.length : 0;

                if (Array.isArray(fullShow.seasons)) {
                  for (const s of fullShow.seasons) {
                    if (Array.isArray(s.episodes)) {
                      for (const ep of s.episodes) {
                        if (Array.isArray(ep.acts)) {
                          for (const act of ep.acts) {
                            if (Array.isArray(act.scenes)) {
                              for (const sc of act.scenes) {
                                if (Array.isArray(sc.cinematicBeats)) {
                                  beatCount += sc.cinematicBeats.length;
                                  for (const b of sc.cinematicBeats) {
                                    if (b.script) {
                                      if (Array.isArray(b.script.entries)) {
                                        scriptCount += b.script.entries.length;
                                      } else if (Array.isArray(b.script.lines)) {
                                        scriptCount += b.script.lines.length;
                                      }
                                    } else if (Array.isArray(b.lines)) {
                                      scriptCount += b.lines.length;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.error(`Failed to load full show ${sum.id} from local IDB:`, err);
            }

            records.push({
              summaryId: sum.id,
              name: sum.name || 'Untitled Show',
              lastModified: sum.lastModified || sum.createdAt || 0,
              createdAt: sum.createdAt,
              hasRestoredSuffix: (sum.name || '').endsWith(' (Restored)'),
              fullShowLoaded,
              beatCount: fullShowLoaded ? beatCount : undefined,
              scriptCount: fullShowLoaded ? scriptCount : undefined,
              galleryCount: fullShowLoaded ? galleryCount : undefined
            });
          }

          // Sort records within group by last modified descending
          records.sort((a, b) => b.lastModified - a.lastModified);

          groups.push({
            normalizedName: norm,
            records,
          });
        }

        setDuplicateGroups(groups);
      } catch (err) {
        console.error('Failed to list or populate duplicate groups:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadGroupsData();
  }, [isOpen, summaries]);

  // Handle single group keep canonical selection
  const handleKeepSelection = (groupNameNorm: string, targetShowId: string) => {
    setDuplicateGroups(prev =>
      prev.map(g =>
        g.normalizedName === groupNameNorm
          ? { ...g, selectedCanonicalId: targetShowId }
          : g
      )
    );
  };

  // Compute stats for deletion
  const deletionSummary = useMemo(() => {
    let deleteCount = 0;
    let resolvedGroupsCount = 0;
    const idsToDelete: { id: string; name: string }[] = [];

    for (const g of duplicateGroups) {
      if (g.selectedCanonicalId) {
        resolvedGroupsCount++;
        for (const r of g.records) {
          if (r.summaryId !== g.selectedCanonicalId) {
            deleteCount++;
            idsToDelete.push({ id: r.summaryId, name: r.name });
          }
        }
      }
    }

    return {
      deleteCount,
      resolvedGroupsCount,
      idsToDelete
    };
  }, [duplicateGroups]);

  // Apply deletions
  const applyDeletions = async () => {
    setShowConfirm(false);
    setIsDeleting(true);
    setCurrentProgressIndex(0);

    try {
      const { idsToDelete } = deletionSummary;
      for (let i = 0; i < idsToDelete.length; i++) {
        const item = idsToDelete[i];
        setCurrentProgressIndex(i);
        setCurrentProgressName(item.name);
        // Call global VaultStorage.deleteOne
        await VaultStorage.deleteOne(item.id);
      }

      // Success, hydrate and refresh summaries
      const newSummaries = await VaultStorage.getSummaries();
      dispatch({ type: 'HYDRATE_LIST', summaries: newSummaries });
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Math.random().toString(),
          type: 'success',
          message: `Successfully repaired ${idsToDelete.length} duplicate records.`,
        }
      });
      onClose();
    } catch (e) {
      console.error('Error applying direct deletions:', e);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Math.random().toString(),
          type: 'error',
          message: 'An error occurred during deduplication. Please check logs.',
        }
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
      <div className="glass p-8 w-full max-w-4xl relative max-h-[90vh] flex flex-col border-white/70 bg-[#070707] text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tighter text-amber-500">Duplicate Show Repair</h2>
            <p className="text-[10px] text-white/60 uppercase tracking-widest mt-1">
              Select one canonical record to keep. Duplicate matches are grouped by trimmed name.
            </p>
          </div>
          {!isDeleting && (
            <button 
              onClick={onClose} 
              className="text-white/60 hover:text-white text-[10px] uppercase tracking-widest font-black"
            >
              Close
            </button>
          )}
        </div>

        {/* Dynamic States */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
            <Loader className="animate-spin text-amber-500" size={24} />
            <p className="text-xs text-white/70 uppercase tracking-widest font-bold">Scanning Local Databases...</p>
          </div>
        ) : isDeleting ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-6">
            <Loader className="animate-spin text-amber-500" size={32} />
            <div className="text-center space-y-2">
              <p className="text-sm text-white font-bold uppercase tracking-widest">
                Purging Duplicate Records ({currentProgressIndex + 1}/{deletionSummary.deleteCount})
              </p>
              <p className="text-xs text-white/50 font-mono">
                Deleting: {currentProgressName}
              </p>
            </div>
          </div>
        ) : duplicateGroups.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
            <Check className="text-emerald-400" size={32} />
            <p className="text-sm text-white/95 font-bold uppercase tracking-widest text-center leading-relaxed">
              No duplicate shows found in summarizing list!
            </p>
          </div>
        ) : (
          <>
            {/* Scrollable Groups Container */}
            <div className="flex-1 overflow-y-auto pt-6 pb-4 space-y-8 pr-2">
              {duplicateGroups.map(group => {
                // Find most recently modified record amongst they
                const maxModified = Math.max(...group.records.map(r => r.lastModified));
                const anyRecordMissingLocalFullData = group.records.some(r => !r.fullShowLoaded);

                return (
                  <div key={group.normalizedName} className="border border-white/10 bg-white/5 p-6 rounded-sm space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-xs uppercase tracking-wider font-extrabold text-white">
                        Group: {group.records[0]?.name.replace(/ \(Restored\)$/, '') || group.normalizedName}
                      </span>
                      <span className="text-[10px] font-mono text-white/60">
                        {group.records.length} duplicate records detected
                      </span>
                    </div>

                    {/* Missing local data alert */}
                    {anyRecordMissingLocalFullData && (
                      <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 p-3 rounded-sm text-red-400 text-[11px] leading-relaxed">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Full data not available locally — load from cloud before deleting.</p>
                          <p className="text-white/60 mt-0.5">We cannot safely purge duplicate matches until all grouped content has been downloaded to this device.</p>
                        </div>
                      </div>
                    )}

                    {/* Records Table */}
                    <div className="space-y-3">
                      {group.records.map(record => {
                        const isMostRecent = record.lastModified === maxModified && maxModified > 0;
                        const isSelected = group.selectedCanonicalId === record.summaryId;
                        const isOtherKept = group.selectedCanonicalId && group.selectedCanonicalId !== record.summaryId;

                        return (
                          <div 
                            key={record.summaryId}
                            className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-sm border transition-all ${
                              isSelected 
                                ? 'border-emerald-500/50 bg-emerald-500/5' 
                                : isOtherKept 
                                ? 'border-red-500/20 bg-red-500/5 opacity-50'
                                : 'border-white/10 bg-black/40'
                            }`}
                          >
                            <div className="space-y-2 flex-1 min-w-0 pr-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-sm ${isSelected ? 'bg-emerald-500 text-black font-black' : 'bg-white/10 text-white/80'}`}>
                                  ID: {record.summaryId}
                                </span>
                                {isMostRecent && (
                                  <span className="bg-amber-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm tracking-widest uppercase">
                                    Most Recent
                                  </span>
                                )}
                                {record.hasRestoredSuffix && (
                                  <span className="border border-white/30 text-white/70 text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-extrabold">
                                    Restored
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                <span className="text-[10px] text-white/60">
                                  Modified: <strong className="text-white/90">{new Date(record.lastModified).toLocaleDateString()}</strong>
                                </span>
                                {record.fullShowLoaded ? (
                                  <>
                                    <span className="text-[10px] text-white/60">
                                      Beats: <strong className="text-white/90">{record.beatCount}</strong>
                                    </span>
                                    <span className="text-[10px] text-white/60">
                                      Dialogue Lines: <strong className="text-white/90">{record.scriptCount}</strong>
                                    </span>
                                    <span className="text-[10px] text-white/60">
                                      Gallery Pages: <strong className="text-white/90">{record.galleryCount}</strong>
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-red-500 col-span-3 font-medium">
                                    Local source is missing (Cloud only)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="mt-4 md:mt-0 shrink-0">
                              <button
                                onClick={() => handleKeepSelection(group.normalizedName, record.summaryId)}
                                disabled={anyRecordMissingLocalFullData || !record.fullShowLoaded || isSelected}
                                className={`px-4 py-2 rounded-sm text-[10px] uppercase tracking-wider font-black transition-all ${
                                  isSelected
                                    ? 'bg-emerald-500 text-black cursor-default'
                                    : 'bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white'
                                }`}
                              >
                                {isSelected ? (
                                  <span className="flex items-center gap-1">
                                    <Check size={10} strokeWidth={3} /> Kept
                                  </span>
                                ) : (
                                  'Keep This One'
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions Bar footer */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4">
              <span className="text-[11px] text-white/70">
                Processed <strong className="text-white font-extrabold">{deletionSummary.resolvedGroupsCount}</strong> of <strong className="text-white font-extrabold">{duplicateGroups.length}</strong> duplicate groups.
              </span>
              <button
                disabled={deletionSummary.deleteCount === 0}
                onClick={() => setShowConfirm(true)}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black px-6 py-3 rounded-sm text-[10px] uppercase tracking-widest font-black transition-all"
              >
                Apply Deletions ({deletionSummary.deleteCount} duplicate{deletionSummary.deleteCount !== 1 ? 's' : ''})
              </button>
            </div>
          </>
        )}
      </div>

      {/* Confirmation inner dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm">
          <div className="glass p-8 w-full max-w-md relative space-y-6 border-red-500/50 bg-[#070707] text-white">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold uppercase tracking-tighter">Confirm Permanent Purge?</h3>
            </div>
            
            <p className="text-xs text-white/90 leading-relaxed">
              This will permanently delete <strong className="text-amber-500 font-extrabold">{deletionSummary.deleteCount}</strong> duplicate show record(s) and all associated assets, logs, scripts, and media databases from this device and Firebase Cloud Storage.
            </p>
            <p className="text-xs text-red-400/90 font-medium">
              This action is destructive and cannot be undone. Kept records will remain completely unaffected.
            </p>

            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => setShowConfirm(false)} 
                className="flex-1 border border-white/40 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-white/10"
              >
                Cancel
              </button>
              <button 
                onClick={applyDeletions}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 text-[10px] uppercase tracking-widest font-black"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
