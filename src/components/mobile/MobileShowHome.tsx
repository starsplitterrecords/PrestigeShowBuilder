import React, { useState } from 'react';
import { useStore } from '../../StoreContext';
import { PieChart, Download, PlusSquare } from 'lucide-react';

import MobileGenerationSheet from './MobileGenerationSheet';
import MobileExportSheet, { ExportTarget } from './MobileExportSheet';

const MobileShowHome: React.FC = () => {
  const { state, dispatch } = useStore();
  const { currentShow } = state;
  const [isGenSheetOpen, setIsGenSheetOpen] = useState(false);
  const [exportSheet, setExportSheet] = useState<{ open: boolean; target: ExportTarget | null }>({
    open: false,
    target: null,
  });

  if (!currentShow) return null;

  const stats = [
    { label: 'Seasons', val: currentShow.seasons?.length || 0 },
    { label: 'Episodes', val: currentShow.seasons?.[0]?.episodes?.length || 0 },
    { label: 'Characters', val: currentShow.characters?.length || 0 },
    { label: 'Pages', val: currentShow.comicGallery?.length || 0 },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* SHOW INFO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extralight tracking-tight text-white leading-tight">
            {currentShow.titleSuggestion || currentShow.name}
          </h2>
        </div>
        <p className="text-sm text-white/70 leading-relaxed font-light line-clamp-4 italic">
          {currentShow.premise}
        </p>
      </section>

      {/* STATS GRID */}
      <section className="grid grid-cols-2 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/60 font-black">
              {s.label}
            </span>
            <span className="text-2xl font-light text-white">
              {s.val}
            </span>
          </div>
        ))}
      </section>

      {/* ACTIONS */}
      <section className="space-y-4">
        <h3 className="text-[10px] uppercase tracking-widest font-black text-amber-500/80">Production Control</h3>
        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'm-hierarchy' })}
            className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl active:scale-95 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 group-hover:text-amber-500 transition-colors">
                <PieChart size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold">Show Hierarchy</h4>
                <p className="text-[10px] text-white/60 uppercase tracking-widest">Manage Seasons & Episodes</p>
              </div>
            </div>
            <span className="text-white/60">→</span>
          </button>

          <button 
            className="flex items-center justify-between p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl active:scale-95 transition-all text-left group"
            onClick={() => setIsGenSheetOpen(true)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                <PlusSquare size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-500">Smart Fill</h4>
                <p className="text-[10px] text-amber-500/60 uppercase tracking-widest">Expand Whole Show AI</p>
              </div>
            </div>
            <span className="text-amber-500/40">⚡</span>
          </button>
        </div>
      </section>

      {/* NEW: Export section */}
      <section className="space-y-4">
        <h3 className="text-[10px] uppercase tracking-widest font-black text-emerald-500">Local Delivery</h3>
        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={() => setExportSheet({ 
              open: true, 
              target: { kind: 'issue-pdf', label: `${currentShow.name} — Issue PDF` } 
            })}
            className="flex items-center justify-between p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl active:scale-95 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Download size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-400">Issue PDF</h4>
                <p className="text-[10px] text-emerald-500/40 uppercase tracking-widest">Compile Approved Pages</p>
              </div>
            </div>
            <span className="text-emerald-500/40">⤓</span>
          </button>

          <button 
            onClick={() => setExportSheet({ 
              open: true, 
              target: { kind: 'teleplay-show', label: `${currentShow.name} — Full Teleplay` } 
            })}
            className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl active:scale-95 transition-all text-left group"
          >
            <div className="flex items-center gap-4 ml-2">
              <PlusSquare size={16} className="text-white/60" />
              <span className="text-xs font-bold text-white/70">Full Teleplay (.txt)</span>
            </div>
            <span className="text-white/60">⤓</span>
          </button>
        </div>
      </section>
      
      <div className="h-4" />

      <MobileGenerationSheet 
        isOpen={isGenSheetOpen}
        onClose={() => setIsGenSheetOpen(false)}
        context={{ scope: 'show', label: currentShow.name }}
      />

      <MobileExportSheet 
        isOpen={exportSheet.open}
        target={exportSheet.target}
        onClose={() => setExportSheet({ open: false, target: null })}
      />
    </div>
  );
};

export default MobileShowHome;
