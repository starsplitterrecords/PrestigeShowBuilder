import React from 'react';
import { Psb4Artifact, EngineReadPayload, ArtifactType } from '../types';
import { Lightbulb, Sliders, Settings, ShieldAlert, Eye, Skull, Image } from 'lucide-react';

export const EngineReadView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as EngineReadPayload;

  if (!payload) {
    return (
      <div className="p-4 text-xs font-mono text-red-400">
        Error: Invalid Engine Read Payload.
      </div>
    );
  }

  const items = [
    { label: 'Locked Core Premise', val: payload.premise, icon: Lightbulb },
    { label: 'Genre Rules & Lanes', val: payload.genreLane, icon: Sliders },
    { label: 'Character Collisons (Relationship Engine)', val: payload.characterEngine, icon: Settings },
    { label: 'External Structural Pressures', val: payload.externalPressure, icon: ShieldAlert },
    { label: 'Visual Palette & Motifs', val: payload.visualWorld, icon: Eye },
    { label: 'Antagonist Operational Mode', val: payload.antagonistMode, icon: Skull },
  ];

  return (
    <div className="space-y-6 text-left" id="engine_read_view">
      <div className="border-b border-white/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
          Phase 0.1 • Series Configuration Engine
        </span>
        <h2 className="text-lg font-sans font-bold text-white tracking-tight mt-1">
          Lockdown & Structural Forces
        </h2>
        <p className="text-xs text-white/70 mt-1">
          Establishing locked-in constraints and operational guidelines before reconstruction.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="bg-[#0e0e0e] border border-white/10 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-1.5">
                  <Icon size={14} className="text-amber-400" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/70">
                    {item.label}
                  </span>
                </div>
                <p className="text-xs font-sans text-white/85 leading-relaxed whitespace-pre-wrap">
                  {item.val || 'No details provided.'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {payload.endingImage && (
        <div className="bg-amber-950/20 border border-amber-500/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 border-b border-amber-500/10 pb-1.5">
            <Image size={14} className="text-amber-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
              Thematic Seasonal Ending Image
            </span>
          </div>
          <p className="text-xs font-sans text-white/90 leading-relaxed font-semibold italic">
            &ldquo;{payload.endingImage}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
};
