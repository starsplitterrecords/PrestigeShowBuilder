import React, { useState, useEffect } from 'react';
import { useStore } from '../StoreContext';
import { analyzePortraitImage, suggestField } from '../geminiService';
import { generateCharacterPortrait } from '../ai/imageGeneration/generateBaseImage';
import { AssetStorage } from '../storage';
import { Character } from '../types/models';
import { appendGenerationLog } from '../domainUtils';
import { canGenerateMedia } from '../utils/generationMode';
import AutoResizingTextarea from './shared/AutoResizingTextarea';

const CharacterConceptsPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isAutofilling, setIsAutofilling] = useState<Record<string, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];
    
    const loadImages = async () => {
      if (!currentShow) return;
      const urls: Record<string, string> = {};
      for (const char of currentShow.characters) {
        const assetId = char.portraitAssetId || char.visualAnchorAssetId;
        if (assetId) {
          const url = await AssetStorage.getBlobUrl(assetId);
          if (url && active) {
            urls[assetId] = url;
            createdUrls.push(url);
          }
        }
      }
      if (active) {
        setImageUrls(urls);
      }
    };
    
    loadImages();
    
    return () => {
      active = false;
      createdUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [currentShow?.characters]);

  if (!currentShow) return null;

  const selectedChar = currentShow.characters.find(c => c.id === selectedCharId);

  const handleUpdateCharacter = (charId: string, updates: Partial<Character>) => {
    if (!currentShow) return;
    const characters = currentShow.characters.map(c => 
      c.id === charId ? { ...c, ...updates } : c
    );
    dispatch({ type: 'UPDATE_SHOW', updates: { characters } });
  };

  const handleDeleteCharacter = (charId: string) => {
    if (!currentShow) return;
    const characters = currentShow.characters.filter(c => c.id !== charId);
    dispatch({ type: 'UPDATE_SHOW', updates: { characters } });
    if (selectedCharId === charId) {
      setSelectedCharId(null);
    }
  };

  const handleAutofill = async (char: Character, field: keyof Character, label: string) => {
    if (!currentShow) return;
    const key = `${char.id}-${field}`;
    setIsAutofilling(prev => ({ ...prev, [key]: true }));
    try {
      const context = `Character: ${char.name}\nRole: ${char.role}\nShow Premise: ${currentShow.premise}`;
      const suggestion = await suggestField(currentShow, label, context);
      handleUpdateCharacter(char.id, { [field]: suggestion });
    } finally {
      setIsAutofilling(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleGenerate = async (char: Character) => {
    if (isGenerating || isBatchGenerating) return;

    if (!canGenerateMedia(state.generationMode)) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: `free-mode-block-${Date.now()}`,
        type: 'warning',
        message: 'Visual generation is disabled in Free Tier Draft Mode.'
      }});
      return;
    }

    setIsGenerating(true);
    dispatch({ type: 'PIPELINE_START', task: 'PORTRAIT SYNTHESIS' });
    dispatch({ type: 'PIPELINE_LOG', log: `AI: Synthesizing visual anchor for ${char.name}...` });
    
    try {
      const result = await generateCharacterPortrait(currentShow, char, true, state.generationMode);
      if (result) {
        const { assetId, prompt } = result;
        const updatedChars = currentShow.characters.map(c => 
          c.id === char.id ? { ...c, portraitAssetId: assetId } : c
        );
        dispatch({ type: 'UPDATE_SHOW', updates: { characters: updatedChars } });
        
        appendGenerationLog(dispatch, currentShow, {
          assetId,
          beatFid: `CHAR-${char.id}`,
          method: "portrait",
          prompt,
        });

        dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: `Portrait generated for ${char.name}.` } });
      }
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: `Synthesis failed for ${char.name}: ${err.message}` } });
    } finally {
      setIsGenerating(false);
      dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Portrait ready.' });
    }
  };

  const handleGenerateAll = async () => {
    if (isBatchGenerating || isGenerating) return;
    if (!currentShow) return;

    if (!canGenerateMedia(state.generationMode)) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: `free-mode-block-batch-${Date.now()}`,
        type: 'warning',
        message: 'Visual generation is disabled in Free Tier Draft Mode.'
      }});
      return;
    }

    setIsBatchGenerating(true);
    // Snapshot: local mutable copy that accumulates each portrait result
    let liveChars = [...currentShow.characters];
    dispatch({ type: 'PIPELINE_START', task: 'BATCH PORTRAIT SYNTHESIS' });
    
    try {
      for (let i = 0; i < liveChars.length; i++) {
        if (!currentShow) break;  // User navigated away
        const char = liveChars[i];
        if (char.portraitAssetId || char.visualAnchorAssetId) continue;
        
        dispatch({ type: 'PIPELINE_LOG', log: `AI: Batch processing ${char.name} (${i+1}/${liveChars.length})...` });
        const result = await generateCharacterPortrait(currentShow, char, true, state.generationMode);
        if (result) {
          const { assetId, prompt } = result;
          // Update the local snapshot first, then commit the whole array
          liveChars = liveChars.map(c => 
            c.id === char.id ? { ...c, portraitAssetId: assetId } : c
          );
          dispatch({ type: 'UPDATE_SHOW', updates: { characters: liveChars } });

          appendGenerationLog(dispatch, currentShow, {
            assetId,
            beatFid: `CHAR-${char.id}`,
            method: "portrait",
            prompt,
          });
        }
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'success', message: `Batch portrait generation complete.` } });
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: `Batch synthesis failed: ${err.message}` } });
    } finally {
      setIsBatchGenerating(false);
      dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Batch complete.' });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChar || !currentShow) return;
    if (!file.type.startsWith('image/')) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: 'Please select an image file.' } });
      return;
    }
    dispatch({ type: 'PIPELINE_START', task: 'PORTRAIT UPLOAD' });
    dispatch({ type: 'PIPELINE_LOG', log: `AI: Storing portrait for ${selectedChar.name}...` });
    try {
      const assetId = `portrait-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await AssetStorage.put(assetId, file);
 
      dispatch({ type: 'PIPELINE_LOG', log: `AI: Analysing visual characteristics of ${selectedChar.name}...` });
      const analysis = await analyzePortraitImage(file, selectedChar.name, currentShow).catch(() => null);
 
      const updatedChars = currentShow.characters.map(c =>
        c.id === selectedChar.id
          ? { ...c, portraitAssetId: assetId, ...analysis }
          : c
      );
      dispatch({ type: 'UPDATE_SHOW', updates: { characters: updatedChars } });
 
      const fieldsUpdated = analysis
        ? Object.keys(analysis).join(', ')
        : null;
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Math.random().toString(), type: 'success',
        message: fieldsUpdated
          ? `Portrait uploaded. Fields updated: ${fieldsUpdated}.`
          : `Portrait uploaded for ${selectedChar.name}. (Visual analysis failed — character fields unchanged.)`,
      }});
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: { id: Math.random().toString(), type: 'error', message: `Upload failed: ${err.message}` } });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      dispatch({ type: 'PIPELINE_END', task: 'COMPLETE', subTask: 'Portrait ready.' });
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500">
      <header className="flex items-center justify-between border-b border-white/70 pb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Character Concepts</h2>
          <p className="text-[10px] text-white uppercase tracking-widest font-black">Visual Anchor & Identity Synthesis</p>
        </div>
        <button
          onClick={handleGenerateAll}
          disabled={isBatchGenerating || isGenerating}
          className="text-[10px] text-amber-500 hover:text-amber-400 font-black uppercase tracking-widest transition-colors disabled:opacity-30"
        >
          {isBatchGenerating ? 'Batching...' : 'Generate All Missing'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-[10px] text-white uppercase tracking-widest font-black">Ensemble</h3>
          <div className="space-y-2">
            {currentShow.characters.map(char => (
              <div key={char.id} className="relative group">
                <button
                  onClick={() => setSelectedCharId(char.id)}
                  className={`w-full p-4 text-left border rounded-sm transition-all ${
                    selectedCharId === char.id 
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' 
                      : 'bg-white/30 border-white/70 text-white hover:bg-white/50'
                  }`}
                >
                  <div className="text-xs font-black uppercase tracking-widest">{char.name}</div>
                  <div className="text-[10px] opacity-60">{char.role}</div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.id); }}
                  className="absolute top-2 right-2 text-white/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Delete Character"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-12">
          {selectedChar ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <section className="space-y-4">
                  <h4 className="text-[10px] text-white uppercase tracking-widest font-black">Identity Brief</h4>
                  <div className="glass p-6 space-y-4">
                    <div className="space-y-1">
                      <div className="text-[10px] text-white/90 uppercase tracking-widest">Physical Description</div>
                      <AutoResizingTextarea
                        value={selectedChar.physicalDescription || ''}
                        onChange={(e) => handleUpdateCharacter(selectedChar.id, { physicalDescription: e.target.value })}
                        onAutofill={() => handleAutofill(selectedChar, 'physicalDescription', 'Physical Description')}
                        isAutofilling={isAutofilling[`${selectedChar.id}-physicalDescription`]}
                        className="bg-white/30 border-white/70 text-sm text-white leading-relaxed"
                        placeholder="No description provided."
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-white/90 uppercase tracking-widest">Visual Anchor Note</div>
                      <AutoResizingTextarea
                        value={selectedChar.visualAnchor || ''}
                        onChange={(e) => handleUpdateCharacter(selectedChar.id, { visualAnchor: e.target.value })}
                        onAutofill={() => handleAutofill(selectedChar, 'visualAnchor', 'Visual Anchor Note')}
                        isAutofilling={isAutofilling[`${selectedChar.id}-visualAnchor`]}
                        className="bg-white/30 border-white/70 text-sm text-white leading-relaxed"
                        placeholder="No anchor note provided."
                      />
                    </div>
                  </div>
                </section>

                <div className="space-y-2">
                  <button
                    onClick={() => handleGenerate(selectedChar)}
                    disabled={isGenerating || isBatchGenerating}
                    className="w-full bg-amber-500 text-black py-4 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 disabled:opacity-50 transition-all shadow-2xl shadow-amber-500/20"
                  >
                    {isGenerating ? 'Synthesizing Portrait...' : 'Generate Visual Anchor'}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating || isBatchGenerating}
                    className="w-full border border-white/70 text-white py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:border-white/200 hover:text-white transition-all"
                  >
                    Upload Image Instead
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] text-white uppercase tracking-widest font-black">Visual Anchor</h4>
                <div className="aspect-[9/16] glass overflow-hidden relative group bg-black/40">
                  {(selectedChar.portraitAssetId || selectedChar.visualAnchorAssetId) && imageUrls[selectedChar.portraitAssetId || selectedChar.visualAnchorAssetId || ''] ? (
                    <img 
                      src={imageUrls[selectedChar.portraitAssetId || selectedChar.visualAnchorAssetId || '']} 
                      alt={selectedChar.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-12 text-center space-y-4">
                      <div className="w-12 h-12 border border-white/70 rounded-full flex items-center justify-center">
                        <span className="text-xl">?</span>
                      </div>
                      <p className="text-[10px] uppercase tracking-widest">No visual anchor synthesized.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center border border-dashed border-white/70 rounded-sm opacity-20">
              <p className="text-[10px] uppercase tracking-widest">Select a character to begin visual development.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterConceptsPanel;
