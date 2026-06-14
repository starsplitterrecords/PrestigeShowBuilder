import React, { useEffect, useState, useRef } from 'react';
import { ImageVersion } from '../../types/production';
import { AssetStorage } from '../../storage';
import { X, Upload, Trash2, AlertTriangle, Sparkles, Layers, Play, Type, RefreshCw, Wand2, Lock, Unlock } from 'lucide-react';
import { useStore } from '../../StoreContext';
import { generateUID } from '../../domainUtils';
import { VaultStorage } from '../../storage/VaultStorage';

interface WorkbenchPageImageProps {
  entry: ImageVersion | null | undefined;
  productionPageUid?: string;
  actions: any;
  page: any;
  pageBeat: any;
}

export const WorkbenchPageImage: React.FC<WorkbenchPageImageProps> = ({ 
  entry, 
  productionPageUid,
  actions,
  page,
  pageBeat
}) => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isRefineOpen, setIsRefineOpen] = useState(false);
  const [refinementNote, setRefinementNote] = useState('');

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (entry?.assetId) {
      setIsLoading(true);
      AssetStorage.getBlobUrl(entry.assetId).then(blobUrl => {
        if (active) {
          createdUrl = blobUrl;
          setUrl(blobUrl);
          setIsLoading(false);
        }
      }).catch(err => {
        console.error("Failed to load page image blob:", err);
        if (active) {
          setUrl(null);
          setIsLoading(false);
        }
      });
    } else {
      setUrl(null);
      setIsLoading(false);
    }

    return () => {
      active = false;
      if (createdUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [entry?.assetId]);

  // Escape key handler for zoomed state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomed(false);
      }
    };
    if (isZoomed) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoomed]);

  const handleUpload = async (file: File) => {
    if (!productionPageUid || !currentShow) return;
    if (!file.type.startsWith("image/")) {
      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "error",
        message: "File must be an image."
      }});
      return;
    }
    setIsUploading(true);
    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(dataUri);
      const blob = await res.blob();
      const assetId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      await AssetStorage.put(assetId, blob);

      const newVersion: ImageVersion = {
        uid: generateUID(),
        showId: currentShow.id,
        productionPageUid: productionPageUid,
        assetId,
        variantType: 'uploaded',
        status: 'draft',
        createdAt: Date.now(),
      };

      await VaultStorage.writeImageVersion(currentShow.id, newVersion);

      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "success", message: "Image uploaded."
      }});
      // Reload show so filmstrip updates
      dispatch({ type: 'RELOAD_SHOW' });
    } catch (err: any) {
      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "error",
        message: `Upload failed: ${err.message}`
      }});
    } finally {
      setIsUploading(false);
    }
  };

  const handleHardDelete = () => {
    setIsConfirmDeleteOpen(true);
  };

  const executeHardDelete = async () => {
    if (!productionPageUid || !currentShow) return;

    try {
      const allVersions = await VaultStorage.getImageVersionsForPage(productionPageUid);
      if (allVersions.length === 0) return;

      setIsConfirmDeleteOpen(false);

      for (const v of allVersions) {
        try { await AssetStorage.delete(v.assetId); } catch {}
        if (v.panelAssetIds) {
          for (const pid of v.panelAssetIds) {
            try { await AssetStorage.delete(pid); } catch {}
          }
        }
      }

      await VaultStorage.deleteImageVersionsForPage(productionPageUid);

      dispatch({ type: "RELOAD_SHOW" });
      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "success",
        message: "Image permanently deleted."
      }});
    } catch (err: any) {
      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "error",
        message: `Deletion failed: ${err.message}`
      }});
    }
  };

  const handleRefineSubmit = async () => {
    try {
      await actions.refineImage(refinementNote || undefined);
      setRefinementNote('');
      setIsRefineOpen(false);
    } catch (err: any) {
      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "error",
        message: `Refinement failed: ${err.message}`
      }});
    }
  };

  if (isLoading) {
    return (
      <div className="flex-grow w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] rounded-sm select-none">
        <span className="text-white/60 font-mono text-xs uppercase tracking-widest animate-pulse">
          Loading Page Asset...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-grow w-full h-full flex flex-row items-stretch bg-[#0a0a0a] select-none relative overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />

      {/* Zoomable Artwork Canvas or No Image placeholder */}
      <div className="flex-1 min-w-0 h-full flex items-center justify-center relative">
        {url ? (
          <div 
            onClick={() => setIsZoomed(true)}
            className="w-full h-full cursor-zoom-in flex items-center justify-center relative group p-1"
          >
            <img
              src={url}
              alt="Focused Page"
              className="w-full h-full max-w-full max-h-full object-contain mx-auto transition-all"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-2.5 left-1/2 transform -translate-x-1/2 px-2.5 py-1 rounded-sm bg-black/80 border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none text-center">
              <span className="text-[9px] text-white/70 uppercase tracking-widest font-black leading-normal">
                Click to zoom page
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center select-none w-full h-full">
            <span className="text-white/60 text-[10px] font-mono uppercase tracking-[0.2em] mb-2 block font-bold">
              No image for this page
            </span>
            {productionPageUid && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="mt-4 px-4 py-2 bg-white/10 border border-white/20 rounded-sm text-[11px] font-black uppercase tracking-widest text-white/80 hover:text-white hover:bg-white/15 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? "Uploading..." : "Upload Image"}
                </button>
                <span className="text-white/50 text-[10px] mt-2 font-mono">
                  Use the control panel on the right to generate
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Button Controls Stack: vertically stacked, top to bottom, flush to the outside top-right */}
      <div className="flex flex-col gap-2.5 p-1.5 pt-3 border-l border-white/10 bg-[#0d0e11] justify-start items-center shrink-0 w-12 z-10 relative select-none">
        
        {/* Step 1: Fill Visual Brief */}
        {(() => {
          const versions = actions?.getVersions() || [];
          const activeVersion = actions?.getActiveVersion();
          const hasBase = versions.some((v: any) => v.variantType === 'base');
          const isRunning = actions?.isRunning || actions?.isPendingUpdate;

          const renderBtn = (
            icon: any,
            tooltip: string,
            onClick: () => void,
            disabled: boolean,
            colorClass: string = "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white",
            pulse: boolean = false,
            badge: string | null = null
          ) => {
            const IconComponent = icon;
            return (
              <div className="relative group select-none flex items-center justify-center">
                <button
                  onClick={onClick}
                  disabled={disabled}
                  className={`w-9 h-9 flex items-center justify-center rounded border transition-all cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed ${colorClass} ${pulse ? 'animate-pulse' : ''}`}
                >
                  <IconComponent className={`w-4 h-4 ${isRunning && pulse ? 'animate-spin' : ''}`} />
                  {badge && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-[#0d0e11]">
                      {badge}
                    </span>
                  )}
                </button>
                <div className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 hidden group-hover:block bg-[#121316] border border-white/10 shadow-2xl px-2.5 py-1.5 rounded text-[10px] text-white/90 whitespace-nowrap pointer-events-none z-50 font-sans font-semibold">
                  {tooltip}
                </div>
              </div>
            );
          };

          return (
            <>
              {/* Step 1: Fill Visual Brief */}
              {renderBtn(
                Sparkles,
                actions?.needsVisualBrief ? "Fill Visual Brief (Step 1 - Recommended)" : "Re-generate Visual Brief",
                () => actions?.fillVisualBrief(),
                isRunning,
                actions?.needsVisualBrief
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              )}

              {/* Step 2: Plan Panels */}
              {renderBtn(
                Layers,
                page?.status === 'ready' ? "Plan Panels & Shots (Step 2 - Recommended)" : "Plan Panels & Shots",
                () => actions?.generatePanelPlan(),
                isRunning,
                page?.status === 'ready'
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-350"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              )}

              {/* Step 3: Generate Base Artwork */}
              {renderBtn(
                Play,
                "Generate Base Image (Step 3)",
                () => actions?.generateImage(),
                isRunning,
                page?.status === 'planned'
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
              )}

              {/* Divider */}
              <div className="w-6 h-[1px] bg-white/10 my-1 shrink-0" />

              {/* Surgical Reroll */}
              {renderBtn(
                RefreshCw,
                !hasBase ? "Surgically Reroll: Generate a base image first." : "Surgically Reroll Page (Random Variant)",
                () => actions?.rerollImage(),
                isRunning || !hasBase,
                "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/85"
              )}

              {/* Prompt Refine Button with absolute popover input */}
              <div className="relative flex items-center justify-center">
                {renderBtn(
                  Wand2,
                  !hasBase ? "Refinement: Generate a base image first." : "Refine Layout with Custom Prompt",
                  () => setIsRefineOpen(!isRefineOpen),
                  isRunning || !hasBase,
                  isRefineOpen
                    ? "bg-blue-500 text-white border-blue-400"
                    : "bg-white/5 border-white/10 text-sky-400 hover:bg-white/10"
                )}

                {/* Absolute positioning overlay box for input notes */}
                {isRefineOpen && hasBase && (
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 bg-[#0d0e11] border border-white/15 p-3 rounded-lg shadow-2xl z-50 w-72 space-y-2.5">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-white/70">
                      Refining Adjustment Instructions
                    </div>
                    <textarea
                      value={refinementNote}
                      onChange={(e) => setRefinementNote(e.target.value)}
                      placeholder="Tell the AI what to change (e.g., make it more dramatic, change the background to a sunset, add more lightning...)"
                      className="w-full bg-[#070707] border border-white/10 text-xs text-white/90 p-2 rounded h-20 outline-none focus:border-amber-500/50 resize-none placeholder:text-white/40 font-sans"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setIsRefineOpen(false);
                          setRefinementNote('');
                        }}
                        className="px-2.5 py-1 text-[10px] uppercase font-bold text-white/50 hover:text-white/80 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRefineSubmit}
                        disabled={isRunning}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-wider rounded transition-colors"
                      >
                        Submit Refine
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Lock Setting Anchor */}
              {actions?.settingAnchorIsSet && renderBtn(
                Lock,
                actions?.settingAnchorHasImage ? "Update Locked Setting Blueprint" : "Lock this image as visual Setting Anchor",
                () => actions?.lockAsSettingAnchor(),
                isRunning,
                actions?.settingAnchorHasImage
                  ? "bg-pink-500/10 border-pink-500/30 text-pink-400 hover:bg-pink-500/20"
                  : "bg-white/5 border-white/10 text-amber-400 hover:bg-white/10"
              )}

              {/* Divider if we have upload buttons */}
              <div className="w-6 h-[1px] bg-white/10 my-1 shrink-0" />

              {/* Upload replacement image Button */}
              {renderBtn(
                Upload,
                "Upload custom replacement image",
                () => fileInputRef.current?.click(),
                isUploading || !productionPageUid,
                "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              )}

              {/* Permanently Delete Button */}
              {renderBtn(
                Trash2,
                "Permanently delete page image",
                handleHardDelete,
                !entry,
                entry
                  ? "bg-red-950/20 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-400"
                  : "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
              )}
            </>
          );
        })()}
      </div>

      {isZoomed && url && (
        <div 
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 bg-black/95 z-[999] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
            className="absolute top-4 right-4 p-2 bg-white/10 border border-white/25 rounded-full hover:bg-white/20 text-white transition-all z-[1000]"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={url}
            alt="Page Zoomed"
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-[#070707]/95 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0c0d0f] border border-red-500/40 p-6 rounded-sm space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 shrink-0">
                <AlertTriangle size={24} />
              </span>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Permanently delete image?
                </h4>
                <p className="text-[10px] text-red-400 font-mono font-bold uppercase tracking-widest mt-0.5">
                  WARNING: Destructive Operation
                </p>
              </div>
            </div>

            <div className="text-xs text-white/95 leading-relaxed bg-[#140a0c] border border-red-900/20 p-4 rounded-sm space-y-2">
              <p>
                Are you sure you want to permanently delete this page image?
              </p>
              <p className="text-white/80">
                This will delete the current image and all accompanying archived version(s) for this page from local storage.
              </p>
              <p className="text-white/70 text-[11px] italic font-mono">
                This action is irreversible. All cached pixel data will be deleted.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest rounded transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={executeHardDelete}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest rounded transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 size={12} />
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkbenchPageImage;
