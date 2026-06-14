// WorkbenchPromptPanel.tsx — DA-082
// Shows the EXACT assembled prompt for the focused page, live, before any
// generation — sitting to the LEFT of the page image in the Scene Workbench
// middle column. Reads the same builder generateFinalComicPage uses, so what
// is shown is what gets sent. Also surfaces the reference manifest, a copy
// button, a continuity toggle, and the preflight verdict.
 
import React, { useMemo, useState } from 'react';
import { Show } from '../../types/show';
import { PageBeat, ProductionPage, ImageVersion } from '../../types/production';
import { buildPagePromptPreview, PagePromptPreview } from '../../ai/imageGeneration/finalPagePromptPreview';
import { resolveCanonicalCharacters } from '../../domainUtils';
 
interface Props {
  show: Show;
  pageBeat: PageBeat;
  page: ProductionPage;
  activeVersion?: ImageVersion | null;   // when present, show the EXACT prompt that produced it
  // live ref counts already resolved by the workbench preflight; pass through
  refCounts: { characterRefs: number; settingRefs: number; lockedRefs: number; priorPages: number };
  continuity: boolean;
  onToggleContinuity: (v: boolean) => void;
}
 
type ViewMode = 'live' | 'sent';
 
export function WorkbenchPromptPanel({
  show, pageBeat, page, activeVersion, refCounts, continuity, onToggleContinuity,
}: Props) {
  const [mode, setMode] = useState<ViewMode>('live');
  const [copied, setCopied] = useState(false);
 
  const characterNames = useMemo(() => {
    const res = resolveCanonicalCharacters(show, pageBeat.characterIds ?? []);
    return res.resolvedCharacters.map((c: any) => c.name || c.handle || c.id);
  }, [show, pageBeat]);
 
  const preview: PagePromptPreview = useMemo(
    () => buildPagePromptPreview(show, pageBeat.uid, refCounts, characterNames, continuity),
    [show, pageBeat, refCounts, characterNames, continuity]
  );
 
  // The exact prompt stored on the active version (post-generation truth).
  const sentPrompt: string | null =
    (activeVersion?.metadata && (activeVersion.metadata.prompt || activeVersion.metadata.compositePrompt)) || null;
 
  // DA-088: served-response diagnostics — distinguishes endpoint drift / degraded
  // returns from a clean Pro render when an image "suddenly looks different".
  const md: any = activeVersion?.metadata || {};
  const servedVersion: string | null = md.servedModelVersion ?? null;
  const finishReason: string | null = md.finishReason ?? null;
  const diagShown = mode === 'sent' && (servedVersion || finishReason);

  const shownPrompt = mode === 'sent' && sentPrompt ? sentPrompt : preview.fullPrompt;
 
  const copy = () => {
    navigator.clipboard?.writeText(shownPrompt).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1200);
    });
  };
 
  return (
    <div className="flex flex-col h-full bg-[#0b0b0d] border-r border-white/10 overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/40 shrink-0">
        <span className="w-2 h-2 rounded-sm" style={{ background: '#E5392B' }} />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/80 font-mono">Assembled prompt</span>
        <span className="text-[9px] uppercase tracking-wider text-white/35 font-mono">exactly what is sent</span>
        <div className="flex-1" />
        {sentPrompt && (
          <div className="flex rounded overflow-hidden border border-white/10">
            <button
              onClick={() => setMode('live')}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer ${mode === 'live' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
            >Live</button>
            <button
              onClick={() => setMode('sent')}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer ${mode === 'sent' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
            >This image</button>
          </div>
        )}
        <button onClick={copy} className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border border-white/10 text-white/60 hover:text-white hover:bg-white/10 cursor-pointer font-mono">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
 
      {/* preflight verdict */}
      {mode === 'live' && (preview.blocked || preview.warnings.length > 0) && (
        <div className="px-3 py-2 border-b border-white/10 shrink-0 space-y-1 font-mono" style={{ background: preview.blocked ? '#2a0f0c' : '#241d08' }}>
          {preview.errors.map((e, i) => (
            <div key={i} className="text-[10.5px] leading-snug" style={{ color: '#ff8d80' }}>⚠ {e}</div>
          ))}
          {preview.warnings.map((w, i) => (
            <div key={i} className="text-[10.5px] leading-snug" style={{ color: '#e9c46a' }}>• {w}</div>
          ))}
        </div>
      )}
      {mode === 'live' && !preview.blocked && preview.warnings.length === 0 && (
        <div className="px-3 py-1.5 border-b border-white/10 shrink-0 font-mono">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7CCf6A' }}>✓ Preflight clear — ready to generate</span>
        </div>
      )}

      {diagShown && (
        <div className="px-3 py-1.5 border-b border-white/10 shrink-0 text-[10px] font-mono"
          style={{ color: finishReason && finishReason !== 'STOP' ? '#e9c46a' : '#7f9cf5' }}>
          served: {servedVersion || 'unknown'}{finishReason ? ` · finish: ${finishReason}` : ''}
          {finishReason && finishReason !== 'STOP' ? ' · ⚠ non-STOP' : ''}
        </div>
      )}
 
      {/* the prompt */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/10">
        <pre className="text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-white/85" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', margin: 0 }}>
          {shownPrompt || '(no prompt — select a page)'}
        </pre>
      </div>
 
      {/* reference manifest */}
      <div className="border-t border-white/10 shrink-0 max-h-[34%] overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/10 font-mono">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2 font-mono">
          References passed → gemini-3-pro-image
        </div>
        {preview.manifest.length === 0 && (
          <div className="text-[10px] text-white/30 font-mono">text-only prompt — no references</div>
        )}
        <div className="space-y-1.5">
          {preview.manifest.map((m, i) => {
            const color = m.kind === 'character' ? '#E5392B' : m.kind === 'setting' ? '#36B6C4'
              : m.kind === 'prior' ? '#7CCf6A' : '#9b8cff';
            return (
              <div key={i} className="flex items-center gap-2.5 bg-black/30 border border-white/10 rounded px-2 py-1.5">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                <span className="text-[11px] text-white/85">{m.label}</span>
                {m.detail && <span className="text-[9.5px] text-white/35 ml-auto">{m.detail}</span>}
              </div>
            );
          })}
        </div>
 
        {/* continuity toggle — lives with the references it controls */}
        <label className="flex items-start gap-2 mt-3 cursor-pointer rounded px-2 py-2 border font-sans"
          style={{ borderColor: continuity ? '#7CCf6A55' : 'rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
          <input type="checkbox" checked={continuity} onChange={(e) => onToggleContinuity(e.target.checked)}
            className="mt-0.5" style={{ accentColor: '#7CCf6A' }} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: continuity ? '#7CCf6A' : 'rgba(255,255,255,0.55)' }}>
              Use previous page as reference
            </div>
            <div className="text-[10px] text-white/40 mt-0.5 leading-snug">
              {continuity
                ? 'The previous approved page is attached; the prompt asks for the following page in the book.'
                : 'Off — the previous page is not passed; this page renders on its own.'}
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
