import React, { useState } from 'react';
import { useStore } from "../../StoreContext";
import { Show } from "../../types/models";
import { exportBeatText, mergeComponentText, graftComponentText } from "../../utils/assembleComponentText";
import { VaultStorage } from "../../storage";

export function useBeatTextIO(
  show: Show | undefined,
  activePath: {
    seasonIdx?: number; episodeIdx?: number;
    actIdx?: number; sceneIdx?: number; beatIdx?: number
  }
) {
  const { dispatch } = useStore();
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx } = activePath;

  const handleExportText = () => {
    if (!show || seasonIdx === undefined || episodeIdx === undefined || actIdx === undefined || sceneIdx === undefined || beatIdx === undefined) return;
    const text = exportBeatText(show, seasonIdx, episodeIdx, actIdx, sceneIdx, beatIdx);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${show.showCode}-S${seasonIdx + 1}E${episodeIdx + 1}A${actIdx + 1}Sc${sceneIdx + 1}B${beatIdx + 1}-Text.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportExtended = async (options: { 
    text: string; 
    isGraft: boolean; 
    targetParentFid?: string;
    sourceTopLevel?: 'episode' | 'act' | 'scene' | 'beat'
  }) => {
    if (!show || !options.text) return;

    setIsImporting(true);
    try {
      let updated: Show;
      let result: any;

      if (options.isGraft && options.targetParentFid && options.sourceTopLevel) {
        const graft = graftComponentText(options.text, show, options.targetParentFid, options.sourceTopLevel);
        updated = graft.show;
        result = graft.result;
      } else {
        const merge = mergeComponentText(options.text, show);
        updated = merge.show;
        result = merge.result;
      }
      
      // Persist
      await VaultStorage.saveOne(updated);
      
      // Update state
      dispatch({ type: 'UPDATE_SHOW', updates: updated });

      // Build message
      const count = (result.updated?.length || 0) + (result.created?.length || 0);
      let message = `${options.isGraft ? 'Grafted' : 'Updated'} ${count} items (${result.panelsModified || 0} panels modified).`;
      if (result.errors.length > 0) {
        message += ` ${result.errors.length} errors found.`;
      }

      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { 
          id: Date.now().toString(), 
          // @ts-expect-error LEGACY: title does not exist on Toast
          title: options.isGraft ? "Graft Success" : "Import Success", 
          message, 
          type: result.errors.length > 0 ? "warning" : "success" 
        } 
      });

      if (result.errors.length > 0) {
        result.errors.forEach((err: any, idx: number) => {
          dispatch({
            type: 'ADD_TOAST',
            toast: {
              id: `${Date.now()}-err-${idx}`,
              // @ts-expect-error LEGACY: title does not exist on Toast
              title: `Import Detail [${err.fid || 'General'}]`,
              message: err.message,
              type: 'error'
            }
          });
        });
      }
      setIsImportModalOpen(false);
    } catch (err) {
      console.error("Import failed:", err);
      dispatch({ 
        type: 'ADD_TOAST', 
        // @ts-expect-error LEGACY: title does not exist on Toast
        toast: { id: Date.now().toString(), title: "Import Failed", message: err instanceof Error ? err.message : "Unknown error", type: "error" } 
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportRevision = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !show) return;
    const text = await file.text();
    handleImportExtended({ text, isGraft: false });
    e.target.value = "";
  };

  return { 
    isImporting, 
    isImportModalOpen, 
    setIsImportModalOpen,
    handleExportText, 
    handleImportRevision,
    handleImportExtended
  };
}
