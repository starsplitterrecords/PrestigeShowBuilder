import React from 'react';
import { useStore } from '../StoreContext';
import DashboardPanel from './DashboardPanel';
import ConceptPanel from './ConceptPanel';
import SetupPanel from './SetupPanel';
import CharactersPanel from './CharactersPanel';
import ArtDeptPanel from './ArtDeptPanel';
import CharacterConceptsPanel from './CharacterConceptsPanel';
import IssueCompilerPanel from './IssueCompilerPanel';
import { ProductionAuditPanel } from './ProductionAuditPanel';
import TeleplaysPanel from './TeleplaysPanel';
import ExportPanel from './ExportPanel';
import GenerationLogPanel from './GenerationLogPanel';
import SceneWorkbench from './SceneWorkbench';
import ConsolePanel from './ConsolePanel';
import Psb4Panel from '../psb4/ui/Psb4Panel';
import VisualPlanningPanel from './VisualPlanningPanel';

const UnknownViewPanel: React.FC<{ view: string }> = ({ view }) => {
  const { dispatch } = useStore();
  return (
    <div className="p-8 md:p-12 max-w-xl mx-auto space-y-6 text-center animate-in fade-in duration-300">
      <div className="py-12 border border-dashed border-red-500/30 bg-red-500/5 p-8 space-y-4 rounded-sm">
        <h3 className="text-lg font-black uppercase tracking-widest text-red-500">Unknown Workspace View</h3>
        <p className="text-xs text-white/70">
          The view state <code className="font-mono text-red-400 bg-red-950 px-1.5 py-0.5 rounded-xs">"{view}"</code> is not mapped to any active route component.
        </p>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'dashboard' })}
          className="mx-auto px-6 py-2.5 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 rounded-sm transition-all shadow-md"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

const WorkspaceRouter: React.FC = () => {
  const { state } = useStore();
  const { view } = state;

  switch (view) {
    case 'dashboard': return <DashboardPanel />;
    case 'concept': return <ConceptPanel />;
    case 'setup': return <SetupPanel />;
    case 'characters': return <CharactersPanel />;
    case 'art-dept': return <ArtDeptPanel />;
    case 'character-concepts': return <CharacterConceptsPanel />;
    case 'issue-compiler': return <IssueCompilerPanel />;
    case 'production-audit': return <ProductionAuditPanel />;
    case 'workbench': return <SceneWorkbench />;
    case 'visual-planning': return <VisualPlanningPanel />;
    case 'psb4-replay': return <ConsolePanel />;
    case 'psb4': return <Psb4Panel />;
    case 'teleplay': return <TeleplaysPanel />;
    case 'export': return <ExportPanel />;
    case 'generation-log': return <GenerationLogPanel />;
    default: return <UnknownViewPanel view={view} />;
  }
};
 
export default WorkspaceRouter;
