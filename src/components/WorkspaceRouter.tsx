import React from 'react';
import { useStore } from '../StoreContext';
import DashboardPanel from './DashboardPanel';
import ConceptPanel from './ConceptPanel';
import SetupPanel from './SetupPanel';
import CharactersPanel from './CharactersPanel';
import ArtDeptPanel from './ArtDeptPanel';
import CharacterConceptsPanel from './CharacterConceptsPanel';
import SeasonPanel from './SeasonPanel';
import EpisodeListPanel from './EpisodeListPanel';
import IssueCompilerPanel from './IssueCompilerPanel';
import ProductionHubPanel from './ProductionHubPanel';
import { ProductionAuditPanel } from './ProductionAuditPanel';
import TeleplaysPanel from './TeleplaysPanel';
import ExportPanel from './ExportPanel';
import GenerationLogPanel from './GenerationLogPanel';
import SceneWorkbench from './SceneWorkbench';
import ConsolePanel from './ConsolePanel';
import Psb4Panel from '../psb4/ui/Psb4Panel';
import VisualPlanningPanel from './VisualPlanningPanel';
// DA-089: mobile views graveyarded.
// import MobileShowHome from './mobile/MobileShowHome';
// import MobileHierarchy from './mobile/MobileHierarchy';
// import MobileBeatReview from './mobile/MobileBeatReview';
 
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
   case 'season': return <SeasonPanel />;
   case 'episode': return <EpisodeListPanel />;
   case 'issue-compiler': return <IssueCompilerPanel />;
   case 'production-hub': return <ProductionHubPanel />;
   case 'production-audit': return <ProductionAuditPanel />;
   case 'workbench': return <SceneWorkbench />;
   case 'visual-planning': return <VisualPlanningPanel />;
   case 'psb4-replay': return <ConsolePanel />;
   case 'psb4': return <Psb4Panel />;
   case 'teleplay': return <TeleplaysPanel />;
   case 'export': return <ExportPanel />;
   case 'generation-log': return <GenerationLogPanel />;
   // DA-089: mobile cases graveyarded; any stray m-* view falls back to dashboard.
   default: return <DashboardPanel />;
 }
};
 
export default WorkspaceRouter;
