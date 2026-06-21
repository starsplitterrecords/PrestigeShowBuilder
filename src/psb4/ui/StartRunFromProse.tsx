import React, { useState } from 'react';
import { useStore } from '../../StoreContext';
import { computeExportHash } from '../reader/hash';
import { createRun, failRun } from '../storage';
import { readSource } from '../reader';
 
// StartRunFromProse — DA-091 (Plan B)
// Author-facing entry to GNDS: paste freeform prose and start a run directly
// from it, with no flatten-the-show step. The pasted text IS the teleplay
// source. It mirrors StartRunAction exactly, except the payload is the prose
// string instead of getCurrentExportForShow(show). The existing reader detects
// it as psb3-prose / band D, segments it, reconciles speakers against the
// show's existing roster (characters-first), and flags any unrecognized
// speaker — so unresolved names surface as flags rather than silently passing.
//
// Requires: the show must already have its character roster established
// (via the bible/concept path or mining). Speakers in the prose are matched
// to that roster; unknown names are flagged for you to resolve.
 
export const StartRunFromProse: React.FC = () => {
  const { state, dispatch } = useStore();
  const show = state.currentShow;
  const [prose, setProse] = useState('');
  const [busy, setBusy] = useState(false);
 
  const rosterCount = show?.characters?.length ?? 0;
  const canStart = !!show && prose.trim().length > 0 && rosterCount > 0 && !busy;
 
  const start = async () => {
    if (!show || !canStart) return;
    setBusy(true);
    const showId = show.id;
    const payload = prose; // raw string => detect.ts classifies as psb3-prose / band D
    try {
      const hash = computeExportHash(payload);
      let run;
      try {
        run = await createRun(showId, hash);
      } catch (e: any) {
        dispatch({
          type: 'ADD_TOAST',
          toast: { id: Date.now() + '_run', type: 'info', message: 'An active run already exists. Open it from history.' },
        });
        setBusy(false);
        return;
      }
      try {
        await readSource(run.id, payload);
      } catch (innerErr) {
        try { await failRun(run.id); } catch { /* noop */ }
        throw innerErr;
      }
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_ok', type: 'success', message: `GNDS run started from prose — source hash ${hash.substring(0, 8)}.` },
      });
    } catch (err: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now() + '_err', type: 'error', message: err?.message || 'Failed to start GNDS run from prose.' },
      });
    } finally {
      setBusy(false);
    }
  };
 
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Start from prose</span>
        <span className="text-[10px] text-white/40">paste a script / scenes — no export needed</span>
      </div>
 
      <p className="text-xs text-white/60 leading-relaxed">
        Paste your teleplay or scene prose directly. It becomes the GNDS source as-is —
        speakers are matched to this show’s existing characters. Establish the character
        roster first; unknown names will be flagged on the run for you to reconcile.
      </p>
 
      <textarea
        value={prose}
        onChange={e => setProse(e.target.value)}
        placeholder="Paste freeform prose here — a scene, a sequence, a full teleplay…"
        spellCheck={false}
        className="w-full min-h-[220px] rounded-lg border border-white/10 bg-black/30 focus:border-amber-500/40 p-4 text-sm text-white/85 leading-relaxed font-serif outline-none resize-y"
      />
 
      {rosterCount === 0 && (
        <div className="text-[11px] text-amber-300/90">
          This show has no characters yet. Establish the roster first (Concept → bible, or Characters) so speakers can be matched.
        </div>
      )}
 
      <button
        onClick={start}
        disabled={!canStart}
        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
          canStart ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
      >
        {busy ? 'Starting…' : 'Start GNDS run from prose'}
      </button>
    </div>
  );
};
