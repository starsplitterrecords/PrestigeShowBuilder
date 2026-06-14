import React, { useState, useEffect } from 'react';
import { useStore } from '../../StoreContext';
import { LockedReferenceType, LockedReference } from '../../types/models';
import { AssetStorage } from '../../storage';
import { scanWorldElements, ReferenceCandidate } from '../../ai/textGeneration/generateCharacters';
import { generateReferenceImage } from '../../ai/imageGeneration/generateBaseImage';
import { 
  resolveImageSize, 
  COST_PER_IMAGE 
} from '../../constants/generation.constants';

export const ReferenceVault: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  const [isAddingRef, setIsAddingRef] = useState(false);
  const [newRefLabel, setNewRefLabel] = useState('');
  const [newRefType, setNewRefType] = useState<LockedReferenceType>('environment');
  const [newRefDesc, setNewRefDesc] = useState('');
  const [refImageUrls, setRefImageUrls] = useState<Record<string, string>>({});

  const [isScanning, setIsScanning] = useState(false);
  const [scanCandidates, setScanCandidates] = useState<ReferenceCandidate[]>([]);
  const [generatingCandidateId, setGeneratingCandidateId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShow?.lockedReferences?.length) return;
    let isMounted = true;
    const newUrls: Record<string, string> = {};

    const loadUrls = async () => {
      for (const ref of currentShow.lockedReferences!) {
        if (!refImageUrls[ref.id]) {
          const url = await AssetStorage.getBlobUrl(ref.assetId);
          if (url && isMounted) {
            newUrls[ref.id] = url;
          }
        }
      }
      if (isMounted && Object.keys(newUrls).length > 0) {
        setRefImageUrls(prev => ({ ...prev, ...newUrls }));
      }
    };
    loadUrls();

    return () => {
      isMounted = false;
    };
  }, [currentShow?.lockedReferences]);

  useEffect(() => {
    if (!currentShow) return;
    const currentIds = new Set(currentShow.lockedReferences?.map(r => r.id) || []);
    setRefImageUrls(prev => {
      const next = { ...prev };
      let changed = false;
      for (const id in next) {
        if (!currentIds.has(id)) {
          URL.revokeObjectURL(next[id]);
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentShow?.lockedReferences]);

  if (!currentShow) return null;

  const handleUpdateRef = (refId: string, updates: Partial<LockedReference>) => {
    if (!currentShow) return;
    const updated = currentShow.lockedReferences?.map(r =>
      r.id === refId ? { ...r, ...updates } : r
    );
    dispatch({ type: 'UPDATE_SHOW', updates: { lockedReferences: updated } });
  };

  const handleRefUpload = async (file: File) => {
    if (!newRefLabel.trim()) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUri = e.target?.result as string;
      const res = await fetch(dataUri);
      const blob = await res.blob();
      const assetId = Math.random().toString(36).substring(2, 11);
      await AssetStorage.put(assetId, blob);
      
      const newRef: LockedReference = {
        id: Math.random().toString(36).substring(2, 11),
        label: newRefLabel.trim(),
        type: newRefType,
        assetId,
        description: newRefDesc.trim() || undefined,
        active: true,
      };
      const updated = [...(currentShow!.lockedReferences ?? []), newRef];
      dispatch({ type: 'UPDATE_SHOW', updates: { lockedReferences: updated } });
      setNewRefLabel('');
      setNewRefDesc('');
      setIsAddingRef(false);
    };
    reader.readAsDataURL(file);
  };

  const handleScanWorldElements = async () => {
    if (!currentShow) return;
    setIsScanning(true);
    try {
      const candidates = await scanWorldElements(currentShow, state.generationMode);
      setScanCandidates(candidates);
    } catch (e) {
      console.error("Scan failed", e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerateCandidate = async (candidate: ReferenceCandidate, index: number) => {
    if (!currentShow) return;
    const cid = `candidate-${index}`;
    setGeneratingCandidateId(cid);
    try {
      const assetId = await generateReferenceImage(candidate.imagePrompt, currentShow, candidate.type, state.generationMode);
      if (assetId) {
        const newRef: LockedReference = {
          id: Math.random().toString(36).substring(2, 11),
          label: candidate.label,
          type: candidate.type,
          assetId,
          description: candidate.description,
          active: true,
        };
        const updated = [...(currentShow.lockedReferences ?? []), newRef];
        dispatch({ type: 'UPDATE_SHOW', updates: { lockedReferences: updated } });
        setScanCandidates(prev => prev.filter((_, i) => i !== index));
      }
    } catch (e) {
      console.error("Generation failed", e);
    } finally {
      setGeneratingCandidateId(null);
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
      <section className="space-y-4 pt-8 border-t border-white/70">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs text-emerald-400 uppercase tracking-widest font-black">
              Reference Vault
            </label>
            <p className="text-xs text-white mt-1">
              Active references are injected into every Comic Lab generation.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleScanWorldElements}
              disabled={isScanning}
              className="text-xs text-emerald-400 font-black uppercase tracking-widest
                hover:text-emerald-400 transition-colors disabled:opacity-60"
            >
              {isScanning ? 'Scanning...' : 'Scan World Elements'}
            </button>
            <button onClick={() => setIsAddingRef(v => !v)}
              className="text-xs text-emerald-400 font-black uppercase tracking-widest
                hover:text-emerald-300 transition-colors">
              {isAddingRef ? 'Cancel' : '+ Add Reference'}
            </button>
          </div>
        </div>

        {scanCandidates.length > 0 && (
          <div className="space-y-3 p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-emerald-400 uppercase tracking-widest font-black">
                AI Proposed References
              </span>
              <button onClick={() => setScanCandidates([])} className="text-emerald-400 hover:text-emerald-400 text-xs">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {scanCandidates.map((candidate, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/10 border border-white/20 rounded-sm">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">{candidate.label}</div>
                    <div className="text-xs text-white/70 uppercase tracking-widest">
                      {candidate.type} — {candidate.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerateCandidate(candidate, idx)}
                      disabled={generatingCandidateId !== null}
                      className="text-xs font-black uppercase tracking-widest px-3 py-1
                        bg-emerald-500/30 text-emerald-400 border border-emerald-500/50
                        hover:bg-emerald-500/30 transition-all disabled:opacity-60 flex items-center gap-2"
                    >
                      {generatingCandidateId === `candidate-${idx}` ? 'Generating...' : 'Generate'}
                      {generatingCandidateId !== `candidate-${idx}` && (
                        <span className="opacity-70 font-mono">
                          (${COST_PER_IMAGE[resolveImageSize(state.generationMode, 'reference')]})
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setScanCandidates(prev => prev.filter((_, i) => i !== idx))}
                      className="text-white/70 hover:text-white/80 transition-colors text-xs px-2"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAddingRef && (
          <div className="space-y-3 p-4 bg-white/30 border border-white/70 rounded-sm">
            <input value={newRefLabel} onChange={e => setNewRefLabel(e.target.value)}
              placeholder="Label e.g. MTDID Lobby"
              className="w-full bg-white/30 border border-white/70 p-3 rounded-sm text-sm
                text-white focus:border-emerald-500/30 outline-none" />
            <select value={newRefType}
              onChange={e => setNewRefType(e.target.value as LockedReferenceType)}
              className="w-full bg-white/30 border border-white/70 p-3 rounded-sm text-sm
                text-white focus:border-emerald-500/30 outline-none">
              <option value="environment">Environment</option>
              <option value="prop">Prop</option>
              <option value="minor-character">Minor Character</option>
              <option value="costume">Costume</option>
              <option value="palette">Colour Palette</option>
              <option value="other">Other</option>
            </select>
            <input value={newRefDesc} onChange={e => setNewRefDesc(e.target.value)}
              placeholder="Instruction to model (optional) — e.g. Match this lobby exactly"
              className="w-full bg-white/30 border border-white/70 p-3 rounded-sm text-sm
                text-white focus:border-emerald-500/30 outline-none" />
            <label className="block cursor-pointer w-full border border-dashed border-emerald-500/30
              p-4 text-center text-xs text-emerald-400 uppercase tracking-widest
              hover:border-emerald-500/60 transition-all rounded-sm">
              Upload Image
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleRefUpload(e.target.files[0]); }} />
            </label>
          </div>
        )}

        <div className="space-y-2">
          {(currentShow.lockedReferences ?? []).map(ref => (
            <div key={ref.id}
              className="flex items-center gap-3 p-3 bg-white/30 border border-white/70 rounded-sm">
              <div className={`relative w-12 h-12 rounded-sm overflow-hidden border flex-shrink-0 transition-all ${
                ref.active ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/40'
              }`}>
                {refImageUrls[ref.id] && (
                  <img src={refImageUrls[ref.id]} alt={ref.label}
                    className={`w-full h-full object-cover transition-all ${ref.active ? 'scale-105' : 'grayscale-[0.4] opacity-80'}`}
                    referrerPolicy="no-referrer" />
                )}
                {ref.active && (
                  <div className="absolute top-0.5 left-0.5 bg-emerald-500 text-black text-xs font-black px-1 rounded-sm uppercase tracking-tighter">
                    Active
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={ref.label}
                    onChange={(e) => handleUpdateRef(ref.id, { label: e.target.value })}
                    className="bg-transparent border-none outline-none text-xs font-bold text-white w-full"
                  />
                  <span className="text-xs uppercase tracking-widest text-white/70 shrink-0">{ref.type}</span>
                </div>
                
                {/* Entity Link UI */}
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest text-emerald-400 font-black shrink-0">Link:</span>
                  {ref.type === 'minor-character' ? (
                    <select
                      value={ref.linkedCharacterId || ''}
                      onChange={(e) => handleUpdateRef(ref.id, { linkedCharacterId: e.target.value || undefined })}
                      className="bg-black/40 border border-white/40 text-xs text-white p-1 rounded-sm outline-none focus:border-emerald-500/40 w-full"
                    >
                      <option value="">(Unlinked Global)</option>
                      {currentShow.characters.filter(c => c.isMinor).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={ref.linkedSettingId || ''}
                      onChange={(e) => handleUpdateRef(ref.id, { linkedSettingId: e.target.value || undefined })}
                      className="bg-black/40 border border-white/40 text-xs text-white p-1 rounded-sm outline-none focus:border-emerald-500/40 w-full"
                    >
                      <option value="">(Unlinked Global)</option>
                      {currentShow.settingAnchors?.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <textarea
                  value={ref.description || ''}
                  onChange={(e) => handleUpdateRef(ref.id, { description: e.target.value })}
                  placeholder="Reference description..."
                  className="w-full bg-black/20 border border-white/40 p-2 text-xs text-white h-12 outline-none focus:border-white/30 resize-none"
                />
              </div>
              <button
                onClick={() => handleUpdateRef(ref.id, { active: !ref.active })}
                className={`text-xs font-black uppercase tracking-widest px-3 py-1
                  rounded-sm transition-all border ${ref.active
                    ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                    : 'border-white/70 text-white hover:border-white/200'}`}>
                {ref.active ? 'Active' : 'Inactive'}
              </button>
              <button
                onClick={() => {
                  const updated = currentShow.lockedReferences!.filter(r => r.id !== ref.id);
                  dispatch({ type: 'UPDATE_SHOW', updates: { lockedReferences: updated } });
                }}
                className="text-white hover:text-red-400 transition-colors text-xs">
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
