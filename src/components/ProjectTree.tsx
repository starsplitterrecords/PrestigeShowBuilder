import React, { useState, useEffect } from 'react';
import { useStore } from '../StoreContext';
import { WorkspaceView } from '../types/models';
import HierarchyTree from './nav/HierarchyTree';
import { useRecentlyVisited } from '../hooks/useRecentlyVisited';

const ProjectTree: React.FC = () => {
  const { state, dispatch } = useStore();
  const { view, currentShow, activePath } = state;
  const { visited } = useRecentlyVisited();
  const [recentExpanded, setRecentExpanded] = useState(false);

  const handleNavClick = (view: WorkspaceView) => {
    dispatch({ type: 'SET_VIEW', view });
    if (state.isMobileMenuOpen) {
      dispatch({ type: 'TOGGLE_MOBILE_MENU' });
    }
  };

  return (
    <aside className={`w-64 border-r border-white/70 bg-[#0a0a0a] flex-col shrink-0 fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:h-full ${state.isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex`}>
      <div className="p-6 border-b border-white/70 flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-[0.4em] font-black text-white/90">Navigation</span>
        {state.isMobileMenuOpen && (
          <button onClick={() => dispatch({ type: 'TOGGLE_MOBILE_MENU' })} className="lg:hidden text-white p-2">
            ✕
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* ── MAIN NAV ────────────────────────────── */}
        <div className="space-y-1">
          {([
            { view: "setup",              label: "Settings" },
            { view: "dashboard",          label: "Dashboard" },
            { view: "concept",            label: "Series Bible" },
            { view: "art-dept",           label: "Art Dept" },
            { view: "characters",         label: "Ensemble" },
            { view: "character-concepts", label: "Character Concepts" },
          ] as const).map(item => (
            <button key={item.view}
              onClick={() => handleNavClick(item.view as WorkspaceView)}
              className={`w-full text-left py-3 px-4 text-[10px] uppercase tracking-widest
                font-bold rounded-sm transition-all min-h-[44px] ${
                view === item.view
                  ? "bg-white/30 text-amber-500"
                  : "text-white hover:text-white hover:bg-white/30"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-t border-white/70"></div>

        {/* ── PRODUCTION ────────────────────────────── */}
        <div className="space-y-1">
          {([
            { view: "production-hub", label: "Production Hub" },
            { view: "psb4",           label: "Story Pipeline" },
            { view: "visual-planning", label: "Visual Planner" },
            { view: "workbench",      label: "Scene Workbench" },
            { view: "issue-compiler", label: "Issue Compiler" },
          ] as const).map(item => (
            <button key={item.view}
              onClick={() => handleNavClick(item.view as WorkspaceView)}
              className={`w-full text-left py-3 px-4 text-[10px] uppercase tracking-widest
                font-bold rounded-sm transition-all min-h-[44px] ${
                view === item.view
                  ? "bg-white/30 text-amber-500"
                  : "text-white hover:text-white hover:bg-white/30"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-t border-white/70"></div>

        {/* ── LOGS ────────────────────────────── */}
        <div className="space-y-1">
          {([
            { view: "production-audit", label: "Production Audit" },
            { view: "generation-log",      label: "Image Log" },
            { view: "psb4-replay",         label: "Replay Console" },
          ] as const).map(item => (
            <button key={item.view}
              onClick={() => handleNavClick(item.view as WorkspaceView)}
              className={`w-full text-left py-3 px-4 text-[10px] uppercase tracking-widest
                font-bold rounded-sm transition-all min-h-[44px] ${
                view === item.view
                  ? "bg-white/30 text-amber-500"
                  : "text-white hover:text-white hover:bg-white/30"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="border-t border-white/70"></div>

        {/* ── EXPORTS ────────────────────────────── */}
        <div className="space-y-1">
          <button
            onClick={() => handleNavClick("export")}
            className={`w-full text-left py-3 px-4 text-[10px] uppercase tracking-widest
              font-bold rounded-sm transition-all min-h-[44px] ${
              view === "export"
                ? "bg-white/30 text-amber-500"
                : "text-white hover:text-white hover:bg-white/30"
            }`}
          >
            Exports
          </button>
        </div>

        {/* ── STORY HIERARCHY ──────────────────────────── */}
        {currentShow && (
          <div className="space-y-2 pt-4">
            <div className="px-4 text-[10px] uppercase tracking-[0.3em] font-black text-white/90">
              Story Hierarchy
            </div>

            {/* Hierarchy tree */}
            {currentShow.seasons?.length > 0 && (
              <div className="pt-1">
                <HierarchyTree />
              </div>
            )}
          </div>
        )}

        {/* ── BOTTOM SPACER ────────────────────────────── */}
        {/* Ensures bottom items are reachable when PipelineHUD banner is visible */}
        <div className="h-32 shrink-0" />
      </nav>
    </aside>
  );
};

export default ProjectTree;
