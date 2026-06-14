import React from 'react';
import { Psb4Artifact, WorkingInventoryPayload, ArtifactType } from '../types';
import { Award, Heart, Shield, Quote } from 'lucide-react';

export const WorkingInventoryView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as WorkingInventoryPayload;

  if (!payload || !Array.isArray(payload.elements)) {
    return (
      <div className="p-4 text-xs font-mono text-red-400">
        Error: Invalid What's Working Inventory Payload.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left" id="working_inventory_view">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
          Phase 0.2 • Dramaturgical Assets Inventory
        </span>
        <h2 className="text-lg font-sans font-bold text-white tracking-tight mt-1">
          Draft High-Water Marks & Assets
        </h2>
        <p className="text-xs text-white/70 mt-1">
          Preserved draft strengths which future rewrite systems must actively protect.
        </p>
      </div>

      {payload.elements.length === 0 ? (
        <div className="p-8 text-center bg-[#0e0e0e] border border-white/5 rounded-lg">
          <p className="text-xs text-white/60 font-mono tracking-wider uppercase">
            No working assets identified.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payload.elements.map((el, i) => (
            <div 
              key={i} 
              className="bg-[#0e0e0e] border border-white/10 rounded-xl overflow-hidden shadow-md"
            >
              {/* Element Header */}
              <div className="px-4 py-3 bg-[#111111] border-b border-white/10 flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[10px] font-mono font-bold text-amber-400">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-xs font-mono uppercase tracking-wide font-bold text-white/90">
                  {el.element || 'Unnamed Strength'}
                </h3>
              </div>

              {/* Element Details Grid */}
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Why it works */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-400">
                      <Heart size={12} />
                      <span>Why It Works</span>
                    </div>
                    <p className="text-xs font-sans text-white/80 leading-relaxed pl-1.5">
                      {el.whyItWorks || 'No explanation provided.'}
                    </p>
                  </div>

                  {/* What to protect */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-amber-400">
                      <Shield size={12} />
                      <span>What To Protect & Preserve</span>
                    </div>
                    <p className="text-xs font-sans text-white/80 leading-relaxed pl-1.5">
                      {el.whatToProtect || 'No guidance provided.'}
                    </p>
                  </div>
                </div>

                {/* Example from Draft quote callout */}
                {el.exampleFromDraft && (
                  <div className="bg-[#030303] border-l-2 border-amber-500 rounded p-3 relative mt-2">
                    <div className="absolute top-2 right-2 text-white/10">
                      <Quote size={20} />
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-white/60 mb-1">
                      Draft Highlight / Quote
                    </div>
                    <p className="text-xs font-mono text-amber-300 font-medium whitespace-pre-wrap italic">
                      &ldquo;{el.exampleFromDraft}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
