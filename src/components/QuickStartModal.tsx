import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { STYLE_PRESETS, StylePreset } from '../stylePresets';
import { VaultStorage } from '../storage';

const QuickStartModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [premise, setPremise] = useState('');
  const [richInput, setRichInput] = useState('');
  const [mode, setMode] = useState<'seed' | 'mine'>('seed');
  const [styleOpen, setStyleOpen] = useState(false);
  const [selectedVideoPreset, setSelectedVideoPreset] = useState<StylePreset | null>(null);
  const [selectedComicPreset, setSelectedComicPreset] = useState<StylePreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newShow = {
        id: Math.random().toString(36).substring(2, 9),
        name,
        titleSuggestion: '',
        premise: mode === 'seed' ? premise : '',
        richInput: mode === 'mine' ? richInput : '',
        themes: '',
        initMode: mode,
        draftVersion: 1,
        createdAt: Date.now(),
        showCode: (name || 'SHW').substring(0, 3).toUpperCase(),
        styleConfig: selectedVideoPreset ? {
          positivePrompt: selectedVideoPreset.pos,
          negativePrompt: selectedVideoPreset.neg,
          compositionPrompt: selectedVideoPreset.composition ?? '',
        } : {
          positivePrompt: 'Cinematic, high-contrast, 35mm film grain, moody lighting.',
          negativePrompt: 'CGI, cartoon, oversaturated, lens flare',
        },
        comicStyle: selectedComicPreset ? {
          artistStyle: selectedComicPreset.pos,
          negativePrompt: selectedComicPreset.neg,
          colorPalette: '',
          lineWeight: '',
        } : {
          artistStyle: 'comic book art, professional panel layout, dynamic inking',
          negativePrompt: 'photorealistic, 3d render, cgi, blurry',
          colorPalette: '',
          lineWeight: '',
        },
        characters: [],
        seasons: [],
        depthConfig: { lines: true },
        // D90: minimal defaults — 1 episode, 1 act, 1 scene, 1 beat.
        // Adjust in SetupPanel before generating. Smart fill adds missing structure.
        structureConfig: {
          episodesPerSeason: 1,
          actsPerEpisode: 1,
          scenesPerAct: 1,
          beatsPerScene: 1,
        },
        register: 'drama',
        writingRules: {
          dialogueRules: [
            "Maintain clear character voice and distinct vernacular.",
            "Use dialogue to reveal subtext, not just deliver information.",
            "Keep lines punchy and avoid long monologues."
          ],
          blockingRules: [
            "Stage action for maximum dynamic range.",
            "Use physical environment as an active participant in scenes.",
            "Prioritize visual storytelling over descriptive exposition."
          ],
          structureRules: [
            "Every beat must move the spine of the act forward.",
            "Identify and sharpen the dramatic want in every scene.",
            "Ensure strong causal links between sequence events."
          ],
          craftNotes: [
            "Maintenance & Migration: Preserve character depth and thematic consistency.",
            "Tone: Prestige drama with grounded emotional stakes.",
            "Register: Naturalistic and cinematic."
          ]
        },
        isInitialSequence: true,
      };

      // Save to local IndexedDB immediately to prevent duplicate/lost records
      await VaultStorage.saveOne(newShow as any, false);
      dispatch({ type: 'CREATE_SHOW', show: newShow as any });
      dispatch({ type: 'SET_AUTO_IGNITE', enabled: true });
      onClose();
    } catch (e) {
      console.error('Failed to save show to disk during creation:', e);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Math.random().toString(),
          type: 'error',
          message: 'Failed to persist show locally.',
        }
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="glass w-full max-w-xl relative flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden animate-in zoom-in duration-300">
        
        {/* Fixed header */}
        <div className="px-8 pt-8 pb-4 shrink-0">
          <header className="space-y-1">
            <h2 className="text-2xl font-bold text-white">Initialize Series</h2>
            <p className="text-[10px] text-white uppercase tracking-widest font-black">Select Production Entry Point</p>
          </header>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-6">
          <div className="flex gap-4 border-b border-white/70 pb-4">
            <button 
              onClick={() => setMode('seed')}
              className={`text-[10px] uppercase tracking-widest font-black pb-2 transition-all ${mode === 'seed' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-white/90'}`}
            >
              Seed Mode
            </button>
            <button 
              onClick={() => setMode('mine')}
              className={`text-[10px] uppercase tracking-widest font-black pb-2 transition-all ${mode === 'mine' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-white/90'}`}
            >
              Mining Mode
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] text-white/90 uppercase tracking-widest font-black">Working Title</label>
              <input 
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Neon Shadows" 
                className="w-full bg-white/30 border border-white/70 p-4 rounded-sm text-sm text-white focus:border-amber-500/30 outline-none transition-all"
              />
            </div>

            {mode === 'seed' ? (
              <div className="space-y-2">
                <label className="text-[10px] text-white/90 uppercase tracking-widest font-black">Initial Premise Seed</label>
                <textarea 
                  value={premise} onChange={e => setPremise(e.target.value)}
                  placeholder="Describe the core engine of the show in a few sentences..." 
                  className="w-full bg-white/30 border border-white/70 p-4 rounded-sm text-sm text-white h-48 focus:border-amber-500/30 outline-none transition-all"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] text-white/90 uppercase tracking-widest font-black">Source Document (Full Script/Bible)</label>
                <textarea 
                  value={richInput} onChange={e => setRichInput(e.target.value)}
                  placeholder="Paste your full document here. AI will mine characters, locations, and arcs..." 
                  className="w-full bg-white/30 border border-white/70 p-4 rounded-sm text-sm text-white h-64 focus:border-amber-500/30 outline-none transition-all font-mono"
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button onClick={() => setStyleOpen(v => !v)}
              className="text-[10px] text-white uppercase tracking-widest font-black hover:text-white transition-all flex items-center gap-2">
              {styleOpen ? '▾' : '▸'} Set Visual Style (optional)
            </button>
            
            {styleOpen && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-3">
                  <h4 className="text-[10px] text-white/70 uppercase tracking-widest font-black border-b border-white/20 pb-2">Video Style</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STYLE_PRESETS.filter(p => p.category === 'live-action' || p.category === 'animation').map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => setSelectedVideoPreset(prev => prev?.name === preset.name ? null : preset)}
                        className={`p-3 rounded-sm text-left transition-all border ${
                          selectedVideoPreset?.name === preset.name
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                            : 'bg-white/30 border-white/60 text-white/90 hover:bg-white/50 hover:text-white'
                        }`}
                      >
                        <div className="text-[10px] font-bold mb-1">{preset.name}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{preset.register}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-[10px] text-white/70 uppercase tracking-widest font-black border-b border-white/20 pb-2">Comic Art Style</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STYLE_PRESETS.filter(p => p.category === 'comics').map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => setSelectedComicPreset(prev => prev?.name === preset.name ? null : preset)}
                        className={`p-3 rounded-sm text-left transition-all border ${
                          selectedComicPreset?.name === preset.name
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                            : 'bg-white/30 border-white/60 text-white/90 hover:bg-white/50 hover:text-white'
                        }`}
                      >
                        <div className="text-[10px] font-bold mb-1">{preset.name}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{preset.register}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed footer */}
        <div className="px-8 pb-8 pt-4 shrink-0">
          <button 
            onClick={handleCreate} 
            disabled={isCreating || !name.trim() || (mode === 'seed' ? !premise.trim() : !richInput.trim())}
            className="w-full bg-amber-500 text-black py-4 rounded-sm font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 disabled:opacity-50 transition-all shadow-2xl shadow-amber-500/20"
          >
            {isCreating ? 'Creating...' : 'Begin Production'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickStartModal;
