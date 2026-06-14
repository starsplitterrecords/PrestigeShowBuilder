import React, { useState } from "react";
import { useStore } from "../../StoreContext";
import { generateIssuePDF } from "../../utils/exports/issuePDF";
import { generateTeleplay } from "../../utils/exports/teleplay";

export type ExportTarget =
  | { kind: "issue-pdf"; issueId?: string; label: string }
  | { kind: "teleplay-show"; label: string }
  | { kind: "teleplay-episode"; sIdx: number; eIdx: number; label: string }
  | { kind: "teleplay-act"; sIdx: number; eIdx: number; aIdx: number; label: string }
  | { kind: "teleplay-scene"; sIdx: number; eIdx: number; aIdx: number; scIdx: number; label: string };

export const MobileExportSheet: React.FC<{
  isOpen: boolean;
  target: ExportTarget | null;
  onClose: () => void;
}> = ({ isOpen, target, onClose }) => {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const show = state.currentShow;

  if (!isOpen || !target || !show) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      let blob: Blob;
      let filename: string;

      if (target.kind === "issue-pdf") {
        blob = await generateIssuePDF(show, []);
        filename = `${show.showCode}-issue.pdf`;
      } else {
        const text = await generateTeleplay(show, target);
        blob = new Blob([text], { type: "text/plain" });
        filename = teleplayFilename(show, target);
      }

      // Try Web Share API first (iOS/Android Safari/Chrome)
      if (
        typeof navigator !== "undefined" &&
        (navigator as any).share &&
        (navigator as any).canShare?.({
          files: [new File([blob], filename, { type: blob.type })],
        })
      ) {
        await (navigator as any).share({
          files: [new File([blob], filename, { type: blob.type })],
          title: target.label,
        });
      } else {
        // Fallback: trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      onClose();
    } catch (err) {
      dispatch({
        type: "ADD_TOAST",
        toast: {
          id: Date.now().toString(),
          type: "error",
          // @ts-expect-error LEGACY: title does not exist in type 'Toast'
          title: "Export failed",
          message: String(err),
          durationMs: 6000,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 animate-in fade-in duration-300" onClick={busy ? undefined : onClose} />
      <div
        className="absolute bottom-0 left-0 right-0
                     bg-[#0a0a0a] border-t border-emerald-500/30
                     p-6 pb-8 space-y-4 animate-in slide-in-from-bottom-full duration-300"
      >
        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-2" />
        <div
          className="text-[10px] uppercase tracking-widest
                       text-emerald-500 font-black"
        >
          Export {target.kind.startsWith("teleplay") ? "Teleplay" : "Issue PDF"}
        </div>
        <div className="text-xl font-light text-white">{target.label}</div>
        <p className="text-xs text-white/60 leading-relaxed">
          {target.kind === "issue-pdf"
            ? "Generate a PDF of the assembled issue. Use the share sheet to send or save."
            : "Generate a formatted teleplay text file. Use the share sheet to send or save."}
        </p>
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-4 border border-white/10 rounded-xl
                      text-[10px] font-black uppercase tracking-widest
                      text-white/70 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={busy}
            className="flex-1 py-4 bg-emerald-500/10
                      border border-emerald-500/40 rounded-xl
                      text-[10px] font-black uppercase tracking-widest
                      text-emerald-500
                      active:scale-95 transition-all
                      disabled:opacity-50"
          >
            {busy ? "Generating..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
};

function teleplayFilename(show: any, target: ExportTarget) {
  const code = show.showCode || "SHOW";
  switch (target.kind) {
    case "teleplay-show":
      return `${code}-teleplay.txt`;
    case "teleplay-episode":
      return `${code}-S${target.sIdx + 1}E${target.eIdx + 1}-teleplay.txt`;
    case "teleplay-act":
      return `${code}-S${target.sIdx + 1}E${target.eIdx + 1}A${target.aIdx + 1}-teleplay.txt`;
    case "teleplay-scene":
      return `${code}-S${target.sIdx + 1}E${target.eIdx + 1}A${target.aIdx + 1}Sc${target.scIdx + 1}-teleplay.txt`;
    default:
      return `${code}-teleplay.txt`;
  }
}

export default MobileExportSheet;
