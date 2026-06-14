import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../StoreContext';
import { useProductionPipeline } from '../hooks/useProductionPipeline';
import { Character } from '../types/models';
import { AssetStorage } from '../storage';
import { generateCharacterPortrait } from '../ai/imageGeneration/generateBaseImage';
import { appendGenerationLog } from '../domainUtils';
import { useLightbox } from '../hooks/useLightbox';
import ImageLightbox from './ImageLightbox';
import { CHARACTER_CAPTION_PALETTE } from '../constants/caption.constants';
import { EditableField } from './workbench/fields/EditableField';
import { suggestField } from '../geminiService';
import { 
  generateFullCharacterProfile, 
  generateCharacterVoiceProfile, 
  generateVoiceConstraints 
} from '../ai/textGeneration/generateCharacters';
import { deriveVoiceCard } from '../ai/textGeneration/cardDerivation';
import { generateEnsembleImage } from '../ai/imageGeneration/generateEnsembleImage';
import { EnsembleAspect } from '../utils/prompts/ensemblePrompt';
import { 
  Wand2, 
  UserPlus, 
  Sparkles, 
  Trash2, 
  Upload, 
  Eye, 
  UserCheck, 
  History, 
  History as StatsIcon, 
  Check, 
  Image as ImageIcon,
  Palette,
  Volume2
} from 'lucide-react';

const CharactersPanel: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const { run, isRunning } = useProductionPipeline();
  const { lightbox, openLightbox, closeLightbox } = useLightbox();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [isAutofilling, setIsAutofilling] = useState<Record<string, boolean>>({});
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Unified Add Character state
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [newCharRole, setNewCharRole] = useState("");
  const [newCharBrief, setNewCharBrief] = useState("");
  const [newCharIsMinor, setNewCharIsMinor] = useState(true);
  const [isGeneratingNewChar, setIsGeneratingNewChar] = useState(false);
  const [newCharGenStep, setNewCharGenStep] = useState<string | null>(null);

  const [isFillingAll, setIsFillingAll] = useState(false);
  const [fillStep, setFillStep] = useState<string | null>(null);

  // Ensemble state
  const [showEnsembleModal, setShowEnsembleModal] = useState(false);
  const [ensembleAspect, setEnsembleAspect] = useState<EnsembleAspect>('vertical');
  const [selectedEnsembleIds, setSelectedEnsembleIds] = useState<Set<string>>(new Set());
  const [isGeneratingEnsemble, setIsGeneratingEnsemble] = useState(false);

  // Hidden file upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentShowRef = useRef(currentShow);
  useEffect(() => {
    currentShowRef.current = currentShow;
  }, [currentShow]);

  const charactersWithPortraits = (currentShow?.characters || []).filter(c => {
    if (!c.name?.trim()) return false;
    if (c.isMinor && !c.portraitAssetId) return false;
    const aid = c.portraitAssetId ?? c.visualAnchorAssetId;
    return !!aid;
  });
  const canGenerateEnsemble = charactersWithPortraits.length >= 1;

  const handleGenerateEnsembleImage = async () => {
    if (!currentShow || isGeneratingEnsemble) return;
    setIsGeneratingEnsemble(true);

    try {
      const refs: { name: string; dataUri: string; assetId: string; characterId: string }[] = [];
      const degraded: string[] = [];

      for (const c of currentShow.characters || []) {
        if (!selectedEnsembleIds.has(c.id)) continue;
        if (!c.name?.trim()) continue;
        if (c.isMinor && !c.portraitAssetId) continue;
        const aid = c.portraitAssetId ?? c.visualAnchorAssetId;
        if (!aid) continue;
        
        const dataUri = await AssetStorage.getDataUri(aid);
        if (dataUri) {
          refs.push({ name: c.name, dataUri, assetId: aid, characterId: c.id });
        } else {
          degraded.push(c.name);
        }
      }

      if (refs.length === 0) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(),
          type: 'error',
          message: 'No character portraits available to generate ensemble.'
        }});
        return;
      }

      if (degraded.length > 0) {
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(),
          type: 'warning',
          message: `Some portraits unavailable: ${degraded.join(', ')}. Generating without them.`
        }});
      }

      const result = await generateEnsembleImage(
        currentShow, refs, ensembleAspect, state.generationMode, Array.from(selectedEnsembleIds)
      );

      if (!result) {
        throw new Error('Ensemble generation returned no image.');
      }

      const a = document.createElement('a');
      a.href = result.dataUri;
      const safeName = (currentShow.showCode || currentShow.name || 'show')
        .replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
      const today = new Date().toISOString().split('T')[0];
      
      let downloadName: string;
      if (selectedEnsembleIds.size === 1) {
        const onlyId = Array.from(selectedEnsembleIds)[0];
        const onlyChar = (currentShow.characters || []).find(c => c.id === onlyId);
        const handle = (onlyChar?.handle || onlyChar?.name || 'character')
          .replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
        downloadName = `${safeName}_${handle}_portrait_${ensembleAspect}_${today}.png`;
      } else {
        downloadName = `${safeName}_ensemble_${ensembleAspect}_${today}.png`;
      }
      
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      appendGenerationLog(dispatch, currentShow, {
        assetId: result.assetId,
        beatFid: 'ensemble',
        method: 'ensemble',
        prompt: `Generated promotional ensemble image (${ensembleAspect})`,
      });

      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'success',
        message: `Ensemble image downloaded.`
      }});
      setShowEnsembleModal(false);
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'error',
        message: `Ensemble generation failed: ${err.message}`
      }});
    } finally {
      setIsGeneratingEnsemble(false);
    }
  };

  const selectedChar = currentShow?.characters.find(c => c.id === selectedCharId);

  useEffect(() => {
    if (selectedChar?.portraitAssetId) {
      AssetStorage.getBlobUrl(selectedChar.portraitAssetId).then(setPortraitUrl);
    } else if (selectedChar?.visualAnchorAssetId) {
      AssetStorage.getBlobUrl(selectedChar.visualAnchorAssetId).then(setPortraitUrl);
    } else {
      setPortraitUrl(null);
    }
  }, [selectedChar?.portraitAssetId, selectedChar?.visualAnchorAssetId]);

  if (!currentShow) return null;

  const handleUpdateChar = (updates: Partial<Character>) => {
    if (!selectedCharId || !currentShowRef.current) return;
    const newChars = currentShowRef.current.characters.map(c => 
      c.id === selectedCharId ? { ...c, ...updates } : c
    );
    dispatch({ type: 'UPDATE_SHOW', updates: { characters: newChars } });
  };

  const handleDeleteChar = (charId: string) => {
    if (!currentShowRef.current) return;
    const newChars = currentShowRef.current.characters.filter(c => c.id !== charId);
    dispatch({ type: 'UPDATE_SHOW', updates: { characters: newChars } });
    if (selectedCharId === charId) {
      setSelectedCharId(null);
    }
  };

  const handleAddCharacter = async (generateProfile: boolean) => {
    if (!newCharName.trim() || !newCharRole.trim() || !currentShow) return;

    const handle = `@${currentShow.showCode.toLowerCase()}.` +
      newCharName.toLowerCase().replace(/\s+/g, "_");

    const newChar: Character = {
      id: crypto.randomUUID(),
      name: newCharName.trim(),
      handle,
      role: newCharRole.trim(),
      physicalDescription: "",
      isMinor: newCharIsMinor,
      isProtagonist: false,
      castingNotes: "",
      evolution: "",
      voiceProfile: "",
      voiceConstraints: "",
      memoryBleedPalette: "",
      captionColor: "#000000",
      summary: "",
    };

    const addedChars = [...(currentShow.characters || []), newChar];
    dispatch({ type: "UPDATE_SHOW", updates: { characters: addedChars } });
    setSelectedCharId(newChar.id);
    setIsAddingChar(false);
    setNewCharName(""); setNewCharRole("");
    setNewCharBrief(""); setNewCharIsMinor(true);

    if (!generateProfile) return;

    setIsGeneratingNewChar(true);
    try {
      setNewCharGenStep("Writing character profile...");
      const profile = await generateFullCharacterProfile(
        currentShow,
        { name: newChar.name, handle, role: newChar.role,
          brief: newCharBrief.trim() || undefined,
          isMinor: newCharIsMinor },
        state.generationMode
      );
      const afterProfile: Partial<Character> = {
        summary: profile.summary,
        physicalDescription: profile.physicalDescription,
        visualAnchor: profile.visualAnchor,
        castingNotes: profile.castingNotes,
        evolution: profile.evolution,
      };

      const showWithProfile = {
        ...currentShow,
        characters: addedChars.map(c =>
          c.id === newChar.id ? { ...c, ...afterProfile } : c
        ),
      };
      dispatch({ type: "UPDATE_SHOW", updates: { characters: showWithProfile.characters } });

      setNewCharGenStep("Writing voice profile...");
      const voiceProfile = await generateCharacterVoiceProfile(
        showWithProfile,
        { ...newChar, ...afterProfile },
        state.generationMode
      );
      const charWithVoice = { ...newChar, ...afterProfile, voiceProfile };
      dispatch({ type: "UPDATE_SHOW", updates: {
        characters: showWithProfile.characters.map(c =>
          c.id === newChar.id ? { ...c, voiceProfile } : c
        )
      }});

      setNewCharGenStep("Distilling voice constraints...");
      const voiceConstraints = await generateVoiceConstraints(
        showWithProfile, charWithVoice, state.generationMode
      );
      dispatch({ type: "UPDATE_SHOW", updates: {
        characters: showWithProfile.characters.map(c =>
          c.id === newChar.id ? { ...c, voiceProfile, voiceConstraints } : c
        )
      }});

      setNewCharGenStep("Generating portrait...");
      const portraitResult = await generateCharacterPortrait(
        showWithProfile,
        { ...charWithVoice, voiceConstraints },
        undefined,
        state.generationMode
      );
      if (portraitResult?.assetId) {
        dispatch({ type: "UPDATE_SHOW", updates: {
          characters: showWithProfile.characters.map(c =>
            c.id === newChar.id
              ? { ...c, voiceProfile, voiceConstraints,
                  portraitAssetId: portraitResult.assetId }
              : c
          )
        }});
        appendGenerationLog(dispatch, currentShow, {
          assetId: portraitResult.assetId,
          beatFid: 'ensemble',
          method: 'portrait',
          prompt: `Generated portrait for character: ${newChar.name}`,
        });
      }
    } catch (err: any) {
      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "error",
        message: `Character generation failed: ${err.message}`,
      }});
    } finally {
      setIsGeneratingNewChar(false);
      setNewCharGenStep(null);
    }
  };

  const handleFillAllFields = async () => {
    if (!selectedChar || !currentShow || isFillingAll) return;
    setIsFillingAll(true);
    let working = { ...selectedChar };
    try {
      const hasEmptyCore = !working.summary?.trim()
        || !working.physicalDescription?.trim()
        || !working.visualAnchor?.trim();

      if (hasEmptyCore) {
        setFillStep("Writing character profile...");
        const profile = await generateFullCharacterProfile(
          currentShow,
          { name: working.name, handle: working.handle,
            role: working.role, isMinor: working.isMinor },
          state.generationMode
        );
        const updates: Partial<Character> = {};
        if (!working.summary?.trim())          updates.summary = profile.summary;
        if (!working.physicalDescription?.trim()) updates.physicalDescription = profile.physicalDescription;
        if (!working.visualAnchor?.trim())     updates.visualAnchor = profile.visualAnchor;
        if (!working.castingNotes?.trim())     updates.castingNotes = profile.castingNotes;
        if (!working.evolution?.trim())        updates.evolution = profile.evolution;
        
        if (Object.keys(updates).length > 0) {
          working = { ...working, ...updates };
          handleUpdateChar(updates);
        }
      }

      if (!working.voiceProfile?.trim()) {
        setFillStep("Writing voice profile...");
        const voiceProfile = await generateCharacterVoiceProfile(
          currentShow, working, state.generationMode
        );
        if (voiceProfile) {
          working = { ...working, voiceProfile };
          handleUpdateChar({ voiceProfile });
        }
      }

      if (!working.voiceConstraints?.trim()) {
        setFillStep("Distilling voice constraints...");
        const voiceConstraints = await generateVoiceConstraints(
          currentShow, working, state.generationMode
        );
        if (voiceConstraints) {
          working = { ...working, voiceConstraints };
          handleUpdateChar({ voiceConstraints });
        }
      }

    } catch (err: any) {
      dispatch({ type: "ADD_TOAST", toast: {
        id: Date.now().toString(), type: "error",
        message: `Profile generation failed: ${err.message}`,
      }});
    } finally {
      setIsFillingAll(false);
      setFillStep(null);
    }
  };

  const handleAutofill = async (field: keyof Character, label: string) => {
    if (!selectedChar || !currentShow) return;
    const key = `${selectedChar.id}-${field}`;
    setIsAutofilling(prev => ({ ...prev, [key]: true }));
    try {
      let context = `Character: ${selectedChar.name}\nRole: ${selectedChar.role}\nSummary: ${selectedChar.summary}`;
      if (field === 'voiceConstraints') {
        if (selectedChar.voiceProfile?.trim()) {
          context += `\nVOICE PROFILE:\n${selectedChar.voiceProfile}`;
        }
        context += `\nTASK: Distil HOW this character speaks into 1-2 hard constraint sentences for dialogue generation.
Focus on specific verbal tics, rhythms, and prohibited words.`;
      }
      if (field === 'visualAnchor') {
        context += `\nTASK: Write a plain prose description of this character's physical appearance.`
        + `\nThis text is used verbatim in AI image generation prompts.`
        + `\n2-4 sentences. No JSON, no bullets, no labels, no structured output.`
        + `\nCover: physical build, clothing or costume, hair, skin tone or coloring, and visually distinctive features.`;
      }
      const suggestion = await suggestField(currentShow, label, context);
      handleUpdateChar({ [field]: suggestion });
    } finally {
      setIsAutofilling(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAutofillIdentFeature = async () => {
    if (!selectedChar || !currentShow) return;
    const field = 'identifyingFeature';
    const key = `${selectedChar.id}-${field}`;
    setIsAutofilling(prev => ({ ...prev, [key]: true }));
    try {
      let context = `Character: ${selectedChar.name}\nRole: ${selectedChar.role}\nSummary: ${selectedChar.summary}`;
      if (selectedChar.visualAnchor?.trim()) {
        context += `\nVISUAL ANCHOR:\n${selectedChar.visualAnchor}`;
      }
      context += `\nTASK: Produce ONE short clause naming the single most distinctive visible feature of this character. 4-10 words.`;
      const suggestion = await suggestField(currentShow, 'Identifying Feature', context);
      handleUpdateChar({ identifyingFeature: suggestion });
    } finally {
      setIsAutofilling(prev => ({ ...prev, [key]: false }));
    }
  };

  // Generate single character portrait
  const handleGenerateSinglePortrait = async () => {
    if (!selectedChar || !currentShow) return;
    setIsAutofilling(prev => ({ ...prev, portrait: true }));
    try {
      const portraitResult = await generateCharacterPortrait(
        currentShow,
        selectedChar,
        undefined,
        state.generationMode
      );
      if (portraitResult?.assetId) {
        handleUpdateChar({ portraitAssetId: portraitResult.assetId });
        appendGenerationLog(dispatch, currentShow, {
          assetId: portraitResult.assetId,
          beatFid: 'character-portrait',
          method: 'portrait',
          prompt: `Generated portrait for character: ${selectedChar.name}`,
        });
        dispatch({ type: 'ADD_TOAST', toast: {
          id: Date.now().toString(),
          type: 'success',
          message: `Generated portrait for ${selectedChar.name}`
        }});
      }
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'error',
        message: `Portrait generation failed: ${err.message}`
      }});
    } finally {
      setIsAutofilling(prev => ({ ...prev, portrait: false }));
    }
  };

  // Upload custom portrait from file explorer
  const handleUploadPortrait = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChar || !currentShow) return;
    
    try {
      const assetId = crypto.randomUUID();
      await AssetStorage.put(assetId, file);
      handleUpdateChar({ portraitAssetId: assetId });
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'success',
        message: `Uploaded custom portrait for ${selectedChar.name}`
      }});
    } catch (err: any) {
      dispatch({ type: 'ADD_TOAST', toast: {
        id: Date.now().toString(),
        type: 'error',
        message: `Upload failed: ${err.message}`
      }});
    }
  };

  const handleClearPortrait = () => {
    if (!selectedChar) return;
    handleUpdateChar({ portraitAssetId: undefined });
    setPortraitUrl(null);
  };

  // Stats derivation
  const { beatCount, dialogueCount } = React.useMemo(() => {
    let beats = 0;
    let dialogue = 0;
    if (!selectedChar || !currentShow) return { beatCount: 0, dialogueCount: 0 };
    
    const charName = (selectedChar.name || '').trim().toLowerCase();
    const charHandle = (selectedChar.handle || '').trim().toLowerCase();

    (currentShow.seasons || []).forEach(s => {
      (s.episodes || []).forEach(ep => {
        (ep.acts || []).forEach(act => {
          (act.scenes || []).forEach(sc => {
            (sc.cinematicBeats || []).forEach(b => {
              let charAppearedInBeat = false;
              const entries = b.script?.entries || b.script?.lines || b.lines || [];
              if (Array.isArray(entries)) {
                entries.forEach((line: any) => {
                  const speaker = (line.speaker || '').trim().toLowerCase();
                  if (speaker && (speaker === charHandle || speaker === charName || charHandle.includes(speaker) || speaker.includes(charName))) {
                    dialogue++;
                    charAppearedInBeat = true;
                  }
                });
              }
              if (charAppearedInBeat) {
                beats++;
              }
            });
          });
        });
      });
    });

    return { beatCount: beats, dialogueCount: dialogue };
  }, [selectedChar, currentShow]);

  // Roster lists filtered by Search
  const filteredChars = currentShow.characters.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-black text-white overflow-hidden animate-in fade-in duration-500">
      
      {/* Title strip above panes (shrink-0) */}
      <div className="flex items-center justify-between border-b border-white/10 p-6 shrink-0 bg-neutral-950">
        <div className="space-y-1">
          <span className="text-[10px] text-amber-500 font-black uppercase tracking-[0.35em] block">
            Casting & Character Ledger
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase leading-none">
            Ensemble Workbench
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedEnsembleIds(new Set(charactersWithPortraits.map(c => c.id)));
              setShowEnsembleModal(true);
            }}
            disabled={!canGenerateEnsemble || isGeneratingEnsemble}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-sm transition-all disabled:opacity-40"
          >
            <Sparkles size={14} /> Promote Ensemble
          </button>
        </div>
      </div>

      {/* Pane Layout Container */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Left Pane - Roster (25%) */}
        <div className="flex-1 md:flex-none md:w-[25%] border-r border-white/10 flex flex-col min-h-0 bg-neutral-950/40">
          <div className="p-4 border-b border-white/10 space-y-3 shrink-0">
            <input 
              type="text"
              placeholder="Filter roster..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-amber-500/50 outline-none rounded-sm px-3 py-1.5 text-xs text-white placeholder:text-white/60"
            />
          </div>

          {/* List items with completeness dots conforming to high readability standards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {filteredChars.map(char => (
              <div key={char.id} className="relative group">
                <button
                  onClick={() => setSelectedCharId(char.id)}
                  className={`w-full text-left p-3.5 rounded-sm border transition-all ${
                    selectedCharId === char.id 
                      ? 'bg-white/10 border-amber-500/50 shadow-sm shadow-amber-500/10' 
                      : 'bg-white/5 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                      selectedCharId === char.id ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/90'
                    }`}>
                      {char.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{char.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/60 uppercase tracking-widest truncate">{char.role}</span>
                        <span className={`text-[9px] font-black uppercase px-1 rounded-sm ${char.isMinor ? 'bg-white/10 text-white/70' : 'bg-amber-500/20 text-amber-500'}`}>
                          {char.isMinor ? 'Minor' : 'Major'}
                        </span>
                      </div>
                      
                      {/* Completeness dots */}
                      <div className="flex gap-2 mt-2 pt-1.5 border-t border-white/5">
                        <div className="flex items-center gap-1" title="Portrait asset presence">
                          <span className={`w-1.5 h-1.5 rounded-full ${char.portraitAssetId || char.visualAnchorAssetId ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="text-[10px] text-white/70 uppercase font-bold tracking-wider">PORTRAIT</span>
                        </div>
                        <div className="flex items-center gap-1" title="Visual anchor script presence">
                          <span className={`w-1.5 h-1.5 rounded-full ${char.visualAnchor?.trim() ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="text-[10px] text-white/70 uppercase font-bold tracking-wider">ANCHOR</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteChar(char.id); }}
                  className="absolute top-2 right-2 text-white/60 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
                  title="Remove Character"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Character action drawer */}
          <div className="p-4 border-t border-white/10 bg-neutral-950 shrink-0 space-y-3">
            {!isAddingChar ? (
              <button
                onClick={() => setIsAddingChar(true)}
                className="w-full py-2.5 bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest text-white/90 flex items-center justify-center gap-2"
              >
                <UserPlus size={14} /> Add New Character
              </button>
            ) : (
              <div className="space-y-3 p-1">
                <input
                  value={newCharName}
                  onChange={e => setNewCharName(e.target.value)}
                  placeholder="Official Name *"
                  className="w-full bg-white/5 border border-white/10 focus:border-amber-500 outline-none rounded-sm px-3 py-1.5 text-xs text-white"
                />
                <input
                  value={newCharRole}
                  onChange={e => setNewCharRole(e.target.value)}
                  placeholder="Ensemble Role *"
                  className="w-full bg-white/5 border border-white/10 focus:border-amber-500 outline-none rounded-sm px-3 py-1.5 text-xs text-white"
                />
                <textarea
                  value={newCharBrief}
                  onChange={e => setNewCharBrief(e.target.value)}
                  placeholder="Brief synopsis..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 focus:border-amber-500 outline-none rounded-sm px-3 py-1.5 text-xs text-white resize-none"
                />
                <div className="flex gap-2">
                  {(["Major", "Minor"] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewCharIsMinor(type === "Minor")}
                      className={`flex-1 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${
                        (type === "Minor") === newCharIsMinor
                          ? "bg-amber-500 text-black font-black"
                          : "bg-white/5 text-white/60"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAddCharacter(false)}
                    disabled={!newCharName.trim() || !newCharRole.trim()}
                    className="flex-1 py-1.5 border border-white/10 text-white/80 hover:bg-white/5 text-[10px] uppercase font-black tracking-wider transition-all rounded-sm disabled:opacity-30"
                  >
                    Blank
                  </button>
                  <button
                    onClick={() => handleAddCharacter(true)}
                    disabled={!newCharName.trim() || !newCharRole.trim()}
                    className="flex-1 py-1.5 bg-amber-500 text-black text-[10px] uppercase font-black tracking-wider hover:bg-amber-400 transition-all rounded-sm disabled:opacity-30"
                  >
                    AI Build
                  </button>
                </div>
                <button
                  onClick={() => setIsAddingChar(false)}
                  className="w-full text-center text-[9px] text-white/50 hover:text-white uppercase font-black py-1"
                >
                  Cancel
                </button>
              </div>
            )}
            
            {isGeneratingNewChar && newCharGenStep && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 text-center animate-pulse rounded-sm">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                  {newCharGenStep}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Middle Pane - Detail fields (50%) */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#070707]">
          {selectedChar ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Highlight Portrait View & Summary block at the top */}
              <div className="flex flex-col md:flex-row gap-6 border-b border-white/10 pb-6">
                <div className="w-full md:w-36 aspect-[3/4] border border-white/10 bg-black/40 rounded-sm overflow-hidden shrink-0 relative">
                  {portraitUrl ? (
                    <img 
                      src={portraitUrl} 
                      alt={selectedChar.name} 
                      className="w-full h-full object-cover cursor-zoom-in"
                      referrerPolicy="no-referrer"
                      onClick={() => openLightbox(portraitUrl, { caption: selectedChar.name })}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 text-white/60">
                      <ImageIcon size={24} className="text-white/30 mb-2" />
                      <span className="text-[10px] uppercase font-black tracking-widest text-white/60">No Visual Anchor</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-amber-500 font-extrabold uppercase bg-amber-500/10 px-2 py-0.5 rounded-sm inline-block">
                      {selectedChar.handle}
                    </span>
                    <h2 className="text-xl font-black text-white">{selectedChar.name}</h2>
                    <p className="text-xs text-amber-400 uppercase tracking-widest font-bold">Role: {selectedChar.role}</p>
                  </div>
                  
                  <EditableField
                    label="Ledger Synopsis"
                    value={selectedChar.summary || ''}
                    multiline
                    onCommit={(val) => handleUpdateChar({ summary: val })}
                    placeholder="Short summary highlighting character's connection to the narrative matrix..."
                  />
                </div>
              </div>

              {/* Dynamic editing field layout */}
              <div className="space-y-6">
                <EditableField
                  label="Physical Appearance & Costume Specs"
                  value={selectedChar.physicalDescription || ''}
                  multiline
                  onCommit={(val) => handleUpdateChar({ physicalDescription: val })}
                  placeholder="Detail build, hair color, wardrobe guidelines, posture etc..."
                />

                <EditableField
                  label="Visual Prompt Anchor (verbatim prompt extension)"
                  value={selectedChar.visualAnchor || ''}
                  multiline
                  onCommit={(val) => handleUpdateChar({ visualAnchor: val })}
                  placeholder="Prose used to expand generative art prompts (e.g. sharp jawline, high collar, messy braid)..."
                />

                <EditableField
                  label="Unique Identifying Aspect (disambiguator)"
                  value={selectedChar.identifyingFeature || ''}
                  multiline
                  onCommit={(val) => handleUpdateChar({ identifyingFeature: val })}
                  placeholder="Single visible focal point (e.g. silver eyeglasses, neon-lined jacket)..."
                />

                <EditableField
                  label="Dramatic Casting Trajectory"
                  value={selectedChar.castingNotes || ''}
                  multiline
                  onCommit={(val) => handleUpdateChar({ castingNotes: val })}
                  placeholder="Casting comparisons, performance direction metrics..."
                />

                <EditableField
                  label="Character Arc & Narrative Evolution"
                  value={selectedChar.evolution || ''}
                  multiline
                  onCommit={(val) => handleUpdateChar({ evolution: val })}
                  placeholder="How character motives and alignment change across episodes..."
                />

                <div className="pt-4 border-t border-white/5 space-y-6">
                  <EditableField
                    label="Voice Profiling"
                    value={selectedChar.voiceProfile || ''}
                    multiline
                    onCommit={(val) => handleUpdateChar({ voiceProfile: val, voiceCardStale: true })}
                    placeholder="Cadence, verbal tics, phrasing structures..."
                  />

                  {/* Pink Voice Card quick context */}
                  <div className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-pink-400 uppercase tracking-widest font-black flex items-center gap-1.5">
                        <Volume2 size={12} /> Core Voice Card Context
                      </span>
                      {selectedChar.voiceCardStale && (
                        <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Stale</span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-pink-300/90 whitespace-pre-wrap leading-relaxed">
                      {selectedChar.voiceCard || 'No derived voice metrics currently assigned. Trigger refreshes via operational menu.'}
                    </p>
                  </div>

                  <EditableField
                    label="Voice Synthesis Constraints"
                    value={selectedChar.voiceConstraints || ''}
                    multiline
                    monospace
                    onCommit={(val) => handleUpdateChar({ voiceConstraints: val })}
                    placeholder="Writers guidelines (e.g. ALWAYS short declarative lines; NEVER rhetorical questions)..."
                    className="bg-amber-500/5 text-amber-400 p-2 border border-amber-500/10 rounded-sm"
                  />

                  {selectedChar.isProtagonist && (
                    <EditableField
                      label="Memory Bleed Palette Rules"
                      value={selectedChar.memoryBleedPalette || ''}
                      multiline
                      onCommit={(val) => handleUpdateChar({ memoryBleedPalette: val })}
                      placeholder="e.g. cold blue hues with gold sparks..."
                    />
                  )}
                </div>

                {/* Caption color picker */}
                <div className="space-y-2 pt-4 border-t border-white/5">
                  <label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex items-center gap-1.5">
                    <Palette size={12} className="text-amber-500" /> Internal Dialogue Caption Hex Code
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-white/5 border border-white/10 rounded-sm">
                    {CHARACTER_CAPTION_PALETTE.map(color => (
                      <button
                        key={color}
                        onClick={() => handleUpdateChar({ captionColor: color })}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          selectedChar.captionColor === color 
                            ? 'border-white scale-110' 
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <div className="w-[1px] h-6 bg-white/20 mx-2" />
                    <input
                      type="color"
                      value={selectedChar.captionColor || '#000000'}
                      onChange={(e) => handleUpdateChar({ captionColor: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                      title="Custom palette value"
                    />
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-white/50 space-y-4">
              <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-xl bg-white/5 text-white/70">👤</div>
              <p className="text-xs uppercase tracking-widest text-white/65">Roster unselected.<br />Select or write a character in the ledger to begin drafting.</p>
            </div>
          )}
        </div>

        {/* Right Pane - Action dashboard (25%) */}
        <div className="flex-1 md:flex-none md:w-[25%] border-l border-white/10 flex flex-col min-h-0 bg-neutral-950/40">
          {selectedChar ? (
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="space-y-3">
                <button
                  onClick={handleFillAllFields}
                  disabled={isFillingAll}
                  className="w-full text-center py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-widest transition-colors rounded-sm flex items-center justify-center gap-2"
                >
                  <Wand2 size={14} /> {isFillingAll && fillStep ? 'Drafting...' : 'Build Full Profile'}
                </button>
                <p className="text-[9px] text-white/60 lowercase leading-relaxed text-center">
                  fills all empty narrative, visual, and voice descriptor parameters sequentially using context metrics.
                </p>
              </div>

              {/* Autofill grouping */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-[10px] text-white/60 uppercase tracking-widest font-black">
                  Interactive Autofill Agents
                </h3>

                <div className="space-y-2">
                  <span className="text-[9px] text-white/60 font-mono block">VISUAL SUITE</span>
                  <button
                    onClick={() => handleAutofill('physicalDescription', 'Physical Description')}
                    disabled={isAutofilling[`${selectedChar.id}-physicalDescription`]}
                    className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 flex items-center justify-between group"
                  >
                    <span>Physical Desc</span>
                    <Wand2 size={12} className="text-white/65 group-hover:text-amber-500" />
                  </button>
                  <button
                    onClick={() => handleAutofill('visualAnchor', 'Visual Anchor')}
                    disabled={isAutofilling[`${selectedChar.id}-visualAnchor`]}
                    className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 flex items-center justify-between group"
                  >
                    <span>Visual Anchor</span>
                    <Wand2 size={12} className="text-white/65 group-hover:text-amber-500" />
                  </button>
                  <button
                    onClick={handleAutofillIdentFeature}
                    disabled={isAutofilling[`${selectedChar.id}-identifyingFeature`]}
                    className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 flex items-center justify-between group"
                  >
                    <span>Disambiguator Feature</span>
                    <Wand2 size={12} className="text-white/65 group-hover:text-amber-500" />
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[9px] text-white/60 font-mono block">VOICE SUITE</span>
                  <button
                    onClick={() => handleAutofill('voiceProfile', 'Voice Profile')}
                    disabled={isAutofilling[`${selectedChar.id}-voiceProfile`]}
                    className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 flex items-center justify-between group"
                  >
                    <span>Voice Profile</span>
                    <Wand2 size={12} className="text-white/65 group-hover:text-amber-400" />
                  </button>
                  <button
                    onClick={async () => {
                      const key = `${selectedChar.id}-voiceCard`;
                      setIsAutofilling(prev => ({ ...prev, [key]: true }));
                      try {
                        const card = await deriveVoiceCard(selectedChar, state.generationMode);
                        if (card) {
                          handleUpdateChar({ voiceCard: card, voiceCardStale: false });
                        }
                      } finally {
                        setIsAutofilling(prev => ({ ...prev, [key]: false }));
                      }
                    }}
                    disabled={isAutofilling[`${selectedChar.id}-voiceCard`]}
                    className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 flex items-center justify-between group"
                  >
                    <span>Extract Voice Card</span>
                    <Wand2 size={12} className="text-white/65 group-hover:text-amber-400" />
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[9px] text-white/60 font-mono block">ARC SUITE</span>
                  <button
                    onClick={() => handleAutofill('castingNotes', 'Casting Notes')}
                    disabled={isAutofilling[`${selectedChar.id}-castingNotes`]}
                    className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 flex items-center justify-between group"
                  >
                    <span>Casting Notes</span>
                    <Wand2 size={12} className="text-white/65 group-hover:text-amber-400" />
                  </button>
                  <button
                    onClick={() => handleAutofill('evolution', 'Arc & Evolution')}
                    disabled={isAutofilling[`${selectedChar.id}-evolution`]}
                    className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[10px] font-bold uppercase tracking-wider text-white/90 flex items-center justify-between group"
                  >
                    <span>Arc & Evolution</span>
                    <Wand2 size={12} className="text-white/65 group-hover:text-amber-400" />
                  </button>
                </div>
              </div>

              {/* Character Portrait generation controls */}
              <div className="space-y-3 pt-6 border-t border-white/10">
                <h3 className="text-[10px] text-white/60 uppercase tracking-widest font-black">
                  Portrait Control Studio
                </h3>
                
                <button
                  onClick={handleGenerateSinglePortrait}
                  disabled={isAutofilling.portrait || !selectedChar.visualAnchor}
                  title="Requires visual anchor to be crafted."
                  className="w-full py-2 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-amber-500/50 transition-colors text-[10px] font-black uppercase tracking-widest text-white/90 flex items-center justify-center gap-2"
                >
                  <Sparkles size={12} className="text-amber-500" /> {isAutofilling.portrait ? 'Drafting Portrait...' : 'Generate Art Portrait'}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-1.5 border border-white/10 hover:bg-white/5 text-[9px] uppercase font-black tracking-widest text-white/80 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Upload size={10} /> Upload
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleUploadPortrait} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  {portraitUrl && (
                    <button
                      onClick={handleClearPortrait}
                      className="flex-1 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/5 text-[9px] uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={10} /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Character performance stats */}
              <div className="space-y-4 pt-6 border-t border-white/10">
                <h3 className="text-[10px] text-white/60 uppercase tracking-widest font-black flex items-center gap-1.5">
                  <StatsIcon size={12} className="text-emerald-400" /> Script Assembly Stats
                </h3>
                <div className="grid grid-cols-2 gap-3 bg-black/40 border border-white/5 rounded-sm p-4">
                  <div>
                    <span className="text-[10px] text-white/70 uppercase tracking-wider block font-bold">Appearances</span>
                    <span className="text-base font-mono font-bold text-white">{beatCount} beats</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/70 uppercase tracking-wider block font-bold">Dialogue Lines</span>
                    <span className="text-base font-mono font-bold text-white">{dialogueCount} lines</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-white/90 font-bold block">Present-Day Protagonist</span>
                      <span className="text-[10px] text-white/70">Experiences the narrative mechanism active state.</span>
                    </div>
                    <button
                      onClick={() => handleUpdateChar({ isProtagonist: !selectedChar.isProtagonist })}
                      className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-sm border transition-all ${
                        selectedChar.isProtagonist
                          ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                          : 'border-white/10 text-white/60'
                      }`}
                    >
                      {selectedChar.isProtagonist ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-white/60 text-xs">
              Select ledger row to view actions.
            </div>
          )}
        </div>

      </div>

      {lightbox.src && (
        <ImageLightbox
          src={lightbox.src}
          caption={lightbox.caption}
          onClose={closeLightbox}
        />
      )}

      {showEnsembleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-white/20 p-8 rounded-sm max-w-sm w-full shadow-2xl space-y-6">
            <div>
              <h3 className="text-xl font-black uppercase tracking-widest text-amber-500 mb-2">Generate Cast Ensemble</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Creates a promotional image of one or more characters in the show's comic art style. Includes characters with valid portraits. Select at least one character.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/90 uppercase tracking-widest font-black block">Cast Selection</label>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedEnsembleIds(new Set(charactersWithPortraits.map(c => c.id)))}
                    className="text-[10px] text-amber-500 hover:text-amber-400 uppercase tracking-widest font-bold transition-colors"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => setSelectedEnsembleIds(new Set())}
                    className="text-[10px] text-white/60 hover:text-white uppercase tracking-widest font-bold transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              <div className="max-h-48 overflow-y-auto border border-white/10 rounded-sm bg-white/5 p-2 space-y-1 scrollbar-hide">
                {charactersWithPortraits.map(char => (
                  <label key={char.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedEnsembleIds.has(char.id)}
                      onChange={(e) => {
                        const newSet = new Set(selectedEnsembleIds);
                        if (e.target.checked) newSet.add(char.id);
                        else newSet.delete(char.id);
                        setSelectedEnsembleIds(newSet);
                      }}
                      className="accent-amber-500 w-4 h-4 shadow-sm"
                    />
                    <div className="flex-1 overflow-hidden">
                      <span className="text-xs font-bold text-white group-hover:text-amber-500 transition-colors truncate block">{char.name}</span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Aspect */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/90 uppercase tracking-widest font-black block">Aspect Format</label>
                <div className="flex gap-2">
                  {(['vertical', 'horizontal', 'square'] as EnsembleAspect[]).map(aspect => (
                    <button
                      key={aspect}
                      onClick={() => setEnsembleAspect(aspect)}
                      className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all ${
                        ensembleAspect === aspect 
                          ? "bg-amber-500 text-black" 
                          : "bg-white/10 text-white/60 hover:bg-white/15"
                      }`}
                    >
                      {aspect}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEnsembleModal(false)}
                className="flex-1 py-2 border border-white/10 text-white/80 hover:bg-white/5 text-[10px] uppercase font-black tracking-widest rounded-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateEnsembleImage}
                disabled={isGeneratingEnsemble || selectedEnsembleIds.size === 0}
                className="flex-1 py-2 bg-amber-500 text-black text-[10px] uppercase font-black tracking-widest hover:bg-amber-400 transition-all rounded-sm disabled:opacity-40"
              >
                {isGeneratingEnsemble ? 'Generating...' : 'Assemble'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharactersPanel;
