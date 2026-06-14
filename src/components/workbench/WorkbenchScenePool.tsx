import React, { useEffect, useState, useMemo } from 'react';
import { loadScenePool, insertPoolSceneIntoIssue, PoolSceneEntry } from '../../utils/production/scenePoolUtils';
import { Show } from '../../types/show';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

interface WorkbenchScenePoolProps {
  show: Show;
  focusedPageUid?: string;
  issueUid?: string;
  dispatch: (action: any) => void;
}

export const WorkbenchScenePool: React.FC<WorkbenchScenePoolProps> = ({
  show,
  focusedPageUid,
  issueUid,
  dispatch,
}) => {
  const [open, setOpen] = useState(false);
  const [poolEntries, setPoolEntries] = useState<PoolSceneEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show.id) {
      setLoading(true);
      loadScenePool(show.id)
        .then((entries) => {
          setPoolEntries(entries);
          setLoading(false);
        })
        .catch((err) => {
          console.error('[ScenePool] Failed to load scene pool:', err);
          setLoading(false);
        });
    }
  }, [show.id]);

  // Group by character
  const groupedByCharacter = useMemo(() => {
    const map: Record<string, PoolSceneEntry[]> = {};
    poolEntries.forEach((entry) => {
      const chars = entry.characters && entry.characters.length > 0 
        ? entry.characters 
        : ['General / Solo'];
      chars.forEach((char) => {
        if (!map[char]) map[char] = [];
        if (!map[char].some(e => e.artifactId === entry.artifactId && e.sceneIndex === entry.sceneIndex)) {
          map[char].push(entry);
        }
      });
    });
    return map;
  }, [poolEntries]);

  // Only render section if pool entries exist
  if (poolEntries.length === 0) return null;

  const handleInsert = async (entry: PoolSceneEntry, version: 'full' | 'compressed' | 'single') => {
    if (!focusedPageUid || !issueUid) {
      console.warn('[ScenePool] No active issue selection or focused page to insert after');
      return;
    }
    try {
      await insertPoolSceneIntoIssue(show, entry, version, focusedPageUid, issueUid, dispatch);
    } catch (err) {
      console.error('[ScenePool] Insertion failed:', err);
    }
  };

  return (
    <div className="border-t border-white/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-3 text-left flex items-center justify-between hover:bg-white/5 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
            Scene Pool
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/60 text-[10px] bg-white/10 px-1.5 py-0.5 rounded-sm">
            {poolEntries.length} scenes
          </span>
          {open ? (
            <ChevronDown size={14} className="text-white/60" />
          ) : (
            <ChevronRight size={14} className="text-white/60" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-4 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {Object.entries(groupedByCharacter).map(([character, entries]) => (
            <div key={character} className="space-y-2">
              {/* Group Character Header */}
              <div className="text-[10px] font-black tracking-wider text-amber-400 uppercase border-b border-white/5 pb-1 mb-1.5">
                {character}
              </div>

              <div className="space-y-2 pl-1">
                {entries.map((entry, idx) => (
                  <div
                    key={`${entry.artifactId}-${entry.sceneIndex}-${idx}`}
                    className="p-2 rounded bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-bold text-white/95 leading-snug">
                        {entry.title}
                      </p>
                      
                      <p className="text-[10px] text-white/70 leading-relaxed font-sans">
                        <span className="font-semibold text-white/80">Functional Goal:</span> {entry.emotionalFunction}
                      </p>

                      <p className="text-[10px] text-white/60 font-mono italic leading-normal">
                        Suggestion: {entry.placementSuggestion}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(['full', 'compressed', 'single'] as const).map((v) => {
                          const isEligible = !!focusedPageUid && !!issueUid;
                          return (
                            <button
                              key={v}
                              disabled={!isEligible}
                              onClick={() => handleInsert(entry, v)}
                              title={
                                isEligible
                                  ? `Insert ${v} version after current page`
                                  : 'Select a page in the outline first'
                              }
                              className="text-[10px] px-2 py-0.5 font-black uppercase tracking-wider rounded bg-white/15 border border-white/10 text-white hover:bg-white/25 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
