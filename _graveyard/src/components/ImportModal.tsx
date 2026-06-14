import React, { useState, useMemo } from 'react';
import { Show } from '../types/models';
import { X, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (options: { text: string; isGraft: boolean; targetParentFid?: string; sourceTopLevel?: 'episode' | 'act' | 'scene' | 'beat' }) => void;
  currentShow: Show;
  isImporting: boolean;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  currentShow,
  isImporting
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [isGraft, setIsGraft] = useState(false);
  const [targetParentFid, setTargetParentFid] = useState<string>("");

  const detectedKind = useMemo(() => {
    if (!text) return null;
    const lines = text.split("\n").slice(0, 50);
    for (const line of lines) {
       if (line.includes("# EPISODE ")) return "episode";
       if (line.includes("## ACT ")) return "act";
       if (line.includes("### SCENE ")) return "scene";
       if (line.includes("#### BEAT ")) return "beat";
    }
    return null;
  }, [text]) as 'episode' | 'act' | 'scene' | 'beat' | null;

  // Generate target options based on detected kind
  const targetOptions = useMemo(() => {
    const options: { fid: string; label: string }[] = [];
    if (!detectedKind) return options;

    // Always can graft into Season (for episodes)
    currentShow.seasons.forEach(s => {
      const sFid = `${currentShow.showCode}-S${s.number}`;
      if (detectedKind === 'episode') {
        options.push({ fid: sFid, label: `Season ${s.number}` });
      }
      
      if (detectedKind === 'act' || detectedKind === 'scene' || detectedKind === 'beat') {
        s.episodes.forEach(e => {
          if (detectedKind === 'act') {
            options.push({ fid: e.fid ?? "", label: `Episode ${e.number}: ${e.title || 'Untitled'}` });
          }
          
          if (detectedKind === 'scene' || detectedKind === 'beat') {
            e.acts.forEach(a => {
              if (detectedKind === 'scene') {
                options.push({ fid: a.fid ?? "", label: `  Act ${a.number}: ${a.summary.slice(0, 30)}...` });
              }
              
              if (detectedKind === 'beat') {
                a.scenes.forEach(sc => {
                  options.push({ fid: sc.fid ?? "", label: `    Scene ${sc.number}: ${sc.title || sc.setting || 'Untitled'}` });
                });
              }
            });
          }
        });
      }
    });

    return options;
  }, [currentShow, detectedKind]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const t = await f.text();
      setText(t);
    }
  };

  const handleApply = () => {
    if (!text) return;
    onImport({
      text,
      isGraft,
      targetParentFid: isGraft ? targetParentFid : undefined,
      sourceTopLevel: detectedKind || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111] border border-white/10 rounded-sm w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-amber-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Import Revision</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </header>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* File Picker */}
          {!file ? (
            <label className="border-2 border-dashed border-white/10 rounded-sm p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-amber-500/30 hover:bg-white/5 transition-all">
              <Upload size={32} className="text-white/60" />
              <div className="text-center">
                <p className="text-sm font-bold text-white">Choose a Component Text file</p>
                <p className="text-xs text-white/50 mt-1">.txt files only</p>
              </div>
              <input type="file" accept=".txt" onChange={handleFileChange} className="hidden" />
            </label>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-sm p-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">{file.name}</p>
                    <p className="text-[10px] text-white/50 font-mono">{(file.size / 1024).toFixed(1)} KB • Detected: {detectedKind?.toUpperCase() || 'UNKNOWN'}</p>
                  </div>
                </div>
                <button onClick={() => { setFile(null); setText(""); }} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors">Change</button>
              </div>

              {!detectedKind && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-sm">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400 leading-relaxed">
                    Could not detect any component anchors (EPISODE, ACT, SCENE, BEAT) in this file. Correct formatting is required for import.
                  </p>
                </div>
              )}

              {detectedKind && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="graft-mode"
                      checked={isGraft}
                      onChange={e => setIsGraft(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-black text-amber-500 focus:ring-amber-500 focus:ring-offset-black transition-all"
                    />
                    <label htmlFor="graft-mode" className="text-xs font-bold text-white cursor-pointer select-none hover:text-amber-500 transition-colors">
                      Graft from another vault (create new components)
                    </label>
                  </div>

                  {isGraft && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Target Parent Location</label>
                      <select
                        value={targetParentFid}
                        onChange={e => setTargetParentFid(e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-sm px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50 transition-colors"
                      >
                        <option value="">Select a target...</option>
                        {targetOptions.map(opt => (
                          <option key={opt.fid} value={opt.fid}>{opt.label}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-white/50 leading-relaxed italic">
                        New {detectedKind}s will be appended to this parent container.
                      </p>
                    </div>
                  )}

                  {!isGraft && (
                    <p className="text-[10px] text-white/50 leading-relaxed italic">
                      Standard mode: will merge fields into existing components by matching FIDs.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleApply}
            disabled={!file || !detectedKind || isImporting || (isGraft && !targetParentFid)}
            className="px-8 py-2 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-amber-400 disabled:opacity-50 transition-all shadow-lg"
          >
            {isImporting ? "Processing..." : isGraft ? "Begin Graft" : "Apply Merge"}
          </button>
        </footer>
      </div>
    </div>
  );
};
