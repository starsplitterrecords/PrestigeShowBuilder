import React from 'react';
import { Psb4Artifact, RegroundingBriefPayload, ArtifactType } from '../types';
import { BookOpen, Film, Radio, Layers, Flame, Users, Calendar, MapPin, AlertCircle } from 'lucide-react';

export const RegroundingBriefView: React.FC<{ artifact: Psb4Artifact }> = ({ artifact }) => {
  const payload = artifact.payload as RegroundingBriefPayload;

  if (!payload) {
    return (
      <div className="p-4 text-xs font-mono text-red-400">
        Error: Invalid Regrounding Brief Payload.
      </div>
    );
  }

  const sections = [
    { label: 'Core Premise', val: payload.premise, icon: BookOpen },
    { label: 'Narrative Mechanism', val: payload.narrativeMechanism, icon: Layers },
    { label: 'Conflict Engine', val: payload.conflictEngine, icon: Flame },
    { label: 'Character Roster Status', val: payload.characterRosterStatus, icon: Users },
    { label: 'Season Arc Summary', val: payload.seasonArcSummary, icon: Calendar },
    { label: 'Setting & Visuality', val: payload.settingDetails, icon: MapPin },
  ];

  return (
    <div className="space-y-6 text-left" id="regrounding_brief_view">
      {/* Title Header Block */}
      <div className="border-b border-white/10 pb-4">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
          Phase 0.0 • Verified Definitive Title
        </span>
        <h2 className="text-xl font-sans font-bold text-white tracking-tight mt-1">
          {payload.title || 'Untitled Series'}
        </h2>
        <div className="flex flex-wrap gap-4 mt-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded">
            <Film size={12} className="text-amber-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">Genre:</span>
            <span className="text-xs font-sans text-white/90 font-medium">{payload.genre || 'Unspecified'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded">
            <Radio size={12} className="text-amber-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">Tone:</span>
            <span className="text-xs font-sans text-white/90 font-medium">{payload.tone || 'Unspecified'}</span>
          </div>
        </div>
      </div>

      {/* Themes Flag */}
      {payload.themes && (
        <div className="bg-amber-950/20 border border-amber-500/10 rounded-lg p-3.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
            Season Theme Matrix
          </span>
          <p className="text-xs font-sans text-white/95 mt-1 leading-relaxed">
            {payload.themes}
          </p>
        </div>
      )}

      {/* Detailed bento sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((sec, i) => {
          const Icon = sec.icon;
          return (
            <div key={i} className="bg-[#0e0e0e] border border-white/10 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 border-b border-white/5 pb-1.5">
                  <Icon size={14} className="text-amber-400" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/70">
                    {sec.label}
                  </span>
                </div>
                <p className="text-xs font-sans text-white/85 leading-relaxed whitespace-pre-wrap">
                  {sec.val || 'No information provided.'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editorial Priorities block */}
      {payload.editorialPriorities && (
        <div className="bg-red-950/20 border border-red-500/15 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 border-b border-red-500/10 pb-1.5">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-300">
              Showrunner Editorial Priorities
            </span>
          </div>
          <p className="text-xs font-sans text-white/90 leading-relaxed whitespace-pre-wrap">
            {payload.editorialPriorities}
          </p>
        </div>
      )}
    </div>
  );
};
