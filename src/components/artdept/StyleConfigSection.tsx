import React, { useState, useEffect } from 'react';
import { useStore } from '../../StoreContext';
import { STYLE_PRESETS } from '../../stylePresets';
import AutoResizingTextarea from '../shared/AutoResizingTextarea';
import { suggestField } from '../../geminiService';

export const StyleConfigSection: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  const [localPositive, setLocalPositive] = useState(currentShow?.styleConfig.positivePrompt || '');
  const [localNegative, setLocalNegative] = useState(currentShow?.styleConfig.negativePrompt || '');
  const [localComposition, setLocalComposition] = useState(currentShow?.styleConfig.compositionPrompt || '');
  const [localComicPositive, setLocalComicPositive] = useState(currentShow?.comicStyle?.artistStyle || '');
  const [localComicNegative, setLocalComicNegative] = useState(currentShow?.comicStyle?.negativePrompt || '');
  const [localComicComposition, setLocalComicComposition] = useState(currentShow?.comicStyle?.compositionPrompt || '');
  const [localCoverTreatment, setLocalCoverTreatment] = useState(currentShow?.coverTreatmentPrompt || '');
  const [localCode, setLocalCode] = useState(currentShow?.showCode || '');
  const [showWarning, setShowWarning] = useState<string | null>(null);
  const [isAutofilling, setIsAutofilling] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!currentShow) return;
    setLocalPositive(currentShow.styleConfig.positivePrompt);
    setLocalNegative(currentShow.styleConfig.negativePrompt || '');
    setLocalComposition(currentShow.styleConfig.compositionPrompt || '');
    setLocalComicPositive(currentShow.comicStyle?.artistStyle || '');
    setLocalComicNegative(currentShow.comicStyle?.negativePrompt || '');
    setLocalComicComposition(currentShow.comicStyle?.compositionPrompt || '');
    setLocalCoverTreatment(currentShow.coverTreatmentPrompt || '');
    setLocalCode(currentShow.showCode || '');
  }, [currentShow?.id]);

  if (!currentShow) return null;

  const handleAutofill = async (field: string, label: string) => {
    if (!currentShow) return;
    const key = `art-${field}`;
    setIsAutofilling(prev => ({ ...prev, [key]: true }));
    try {
      const context = `Show Title: ${currentShow.titleSuggestion || currentShow.name}\nPremise: ${currentShow.premise}`;
      const suggestion = await suggestField(currentShow, label, context);
      
      if (field === 'comicPositive') setLocalComicPositive(suggestion);
      else if (field === 'comicNegative') setLocalComicNegative(suggestion);
      else if (field === 'comicComposition') setLocalComicComposition(suggestion);
      else if (field === 'coverTreatment') setLocalCoverTreatment(suggestion);
      else if (field === 'basePositive') setLocalPositive(suggestion);
      else if (field === 'baseNegative') setLocalNegative(suggestion);
      else if (field === 'baseComposition') setLocalComposition(suggestion);
    } finally {
      setIsAutofilling(prev => ({ ...prev, [key]: false }));
    }
  };

  const isBaseDirty =
    localPositive !== (currentShow?.styleConfig.positivePrompt ?? '') ||
    localNegative !== (currentShow?.styleConfig.negativePrompt ?? '') ||
    localComposition !== (currentShow?.styleConfig.compositionPrompt ?? '') ||
    localCode !== (currentShow?.showCode ?? '');

  const isComicDirty =
    localComicPositive !== (currentShow?.comicStyle?.artistStyle ?? '') ||
    localComicNegative !== (currentShow?.comicStyle?.negativePrompt ?? '') ||
    localComicComposition !== (currentShow?.comicStyle?.compositionPrompt ?? '') ||
    localCoverTreatment !== (currentShow?.coverTreatmentPrompt ?? '');

  const handleSaveBaseStyle = () => {
    dispatch({ 
      type: 'UPDATE_SHOW', 
      updates: { 
        styleConfig: { 
          ...currentShow.styleConfig, 
          positivePrompt: localPositive, 
          negativePrompt: localNegative,
          compositionPrompt: localComposition || undefined,
        },
        showCode: localCode
      } 
    });
  };

  const handleSaveComic = () => {
    dispatch({
      type: 'UPDATE_COMIC_STYLE',
      comicStyle: {
        artistStyle: localComicPositive,
        colorPalette: currentShow.comicStyle?.colorPalette || '',
        lineWeight: currentShow.comicStyle?.lineWeight || '',
        negativePrompt: localComicNegative || undefined,
        compositionPrompt: localComicComposition || undefined,
      }
    });
    dispatch({
      type: 'UPDATE_SHOW',
      updates: {
        coverTreatmentPrompt: localCoverTreatment || undefined,
      },
    });
  };

  const applyPreset = (name: string, pos: string, neg: string, category: 'comics' | 'live-action' | 'animation', composition?: string) => {
    const isComics = category === 'comics';
    const existing = isComics ? localComicPositive : localPositive;
    const isCustom = existing.trim() !== '' && !STYLE_PRESETS.some(p => p.pos === existing.trim());
    if (isCustom && showWarning !== name) {
      setShowWarning(name);
      setTimeout(() => setShowWarning(null), 3000);
      return;
    }
    setShowWarning(null);
    if (isComics) {
      setLocalComicPositive(pos);
      setLocalComicNegative(neg);
      if (composition !== undefined) setLocalComicComposition(composition);
    } else {
      setLocalPositive(pos);
      setLocalNegative(neg);
      if (composition !== undefined) setLocalComposition(composition);
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
      <header className="flex items-center justify-between border-b border-white/70 pb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Art Department</h2>
          <p className="text-xs text-white uppercase tracking-widest font-black">Visual Register & Aesthetic Engine</p>
        </div>
        <div className="flex items-center gap-4">
          {(isBaseDirty || isComicDirty) && (
            <span className="text-xs text-amber-500 uppercase tracking-widest animate-pulse font-black">
              Unsaved
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-12">
          
          {/* COMIC STYLE SECTION */}
          <section className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs text-blue-400 uppercase tracking-widest font-black">
                Comic Lab Style
              </label>
              {isComicDirty && (
                <button onClick={handleSaveComic} className="text-xs text-blue-400 font-black uppercase tracking-widest hover:text-blue-300 transition-colors">
                  Commit Comic Style
                </button>
              )}
            </div>
            <AutoResizingTextarea
              value={localComicPositive}
              onChange={(e) => setLocalComicPositive(e.target.value)}
              onAutofill={() => handleAutofill('comicPositive', 'Comic Art Style')}
              isAutofilling={isAutofilling['art-comicPositive']}
              placeholder="Comic art style: artist reference, rendering technique, ink weight..."
              className="bg-white/30 border-white/70 text-sm text-white leading-relaxed"
            />
            <p className="text-xs text-white">
              Applied in Comic Lab only. Video Lab style is unaffected.
            </p>
            
            <div className="pt-4">
              <label className="text-xs text-red-500 uppercase tracking-widest font-black block mb-4">Comic Negative Constraints</label>
              <AutoResizingTextarea
                value={localComicNegative}
                onChange={(e) => setLocalComicNegative(e.target.value)}
                onAutofill={() => handleAutofill('comicNegative', 'Comic Negative Constraints')}
                isAutofilling={isAutofilling['art-comicNegative']}
                placeholder="e.g. photorealistic, CGI, 3D render, blurry"
                className="bg-white/30 border-white/70 text-xs text-white font-mono"
              />
            </div>
            
            <div className="pt-4">
              <label className="text-xs uppercase tracking-widest text-white font-bold block mb-4">Comic Composition</label>
              <AutoResizingTextarea
                value={localComicComposition}
                onChange={(e) => setLocalComicComposition(e.target.value)}
                onAutofill={() => handleAutofill('comicComposition', 'Comic Composition')}
                isAutofilling={isAutofilling['art-comicComposition']}
                placeholder="Comic staging — panel arrangement, figure placement..."
                className="bg-white/30 border-white/70 text-xs text-white leading-relaxed"
              />
            </div>


          </section>

          {/* COVER TREATMENT SECTION */}
          <section className="space-y-4 pt-8 border-t border-white/70">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-xs text-purple-400 uppercase tracking-widest font-black">
                  Cover Treatment
                </label>
                <p className="text-xs text-white mt-1">
                  Graphic design applied as pass 2 of cover generation.
                  Leave blank for single-pass output.
                </p>
              </div>
              {localCoverTreatment !== (currentShow?.coverTreatmentPrompt ?? '') && (
                <button
                  onClick={() => dispatch({ type: 'UPDATE_SHOW',
                    updates: { coverTreatmentPrompt: localCoverTreatment || undefined } })}
                  className="text-xs text-purple-400 font-black uppercase tracking-widest
                    hover:text-purple-300 transition-colors"
                >
                  Commit Treatment
                </button>
              )}
            </div>
            <AutoResizingTextarea
              value={localCoverTreatment}
              onChange={(e) => setLocalCoverTreatment(e.target.value)}
              onAutofill={() => handleAutofill('coverTreatment', 'Cover Treatment')}
              isAutofilling={isAutofilling['art-coverTreatment']}
              placeholder={
                "Describe the cover graphic design to apply over the generated image.\n\n" +
                "Example: Comic book cover header occupying top quarter. Flat white background. Heavy bold sans-serif title centred. Publisher block top-left with dark box and white star. Issue number and year adjacent. Thin rule below title. All-caps government label subtitle. Retail barcode bottom-right. No fire, no glow, no fantasy typography."
              }
              className="bg-white/30 border-white/70 text-sm text-white leading-relaxed"
            />
            {currentShow.coverTreatmentPrompt && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400/60" />
                <p className="text-xs text-purple-400 uppercase tracking-widest font-black">
                  Treatment active — covers will use two-pass generation
                </p>
              </div>
            )}
          </section>

          {/* BASE VISUAL STYLE SECTION */}
          <section className="space-y-4 pt-8 border-t border-white/70">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs text-amber-500 uppercase tracking-widest font-black">
                Base Visual Style
              </label>
              {isBaseDirty && (
                <button onClick={handleSaveBaseStyle} className="text-xs text-amber-500 font-black uppercase tracking-widest hover:text-amber-400 transition-colors">
                  Commit Base Style
                </button>
              )}
            </div>
            <AutoResizingTextarea
              value={localPositive}
              onChange={(e) => setLocalPositive(e.target.value)}
              onAutofill={() => handleAutofill('basePositive', 'Base Visual Style')}
              isAutofilling={isAutofilling['art-basePositive']}
              className="bg-white/30 border-white/70 text-sm text-white leading-relaxed"
              placeholder="Describe the visual language: lighting, camera, texture, color palette..."
            />
            <p className="text-xs text-white">This prompt anchors all image generation for the series.</p>
            
            <div className="pt-4">
              <label className="text-xs text-red-500 uppercase tracking-widest font-black block mb-4">Negative Constraints</label>
              <AutoResizingTextarea
                value={localNegative}
                onChange={(e) => setLocalNegative(e.target.value)}
                onAutofill={() => handleAutofill('baseNegative', 'Base Negative Constraints')}
                isAutofilling={isAutofilling['art-baseNegative']}
                className="bg-white/30 border-white/70 text-xs text-white font-mono"
                placeholder="e.g. CGI, cartoon, oversaturated, lens flare"
              />
            </div>
            
            <div className="pt-4">
              <label className="text-xs uppercase tracking-widest text-white font-bold block mb-4">Composition</label>
              <AutoResizingTextarea
                value={localComposition}
                onChange={(e) => setLocalComposition(e.target.value)}
                onAutofill={() => handleAutofill('baseComposition', 'Base Composition')}
                isAutofilling={isAutofilling['art-baseComposition']}
                placeholder="Staging and figure arrangement — e.g. three-character ensemble, conspiracy wall behind..."
                className="bg-white/30 border-white/70 text-xs text-white leading-relaxed"
              />
              <p className="text-xs text-white leading-relaxed mt-2">
                Describes staging, figure count, spatial arrangement, and set-dressing. Applied independently of visual style.
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="glass p-8 space-y-4">
            <label className="text-xs text-white uppercase tracking-widest font-black">Production Code</label>
            <input
              type="text"
              value={localCode}
              onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
              className="w-full bg-white/30 border border-white/70 p-4 rounded-sm text-xl font-mono text-white text-center tracking-[0.2em] focus:border-amber-500/30 outline-none transition-all"
              maxLength={4}
            />
            <p className="text-xs text-white text-center uppercase tracking-widest">Unique 3-4 letter ID for assets</p>
          </section>

          <section className="space-y-6">
            <h3 className="text-xs text-white uppercase tracking-widest font-black">Style Presets</h3>
            {(['comics', 'live-action', 'animation'] as const).map(cat => {
              const labels = {
                comics: 'Comic Art',
                'live-action': 'Live Action',
                animation: 'Animation',
              };
              const presets = STYLE_PRESETS.filter(p => p.category === cat);
              return (
                <div key={cat} className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-white font-bold">
                    {labels[cat]}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {presets.map(style => (
                      <button
                        key={style.name}
                        onClick={() => applyPreset(style.name, style.pos, style.neg, cat, style.composition)}
                        className={`p-2 border text-left flex flex-col gap-0.5 transition-all ${
                          showWarning === style.name
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 animate-pulse'
                            : 'border-white/70 bg-white/30 hover:bg-white/50 hover:border-white/200 text-white'
                        }`}
                      >
                        <span className="text-xs uppercase tracking-widest font-bold leading-tight">
                          {style.name}
                        </span>
                        <span className="text-xs text-white uppercase tracking-wider leading-tight">
                          {style.register}
                        </span>
                        {showWarning === style.name && (
                          <span className="text-xs text-amber-500">tap again to apply</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
};
