import React from 'react';
import { Psb4Run, PassSpec, Psb4Artifact } from '../types';
import { getAllPassSpecs } from '../passes/registry';
import { GnPacketEntry } from './GnPacketEntry';
import { PassStatus } from './utils/passStatus';
import { Check, Edit3, Loader2, Lock, AlertCircle, CircleDot } from 'lucide-react';
import { ArcLockRevisionGate } from './ArcLockRevisionGate';

interface Psb4PassNavigatorProps {
  run: Psb4Run;
  passStatuses: Record<string, PassStatus>;
  selectedPassId: string | null;
  onSelectPass: (passId: string) => void;
  readOnly?: boolean;
  artifacts: Psb4Artifact[];
  defaultEpisodeIds?: string[];
  onNotesSaved?: (notes: string) => void;
}

const PHASES: Array<{ id: 'reduction' | 'arc_lock' | 'rebuild' | 'enrichment'; label: string }> = [
  { id: 'reduction', label: 'Reduction' },
  { id: 'arc_lock', label: 'Arc Lock' },
  { id: 'rebuild', label: 'Rebuild' },
  { id: 'enrichment', label: 'Enrichment' }
];

export const Psb4PassNavigator: React.FC<Psb4PassNavigatorProps> = ({
  run,
  passStatuses,
  selectedPassId,
  onSelectPass,
  readOnly = false,
  artifacts,
  defaultEpisodeIds = [],
  onNotesSaved
}) => {
  const specs = getAllPassSpecs();

  // Determine episodes in scope
  let episodesInScope = run.scopeEpisodeIds || [];
  if (episodesInScope.length === 0) {
    if (defaultEpisodeIds.length > 0) {
      episodesInScope = defaultEpisodeIds;
    } else {
      const unique = new Set<string>();
      artifacts.forEach(a => { if (a.episodeId) unique.add(a.episodeId); });
      episodesInScope = Array.from(unique);
    }
  }

  // Group specs by phase
  const specsByPhase = PHASES.map(p => {
    return {
      phaseId: p.id,
      label: p.label,
      items: specs.filter(s => s.phase === p.id)
    };
  });

  // Render status icon or badge
  const renderStatus = (passId: string, spec: PassSpec, status: PassStatus) => {
    const details = (passStatuses as any)?._details?.[passId];
    const hoverTitle = details?.reason || '';

    const wrapWithTitle = (element: React.ReactNode) => (
      <span title={hoverTitle} className="inline-flex shrink-0">
        {element}
      </span>
    );

    if (status === 'complete') {
      return wrapWithTitle(<Check size={12} className="text-emerald-400" id={`status_icon_complete_${passId.replace('.', '_')}`} />);
    }
    if (status === 'author-edited') {
      return wrapWithTitle(<Edit3 size={12} className="text-amber-400" id={`status_icon_edited_${passId.replace('.', '_')}`} />);
    }
    if (status === 'running') {
      return wrapWithTitle(<Loader2 size={12} className="text-amber-400 animate-spin" id={`status_icon_running_${passId.replace('.', '_')}`} />);
    }
    if (status === 'blocked') {
      return wrapWithTitle(<Lock size={12} className="text-white/50" id={`status_icon_blocked_${passId.replace('.', '_')}`} />);
    }
    if (status === 'error') {
      return wrapWithTitle(<AlertCircle size={12} className="text-red-400" id={`status_icon_error_${passId.replace('.', '_')}`} />);
    }
    if (status === 'partial') {
      const matchesCurrentScope = (art: Psb4Artifact) => {
        if (spec.scope === 'episode' || spec.scope === 'episode-anchored') {
          return !!(art.episodeId && episodesInScope.includes(art.episodeId));
        }
        return true;
      };

      // Find matching artifacts vs scoped episodes
      const passArtifacts = artifacts.filter(a =>
        a.artifactType === spec.outputArtifactType &&
        a.createdByPass === passId &&
        matchesCurrentScope(a)
      );
      const completedEpisodeIds = new Set<string>();
      passArtifacts.forEach(art => {
        if (art.episodeId && episodesInScope.includes(art.episodeId)) {
          completedEpisodeIds.add(art.episodeId);
        }
      });
      const matched = completedEpisodeIds.size;
      const total = episodesInScope.length;

      return wrapWithTitle(
        <span 
          className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/20 px-1 border border-amber-900/30 rounded flex items-center gap-1 shrink-0"
          id={`status_badge_partial_${passId.replace('.', '_')}`}
        >
          <CircleDot size={9} />
          {matched}/{total}
        </span>
      );
    }
    return null;
  };

  // Phase section style
  const getPhaseColor = (phaseId: string) => {
    const progress = (run.phaseProgress as Record<string, string | undefined>)?.[phaseId];
    if (run.currentPhase === phaseId && run.status === 'active') {
      return 'text-amber-400';
    }
    if (progress === 'complete') {
      return 'text-emerald-400';
    }
    if (progress === 'failed') {
      return 'text-red-400';
    }
    return 'text-white/60';
  };

  const getPhaseDotColor = (phaseId: string) => {
    const progress = (run.phaseProgress as Record<string, string | undefined>)?.[phaseId];
    if (run.currentPhase === phaseId && run.status === 'active') {
      return 'bg-amber-400 animate-pulse';
    }
    if (progress === 'complete') {
      return 'bg-emerald-400';
    }
    if (progress === 'failed') {
      return 'bg-red-500';
    }
    return 'bg-white/30';
  };

  return (
    <div 
      className="h-full flex flex-col overflow-hidden bg-[#090909] select-none text-left"
      id="psb4_pass_navigator"
    >
      {/* GN Packet strip */}
      <div className="p-2 shrink-0">
        <GnPacketEntry />
      </div>

      <div className="shrink-0 h-px bg-white/10" />

      {/* Phase & Pass list scroll area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {specsByPhase.map(grp => {
          const phaseColor = getPhaseColor(grp.phaseId);
          const phaseDotColor = getPhaseDotColor(grp.phaseId);

          return (
            <div key={grp.phaseId} className="space-y-1" id={`phase_section_${grp.phaseId}`}>
              {/* Phase header */}
              <div className="flex items-center gap-2 px-2 py-1.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${phaseDotColor}`} />
                <span className={`text-[10px] font-mono font-black uppercase tracking-widest ${phaseColor}`}>
                  {grp.label}
                </span>
              </div>

              {/* Passes under this phase */}
              <div className="space-y-0.5 pl-2">
                {grp.items.map(item => {
                  const isSelected = selectedPassId === item.id;
                  const status = passStatuses[item.id] || 'pending';
                  const isBlocked = status === 'blocked';

                  return (
                    <React.Fragment key={item.id}>
                      {item.id === '0.8R' && (
                        <ArcLockRevisionGate
                          run={run}
                          arcLockComplete={passStatuses['0.8A'] === 'complete' || passStatuses['0.8A'] === 'author-edited'}
                          onNotesSaved={(notes) => {
                            onNotesSaved?.(notes);
                          }}
                        />
                      )}
                      <button
                        onClick={() => onSelectPass(item.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-all text-left focus:outline-none focus:ring-1 focus:ring-amber-500/30 ${
                          isSelected
                            ? 'bg-white/10 border-l-2 border-amber-500 text-white font-medium shadow-sm'
                            : isBlocked
                              ? 'text-white/50 hover:bg-white/5'
                              : 'text-white/80 hover:bg-white/5'
                        }`}
                        id={`nav_pass_btn_${item.id.replace('.', '_')}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span className="font-mono text-[10px] text-white/60 tracking-wider shrink-0 min-w-[20px]">
                            {item.id}
                          </span>
                          <span className="truncate text-[11px] leading-tight">
                            {item.name}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {renderStatus(item.id, item, status)}
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
