import React from 'react';
import { Psb4Run, Psb4Phase, Psb4ProgressStatus } from '../types';

interface PhaseStripProps {
  run: Psb4Run;
}

export const PhaseStrip: React.FC<PhaseStripProps> = ({ run }) => {
  const phases: { key: keyof Psb4Run['phaseProgress']; label: string; description: string }[] = [
    { key: 'reduction', label: 'Reduction', description: 'Source Distillation' },
    { key: 'arc_lock', label: 'Arc Lock', description: 'Narrative Binding' },
    { key: 'rebuild', label: 'Rebuild', description: 'Script Reconstruction' },
    { key: 'enrichment', label: 'Enrichment', description: 'High-Fidelity Polish' },
  ];

  const getStatusStyles = (status: Psb4ProgressStatus, isCurrent: boolean) => {
    switch (status) {
      case 'complete':
        return {
          bg: 'bg-emerald-950/40 border-emerald-800/60',
          text: 'text-emerald-400',
          badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
          label: 'COMPLETE',
        };
      case 'running':
        return {
          bg: 'bg-amber-950/40 border-amber-800/60 animate-pulse',
          text: 'text-amber-300',
          badge: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
          label: 'RUNNING',
        };
      case 'failed':
        return {
          bg: 'bg-red-950/40 border-red-900/60',
          text: 'text-red-400',
          badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
          label: 'FAILED',
        };
      default: // pending
        return {
          bg: isCurrent ? 'bg-zinc-900 border-zinc-700/80' : 'bg-[#0b0b0b] border-white/5',
          text: isCurrent ? 'text-white/90' : 'text-white/60',
          badge: 'bg-white/5 text-white/50 border border-white/10',
          label: 'PENDING',
        };
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#0d0d0d] p-3 rounded-lg border border-white/10" id="psb4_phase_strip">
      {phases.map((phase) => {
        const isCurrent = run.currentPhase === phase.key;
        const status = run.phaseProgress[phase.key] || 'pending';
        const styles = getStatusStyles(status, isCurrent);

        return (
          <div
            key={phase.key}
            className={`relative flex flex-col p-3 rounded-md border transition-all duration-150 ${styles.bg}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[11px] font-mono uppercase tracking-wider ${styles.text}`}>
                {phase.label}
              </span>
              <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded uppercase leading-none ${styles.badge}`}>
                {styles.label}
              </span>
            </div>
            <span className="text-xs font-sans font-medium text-white/90 mb-0.5">
              {phase.description}
            </span>
            {isCurrent && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-b-md" />
            )}
          </div>
        );
      })}
    </div>
  );
};
