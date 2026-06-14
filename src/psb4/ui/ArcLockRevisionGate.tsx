import React, { useState, useEffect, useRef } from 'react';
import { Psb4Run } from '../types';
import { setArcLockNotes, autoApproveBlankNotes } from '../storage';
import { PenLine, Check } from 'lucide-react';

interface ArcLockRevisionGateProps {
  run: Psb4Run;
  arcLockComplete: boolean;   // true when 0.8A artifact exists
  onNotesSaved: (notes: string) => void;
}

export const ArcLockRevisionGate: React.FC<ArcLockRevisionGateProps> = ({
  run,
  arcLockComplete,
  onNotesSaved,
}) => {
  const [notes, setNotes] = useState<string>(run.arcLockNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with prop changes (e.g., when run loaded)
  useEffect(() => {
    if (run.arcLockNotes !== undefined && run.arcLockNotes !== notes && !hasUnsavedChanges) {
      setNotes(run.arcLockNotes || '');
    }
  }, [run.arcLockNotes]);

  // Handle textarea auto-resize
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const computedHeight = Math.min(Math.max(textarea.scrollHeight, 80), 240);
      textarea.style.height = `${computedHeight}px`;
    }
  }, [notes]);

  if (!arcLockComplete) {
    return null;
  }

  const performSave = async (notesToSave: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setIsSaving(true);
    try {
      await setArcLockNotes(run.id, notesToSave);
      onNotesSaved(notesToSave);
      setHasUnsavedChanges(false);
      setShowCheckmark(true);
      setTimeout(() => setShowCheckmark(false), 2000);
    } catch (err) {
      console.error('Error saving revision notes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    setHasUnsavedChanges(true);

    // Debounced auto-save (500ms)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSave(val);
    }, 500);
  };

  const handleBlur = () => {
    if (hasUnsavedChanges) {
      performSave(notes);
    }
  };

  const handleManualSave = (e: React.MouseEvent) => {
    e.preventDefault();
    performSave(notes);
  };

  const handleSkip = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await autoApproveBlankNotes(run.id);
      onNotesSaved("(Skipped / Auto-approved blank notes)");
    } catch (err) {
      console.error('Error auto-approving blank notes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="p-3 my-2 border-l-2 border-amber-500 border-t border-r border-b border-white/10 rounded-r bg-[#111111] space-y-2"
      id="psb4_arc_lock_revision_gate"
    >
      <div className="flex items-center gap-1.5">
        <PenLine size={13} className="text-amber-400" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
          Authorial Notes
        </span>
      </div>

      <p className="text-[10px] text-white/60 leading-normal font-sans">
        Write revision notes before running 0.8R and 0.8RA. Notes are saved to this run and persist across sessions.
      </p>

      <textarea
        ref={textareaRef}
        value={notes}
        onChange={handleTextareaChange}
        onBlur={handleBlur}
        placeholder="E.g. — Move episode 3 climax to episode 4. Strengthen Bjorn's arc turn in episode 6. Remove the subplot about the permit office until it can be better motivated..."
        rows={4}
        className="w-full bg-[#070707] border border-white/10 rounded px-2.5 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-amber-500/50 resize-none font-sans leading-relaxed"
        id="arc_lock_notes_textarea"
      />

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-mono text-white/50">
          {isSaving ? (
            <span className="text-amber-400 animate-pulse">Saving...</span>
          ) : showCheckmark ? (
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <Check size={10} /> Saved
            </span>
          ) : hasUnsavedChanges ? (
            <span className="text-amber-400 animate-pulse">Unsaved changes</span>
          ) : (
            <span className="text-white/50">Notes saved</span>
          )}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSkip}
            disabled={isSaving}
            className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400 hover:text-sky-300 bg-sky-950/20 px-2 py-1 rounded border border-sky-500/20 focus:outline-none transition-colors"
            id="skip_notes_btn"
            title="Skip and auto-approve un-revised clean spine & arc ladder"
          >
            Skip Notes
          </button>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 bg-amber-950/20 px-2 py-1 rounded border border-amber-500/10 focus:outline-none focus:ring-1 focus:ring-amber-500/35 transition-colors"
            id="save_notes_btn"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
};
