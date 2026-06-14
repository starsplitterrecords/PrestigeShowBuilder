import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Lock, Loader2 } from 'lucide-react';

interface EditableFieldProps {
  value: string;
  onCommit: (newValue: string) => void;
  placeholder?: string;
  multiline?: boolean;
  monospace?: boolean;       // for fid display in card headers
  readOnly?: boolean;        // when beat is locked
  label?: string;            // shown above the field
  className?: string;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  value,
  onCommit,
  placeholder = '',
  multiline = false,
  monospace = false,
  readOnly = false,
  label,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isPending, setIsPending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync internal value with external changes, clear pending state when external value aligns
  useEffect(() => {
    setLocalValue(value);
    setIsPending(false);
  }, [value]);

  // Handle auto-focus and auto-resize on edit mode enter
  useEffect(() => {
    if (isEditing) {
      if (multiline) {
        if (textareaRef.current) {
          textareaRef.current.focus();
          // select all text
          textareaRef.current.select();
          adjustTextareaHeight();
        }
      } else {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }
    }
  }, [isEditing, multiline]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Adjust height content-sized but cap at reasonable height with overflow
      textarea.style.height = `${Math.min(textarea.scrollHeight, 600)}px`;
    }
  };

  const handleStartEdit = () => {
    if (readOnly) return;
    setIsEditing(true);
    setLocalValue(value);
  };

  const commitAndExit = () => {
    setIsEditing(false);
    const trimmed = localValue.trim();
    if (trimmed !== value.trim()) {
      setIsPending(true);
      onCommit(trimmed);
    }
  };

  const handleCancel = () => {
    setLocalValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Enter') {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!multiline || isCmdOrCtrl) {
        e.preventDefault();
        commitAndExit();
      }
    }
  };

  // Determine CSS classes active
  const baseClass = monospace ? 'font-mono' : 'font-sans';
  const showPlaceholder = !localValue || localValue.trim() === '';

  // Component structure
  return (
    <div className={`space-y-1 select-none ${className}`} id={`field-container-${label?.replace(/\s+/g, '-').toLowerCase()}`}>
      {label && (
        <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-white/60">
          {readOnly && <Lock className="w-3 h-3 text-white/60 shrink-0" />}
          <span>{label}</span>
          {isPending && (
            <Loader2 className="w-3 h-3 text-amber-500 animate-spin shrink-0 ml-1" />
          )}
        </div>
      )}

      {isEditing ? (
        multiline ? (
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              adjustTextareaHeight();
            }}
            onBlur={commitAndExit}
            onKeyDown={handleKeyDown}
            rows={1}
            className={`w-full bg-[#141414] border border-amber-500/50 rounded-sm p-2 text-xs text-white leading-relaxed outline-none focus:ring-1 focus:ring-amber-500/30 transition-all resize-none overflow-y-auto block ${baseClass}`}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commitAndExit}
            onKeyDown={handleKeyDown}
            className={`w-full bg-[#141414] border border-amber-500/50 rounded-sm px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500/30 transition-all block ${baseClass}`}
            placeholder={placeholder}
          />
        )
      ) : (
        <div
          onClick={handleStartEdit}
          className={`group/field relative min-h-[32px] w-full rounded-sm py-1.5 px-2.5 border border-transparent transition-all flex items-center justify-between ${
            readOnly
              ? 'bg-transparent text-white/80'
              : 'hover:bg-white/[0.04] active:bg-white/[0.02] cursor-pointer'
          }`}
        >
          <div className={`text-xs leading-relaxed break-words whitespace-pre-wrap flex-1 ${baseClass} ${showPlaceholder ? 'text-white/40 italic' : 'text-white/90'}`}>
            {showPlaceholder ? placeholder : value}
          </div>

          {!readOnly ? (
            <div className="opacity-0 group-hover/field:opacity-100 p-1 rounded-sm text-white/60 group-hover/field:text-white/85 transition-all ml-2 shrink-0 flex items-center justify-center">
              <Pencil className="w-3 h-3" />
            </div>
          ) : (
            <div className="opacity-0 group-hover/field:opacity-100 p-1 rounded-sm text-white/60 transition-all ml-2 shrink-0 flex items-center justify-center">
              <Lock className="w-3 h-3 text-white/60" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
