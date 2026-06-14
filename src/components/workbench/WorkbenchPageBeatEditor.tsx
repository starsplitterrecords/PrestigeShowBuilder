import React, { useState, useEffect, useRef } from 'react';
import { PageBeat } from '../../types/production';
import { Show } from '../../types/models';
import { Sparkles } from 'lucide-react';
import { deriveCharactersForBeat } from '../../utils/characterUtils';

interface EditorFieldProps {
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (val: string) => void;
  onBlur: () => void;
}

const EditorField: React.FC<EditorFieldProps> = ({
  label,
  value,
  multiline,
  onChange,
  onBlur,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (multiline && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value, multiline]);

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-white/60 tracking-wider uppercase block">
        {label}
      </label>
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full bg-[#121316] text-xs border border-white/10 text-white/90 rounded p-2 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
          rows={2}
          placeholder={`Enter page ${label.toLowerCase()}...`}
        />
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full bg-[#121316] text-xs border border-white/10 text-white/90 rounded p-2 focus:outline-none focus:border-amber-500/50 leading-normal"
          placeholder={`Enter page ${label.toLowerCase()}...`}
        />
      )}
    </div>
  );
};

interface CharacterSelectorProps {
  characterIds: string[];
  show: Show;
  onChange: (ids: string[]) => void;
  pageBeat?: PageBeat;
}

const CharacterSelector: React.FC<CharacterSelectorProps> = ({
  characterIds,
  show,
  onChange,
  pageBeat,
}) => {
  const selectable = (show.characters ?? []).filter((c) => c.isMinor !== true);
  const currentIds = characterIds ?? [];

  const handleToggle = (id: string) => {
    if (currentIds.includes(id)) {
      onChange(currentIds.filter((x) => x !== id));
    } else {
      onChange([...currentIds, id]);
    }
  };

  const handleAutoDerive = () => {
    if (!pageBeat) return;
    const derived = deriveCharactersForBeat(pageBeat, show);
    const selectableIds = selectable.map((c) => c.id);
    const finalIds = derived.filter((id) => selectableIds.includes(id));
    onChange(finalIds);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-white/60 tracking-wider uppercase block">
          Character Roster
        </label>
        {pageBeat && (
          <button
            type="button"
            onClick={handleAutoDerive}
            className="text-[10px] text-amber-500 hover:text-amber-400 font-black uppercase tracking-widest flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/15 px-1.5 py-0.5 rounded cursor-pointer transition-colors border border-amber-500/20"
            title="Auto-select characters based on description, visual notes, dialogue and plans"
          >
            <Sparkles className="w-2.5 h-2.5" />
            Auto-Derive
          </button>
        )}
      </div>
      <div className="border border-white/10 rounded bg-[#121316] p-2 max-h-48 overflow-y-auto space-y-1.5 select-none scrollbar-thin scrollbar-thumb-white/10">
        {selectable.length > 0 ? (
          selectable.map((c) => {
            const isChecked = currentIds.includes(c.id);
            return (
              <label
                key={c.id}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/5 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(c.id)}
                  className="rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5"
                />
                <span className="text-white/90 font-medium truncate">{c.name}</span>
                {c.handle && (
                  <span className="text-white/50 text-[10px] font-mono ml-auto truncate">
                    {c.handle}
                  </span>
                )}
              </label>
            );
          })
        ) : (
          <p className="text-[10px] text-white/50 py-2 text-center select-text">
            No primary characters found.
          </p>
        )}
      </div>
    </div>
  );
};

interface WorkbenchPageBeatEditorProps {
  pageBeat: PageBeat;
  show: Show;
  updatePageBeat: (updates: Partial<PageBeat>) => void;
}

export const WorkbenchPageBeatEditor: React.FC<WorkbenchPageBeatEditorProps> = ({
  pageBeat,
  show,
  updatePageBeat,
}) => {
  const [local, setLocal] = useState({
    description: pageBeat?.description ?? '',
    visualNote: pageBeat?.visualNote ?? '',
    direction: pageBeat?.direction ?? '',
    subtext: pageBeat?.subtext ?? '',
  });

  useEffect(() => {
    if (pageBeat) {
      setLocal({
        description: pageBeat.description ?? '',
        visualNote: pageBeat.visualNote ?? '',
        direction: pageBeat.direction ?? '',
        subtext: pageBeat.subtext ?? '',
      });
    }
  }, [pageBeat?.uid]);

  const handleBlur = (field: keyof typeof local) => () => {
    if (!pageBeat) return;
    if (local[field] !== (pageBeat as any)[field]) {
      updatePageBeat({ [field]: local[field] });
    }
  };

  if (!pageBeat) {
    return (
      <div className="p-3 text-center">
        <p className="text-[10px] text-white/50 uppercase tracking-widest">
          No active page beat stashed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <EditorField
        label="Description"
        value={local.description}
        multiline
        onChange={(v) => setLocal((s) => ({ ...s, description: v }))}
        onBlur={handleBlur('description')}
      />
      <EditorField
        label="Visual Note"
        value={local.visualNote}
        multiline
        onChange={(v) => setLocal((s) => ({ ...s, visualNote: v }))}
        onBlur={handleBlur('visualNote')}
      />
      <EditorField
        label="Direction"
        value={local.direction}
        onChange={(v) => setLocal((s) => ({ ...s, direction: v }))}
        onBlur={handleBlur('direction')}
      />
      <EditorField
        label="Subtext"
        value={local.subtext}
        onChange={(v) => setLocal((s) => ({ ...s, subtext: v }))}
        onBlur={handleBlur('subtext')}
      />
      <CharacterSelector
        characterIds={pageBeat.characterIds ?? []}
        show={show}
        onChange={(ids) => updatePageBeat({ characterIds: ids })}
        pageBeat={pageBeat}
      />
    </div>
  );
};
