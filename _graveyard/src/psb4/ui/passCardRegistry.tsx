import React from 'react';
import { Psb4Run, Psb4Artifact, PassSpec } from '../types';
import { Zap, CheckCircle, Play, FileCode, Sliders, Hourglass } from 'lucide-react';
import { getLatestArtifactByShow } from '../storage';

export type PassCardProps = {
  run: Psb4Run;
  passSpec: PassSpec;
  onRunPass: (spec: PassSpec) => Promise<void>;
  isLoading: boolean;
  latestArtifact: Psb4Artifact | null;
  onViewArtifact?: (art: Psb4Artifact) => void;
};

type PassCardComponent = React.FC<PassCardProps>;

const registry: Record<string, PassCardComponent> = {};

export function registerPassCard(passId: string, card: PassCardComponent) {
  registry[passId] = card;
}

export function getPassCard(passId: string): PassCardComponent | null {
  return registry[passId] ?? null;
}

// ----------------------------------------------------------------------------
// PASS CARD FOR 0.0: PROJECT REGROUNDING
// ----------------------------------------------------------------------------
const RegroundingCard: React.FC<PassCardProps> = ({
  run,
  passSpec,
  onRunPass,
  isLoading,
  latestArtifact,
  onViewArtifact
}) => {
  const isAvailable = true; // 0.0 always available if run is active

  return (
    <div 
      className="p-5 border border-white/10 rounded-lg bg-[#0e0e0e] hover:border-white/15 transition-all text-left flex flex-col justify-between min-h-[190px]"
      id="pass_card_0_0"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/10">
            Pass 0.0 • ARC SCOPE
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
            id="view_btn_0_0"
          >
            <FileCode size={12} className="text-white/60" /> View Brief
          </button>
        ) : (
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
            Pending Execution
          </span>
        )}

        <button
          disabled={isLoading || !isAvailable}
          onClick={() => onRunPass(passSpec)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-mono rounded font-bold uppercase transition-all focus:outline-none focus:ring-1 focus:ring-amber-400 ${
            isLoading 
              ? 'bg-amber-950/20 text-amber-500/60 border border-amber-900/20 cursor-not-allowed'
              : 'bg-amber-400 text-[#070707] hover:bg-amber-300 pointer-events-auto'
          }`}
          id="run_btn_0_0"
        >
          {isLoading ? (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 border-2 border-t-transparent border-amber-500 rounded-full animate-spin" /> RUNNING
            </span>
          ) : (
            <>
              <Play size={10} fill="currentColor" /> {latestArtifact ? 'RE-RUN' : 'RUN'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
registerPassCard('0.0', RegroundingCard);

// ----------------------------------------------------------------------------
// PASS CARD FOR 0.1: ENGINE READ
// ----------------------------------------------------------------------------
const EngineReadCard: React.FC<PassCardProps> = ({
  run,
  passSpec,
  onRunPass,
  isLoading,
  latestArtifact,
  onViewArtifact
}) => {
  // Check if Regrounding Brief exists
  const hasRegrounding = run.currentPass !== '0.0';

  return (
    <div 
      className={`p-5 border rounded-lg bg-[#0e0e0e] transition-all text-left flex flex-col justify-between min-h-[190px] ${
        hasRegrounding ? 'border-white/10 hover:border-white/15' : 'border-white/5 opacity-60'
      }`}
      id="pass_card_0_1"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/10">
            Pass 0.1 • ADAPTIVE REGISTER
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
            id="view_btn_0_1"
          >
            <Sliders size={12} className="text-white/60" /> View Engine
          </button>
        ) : (
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-1">
            {!hasRegrounding && <Hourglass size={10} className="text-amber-500/70" />}
            {hasRegrounding ? 'Pending Execution' : 'Awaiting 0.0'}
          </span>
        )}

        <button
          disabled={isLoading || !hasRegrounding}
          onClick={() => onRunPass(passSpec)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-mono rounded font-bold uppercase transition-all focus:outline-none focus:ring-1 focus:ring-amber-400 ${
            !hasRegrounding 
              ? 'bg-white/5 text-white/40 border border-white/5 cursor-not-allowed'
              : isLoading 
                ? 'bg-amber-950/20 text-amber-500/60 border border-amber-900/20 cursor-not-allowed'
                : 'bg-amber-400 text-[#070707] hover:bg-amber-300 pointer-events-auto'
          }`}
          id="run_btn_0_1"
        >
          {isLoading ? (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 border-2 border-t-transparent border-amber-500 rounded-full animate-spin" /> RUNNING
            </span>
          ) : (
            <>
              <Play size={10} fill="currentColor" /> {latestArtifact ? 'RE-RUN' : 'RUN'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
registerPassCard('0.1', EngineReadCard);

// ----------------------------------------------------------------------------
// PASS CARD FOR 0.2: WORKING INVENTORY
// ----------------------------------------------------------------------------
const WorkingInventoryCard: React.FC<PassCardProps> = ({
  run,
  passSpec,
  onRunPass,
  isLoading,
  latestArtifact,
  onViewArtifact
}) => {
  // Check if both 0.0 and 0.1 exist
  const isAvailable = run.currentPass === '0.2' || (run.currentPhase === 'done') || (latestArtifact !== null);

  return (
    <div 
      className={`p-5 border rounded-lg bg-[#0e0e0e] transition-all text-left flex flex-col justify-between min-h-[190px] ${
        isAvailable ? 'border-white/10 hover:border-white/15' : 'border-white/5 opacity-60'
      }`}
      id="pass_card_0_2"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/10">
            Pass 0.2 • INVENTORY SCOPE
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
            id="view_btn_0_2"
          >
            <Zap size={12} className="text-white/60" /> View Inventory
          </button>
        ) : (
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-1">
            {!isAvailable && <Hourglass size={10} className="text-amber-500/70" />}
            {isAvailable ? 'Pending Execution' : 'Awaiting 0.1'}
          </span>
        )}

        <button
          disabled={isLoading || !isAvailable}
          onClick={() => onRunPass(passSpec)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-mono rounded font-bold uppercase transition-all focus:outline-none focus:ring-1 focus:ring-amber-400 ${
            !isAvailable 
              ? 'bg-white/5 text-white/40 border border-white/5 cursor-not-allowed'
              : isLoading 
                ? 'bg-amber-950/20 text-amber-500/60 border border-amber-900/20 cursor-not-allowed'
                : 'bg-amber-400 text-[#070707] hover:bg-amber-300 pointer-events-auto'
          }`}
          id="run_btn_0_2"
        >
          {isLoading ? (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 border-2 border-t-transparent border-amber-500 rounded-full animate-spin" /> RUNNING
            </span>
          ) : (
            <>
              <Play size={10} fill="currentColor" /> {latestArtifact ? 'RE-RUN' : 'RUN'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
registerPassCard('0.2', WorkingInventoryCard);
