import React, { useState, useEffect } from 'react';
import { useStore } from '../StoreContext';
import { useProductionPipeline } from '../hooks/useProductionPipeline';
import AutoResizingTextarea from './shared/AutoResizingTextarea';
import { suggestField } from '../geminiService';
import { 
  Sparkles, 
  Save, 
  RefreshCw, 
  Book, 
  FileText,
  ShieldCheck,
  Layout,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

const ConceptPanel: React.FC = () => {
  const { state, dispatch, save } = useStore();
  const { currentShow } = state;
  const { run, isRunning } = useProductionPipeline();
  const [localPremise, setLocalPremise] = useState(currentShow?.premise || '');
  const [localThemes, setLocalThemes] = useState(currentShow?.themes || '');
  const [localRichInput, setLocalRichInput] = useState(currentShow?.richInput || '');
  const [isAutofilling, setIsAutofilling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentShow) return;
    setLocalPremise(currentShow.premise || '');
    setLocalThemes(currentShow.themes || '');
    setLocalRichInput(currentShow.richInput || '');
  }, [currentShow?.id]);

  if (!currentShow) return null;

  const handleAutofill = async (field: 'premise' | 'themes', label: string) => {
    if (!currentShow) return;
    const key = `show-${field}`;
    setIsAutofilling(prev => ({ ...prev, [key]: true }));
    try {
      const context = `Show Title: ${currentShow.titleSuggestion || currentShow.name}\nPremise: ${currentShow.premise}`;
      const suggestion = await suggestField(currentShow, label, context);
      if (field === 'premise') setLocalPremise(suggestion);
      else setLocalThemes(suggestion);
    } finally {
      setIsAutofilling(prev => ({ ...prev, [key]: false }));
    }
  };

  const isDirty =
    localPremise !== (currentShow?.premise ?? '') ||
    localThemes !== (currentShow?.themes ?? '') ||
    localRichInput !== (currentShow?.richInput ?? '');

  const handleSave = async () => {
    const nextShow = {
      ...currentShow,
      premise: localPremise,
      themes: localThemes,
      richInput: localRichInput,
      lastModified: Date.now()
    };
    dispatch({ 
      type: 'UPDATE_SHOW', 
      updates: { 
        premise: localPremise, 
        themes: localThemes,
        richInput: localRichInput
      } 
    });
    await save(nextShow);
  };

  const handleExpand = () => {
    run({ scope: 'show' });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070707] text-white p-6 md:p-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full space-y-12">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-500">
              <Book size={20} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Series Bible</span>
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Foundation</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {isDirty && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black">Unsaved Changes</span>
              </motion.div>
            )}
            <button 
              onClick={handleSave}
              disabled={!isDirty}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
            >
              <Save size={14} />
              Save Foundation
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* LEFT COLUMN: FOUNDATION BIBLE */}
          <div className="lg:col-span-5 space-y-10">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-white/60">
                <ShieldCheck size={14} />
                <h2 className="text-[11px] font-black uppercase tracking-widest">Immutable Foundation</h2>
              </div>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-amber-500/60 uppercase tracking-widest font-black">Core Premise</label>
                </div>
                <AutoResizingTextarea
                  value={localPremise}
                  onChange={(e) => setLocalPremise(e.target.value)}
                  onAutofill={() => handleAutofill('premise', 'Core Premise')}
                  isAutofilling={isAutofilling['show-premise']}
                  className="bg-white/5 border-white/10 text-sm text-white leading-relaxed focus:border-amber-500/50 transition-colors"
                  placeholder="Describe the core engine of the show..."
                />
              </section>

              <section className="space-y-4">
                <label className="text-[10px] text-amber-500/60 uppercase tracking-widest font-black">Thematic Keywords</label>
                <AutoResizingTextarea
                  value={localThemes}
                  onChange={(e) => setLocalThemes(e.target.value)}
                  onAutofill={() => handleAutofill('themes', 'Thematic Keywords')}
                  isAutofilling={isAutofilling['show-themes']}
                  className="bg-white/5 border-white/10 text-xs text-white font-mono focus:border-amber-500/50 transition-colors"
                  placeholder="e.g. Isolation, Corporate Greed, Transhumanism"
                />
              </section>
            </div>

            {currentShow.initMode === 'mine' && (
              <div className="p-6 rounded-lg bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-white/60">
                  <FileText size={14} />
                  <h3 className="text-[11px] font-black uppercase tracking-widest">Source Document</h3>
                </div>
                <AutoResizingTextarea
                  value={localRichInput}
                  onChange={(e) => setLocalRichInput(e.target.value)}
                  className="bg-black/40 border-white/10 text-[11px] text-white/80 leading-relaxed font-mono focus:border-amber-500/50 transition-colors"
                  placeholder="Paste your source document here..."
                />
                <p className="text-[10px] text-white/60 uppercase tracking-widest">Original author input preserved as source of truth.</p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: REVIEW OUTLINE */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/60">
                <Layout size={14} />
                <h2 className="text-[11px] font-black uppercase tracking-widest">Review Outline</h2>
              </div>
              
              <button 
                onClick={handleExpand}
                disabled={isRunning}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-amber-500/10"
              >
                {isRunning ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {currentShow.expandedBible ? 'Re-Draft Outline' : 'Generate Outline'}
              </button>
            </div>

            <div className={`relative min-h-[400px] rounded-lg border transition-all ${currentShow.expandedBible ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-dashed border-white/20 flex items-center justify-center'}`}>
              {currentShow.expandedBible ? (
                <div className="p-8 text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-serif">
                  {currentShow.expandedBible}
                </div>
              ) : (
                <div className="text-center space-y-4 max-w-xs">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                    <Sparkles size={20} className="text-white/60" />
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    The Review Outline expands your foundation into a comprehensive world-building document.
                  </p>
                </div>
              )}
              
              {isRunning && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw size={32} className="text-amber-500 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">AI Mining in Progress...</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="p-2 rounded bg-blue-500/20 text-blue-400">
                <Info size={16} />
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Workflow Note</h4>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  The Review Outline is used to prime character and setting generation. If you change the Foundation, you should Re-Draft the Outline to keep them in sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConceptPanel;
