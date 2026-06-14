import React from 'react';
import {
  Play, CheckCircle, Hourglass,
  AlertTriangle, Search, Users, Target,
  Scissors, BookOpen, Layers, PenLine
} from 'lucide-react';
import { PassCardProps, registerPassCard } from './passCardRegistry';

// ----------------------------------------------------------------------------
// SHARED HELPERS
// ----------------------------------------------------------------------------

const PASS_ORDER = ['0.0','0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.8A','0.8R','0.8RA'];

function isPassAvailable(currentPass: string | null, thisPass: string): boolean {
  if (!currentPass) return false;
  const currentIdx = PASS_ORDER.indexOf(currentPass);
  const thisIdx = PASS_ORDER.indexOf(thisPass);
  if (thisIdx === -1) return false;
  return currentIdx >= thisIdx;
}

const RunButton: React.FC<{
  isLoading: boolean;
  isAvailable: boolean;
  hasArtifact: boolean;
  passId: string;
  onRunPass: () => void;
}> = ({ isLoading, isAvailable, hasArtifact, passId, onRunPass }) => (
  <button
    disabled={isLoading || !isAvailable}
    onClick={onRunPass}
    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-mono rounded font-bold uppercase transition-all focus:outline-none focus:ring-1 focus:ring-amber-400 ${
      !isAvailable
        ? 'bg-white/5 text-white/40 border border-white/5 cursor-not-allowed'
        : isLoading
          ? 'bg-amber-950/20 text-amber-500/60 border border-amber-900/20 cursor-not-allowed'
          : 'bg-amber-400 text-[#070707] hover:bg-amber-300 pointer-events-auto'
    }`}
    id={`run_btn_${passId.replace('.','_')}`}
  >
    {isLoading ? (
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 border-2 border-t-transparent border-amber-500 rounded-full animate-spin" />
        RUNNING
      </span>
    ) : (
      <><Play size={10} fill="currentColor" /> {hasArtifact ? 'RE-RUN' : 'RUN'}</>
    )}
  </button>
);

type PassCardConfig = {
  passId: string;
  badge: string;
  viewLabel: string;
  viewIcon: React.ReactNode;
  prereqPass: string;
};

function makePassCard(cfg: PassCardConfig): React.FC<PassCardProps> {
  const Card: React.FC<PassCardProps> = ({ run, passSpec, onRunPass, isLoading, latestArtifact, onViewArtifact }) => {
    const isAvailable = !!latestArtifact || isPassAvailable(run.currentPass, cfg.passId);

    return (
      <div
        className={`p-5 border rounded-lg bg-[#0e0e0e] transition-all text-left flex flex-col justify-between min-h-[190px] ${
          isAvailable ? 'border-white/10 hover:border-white/15' : 'border-white/5 opacity-60'
        }`}
        id={`pass_card_${cfg.passId.replace('.','_')}`}
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/10">
              Pass {cfg.passId} • {cfg.badge}
            </span>
            {latestArtifact && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold uppercase bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">
                <CheckCircle size={10} /> Complete
              </span>
            )}
          </div>
          <h4 className="text-xs font-mono font-medium text-white/90 uppercase tracking-wide">
            {passSpec.name}
          </h4>
          <p className="text-xs text-white/70 mt-1 leading-relaxed">
            {passSpec.description}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          {latestArtifact ? (
            <button
              onClick={() => onViewArtifact?.(latestArtifact)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-white/80 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 rounded transition-all focus:outline-none focus:ring-1 focus:ring-amber-400"
              id={`view_btn_${cfg.passId.replace('.','_')}`}
            >
              {cfg.viewIcon}
              {cfg.viewLabel}
            </button>
          ) : (
            <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-1">
              {!isAvailable && <Hourglass size={10} className="text-amber-500/70" />}
              {isAvailable ? 'Pending Execution' : `Awaiting ${cfg.prereqPass}`}
            </span>
          )}
          <RunButton
            isLoading={isLoading}
            isAvailable={isAvailable}
            hasArtifact={!!latestArtifact}
            passId={cfg.passId}
            onRunPass={() => onRunPass(passSpec)}
          />
        </div>
      </div>
    );
  };
  Card.displayName = `PassCard_${cfg.passId}`;
  return Card;
}

// ----------------------------------------------------------------------------
// REGISTER CARDS 0.3 → 0.8A
// ----------------------------------------------------------------------------

const CONFIGS: PassCardConfig[] = [
  {
    passId: '0.3',
    badge: 'DIAGNOSTIC',
    viewLabel: 'View Diagnosis',
    viewIcon: <AlertTriangle size={12} className="text-white/60" />,
    prereqPass: '0.2',
  },
  {
    passId: '0.4',
    badge: 'SCENE AUDIT',
    viewLabel: 'View Audit',
    viewIcon: <Search size={12} className="text-white/60" />,
    prereqPass: '0.3',
  },
  {
    passId: '0.5',
    badge: 'CHARACTER AUDIT',
    viewLabel: 'View Audit',
    viewIcon: <Users size={12} className="text-white/60" />,
    prereqPass: '0.3',
  },
  {
    passId: '0.6',
    badge: 'PREMISE',
    viewLabel: 'View Cash-Out',
    viewIcon: <Target size={12} className="text-white/60" />,
    prereqPass: '0.5',
  },
  {
    passId: '0.7',
    badge: 'REVISION ORDERS',
    viewLabel: 'View Orders',
    viewIcon: <Scissors size={12} className="text-white/60" />,
    prereqPass: '0.6',
  },
  {
    passId: '0.8',
    badge: 'ARC LOCK',
    viewLabel: 'View Spine',
    viewIcon: <BookOpen size={12} className="text-white/60" />,
    prereqPass: '0.7',
  },
  {
    passId: '0.8A',
    badge: 'ARC LADDER',
    viewLabel: 'View Ladder',
    viewIcon: <Layers size={12} className="text-white/60" />,
    prereqPass: '0.8',
  },
];

CONFIGS.forEach(cfg => registerPassCard(cfg.passId, makePassCard(cfg)));

// ----------------------------------------------------------------------------
// REVISION CARDS FOR 0.8R and 0.8RA (D351)
// ----------------------------------------------------------------------------

const RevisionCard: React.FC<PassCardProps & { badge: string; passId: string }> = ({
  run,
  passSpec,
  onRunPass,
  isLoading,
  latestArtifact,
  onViewArtifact,
  badge,
  passId
}) => {
  const hasNotes = !!run.arcLockNotes && run.arcLockNotes.trim().length > 0;
  const isAvailable = !!latestArtifact || isPassAvailable(run.currentPass, passId);

  const notesPreview = run.arcLockNotes
    ? run.arcLockNotes.length > 80
      ? run.arcLockNotes.substring(0, 80) + '...'
      : run.arcLockNotes
    : null;

  return (
    <div
      className={`p-5 border rounded-lg bg-[#0e0e0e] transition-all text-left flex flex-col justify-between min-h-[220px] ${
        isAvailable ? 'border-white/10 hover:border-white/15' : 'border-white/5 opacity-60'
      }`}
      id={`pass_card_${passId.replace('.','_')}`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/10">
            Pass {passId} • {badge}
          </span>
          {latestArtifact && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold uppercase bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded">
              <CheckCircle size={10} /> Complete
            </span>
          )}
        </div>
        <h4 className="text-xs font-mono font-medium text-white/90 uppercase tracking-wide">
          {passSpec.name}
        </h4>
        <p className="text-xs text-white/70 mt-1 leading-relaxed">
          {passSpec.description}
        </p>

        {/* Notes preview or required warning */}
        <div className="mt-3 p-2 rounded bg-[#070707] border border-white/5">
          {hasNotes ? (
            <div className="space-y-1">
              <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider block">Notes Preview</span>
              <p className="text-[10px] text-white/80 font-sans italic leading-normal">
                "{notesPreview}"
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-400">
              <AlertTriangle size={11} className="shrink-0" />
              <span className="text-[10px] font-mono font-bold uppercase">Notes required before execution</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {latestArtifact ? (
            <button
              onClick={() => onViewArtifact?.(latestArtifact)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-white/80 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 rounded transition-all focus:outline-none focus:ring-1 focus:ring-amber-400"
              id={`view_btn_${passId.replace('.','_')}`}
            >
              <PenLine size={12} className="text-white/60" />
              View Revision
            </button>
          ) : (
            <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-1">
              {!isAvailable && <Hourglass size={10} className="text-amber-500/70" />}
              {isAvailable ? 'Pending Notes' : 'Awaiting 0.8A'}
            </span>
          )}
          <RunButton
            isLoading={isLoading}
            isAvailable={isAvailable && hasNotes}
            hasArtifact={!!latestArtifact}
            passId={passId}
            onRunPass={() => onRunPass(passSpec)}
          />
        </div>
        <div className="text-[9px] font-mono text-white/60 uppercase tracking-wide text-right">
          Edit notes in the revision panel above.
        </div>
      </div>
    </div>
  );
};

registerPassCard('0.8R', (props) => (
  <RevisionCard {...props} badge="SPINE REVISION" passId="0.8R" />
));

registerPassCard('0.8RA', (props) => (
  <RevisionCard {...props} badge="LADDER REVISION" passId="0.8RA" />
));

