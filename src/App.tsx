import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './StoreContext';
import { useProductionPipeline } from './hooks/useProductionPipeline';
import { getApiKey } from './domainUtils';
import Header from './components/Header';
import ProjectTree from './components/ProjectTree';
import WorkspaceRouter from './components/WorkspaceRouter';
import { requestPersistence } from './storage/db';
{/* D104: BiblePanel import removed */}
import PipelineHUD from './components/PipelineHUD';
import ToastSystem from './components/ToastSystem';
import VaultView from './components/VaultView';
import Breadcrumb from './components/nav/Breadcrumb';
import ErrorBoundary from './components/ErrorBoundary';
 
// DA-089: mobile graveyarded. import MobileShell from './components/mobile/MobileShell';
import PanZoomViewport from './components/PanZoomViewport';
import { FULLSCREEN_VIEWS, HIDE_BREADCRUMB_VIEWS, HIDE_PROJECT_TREE_VIEWS } from './types/models';
 
const AppContent: React.FC = () => {
 const { state, dispatch } = useStore();
 const { currentShow, isLoading, isMobileMenuOpen } = state;
 const [hasKey, setHasKey] = useState<boolean | null>(null);
 
 const { run } = useProductionPipeline();
 
 useEffect(() => {
   const checkKey = async () => {
     // Safety timeout for API key check
     const timeout = setTimeout(() => {
       console.warn("API key check timed out. Assuming key is present.");
       setHasKey(true);
     }, 5000);
 
     try {
       if (window.aistudio?.hasSelectedApiKey) {
         const selected = await window.aistudio.hasSelectedApiKey();
         clearTimeout(timeout);
         setHasKey(selected);
       } else {
         clearTimeout(timeout);
         setHasKey(true); // Fallback if not in AI Studio environment
       }
     } catch (e) {
       clearTimeout(timeout);
       setHasKey(true);
     }
   };
   checkKey();
   requestPersistence(); // Request storage persistence for iOS/Safari
 }, []);
 
 const handleSelectKey = async () => {
   if (window.aistudio?.openSelectKey) {
     await window.aistudio.openSelectKey();
     setHasKey(true); // Assume success per instructions
   }
 };
 
 useEffect(() => {
   if (state.autoIgnite && state.currentShow && !state.pipeline.isRunning) {
     dispatch({ type: 'SET_AUTO_IGNITE', enabled: false });
     run({ scope: 'show' }, false);
   }
 }, [state.autoIgnite, state.currentShow, state.pipeline.isRunning, dispatch, run]);
 
 useEffect(() => {
   const handleResize = () => {
     // DA-089: mobile disabled — always desktop. Pan-zoom handles small screens.
     const nextViewport = 'desktop' as const;
     if (nextViewport !== state.viewport) {
       dispatch({ type: 'SET_VIEWPORT', viewport: nextViewport });
     }
   };
   handleResize(); // initial check
   window.addEventListener('resize', handleResize);
   return () => window.removeEventListener('resize', handleResize);
 }, [state.viewport, dispatch]);
 
 useEffect(() => {
   if (!state.currentShow) return;
 
   // DA-089: mobile graveyarded — only the desktop redirect survives.
   const mobileOnly = ['m-show-home', 'm-hierarchy', 'm-beat-review'];
   if (mobileOnly.includes(state.view)) {
     dispatch({ type: 'SET_VIEW', view: 'dashboard' });
   }
 }, [state.viewport, state.currentShow?.id]);
 
 if (isLoading || hasKey === null) {
   return (
     <div className="min-h-screen bg-[#070707] flex items-center justify-center">
       <div className="text-white/90 uppercase tracking-[0.5em] animate-pulse font-bold text-xs">Initializing Production Vault...</div>
     </div>
   );
 }
 
 if (hasKey === false) {
   return (
     <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center p-8 text-center">
       <div className="max-w-md space-y-8">
         <div className="space-y-4">
           <h1 className="text-2xl font-light tracking-[0.2em] text-white/90 uppercase">API Key Required</h1>
           <p className="text-white/60 font-light leading-relaxed">
             To generate high-quality images, you must select a Gemini API key from a paid Google Cloud project.
           </p>
           <div className="pt-4">
             <a
               href="https://ai.google.dev/gemini-api/docs/billing"
               target="_blank"
               rel="noopener noreferrer"
               className="text-amber-500/80 hover:text-amber-500 text-xs uppercase tracking-widest transition-colors"
             >
               Billing Documentation ↗
             </a>
           </div>
         </div>
         <button
           onClick={handleSelectKey}
           className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/90 uppercase tracking-[0.3em] text-xs font-medium"
         >
           Select API Key
         </button>
       </div>
     </div>
   );
 }
 
 // DA-089: mobile branch graveyarded. The desktop app + PanZoomViewport now
 // serves every screen size.
 
 return (
   <div className="h-screen bg-[#070707] text-white flex flex-col font-sans selection:bg-amber-500/30 overflow-hidden">
     <ToastSystem />
     
     {!currentShow ? (
       <div className="flex-1 overflow-y-auto p-4 md:p-12">
         <VaultView />
       </div>
     ) : (
       <>
         <Header />
         <PanZoomViewport designWidth={1280}>
         <div className="flex-1 flex relative min-h-0 overflow-hidden h-full">
            {isMobileMenuOpen && (
              <div
                className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
                onClick={() => dispatch({ type: 'TOGGLE_MOBILE_MENU' })}
              />
            )}
           
            {(!HIDE_PROJECT_TREE_VIEWS.includes(state.view) || state.forceShowTree) && <ProjectTree />}
           
            <main className="flex-1 bg-[#070707] relative flex flex-col min-h-0 overflow-hidden">
               {!HIDE_BREADCRUMB_VIEWS.includes(state.view) && <Breadcrumb />}
               <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                 <div className={FULLSCREEN_VIEWS.includes(state.view) ? 'h-full w-full' : 'max-w-5xl mx-auto p-4 md:p-12 pb-32 w-full'}>
 
                   <WorkspaceRouter />
                 </div>
               </div>
            </main>
         </div>
         </PanZoomViewport>
         <PipelineHUD />
       </>
     )}
   </div>
 );
};
 
const App: React.FC = () => (
 <ErrorBoundary>
   <StoreProvider>
     <AppContent />
   </StoreProvider>
 </ErrorBoundary>
);
 
export default App;
