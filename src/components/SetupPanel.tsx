import React, { useState } from 'react';
import { useStore } from '../StoreContext';
import { SettingAnchor, WritingRules } from '../types/models';

const SetupPanel: React.FC = () => {
  const { state, dispatch, save } = useStore();
  const { currentShow } = state;
  const [localName, setLocalName] = useState(currentShow?.name || '');
  const [localTitle, setLocalTitle] = useState(currentShow?.titleSuggestion || '');
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('CUSTOM_GEMINI_API_KEY') || '');
  const [localStructure, setLocalStructure] = useState({
    episodesPerSeason: currentShow?.structureConfig?.episodesPerSeason ?? 1,
    actsPerEpisode:    currentShow?.structureConfig?.actsPerEpisode    ?? 1,
    scenesPerAct:      currentShow?.structureConfig?.scenesPerAct      ?? 1,
    beatsPerScene:     currentShow?.structureConfig?.beatsPerScene     ?? 1,
  });

  // Setting Anchors state
  const [isAddingAnchor, setIsAddingAnchor] = useState(false);
  const [editingAnchorId, setEditingAnchorId] = useState<string | null>(null);
  const [newAnchorName, setNewAnchorName] = useState('');
  const [newAnchorDesc, setNewAnchorDesc] = useState('');
  const [newAnchorVisual, setNewAnchorVisual] = useState('');
  const [newAnchorMood, setNewAnchorMood] = useState('');
  const [newAnchorType, setNewAnchorType] = useState<'interior'|'exterior'|'mixed'>('interior');
  
  // Writing Rules state
  const [addingRuleFor, setAddingRuleFor] = useState<keyof WritingRules | null>(null);
  const [newRuleText, setNewRuleText] = useState("");
  const [editingRule, setEditingRule] = useState<{ cat: keyof WritingRules; idx: number } | null>(null);
  const [editRuleText, setEditRuleText] = useState("");

  const handleSaveCustomKey = () => {
    if (customApiKey) {
      localStorage.setItem('CUSTOM_GEMINI_API_KEY', customApiKey);
    } else {
      localStorage.removeItem('CUSTOM_GEMINI_API_KEY');
    }
    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: `save-key-${Date.now()}`,
        type: 'success',
        message: 'Custom API key updated.'
      }
    });
  };

  if (!currentShow) return null;

  // Derive current writingRules with safe defaults:
  const writingRules: WritingRules = currentShow.writingRules ?? {
    dialogueRules: [], blockingRules: [], structureRules: [], craftNotes: []
  };

  const handleAddRule = (cat: keyof WritingRules) => {
    const text = newRuleText.trim();
    if (!text) return;
    const updated: WritingRules = {
      ...writingRules,
      [cat]: [...writingRules[cat], text],
    };
    dispatch({ type: "UPDATE_SHOW", updates: { writingRules: updated } });
    setNewRuleText("");
    setAddingRuleFor(null);
  };

  const handleDeleteRule = (cat: keyof WritingRules, idx: number) => {
    const updated: WritingRules = {
      ...writingRules,
      [cat]: writingRules[cat].filter((_, i) => i !== idx),
    };
    dispatch({ type: "UPDATE_SHOW", updates: { writingRules: updated } });
  };

  const handleSaveEditRule = (cat: keyof WritingRules, idx: number) => {
    const text = editRuleText.trim();
    if (!text) { handleDeleteRule(cat, idx); setEditingRule(null); return; }
    const updatedList = [...writingRules[cat]];
    updatedList[idx] = text;
    const updated: WritingRules = { ...writingRules, [cat]: updatedList };
    dispatch({ type: "UPDATE_SHOW", updates: { writingRules: updated } });
    setEditingRule(null);
  };

  const handleSave = async () => {
    console.log('Save Configuration clicked');
    // alert('Save Configuration button clicked!'); 
    const nextShow = {
      ...currentShow,
      name: localName, 
      titleSuggestion: localTitle,
      structureConfig: localStructure,
      lastModified: Date.now()
    };
    dispatch({ type: 'UPDATE_SHOW', updates: { 
      name: localName, 
      titleSuggestion: localTitle,
      structureConfig: localStructure,
    } });
    await save(nextShow);
  };

  const handleSaveAnchor = () => {
    if (!newAnchorName.trim() || !newAnchorDesc.trim()) return;
    
    const newAnchor: SettingAnchor = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: newAnchorName.trim(),
      physicalDescription: newAnchorDesc.trim(),
      visualDescription: newAnchorVisual.trim() || undefined,
      mood: newAnchorMood.trim() || undefined,
      interiorExterior: newAnchorType,
    };

    const updated = [...(currentShow.settingAnchors ?? []), newAnchor];
    dispatch({ type: 'UPDATE_SHOW', updates: { settingAnchors: updated } });
    
    setNewAnchorName('');
    setNewAnchorDesc('');
    setNewAnchorVisual('');
    setNewAnchorMood('');
    setNewAnchorType('interior');
    setIsAddingAnchor(false);
  };

  const handleDeleteAnchor = (id: string) => {
    const updated = (currentShow.settingAnchors ?? []).filter(a => a.id !== id);
    dispatch({ type: 'UPDATE_SHOW', updates: { settingAnchors: updated } });
  };

  const handleUpdateAnchor = (id: string, updates: Partial<SettingAnchor>) => {
    const updated = (currentShow.settingAnchors ?? []).map(a =>
      a.id === id ? { ...a, ...updates } : a
    );
    dispatch({ type: 'UPDATE_SHOW', updates: { settingAnchors: updated } });
  };

  return (
    <div className="p-8 md:p-12 max-w-2xl mx-auto space-y-12">
      <header className="border-b border-white/70 pb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Project Setup</h2>
          <p className="text-[10px] text-white uppercase tracking-widest font-black">Metadata & Configuration</p>
        </div>
      </header>

      <div className="space-y-8">
        <section className="space-y-4">
          <label className="text-[10px] text-amber-500 uppercase tracking-widest font-black">Project Name (Internal)</label>
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            className="w-full bg-white/30 border border-white/70 p-4 rounded-sm text-sm text-white focus:border-amber-500/30 outline-none transition-all"
          />
        </section>

        <section className="space-y-4">
          <label className="text-[10px] text-amber-500 uppercase tracking-widest font-black">Series Title (Public)</label>
          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            className="w-full bg-white/30 border border-white/70 p-4 rounded-sm text-sm text-white focus:border-amber-500/30 outline-none transition-all"
            placeholder="e.g. The Last Bastion"
          />
        </section>

        <section className="space-y-4">
          <label className="text-[10px] text-white/90 uppercase tracking-widest font-black">Production Stats</label>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/30 rounded-sm border border-white/60">
              <div className="text-[10px] text-white/90 uppercase mb-1">Created</div>
              <div className="text-xs font-mono text-white">{new Date(currentShow.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="p-4 bg-white/30 rounded-sm border border-white/60">
              <div className="text-[10px] text-white/90 uppercase mb-1">Last Modified</div>
              <div className="text-xs font-mono text-white">{new Date(currentShow.lastModified).toLocaleDateString()}</div>
            </div>
          </div>
        </section>

        {/* STRUCTURE CONFIGURATION */}
        <section className="space-y-6 pt-8 border-t border-white/70">
          <label className="text-[10px] text-cyan-400 uppercase tracking-widest font-black">
            Structure Configuration
          </label>
          <p className="text-[10px] text-white/90 leading-relaxed">
            Controls how many acts, scenes, and page beats the AI generates.
            Changes apply on next generation or nuke-and-rebuild.
          </p>
          <div className="grid grid-cols-4 gap-4">
            {([
              { key: "episodesPerSeason", label: "Issues / Season", min: 1, max: 13, def: 1 },
              { key: "actsPerEpisode",    label: "Acts / Issue",    min: 1, max: 5,  def: 1 },
              { key: "scenesPerAct",      label: "Scenes / Act",      min: 1, max: 8,  def: 1 },
              { key: "beatsPerScene",     label: "Page Beats / Scene",     min: 1, max: 9,  def: 1 },
            ] as const).map(({ key, label, min, max, def }) => (
              <div key={key} className="space-y-2">
                <label className="text-[10px] text-white uppercase tracking-widest font-black block">
                  {label}
                </label>
                <input
                  type="number"
                  min={min} max={max}
                  value={localStructure[key] ?? def}
                  onChange={e => setLocalStructure(prev => ({
                    ...prev,
                    [key]: Math.max(min, Math.min(max, parseInt(e.target.value) || def)),
                  }))}
                  className="w-full bg-white/30 border border-white/70 p-3 rounded-sm
                    text-xl font-mono text-white text-center
                    focus:border-cyan-500/30 outline-none transition-all"
                />
              </div>
            ))}
          </div>
        </section>

        {/* D267: MAINTENANCE */}
        <section className="space-y-4 pt-8 border-t border-white/70">
          <div>
            <label className="text-[10px] text-pink-400 uppercase tracking-widest font-black">
              Maintenance & Migration
            </label>
            <p className="text-[10px] text-white/90 mt-1 leading-relaxed">
              Global operations for series-level data.
            </p>
          </div>
          <div className="p-6 bg-white/30 border border-white/70 rounded-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-[10px] text-white uppercase tracking-widest font-bold">Derive Voice Cards</h4>
                <p className="text-[10px] text-white/70 max-w-sm">
                  D267: Generates concise dialogue-specific cards for all characters. 
                  Improves script focus and reduces latency.
                </p>
              </div>
              <button
                onClick={async () => {
                  const { migrateVoiceCards } = await import('../utils/migration');
                  dispatch({ type: 'ADD_TOAST', toast: { id: 'mig', message: 'Starting voice card derivation...', type: 'info' } });
                  const res = await migrateVoiceCards();
                  dispatch({ type: 'ADD_TOAST', toast: { 
                    id: 'mig-done', 
                    // @ts-expect-error LEGACY: title doesn't exist on Toast
                    title: 'Migration Complete',
                    message: `Cards derived: ${res.derived}, Skipped: ${res.skipped}, Failed: ${res.failed}`,
                    type: 'success' 
                  }});
                }}
                className="bg-pink-500/20 text-pink-300 px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-pink-500/30 transition-colors"
              >
                Run Migration
              </button>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div className="space-y-1">
                <h4 className="text-[10px] text-white uppercase tracking-widest font-bold">Series Register</h4>
                <p className="text-[10px] text-white/70 max-w-sm">
                  Sets the primary genre mode. Affects dialogue guidelines and structure logic.
                </p>
              </div>
              <div className="flex gap-2">
                {(['drama', 'comedy', 'mixed'] as const).map(reg => (
                  <button
                    key={reg}
                    onClick={() => dispatch({ type: 'UPDATE_SHOW', updates: { register: reg } })}
                    className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border transition-all ${
                      (currentShow.register || 'drama') === reg
                        ? 'border-pink-500/50 text-pink-300 bg-pink-500/10'
                        : 'border-white/20 text-white/60 hover:text-white'
                    }`}
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SETTING ANCHORS */}
        <section className="space-y-4 pt-8 border-t border-white/70">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[10px] text-violet-400 uppercase tracking-widest font-black">
                Locations
              </label>
              <p className="text-[10px] text-white/90 mt-1">
                Named locations injected into scene and comic generation.
              </p>
            </div>
            <button onClick={() => setIsAddingAnchor(v => !v)}
              className="text-[10px] text-violet-400 font-black uppercase tracking-widest
                hover:text-violet-300 transition-colors">
              {isAddingAnchor ? 'Cancel' : '+ Add Location'}
            </button>
          </div>

          {isAddingAnchor && (
            <div className="p-6 bg-white/30 border border-violet-500/20 rounded-sm space-y-4">
              <input
                type="text"
                value={newAnchorName}
                onChange={e => setNewAnchorName(e.target.value)}
                placeholder="Location Name (e.g. Sector 4 Pump Room)"
                className="w-full bg-black/40 border border-white/70 p-3 rounded-sm text-sm text-white focus:border-violet-500/30 outline-none"
              />
              <textarea
                value={newAnchorDesc}
                onChange={e => setNewAnchorDesc(e.target.value)}
                placeholder="Physical Description (prose)"
                className="w-full h-24 bg-black/40 border border-white/70 p-3 rounded-sm text-xs text-white focus:border-violet-500/30 outline-none resize-none"
              />
              <textarea
                value={newAnchorVisual}
                onChange={e => setNewAnchorVisual(e.target.value)}
                placeholder="Visual Description (image-generation-ready one-liner)"
                className="w-full h-16 bg-black/40 border border-white/70 p-3 rounded-sm text-xs text-white focus:border-violet-500/30 outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={newAnchorMood}
                  onChange={e => setNewAnchorMood(e.target.value)}
                  placeholder="Mood (e.g. industrial, cold)"
                  className="w-full bg-black/40 border border-white/70 p-3 rounded-sm text-xs text-white focus:border-violet-500/30 outline-none"
                />
                <select
                  value={newAnchorType}
                  onChange={e => setNewAnchorType(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/70 p-3 rounded-sm text-xs text-white focus:border-violet-500/30 outline-none"
                >
                  <option value="interior">Interior</option>
                  <option value="exterior">Exterior</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <button
                onClick={handleSaveAnchor}
                disabled={!newAnchorName.trim() || !newAnchorDesc.trim()}
                className="w-full bg-violet-500/20 text-violet-300 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/30 transition-colors disabled:opacity-50"
              >
                Save Location
              </button>
            </div>
          )}

          <div className="space-y-2">
            {(currentShow.settingAnchors ?? []).map(anchor => (
              <div key={anchor.id} className="p-4 bg-white/30 border border-white/70 rounded-sm group min-h-[100px]">
                {editingAnchorId === anchor.id ? (
                  <div className="space-y-3 pr-12">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/70">Name</label>
                      <input
                        value={anchor.name}
                        onBlur={(e) => handleUpdateAnchor(anchor.id, { name: e.target.value })}
                        onChange={(e) => handleUpdateAnchor(anchor.id, { name: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-sm px-2 py-1 text-sm text-white focus:border-amber-500/50 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/70 block">Short Name (optional)</label>
                      <input
                        value={anchor.shortName || ''}
                        onBlur={(e) => handleUpdateAnchor(anchor.id, { shortName: e.target.value || undefined })}
                        onChange={(e) => handleUpdateAnchor(anchor.id, { shortName: e.target.value || undefined })}
                        placeholder="abbreviated for UI"
                        className="w-full bg-white/10 border border-white/20 rounded-sm px-2 py-1 text-sm text-white focus:border-amber-500/50 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/70">Physical Description</label>
                      <textarea
                        defaultValue={anchor.physicalDescription}
                        onBlur={(e) => handleUpdateAnchor(anchor.id, { physicalDescription: e.target.value })}
                        placeholder="what it looks like, what it contains"
                        className="w-full h-24 bg-white/10 border border-white/20 rounded-sm px-2 py-1 text-xs text-white focus:border-amber-500/50 outline-none transition-all resize-none shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/70">Visual Description</label>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest ml-2">
                        preferred for image prompts
                      </span>
                      <textarea
                        defaultValue={anchor.visualDescription || ''}
                        onBlur={(e) => handleUpdateAnchor(anchor.id, { visualDescription: e.target.value || undefined })}
                        placeholder="image-generation-ready one-liner"
                        className="w-full h-16 bg-white/10 border border-white/20 rounded-sm px-2 py-1 text-xs text-white focus:border-amber-500/50 outline-none transition-all resize-none shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/70">Mood (optional)</label>
                      <input
                        value={anchor.mood || ''}
                        onBlur={(e) => handleUpdateAnchor(anchor.id, { mood: e.target.value || undefined })}
                        onChange={(e) => handleUpdateAnchor(anchor.id, { mood: e.target.value || undefined })}
                        placeholder="industrial, cold, claustrophobic"
                        className="w-full bg-white/10 border border-white/20 rounded-sm px-2 py-1 text-xs text-white focus:border-amber-500/50 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/70">Interior / Exterior</label>
                      <select
                        value={anchor.interiorExterior}
                        onChange={(e) => handleUpdateAnchor(anchor.id, { interiorExterior: e.target.value as any })}
                        className="w-full bg-white/10 border border-white/20 rounded-sm px-2 py-1 text-xs text-white focus:border-amber-500/50 outline-none transition-all"
                      >
                        <option value="interior">Interior</option>
                        <option value="exterior">Exterior</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => setEditingAnchorId(null)}
                      className="w-full bg-emerald-500 text-black py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all mt-2"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between w-full">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">
                          {anchor.name}
                          {anchor.shortName ? ` (${anchor.shortName})` : ''}
                        </h4>
                        <span className="text-[10px] uppercase tracking-widest text-violet-400/60 px-2 py-0.5 bg-violet-500/10 rounded-full">
                          {anchor.interiorExterior}
                        </span>
                      </div>
                      <p className="text-xs text-white/90 line-clamp-2">{anchor.physicalDescription}</p>
                      {anchor.mood && <p className="text-[10px] text-white/70">Mood: {anchor.mood}</p>}
                      {anchor.visualDescription && (
                        <p className="text-[10px] text-amber-400 uppercase tracking-widest font-mono line-clamp-1 mt-1">
                          VIS: {anchor.visualDescription}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingAnchorId(anchor.id)}
                        className="text-white/90 hover:text-amber-400 transition-colors text-[14px]"
                        title="Edit Location"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteAnchor(anchor.id)}
                        className="text-white/90 hover:text-red-400 transition-colors text-[14px]"
                        title="Delete Location"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(!currentShow.settingAnchors || currentShow.settingAnchors.length === 0) && !isAddingAnchor && (
              <div className="p-8 border border-white/60 border-dashed rounded-sm text-center">
                <p className="text-xs text-white/90">No locations defined.</p>
              </div>
            )}
          </div>
        </section>

        {/* WRITING RULES */}
        <section className="space-y-6 pt-8 border-t border-white/70">
          <div>
            <label className="text-[10px] text-white/80 uppercase tracking-widest font-black">
              Writing Rules
            </label>
            <p className="text-[10px] text-white/80 mt-1 leading-relaxed">
              Per-series rules injected into the punch-up pass.
              Edit session-only during a punch-up without saving here.
            </p>
          </div>
          
          <div className="space-y-6">
          {([
            { cat: "dialogueRules"  as const, label: "Dialogue Rules",  hint: "How characters speak in this series" },
            { cat: "blockingRules"  as const, label: "Blocking Rules",  hint: "Physical action and staging constraints" },
            { cat: "structureRules" as const, label: "Structure Rules", hint: "Page Beat and scene construction rules" },
            { cat: "craftNotes"     as const, label: "Craft Notes",     hint: "Tone, register, anything else" },
          ]).map(({ cat, label, hint }) => (
            <div key={cat}
              className="p-5 bg-white/30 border border-white/70 rounded-sm space-y-3">
          
              {/* Category header */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] text-white/90 uppercase tracking-widest font-black">
                    {label}
                  </h4>
                  <p className="text-[10px] text-white/80 mt-0.5">{hint}</p>
                </div>
                <button
                  onClick={() => {
                    setAddingRuleFor(cat);
                    setNewRuleText("");
                    setEditingRule(null);
                  }}
                  className="text-[10px] text-amber-400 font-black uppercase tracking-widest
                             hover:text-amber-300 transition-colors"
                >
                  + Add
                </button>
              </div>
          
              {/* Existing rules */}
              {writingRules[cat].length > 0 && (
                <div className="space-y-2">
                  {writingRules[cat].map((rule, i) => (
                    <div key={i}>
                      {editingRule?.cat === cat && editingRule?.idx === i ? (
                        <div className="flex gap-2 items-start">
                          <textarea
                            value={editRuleText}
                            onChange={e => setEditRuleText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEditRule(cat, i);
                              }
                              if (e.key === "Escape") setEditingRule(null);
                            }}
                            autoFocus
                            rows={2}
                            className="flex-1 bg-black/40 border border-amber-500/40
                                       rounded-sm px-2 py-1 text-[10px] text-white
                                       font-mono outline-none resize-none"
                          />
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              onClick={() => handleSaveEditRule(cat, i)}
                              className="text-[10px] text-emerald-400 font-black
                                         uppercase tracking-widest hover:text-emerald-300"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRule(null)}
                              className="text-[10px] text-white/80 font-black
                                         uppercase tracking-widest hover:text-white/80"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 group">
                          <span className="text-white/60 text-[10px] mt-0.5 shrink-0">--</span>
                          <span className="flex-1 text-xs text-white/90 leading-relaxed
                                           font-mono">
                            {rule}
                          </span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100
                                          transition-opacity shrink-0">
                            <button
                              onClick={() => {
                                setEditingRule({ cat, idx: i });
                                setEditRuleText(rule);
                                setAddingRuleFor(null);
                              }}
                              className="text-[10px] text-white/70 hover:text-white
                                         uppercase tracking-widest transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRule(cat, i)}
                              className="text-[10px] text-red-500/80 hover:text-red-400
                                         uppercase tracking-widest transition-colors"
                            >
                              x
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
          
              {/* Add new rule input */}
              {addingRuleFor === cat && (
                <div className="flex gap-2 items-start">
                  <textarea
                    value={newRuleText}
                    onChange={e => setNewRuleText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddRule(cat);
                      }
                      if (e.key === "Escape") setAddingRuleFor(null);
                    }}
                    autoFocus
                    rows={2}
                    placeholder="Write a rule. Enter to save, Escape to cancel."
                    className="flex-1 bg-black/40 border border-white/30 rounded-sm
                               px-2 py-1 text-[10px] text-white font-mono outline-none
                               resize-none placeholder:text-white/50
                               focus:border-amber-500/40 transition-all"
                  />
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => handleAddRule(cat)}
                      className="text-[10px] text-emerald-400 font-black uppercase
                                 tracking-widest hover:text-emerald-300 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingRuleFor(null); setNewRuleText(""); }}
                      className="text-[10px] text-white/80 font-black uppercase
                                 tracking-widest hover:text-white/80 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
          
              {/* Empty state */}
              {writingRules[cat].length === 0 && addingRuleFor !== cat && (
                <p className="text-[11px] text-white/60 italic">No rules yet.</p>
              )}
          
            </div>
          ))}
          </div>
        </section>

        {/* API & CONNECTION */}
        <section className="space-y-4 pt-8 border-t border-white/70">
          <div>
            <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-black">
              API & Connection
            </label>
            <p className="text-[10px] text-white/90 mt-1 leading-relaxed">
              Manage your service connections.
            </p>
          </div>

          <div className="p-6 bg-white/30 border border-white/70 rounded-sm space-y-6">
            <div className="space-y-4">
              <h4 className="text-[10px] text-white uppercase tracking-widest font-bold">Gemini API Key</h4>
              <p className="text-xs text-white leading-relaxed">
                The Gemini API key is platform-managed by default. To use a custom paid key, enter it below. It will be stored in your browser's local storage.
              </p>
              
              <div className="space-y-2">
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Enter custom Gemini API Key..."
                  className="w-full bg-black/40 border border-white/70 p-3 rounded-sm text-xs text-white focus:border-emerald-500/30 outline-none"
                />
                <button
                  onClick={handleSaveCustomKey}
                  className="w-full bg-emerald-500/20 text-emerald-300 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-colors"
                >
                  Save Custom Key
                </button>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <div className={`w-1.5 h-1.5 rounded-full ${customApiKey ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></div>
                <span className="text-[10px] text-white uppercase tracking-widest">
                  {customApiKey ? 'Using Custom Key' : 'Platform Managed'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/60 space-y-3">
              <h4 className="text-[10px] text-white uppercase tracking-widest font-bold">Third-Party Secrets</h4>
              <p className="text-xs text-white leading-relaxed">
                For other services (Stripe, OpenAI, etc.), use the <strong>Settings</strong> menu in the top right of the editor. 
                Secrets added there are securely injected into your environment.
              </p>
              <div className="p-3 bg-black/20 rounded-sm border border-white/60">
                <code className="text-[10px] text-amber-500 font-mono">process.env.YOUR_SECRET_NAME</code>
              </div>
            </div>
          </div>
        </section>

        <div className="pt-8 border-t border-white/70">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSave();
            }}
            className="w-full bg-amber-500 text-black py-4 rounded-sm text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition-all cursor-pointer"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupPanel;
