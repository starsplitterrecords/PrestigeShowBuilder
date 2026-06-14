import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../StoreContext';
import { AssetStorage, VaultStorage } from '../storage';
import {
  PUBLICATION_PRESETS, PublicationPreset, calcPublicationPixels
} from '../constants/generation.constants';
import { generateIssuePDF } from '../utils/exports/issuePDF';
import { generateIssueZip } from '../utils/exports/issueZip';
import { toSlug } from '../utils/slug';
import { useLightbox } from '../hooks/useLightbox';
import ImageLightbox from './ImageLightbox';
import { ImageVersion } from '../types/production';
import { AlertTriangle, Download, Trash2, GripVertical, Image as ImageIcon } from 'lucide-react';
import { useIssueCompiler } from './issuecompiler/useIssueCompiler';
import { getProductionPageStatus } from '../utils/productionStatus';

// Clean functional helper to reorder pages in manifest array
const moveItemInArray = (arr: string[], dragUid: string, targetUid: string): string[] => {
  const dragIdx = arr.indexOf(dragUid);
  const targetIdx = arr.indexOf(targetUid);
  if (dragIdx === -1 || targetIdx === -1) return arr;
  const newArr = [...arr];
  const [removed] = newArr.splice(dragIdx, 1);
  newArr.splice(targetIdx, 0, removed);
  return newArr;
};

const IssueCompilerPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const { lightbox, openLightbox, closeLightbox } = useLightbox();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [showVersions, setShowVersions] = useState<ImageVersion[]>([]);

  // Load production image versions from dedicated IDB store (DA-013)
  useEffect(() => {
    let active = true;
    if (currentShow?.id) {
      VaultStorage.getImageVersionsForShow(currentShow.id)
        .then(versions => {
          if (active) {
            setShowVersions(versions);
          }
        })
        .catch(err => console.error("[Compiler] Failed to load image versions:", err));
    } else {
      setShowVersions([]);
    }
    return () => {
      active = false;
    };
  }, [currentShow?.id, currentShow]);

  // Load images
  useEffect(() => {
    let active = true;
    const loadImages = async () => {
      if (!currentShow) return;
      const assetIdsToLoad = new Set<string>();

      showVersions.filter(v => v.status === 'approved').forEach(v => assetIdsToLoad.add(v.assetId));

      const newUrls: Record<string, string> = {};
      for (const assetId of assetIdsToLoad) {
        if (!imageUrls[assetId]) {
          try {
            const url = await AssetStorage.getBlobUrl(assetId);
            if (active && url) {
              newUrls[assetId] = url;
            }
          } catch {}
        }
      }
      if (active && Object.keys(newUrls).length > 0) {
        setImageUrls(prev => ({ ...prev, ...newUrls }));
      }
    };
    loadImages();
    return () => {
      active = false;
    };
  }, [showVersions]);

  // Derive promoted and unpromoted references for new navigation bar
  const promotedIssues = useMemo(() => {
    return currentShow?.issues ?? [];
  }, [currentShow]);

  const [activeTab, setActiveTab] = useState<{ type: 'promoted'; id: string } | null>(null);

  useEffect(() => {
    if (currentShow && !activeTab && promotedIssues.length > 0) {
      setActiveTab({ type: 'promoted', id: promotedIssues[0].uid });
    }
  }, [currentShow, promotedIssues, activeTab]);

  // Hook for promoted compiler
  const { pages: newPages, manifest } = useIssueCompiler(currentShow || ({} as any), activeTab?.id ?? '', showVersions);

  const newCoverPage = useMemo(() => {
    return newPages.find(p => p.isCover);
  }, [newPages]);

  const newInteriorPages = useMemo(() => {
    return newPages.filter(p => !p.isCover);
  }, [newPages]);

  // Unified Drag and Drop States
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);

  // Promoted Drag Drop Helpers
  const handleNewDragStart = (e: React.DragEvent, pageUid: string) => {
    setDraggedPageId(pageUid);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNewDropOnPage = async (e: React.DragEvent, targetPageUid: string) => {
    e.preventDefault();
    if (!manifest || !draggedPageId || draggedPageId === targetPageUid || !currentShow) return;

    const currentOrder = manifest.pageOrder;
    const newOrder = moveItemInArray(currentOrder, draggedPageId, targetPageUid);

    await VaultStorage.updateIssueManifest(currentShow.id, manifest.uid, newOrder);
    dispatch({ type: 'RELOAD_SHOW' });
    setDraggedPageId(null);
  };

  const handleNewDropOnCoverSlot = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!manifest || !draggedPageId || !currentShow) return;

    await VaultStorage.updateIssueManifest(currentShow.id, manifest.uid, manifest.pageOrder, draggedPageId);
    dispatch({ type: 'RELOAD_SHOW' });
    setDraggedPageId(null);
  };

  const handleNewSetCover = async (pageUid: string) => {
    if (!manifest || !currentShow) return;
    await VaultStorage.updateIssueManifest(currentShow.id, manifest.uid, manifest.pageOrder, pageUid);
    dispatch({ type: 'RELOAD_SHOW' });
  };

  const [showExportPrompt, setShowExportPrompt] = useState(false);
  const [exportIssueId, setExportIssueId] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'pdf' | 'zip'>('pdf');
  const [exportFilename, setExportFilename] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('raw');
  const [customTrimW, setCustomTrimW] = useState('6.625');
  const [customTrimH, setCustomTrimH] = useState('10.25');

  const [useSSV, setUseSSV] = useState(false);
  const [seriesSlugDraft, setSeriesSlugDraft] = useState('');
  const [releaseSlugDraft, setReleaseSlugDraft] = useState('');

  useEffect(() => {
    if (showExportPrompt && exportIssueId) {
      setSeriesSlugDraft(toSlug(currentShow?.name || 'show'));
      setReleaseSlugDraft(toSlug(exportIssueId || 'issue-1'));
    }
  }, [showExportPrompt, exportIssueId, currentShow]);

  const resolvedPreset: PublicationPreset = (() => {
    const base = PUBLICATION_PRESETS.find(p => p.id === selectedPresetId)
      ?? PUBLICATION_PRESETS[0];
    if (base.id !== 'kdp-custom') return base;
    const w = parseFloat(customTrimW) || 6.625;
    const h = parseFloat(customTrimH) || 10.25;
    const { width, height } = calcPublicationPixels(w, h, 300);
    return { ...base, targetWidth: width, targetHeight: height,
      description: `${width}x${height}px / 300 DPI / KDP custom` };
  })();

  const handleExportIssue = (issueId: string) => {
    setExportType('pdf');
    setExportIssueId(issueId);
    setExportFilename(`${currentShow?.showCode || 'SHOW'}-${issueId.toUpperCase()}.pdf`);
    setShowExportPrompt(true);
  };

  const handleExportZip = (issueId: string) => {
    setExportType('zip');
    setExportIssueId(issueId);
    const today = new Date().toISOString().split('T')[0];
    const sanitizedId = issueId.replace(/[^a-z0-9_-]/gi, '_');
    setExportFilename(`${currentShow?.showCode || 'SHOW'}-${sanitizedId}-images-${today}.zip`);
    setShowExportPrompt(true);
  };

  // Star Splitter or PDF export compilation function
  const confirmExport = async () => {
    if (!exportIssueId || !currentShow) return;
    setShowExportPrompt(false);

    const isZip = exportType === 'zip';
    const filename = (exportFilename || "issue").replace(isZip ? /\.zip$/i : /\.pdf$/i, "");

    setIsExporting(true);
    dispatch({ type: 'PIPELINE_START', task: isZip ? 'EXPORTING IMAGES' : 'EXPORTING PDF' });
    dispatch({ type: "PIPELINE_LOG",
      log: `Export ${isZip ? 'Zip' : 'Issue'}: ${exportIssueId} | ${resolvedPreset.label} / ${resolvedPreset.id === 'raw' ? 'Original' : resolvedPreset.targetWidth + 'x' + resolvedPreset.targetHeight + 'px'}${useSSV ? ' | Star Splitter Mode' : ''}` });

    try {
      let blob: Blob;

      {
        const { pages: exportPages } = useIssueCompiler(currentShow, exportIssueId, showVersions);

        // Export reads approvedImage from the uid CompilerPage
        const approved = exportPages
          .filter(p => p.approvedImage !== null)
          .map(p => ({
            pageNumber: p.pageNumber,
            assetId: p.approvedImage!.assetId,
            isCover: p.isCover,
          }));

        const validPages = approved.filter(p => !p.isCover);
        const validCover = approved.find(p => p.isCover);

        if (isZip) {
          const ssvOptions = useSSV ? {
            starSplitter: {
              seriesSlug: seriesSlugDraft,
              releaseSlug: releaseSlugDraft,
              seriesTitle: currentShow.name,
              releaseTitle: exportIssueId,
            }
          } : {};

          blob = await generateIssueZip(validPages as any, {
            presetId: selectedPresetId === 'raw' ? undefined : selectedPresetId,
            includeArchived: false,
            ...ssvOptions
          }, validCover as any);
        } else {
          const mockPages = validPages.map(p => ({
            id: p.assetId,
            assetId: p.assetId,
            enabled: true,
          }));
          blob = await generateIssuePDF(currentShow, mockPages, selectedPresetId, validCover as any);
        }
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      let finalFilename = isZip ? `${filename}.zip` : `${filename}.pdf`;
      if (isZip && useSSV) {
        finalFilename = `${seriesSlugDraft}_${releaseSlugDraft}.zip`;
      }
      
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const { pages: countPages } = useIssueCompiler(currentShow, exportIssueId, showVersions);
      const exportedPagesCount = countPages.filter(p => p.approvedImage !== null).length;

      dispatch({ 
        type: 'PIPELINE_END', 
        task: 'COMPLETE',
        subTask: `${exportedPagesCount} pages / ${resolvedPreset.label}` 
      });
      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { 
          id: Math.random().toString(),
          type: 'success', 
          message: `${isZip ? 'Images border' : 'PDF'} exported -- ${resolvedPreset.label}` 
        } 
      });

    } catch (err: any) {
      dispatch({ type: "PIPELINE_LOG", log: `Export failed: ${err.message}` });
      dispatch({ type: 'PIPELINE_END', task: 'ERROR', subTask: 'Export failed.' });
      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { 
          id: Math.random().toString(),
          type: 'error', 
          message: `${isZip ? 'Image Zip' : 'PDF'} Export Failed` 
        } 
      });
    } finally {
      setIsExporting(false);
      setExportIssueId(null);
    }
  };

  if (!currentShow) {
    return (
      <div className="h-full flex flex-col bg-[#070707] text-white overflow-hidden items-center justify-center p-6 text-center select-none">
        <span className="text-white/60 font-mono text-[10px] uppercase tracking-widest animate-pulse">
          Loading Show Data...
        </span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#070707] text-white overflow-hidden font-sans">
      
      {/* Dynamic Header */}
      <header className="p-6 border-b border-white/20 shrink-0 bg-[#0a0a0a] select-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-amber-500">Issue Compiler</h2>
            <p className="text-[10px] text-white/60 font-mono uppercase tracking-[0.2em] mt-1">
              Assemble, Reorder, and Finalize compiled storyboard sequences for publication.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">
              Active Compiler Mode
            </div>
            <div className="text-lg font-black text-white uppercase tracking-wider">
              PRODUCTION MODEL
            </div>
          </div>
        </div>
      </header>

      {/* Selector Navigation Bar with promoted issues tabs and Legacy dropdown */}
      <div className="flex flex-wrap border-b border-white/10 bg-black/40 px-6 py-2.5 items-center justify-between z-30 shrink-0 select-none gap-2">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/60 mr-2 font-bold select-none">
            Compile Target:
          </span>

          {promotedIssues.map(issue => {
            const isActive = activeTab?.type === 'promoted' && activeTab.id === issue.uid;
            return (
              <button
                key={issue.uid}
                onClick={() => setActiveTab({ type: 'promoted', id: issue.uid })}
                className={`flex items-center gap-2 px-3 py-1.5 border text-[10px] font-black uppercase tracking-wider rounded-sm transition-all duration-150 cursor-pointer focus:outline-none
                  ${isActive
                    ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {issue.issueCode || 'ISSUE'} — {issue.title || 'Untitled'}
              </button>
            );
          })}
        </div>

        {/* Global actions row for currently active issue target */}
        {activeTab && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleExportZip(activeTab.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 text-white/90 rounded-sm
                         text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-white/10 transition-all border border-white/10 cursor-pointer"
            >
              Zip Images
            </button>
            <button 
              onClick={() => handleExportIssue(activeTab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black rounded-sm
                         text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all cursor-pointer shadow-md"
            >
              <Download size={13} /> Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Main compiler canvas scroll area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 bg-[#070707]">

        {/* ==================== 1. NEW PROMOTED COMPILER INTERFACE ==================== */}
        {activeTab?.type === 'promoted' && (
          <div className="space-y-8 animate-in slide-in-from-top-1 duration-150">
            {newPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/10 rounded-sm select-none">
                <AlertTriangle size={32} className="text-white/60 mb-4 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white/70 mb-1">No Pages Promoted</h3>
                <p className="text-[11px] text-white/50 text-center uppercase tracking-widest font-mono italic max-w-md px-4 leading-relaxed">
                  Generate Comic storyboards using the main pipeline interface, then tap 'Promote to Production' to compile pages.
                </p>
              </div>
            ) : (
              <>
                {/* Cover Slot */}
                <div className="space-y-3 select-none">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Cover Assignment</h4>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleNewDropOnCoverSlot(e)}
                      className={`relative aspect-[3/4] rounded-sm transition-all flex flex-col items-center justify-center p-4
                        ${manifest?.coverPageUid 
                          ? 'bg-amber-500/5 border border-amber-500/30' 
                          : 'bg-white/5 border border-dashed border-white/15 hover:border-amber-500/40 hover:bg-amber-500/5'
                        }`}
                    >
                      {newCoverPage ? (
                        <>
                          {newCoverPage.approvedImage?.assetId && imageUrls[newCoverPage.approvedImage.assetId] ? (
                            <img 
                              src={imageUrls[newCoverPage.approvedImage.assetId]} 
                              alt="Cover Artwork" 
                              className="absolute inset-0 w-full h-full object-cover opacity-80" 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <div className="absolute inset-0 bg-neutral-950 border border-white/10 flex flex-col items-center justify-center p-4 text-center">
                              <ImageIcon size={28} className="text-white/60 mb-2" />
                              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">UNRESOLVED COVER</span>
                              <span className="text-[10px] font-mono text-white/60 break-all max-w-full px-2 mt-1 truncate">P. {newCoverPage.pageNumber}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 flex flex-col justify-between p-4 group z-20">
                             <div className="flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[10px] font-black uppercase rounded-sm">
                                 COVER
                                </span>
                               <button 
                                 onClick={() => handleNewSetCover("")}
                                 className="p-1.5 bg-black/80 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/10 rounded-sm transition-all cursor-pointer"
                                 title="Clear Cover Assignment"
                               >
                                 <Trash2 size={16} />
                               </button>
                             </div>
                             {newCoverPage.approvedImage?.assetId && imageUrls[newCoverPage.approvedImage.assetId] && (
                               <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                   onClick={() => openLightbox(imageUrls[newCoverPage.approvedImage!.assetId!])}
                                   className="w-full py-2 bg-black/80 hover:bg-black text-[11px] font-black uppercase tracking-widest rounded-sm border border-white/40 transition-all cursor-pointer"
                                 >
                                   View Cover
                                 </button>
                               </div>
                             )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center space-y-2 pointer-events-none w-full">
                          <ImageIcon size={24} className="mx-auto text-white/60 animate-pulse" />
                          <p className="text-[11px] font-black uppercase tracking-widest text-white/60">No Cover Assigned</p>
                          <p className="text-[10px] font-mono text-white/70 italic">Drag any page card to this slot</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interior Pages Grid */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 select-none">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Interior Pages ({newInteriorPages.length})</h4>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {newInteriorPages.map(page => {
                      const hasApproved = !!page.approvedImage;
                      const assetId = page.approvedImage?.assetId;

                      return (
                        <div 
                          key={page.productionPage.uid}
                          draggable
                          onDragStart={(e) => handleNewDragStart(e, page.productionPage.uid)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleNewDropOnPage(e, page.productionPage.uid)}
                          className={`relative group border border-white/20 rounded-sm bg-black/40 overflow-hidden transition-all select-none
                            ${draggedPageId === page.productionPage.uid ? 'opacity-20 translate-x-2' : 'hover:border-amber-500/40'}`}
                        >
                          <div className="aspect-[3/4] relative">
                            {assetId && imageUrls[assetId] ? (
                              <img src={imageUrls[assetId]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="absolute inset-0 bg-[#0c0c0c] flex flex-col items-center justify-center p-4 text-center">
                                <ImageIcon size={28} className="text-white/60 mb-2" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-500/80">PLANNED PAGE</span>
                                <span className="text-[10px] font-mono text-white/70 break-all max-w-full px-2 mt-1 truncate" title={page.productionPage.uid}>
                                  P.{page.pageNumber}
                                </span>
                              </div>
                            )}
                            
                            {/* Page Badges Row */}
                            {(() => {
                              const computedStatusRes = getProductionPageStatus({
                                page: page.productionPage,
                                pageBeat: page.pageBeat,
                                imageVersions: showVersions,
                                panelPlans: page.pageBeat?.panelPlans
                              });
                              return (
                                <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                                  <span 
                                    title={computedStatusRes.reason}
                                    className={`px-1.5 py-0.5 text-[10px] font-black uppercase rounded-sm border cursor-help
                                      ${computedStatusRes.status === 'APPROVED' 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                        : computedStatusRes.status === 'BLOCKED'
                                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                        : computedStatusRes.status === 'GENERATED'
                                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                        : computedStatusRes.status === 'PARTIAL'
                                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}
                                  >
                                    {computedStatusRes.status}
                                  </span>
                                  <div className="bg-black/90 border border-white/40 px-2 py-0.5 rounded-sm text-[11px] font-black text-white">
                                    P. {page.pageNumber}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Hover Controls screen overlay */}
                            <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4 z-20">
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-[11px] font-black uppercase text-amber-400">Story Narrative</span>
                                <p className="text-[11px] text-white/60 leading-relaxed font-sans line-clamp-4 select-text">
                                  {page.pageBeat.description || 'No descriptive storyboard context available.'}
                                </p>
                              </div>

                              <div className="flex flex-col gap-2">
                                {assetId && imageUrls[assetId] && (
                                  <button 
                                    onClick={() => openLightbox(imageUrls[assetId!])}
                                    className="w-full py-1.5 bg-white/10 hover:bg-white/20 text-[11px] font-black uppercase tracking-widest rounded-sm transition-all text-white cursor-pointer"
                                  >
                                    Preview Panel
                                  </button>
                                )}
                                <div className="flex items-center justify-center gap-1.5 text-white/60 select-none pb-1">
                                  <GripVertical size={14} />
                                  <span className="text-[10px] font-black uppercase tracking-wider">Drag to Reorder</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Global Empty State */}
        {!activeTab && (
          <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-white/10 rounded-sm select-none">
            <AlertTriangle size={32} className="text-white/60 mb-4 animate-bounce" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white/75 mb-2">Compiler Offline</h3>
            <p className="text-[11px] text-white/50 text-center max-w-sm leading-relaxed uppercase tracking-widest font-mono italic">
              No compiled issues or sequence paths are available. Build draft models first.
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Integration */}
      {lightbox.src && (
        <ImageLightbox src={lightbox.src} onClose={closeLightbox} />
      )}

      {/* Export Prompt Modal */}
      {showExportPrompt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-[#111] border border-white/45 p-8 rounded-sm max-w-md w-full shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-black uppercase tracking-widest text-amber-500 mb-1">
                {exportType === 'zip' ? 'Export Image Zip' : 'Export PDF Issue'}
              </h3>
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-mono">
                {exportType === 'zip' ? 'Individual page files in a numbered archive' : 'Platform-Ready Publication File'}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Filename</label>
                <input 
                  type="text"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-sm px-3 py-2 text-xs font-mono outline-none focus:border-amber-500 text-white"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Trim & publication Presets</label>
                <div className="relative">
                  <select 
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/20 rounded-sm px-3 py-2 text-xs text-white outline-none focus:border-amber-500 appearance-none"
                  >
                    {PUBLICATION_PRESETS.map(p => (
                      <option key={p.id} value={p.id} className="bg-black">{p.label}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/50">▼</div>
                </div>
                <p className="text-[10px] text-white/60 font-mono mt-1">{resolvedPreset.description}</p>
              </div>

              {/* Star Splitter Integration toggle */}
              {exportType === 'zip' && (
                <div className="space-y-3 pt-2.5 border-t border-white/10 text-left">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={useSSV}
                      onChange={(e) => setUseSSV(e.target.checked)}
                      className="w-4 h-4 rounded-xs border-white/20 bg-white/5 text-amber-500 accent-amber-500"
                    />
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                      Star Splitter SSV Mode
                    </span>
                  </label>
                  <p className="text-[10px] text-white/60 italic leading-relaxed">
                    Formats ZIP directory payload files to comply with Star Splitter Standard (SSV v1).
                  </p>
                  
                  {useSSV && (
                    <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-1 duration-150">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-white/60 font-bold">Series Slug</label>
                        <input 
                          type="text" value={seriesSlugDraft} onChange={e => setSeriesSlugDraft(toSlug(e.target.value))}
                          className="w-full bg-white/5 border border-white/20 rounded-sm px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-white/60 font-bold">Release Slug</label>
                        <input 
                          type="text" value={releaseSlugDraft} onChange={e => setReleaseSlugDraft(toSlug(e.target.value))}
                          className="w-full bg-white/5 border border-white/20 rounded-sm px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/10">
              <button 
                onClick={confirmExport}
                className="flex-1 py-1.5 px-4 bg-amber-500 text-black text-xs font-black uppercase tracking-widest rounded-sm hover:bg-amber-400 transition-all cursor-pointer"
              >
                Confirm Export
              </button>
              <button 
                onClick={() => setShowExportPrompt(false)}
                className="flex-1 py-1.5 px-4 bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-sm hover:bg-white/20 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueCompilerPanel;
