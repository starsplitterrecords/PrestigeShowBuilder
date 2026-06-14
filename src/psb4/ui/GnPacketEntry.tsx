import React, { useState, useEffect } from 'react';
import { useStore } from '../../StoreContext';
import { GnPacket } from '../types';
import { 
  FileText, X, Check, ClipboardList, Wand2, Sparkles, Loader2, CheckCircle, AlertTriangle 
} from 'lucide-react';
import { autoFillGnPacket, generateGnPacketSuggestions } from './gnPacketUtils';

interface GnPacketEntryProps {
  hiddenTrigger?: boolean;
}

const PACKET_FIELDS: Array<{ key: keyof GnPacket; label: string; placeholder: string }> = [
  { key: 'title', label: 'Title', placeholder: 'e.g. Neon Shadows' },
  { key: 'genre', label: 'Genre', placeholder: 'e.g. Cyberpunk Noir / Psychological Thriller' },
  { key: 'format', label: 'Format', placeholder: 'e.g. 6-Issue Limited Series' },
  { key: 'targetLength', label: 'Target Length', placeholder: 'e.g. 24 pages per issue' },
  { key: 'issueCount', label: 'Issue Count', placeholder: 'e.g. 6' },
  { key: 'audience', label: 'Audience', placeholder: 'e.g. New Adult, fans of Akira and Blade Runner' },
  { key: 'tone', label: 'Tone', placeholder: 'e.g. Atmospheric, cynical, neon-drenched' },
  { key: 'comparableWorks', label: 'Comparable Works', placeholder: 'e.g. Ghost in the Shell meet Sin City' },
  { key: 'corePremise', label: 'Core Premise', placeholder: 'What is the core setup/concept of this graphic novel?' },
  { key: 'plotQuestion', label: 'Plot Question', placeholder: 'e.g. Will Kael expose the syndicate before his terminal virus deletes his memories?' },
  { key: 'emotionalQuestion', label: 'Emotional Question', placeholder: 'e.g. Can an artificial mind truly grieve a human companion?' },
  { key: 'endingIfKnown', label: 'Ending (If Known)', placeholder: 'Describe how the main plot and emotional arcs resolve.' },
  { key: 'opposingForce', label: 'Opposing Force / Antagonist', placeholder: 'Who or what stands in the protagonist\'s way?' },
  { key: 'setting', label: 'Setting / Atmosphere', placeholder: 'e.g. Neo-Detroit, District 9 — smog, acid rain, decaying sky-bridges.' },
  { key: 'visualWorld', label: 'Visual World Guidance', placeholder: 'Describe the art direction, style, colors, panel density.' },
  { key: 'recurringObjects', label: 'Recurring Objects / Keys', placeholder: 'List items with symbolic or plot significance.' },
  { key: 'knownMotifs', label: 'Known Motifs', placeholder: 'Visual or atmospheric recurring motifs.' },
  { key: 'knownCallbacks', label: 'Known Callbacks', placeholder: 'Callbacks between scenes or chapters.' },
  { key: 'knownEndingImage', label: 'Known Ending Image', placeholder: 'Describe the final panel of the story.' },
  { key: 'hardConstraints', label: 'Hard Constraints', placeholder: 'Things that must remain true or occur.' },
  { key: 'whatShouldNotChange', label: 'What Should Not Change', placeholder: 'Essential core assets to preserve from source material.' },
  { key: 'whatFeelsWeak', label: 'What Feels Weak', placeholder: 'Areas needing special revision / reinforcement.' }
];

const SECTIONS = [
  {
    title: 'Project Basics',
    fields: ['title', 'genre', 'format', 'targetLength', 'issueCount', 'audience', 'tone', 'comparableWorks'] as (keyof GnPacket)[]
  },
  {
    title: 'Story Architecture',
    fields: ['corePremise', 'plotQuestion', 'emotionalQuestion', 'endingIfKnown', 'opposingForce'] as (keyof GnPacket)[]
  },
  {
    title: 'World & Visual',
    fields: ['setting', 'visualWorld', 'recurringObjects', 'knownMotifs', 'knownCallbacks', 'knownEndingImage'] as (keyof GnPacket)[]
  },
  {
    title: 'Authorial Direction',
    fields: ['hardConstraints', 'whatShouldNotChange', 'whatFeelsWeak'] as (keyof GnPacket)[]
  }
];

const section4Keys: (keyof GnPacket)[] = ['hardConstraints', 'whatShouldNotChange', 'whatFeelsWeak'];

export const GnPacketEntry: React.FC<GnPacketEntryProps> = ({ hiddenTrigger = false }) => {
  const { state, dispatch } = useStore();
  const show = state.currentShow;
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<GnPacket>({});
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const currentPacket: GnPacket = show?.gnPacket || {};

  const handleOpen = () => {
    if (show) {
      setFormData({ ...show.gnPacket || {} });
      setEnhanceError(null);
      setIsOpen(true);
    }
  };

  // Add global event listener to allow other triggers to open this modal
  useEffect(() => {
    const handleOpenEvent = () => {
      handleOpen();
    };
    window.addEventListener('psb_open_gn_packet', handleOpenEvent);
    return () => {
      window.removeEventListener('psb_open_gn_packet', handleOpenEvent);
    };
  }, [show, currentPacket]);

  if (!show) return null;
  
  // Calculate completeness
  const totalFields = PACKET_FIELDS.length;
  const filledFields = PACKET_FIELDS.filter(f => {
    const val = currentPacket[f.key];
    return val && val.trim() !== '';
  }).length;

  const isDirty = JSON.stringify(formData) !== JSON.stringify(currentPacket);
  
  // Badge handling
  let badgeColor = 'text-white/60 border-white/10 bg-white/5';
  let badgeContent = <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-white/60">Empty</span>;

  if (show.gnPacketConfirmed) {
    badgeColor = 'text-emerald-400 border-emerald-900/40 bg-emerald-950/20';
    badgeContent = (
      <span className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-400">
        <CheckCircle size={10} /> Confirmed
      </span>
    );
  } else if (filledFields > 0) {
    badgeColor = 'text-amber-500 border-amber-900/40 bg-amber-950/20';
    badgeContent = (
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-500">
        {filledFields}/{totalFields} — Unconfirmed
      </span>
    );
  }

  const handleChange = (key: keyof GnPacket, val: string) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  const handleAutoFill = () => {
    const suggestions = autoFillGnPacket(show);
    setFormData(prev => {
      const merged = { ...prev };
      (Object.keys(suggestions) as (keyof GnPacket)[]).forEach(key => {
        if (section4Keys.includes(key)) return;
        if (!prev[key] || prev[key]!.trim() === '') {
          merged[key] = suggestions[key];
        }
      });
      return merged;
    });
  };

  const handleAIEnhance = async () => {
    setIsEnhancing(true);
    setEnhanceError(null);
    try {
      const suggestions = await generateGnPacketSuggestions(show);
      setFormData(prev => {
        const merged = { ...prev };
        (Object.keys(suggestions) as (keyof GnPacket)[]).forEach(key => {
          if (section4Keys.includes(key)) return;
          if (!prev[key] || prev[key]!.trim() === '') {
            merged[key] = (suggestions as any)[key];
          }
        });
        return merged;
      });
    } catch (err: any) {
      setEnhanceError(err?.message || 'AI Enhance failed');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSaveDraft = () => {
    // If the form has edits compared to original packet, confirmed resets to false
    const willBeConfirmed = isDirty ? false : !!show.gnPacketConfirmed;
    dispatch({
      type: 'UPDATE_SHOW',
      updates: {
        gnPacket: formData,
        gnPacketConfirmed: willBeConfirmed
      }
    });
    setIsOpen(false);
  };

  const handleConfirmPacket = () => {
    dispatch({
      type: 'UPDATE_SHOW',
      updates: {
        gnPacket: formData,
        gnPacketConfirmed: true
      }
    });
    setIsOpen(false);
  };

  if (hiddenTrigger) {
    if (!isOpen) return null;
  }

  return (
    <>
      {!hiddenTrigger && (
        <button
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-left"
          id="gn_packet_entry_btn"
        >
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-amber-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/90">
              GN Packet
            </span>
          </div>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
            {badgeContent}
          </span>
        </button>
      )}

      {/* Editor Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm transition-all animate-fade-in"
          id="gn_packet_editor_overlay"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full max-w-xl h-full bg-[#070707] border-l border-white/10 flex flex-col shadow-2xl relative text-left"
            id="gn_packet_editor_panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with integration buttons */}
            <div className="px-5 py-4 border-b border-white/10 bg-[#0e0e0e]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-amber-400" />
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wide text-white">
                    Master Input Packet
                  </h3>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/5 text-white/60 hover:text-white rounded transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-white/60 tracking-wider font-mono">
                  Align core show parameters ({filledFields} / {totalFields} fields)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoFill}
                    disabled={isEnhancing}
                    title="Populate basics from the show bible"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-white/90 hover:text-white border border-white/10 hover:bg-white/5 hover:border-white/20 rounded cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    <Wand2 size={11} className="text-amber-400" />
                    Auto-fill
                  </button>
                  <button
                    onClick={handleAIEnhance}
                    disabled={isEnhancing}
                    title="Generate emotional focus, plot stakes, comparable works, etc."
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase text-white/90 hover:text-white border border-white/10 hover:bg-white/5 hover:border-white/20 rounded cursor-pointer disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    {isEnhancing ? (
                      <Loader2 size={11} className="animate-spin text-amber-400" />
                    ) : (
                      <Sparkles size={11} className="text-amber-400" />
                    )}
                    {isEnhancing ? 'Enhancing...' : 'AI Enhance'}
                  </button>
                </div>
              </div>
              {enhanceError && (
                <div className="flex items-center gap-1.5 text-rose-400 mt-2 font-mono text-[9px] bg-rose-950/20 px-2 py-1 rounded border border-rose-900/30">
                  <AlertTriangle size={10} /> {enhanceError}
                </div>
              )}
            </div>

            {/* Scrollable Fields by Group Section */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {SECTIONS.map((section) => (
                <div key={section.title} className="space-y-4">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/60 border-b border-white/5 pb-1">
                    {section.title}
                  </h4>
                  <div className="space-y-3 pl-1">
                    {section.fields.map((fieldKey) => {
                      const field = PACKET_FIELDS.find(f => f.key === fieldKey)!;
                      const isTextArea = field.key !== 'title' && field.key !== 'genre' && field.key !== 'format' && field.key !== 'targetLength' && field.key !== 'issueCount';
                      const value = formData[field.key] || '';
                      
                      return (
                        <div key={field.key} className="space-y-1">
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-white/70">
                            {field.label}
                          </label>
                          {isTextArea ? (
                            <textarea
                              value={value}
                              onChange={(e) => handleChange(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              rows={3}
                              className="w-full px-3 py-2 bg-[#121212] border border-white/10 hover:border-white/20 focus:border-amber-500 rounded text-xs text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition resize-none"
                            />
                          ) : (
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => handleChange(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-1.5 bg-[#121212] border border-white/10 hover:border-white/20 focus:border-amber-500 rounded text-xs text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with split Save Draft and Confirm Packet actions */}
            <div className="px-5 py-3 border-t border-white/10 bg-[#0e0e0e] flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs font-mono font-medium text-white/60 hover:text-white border border-white/10 hover:bg-white/5 rounded transition cursor-pointer"
              >
                CLOSE
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveDraft}
                  className="px-3 py-1.5 text-xs font-mono font-medium text-white/80 hover:text-white border border-white/10 hover:bg-white/5 rounded transition cursor-pointer"
                  id="gn_packet_save_draft_btn"
                >
                  SAVE DRAFT
                </button>
                <button
                  onClick={handleConfirmPacket}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-bold uppercase text-[#070707] bg-amber-400 hover:bg-amber-300 rounded transition cursor-pointer"
                  id="gn_packet_confirm_btn"
                >
                  <CheckCircle size={12} />
                  CONFIRM PACKET
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
