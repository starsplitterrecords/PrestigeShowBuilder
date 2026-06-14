import React, { useState, useRef } from 'react';
import { useStore } from '../../StoreContext';
import { STYLE_PRESETS } from '../../stylePresets';
import { generateStyleTestImage, StyleTestResult } from '../../ai/imageGeneration/generateStyleTestImage';
import { generateStyleTestZip } from '../../utils/exports/styleTestZip';
import { Play, Square, Download, RotateCcw, AlertTriangle } from 'lucide-react';

export const EnsembleStyleTest: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;

  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'cancelled'>('idle');
  const [progress, setProgress] = useState<{ current: number; total: number; currentStyleName: string }>({
    current: 0,
    total: STYLE_PRESETS.length,
    currentStyleName: '',
  });
  const [results, setResults] = useState<StyleTestResult[]>([]);
  const [isZipping, setIsZipping] = useState(false);
  const abortRef = useRef<boolean>(false);

  if (!currentShow) return null;

  // Compute cast summaries
  const totalCount = currentShow.characters?.length || 0;
  const nonMinorChars = (currentShow.characters || []).filter(
    c => c.name?.trim() && !c.isMinor
  );
  const nonMinorCount = nonMinorChars.length;

  const charNames = (currentShow.characters || [])
    .map(c => c.name?.trim())
    .filter(Boolean);

  let charNamesStr = '';
  if (charNames.length > 6) {
    charNamesStr = charNames.slice(0, 6).join(', ') + `…and ${charNames.length - 6} more`;
  } else if (charNames.length > 0) {
    charNamesStr = charNames.join(', ');
  } else {
    charNamesStr = 'None';
  }

  // Check if there are any character descriptions
  const hasDescriptions = (currentShow.characters || []).some(
    c => c.physicalDescription?.trim() || c.visualAnchor?.trim()
  );

  const handleGenerate = async () => {
    abortRef.current = false;
    setStatus('running');
    setResults([]);
    const accumulated: StyleTestResult[] = [];

    for (let i = 0; i < STYLE_PRESETS.length; i++) {
      if (abortRef.current) {
        setStatus('cancelled');
        break;
      }
      const preset = STYLE_PRESETS[i];
      setProgress({
        current: i + 1,
        total: STYLE_PRESETS.length,
        currentStyleName: `${preset.name} — ${preset.register}`,
      });
      try {
        const result = await generateStyleTestImage(currentShow, preset);
        if (result) {
          accumulated.push(result);
        }
      } catch (err) {
        console.warn('[StyleTest] Failed for preset:', preset.name, err);
        // continue — skip failed presets, don't abort run
      }
      setResults([...accumulated]);
    }

    if (!abortRef.current) {
      if (accumulated.length === 0) {
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: Math.random().toString(),
            type: 'error',
            message: 'All style test image generations failed. Please check your API key.'
          }
        });
        setStatus('idle');
      } else {
        setStatus('done');
      }
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    setStatus('cancelled');
  };

  const handleDownload = async () => {
    if (results.length === 0) return;
    setIsZipping(true);
    try {
      const zip = await generateStyleTestZip(
        currentShow.titleSuggestion || currentShow.name,
        results
      );
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `${currentShow.showCode || 'SHOW'}_style_tests_${today}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[StyleTest] Zip Generation Failed:', err);
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Math.random().toString(),
          type: 'error',
          message: 'Could not create style tests zip.'
        }
      });
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
      <section className="space-y-4 pt-8 border-t border-white/70">
        <label className="text-xs text-green-400 uppercase tracking-widest font-black">
          Style Test Generator
        </label>

        {/* Cast Ensemble Summary */}
        <div className="bg-white/5 border border-white/10 rounded-sm p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-[11px] font-mono text-white/70 uppercase tracking-widest font-black">
                Cast Ensemble Summary
              </h4>
              <p className="text-xs text-white/60 mt-1">
                Only named, non-minor characters (or characters with physical/visual descriptions) are included in style tests (capped at 12 characters).
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded-sm border border-emerald-400/20">
                {nonMinorCount} Non-Minor / {totalCount} Total
              </span>
            </div>
          </div>
          <div className="text-xs text-white/60">
            <span className="text-white/60 font-medium">Included Characters: </span>
            <span className="font-mono text-white/90">{charNamesStr}</span>
          </div>
        </div>

        {/* Status Views */}
        {status === 'idle' && (
          <div className="space-y-4">
            <p className="text-xs text-white/60 leading-relaxed">
              Generate a full-cast promotional poster in memory for every style preset ({STYLE_PRESETS.length} presets total). When complete, a zip file containing all PNGs and a <code className="font-mono text-white/80 bg-white/10 px-1 py-0.5 rounded-sm">MANIFEST.txt</code> (with exact prompt formulas) will be downloaded automatically. No database storage or comic elements are modified in the cloud.
            </p>

            {!hasDescriptions && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 p-4 rounded-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-500 font-bold leading-normal">
                  Add character descriptions in the Characters panel before running style tests.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 bg-green-600/25 hover:bg-green-600/40 border border-green-500/50 hover:border-green-400 text-green-300 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Generate Style Tests
              </button>
            </div>
          </div>
        )}

        {status === 'running' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60 uppercase tracking-wider">Generating Style Suite...</span>
              <span className="font-mono text-green-400 font-bold bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-sm">
                {progress.current} / {progress.total}
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-green-400 h-full transition-all duration-300" 
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div className="font-mono text-[10px] text-white/60 truncate max-w-md">
                Current Style: <span className="text-emerald-400 font-semibold">{progress.currentStyleName}</span>
              </div>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 bg-red-600/25 hover:bg-red-600/40 border border-red-500/50 hover:border-red-400 text-red-300 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                Cancel Run
              </button>
            </div>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-4 pt-2">
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 uppercase tracking-widest font-black">
                Style Suite Completed! ({results.length} images successful)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={isZipping || results.length === 0}
                className="flex items-center gap-2 bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/50 hover:border-blue-400 text-blue-300 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {isZipping ? 'Zipping Suite...' : 'Download Suite Zip'}
              </button>
              <button
                onClick={() => { setStatus('idle'); setResults([]); }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/50 hover:border-white text-white/90 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Run Again
              </button>
            </div>
          </div>
        )}

        {status === 'cancelled' && (
          <div className="space-y-4 pt-2">
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-sm flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-amber-500 uppercase tracking-widest font-black">
                Suite Cancelled. (Generated {results.length} of {STYLE_PRESETS.length} styles)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {results.length > 0 && (
                <button
                  onClick={handleDownload}
                  disabled={isZipping}
                  className="flex items-center gap-2 bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/50 hover:border-blue-400 text-blue-300 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isZipping ? 'Zipping...' : `Download Partial Results (${results.length} of ${STYLE_PRESETS.length} styles)`}
                </button>
              )}
              <button
                onClick={() => { setStatus('idle'); setResults([]); }}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/50 hover:border-white text-white/90 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Run Again
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
