import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Show, ShowSummary, PipelineState, WorkspaceView, NodePath, Character, GenerationStats, User, Viewport, ReadinessIssue } from './types/models';
import { VaultStorage, migrateToAssetStorage } from './storage';
import { backfillSceneTitles } from './utils/assembleTeleplay';
import { migrateShow } from './utils/migration';
import { syncShowAssignmentsAndGallery } from './utils/issueAssignment';
import { ShowStorage } from './storage/ShowStorage';
import { useStorageInit } from './hooks/useStorageInit';

export type { User };

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  action?: { label: string; onClick: () => void };
}

interface State {
  // Vault list
  summaries: ShowSummary[];

  // Active show
  currentShow: Show | null;

  // Navigation
  view: WorkspaceView;
  activePath: NodePath;     // { seasonIdx: 0, episodeIdx?: N, actIdx?: N, sceneIdx?: N }

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean; // Tracks unsaved changes
  isMobileMenuOpen: boolean; // controls the mobile navigation drawer
  forceShowTree: boolean; // force show the project tree view regardless of view type

  // Pipeline
  pipeline: PipelineState;

  // Toast notifications
  toasts: Toast[];
  
  // Side effect triggers
  deletedShowId: string | null;
  autoIgnite: boolean;

  logFilter?: string; // FID or method to filter the generation log

  // Generation Mode
  generationMode: 'free' | 'paid';

  // Auth
  user: User | null;
  isAuthReady: boolean;

  // Viewport
  viewport: Viewport;
  reloadTrigger: number;
}

type Action = 
  | { type: 'HYDRATE_LIST'; summaries: ShowSummary[] }
  | { type: 'LOAD_SHOW_START' }
  | { type: 'LOAD_SHOW_SUCCESS'; show: Show }
  | { type: 'CREATE_SHOW'; show: Show }
  | { type: 'DELETE_SHOW'; id: string }
  | { type: 'UPDATE_SHOW'; updates: Partial<Show> }
  | { type: 'UPDATE_COMIC_STYLE'; comicStyle: Show['comicStyle'] }
  | { type: 'CLOSE_SHOW' }
  | { type: 'PIPELINE_START'; task: string }
  | { type: 'PIPELINE_UPDATE'; task?: string; subTask?: string; progress?: { current: number; total: number } }
  | { type: 'PIPELINE_LOG'; log: string }
  | { type: 'PIPELINE_END'; task: string; subTask: string }
  | { type: 'PIPELINE_CONFIRM' }
  | { type: 'PIPELINE_READINESS_WARNINGS'; warnings: ReadinessIssue[]; beatFid: string }
  | { type: 'SET_VIEW'; view: WorkspaceView; path?: NodePath }
  | { type: 'SET_PATH'; path: Partial<NodePath> }
  | { type: 'SET_SAVING'; isSaving: boolean }
  | { type: 'SET_DIRTY'; isDirty: boolean }
  | { type: 'TOGGLE_MOBILE_MENU' }
  | { type: 'TOGGLE_FORCE_SHOW_TREE' }
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'SET_AUTO_IGNITE'; enabled: boolean }
  | { type: 'CLEAR_DELETED_SHOW_ID' }
  | { type: 'SET_LOG_FILTER'; filter?: string }
  | { type: 'SET_GENERATION_MODE'; mode: 'free' | 'paid' }
  | { type: 'INCREMENT_STAT'; stat: keyof GenerationStats; beatFid?: string }
  | { type: 'SET_USER'; user: User | null }
  | { type: 'AUTH_READY' }
  | { type: 'SET_VIEWPORT'; viewport: Viewport }
  | { type: 'RELOAD_SHOW' };

const initialPipeline: PipelineState = {
  isRunning: false,
  currentTask: '',
  subTask: '',
  progress: { current: 0, total: 0 },
  logs: [],
  pendingConfirmation: false
};

const getSafeLocalStorage = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (e) {
    return fallback;
  }
};

const initialState: State = {
  summaries: [],
  currentShow: null,
  view: 'vault',
  activePath: { seasonIdx: 0 },
  isLoading: true,
  isSaving: false,
  isDirty: false,
  isMobileMenuOpen: false,
  forceShowTree: false,
  pipeline: initialPipeline,
  toasts: [],
  deletedShowId: null,
  autoIgnite: false,
  generationMode: (getSafeLocalStorage('GENERATION_MODE', 'paid') as 'free' | 'paid'),
  user: null,
  isAuthReady: true,
  viewport: 'desktop',
  reloadTrigger: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOG_FILTER':
      return { ...state, logFilter: action.filter };
    case 'SET_GENERATION_MODE':
      localStorage.setItem('GENERATION_MODE', action.mode);
      return { ...state, generationMode: action.mode };
    case 'INCREMENT_STAT': {
      if (!state.currentShow) return state;
      const globalStats = state.currentShow.generationStats || {
        punchUps: 0,
        visualGenerations: 0,
        autoLayouts: 0,
        panelGenerations: 0
      };

      const beatStatsMap = state.currentShow.beatStats || {};
      const beatFid = action.beatFid;
      let newBeatStatsMap = beatStatsMap;

      if (beatFid) {
        const currentBeatStats = beatStatsMap[beatFid] || {
          punchUps: 0,
          visualGenerations: 0,
          autoLayouts: 0,
          panelGenerations: 0
        };
        newBeatStatsMap = {
          ...beatStatsMap,
          [beatFid]: {
            ...currentBeatStats,
            [action.stat]: (currentBeatStats[action.stat] || 0) + 1
          }
        };
      }

      return {
        ...state,
        currentShow: {
          ...state.currentShow,
          generationStats: {
            ...globalStats,
            [action.stat]: (globalStats[action.stat] || 0) + 1
          },
          beatStats: newBeatStatsMap,
          lastModified: Date.now()
        },
        isDirty: true
      };
    }
    case 'SET_USER':
      return { ...state, user: action.user };
    case 'AUTH_READY':
      return { ...state, isAuthReady: true };
    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };
    case 'RELOAD_SHOW':
      return { ...state, reloadTrigger: state.reloadTrigger + 1 };
    case 'HYDRATE_LIST':
      return { ...state, summaries: action.summaries, isLoading: false };
    case 'LOAD_SHOW_START':
      return { ...state, isLoading: true };
    case 'LOAD_SHOW_SUCCESS': {
      const migrated = migrateShow(action.show);
      const patchedSeasons = backfillSceneTitles(migrated);
      let show = patchedSeasons
        ? { ...migrated, seasons: patchedSeasons }
        : migrated;
      
      const { assignments, gallery } = syncShowAssignmentsAndGallery(
        show.id,
        show.issuePageAssignments,
        show.comicGallery
      );
      show.issuePageAssignments = assignments;
      show.comicGallery = gallery;

      const keepViewAndPath = state.currentShow?.id === show.id;
      return { 
        ...state, 
        currentShow: show, 
        isLoading: false, 
        isDirty: false, 
        view: keepViewAndPath ? state.view : 'dashboard', 
        activePath: keepViewAndPath ? state.activePath : { seasonIdx: 0 } 
      };
    }
    case 'CLOSE_SHOW':
      return { ...state, currentShow: null, isDirty: false, view: 'vault', activePath: { seasonIdx: 0 } };
    case 'CREATE_SHOW': {
      const migratedShow = migrateShow(action.show);
      return { 
        ...state, 
        currentShow: migratedShow, 
        isDirty: false,
        view: 'concept',
        activePath: { seasonIdx: 0 },
        summaries: [
          ...state.summaries, 
          { 
            id: migratedShow.id, name: migratedShow.name, titleSuggestion: '', 
            premise: migratedShow.premise, initMode: migratedShow.initMode,
            draftVersion: 1, createdAt: migratedShow.createdAt,
            lastModified: migratedShow.lastModified || migratedShow.createdAt,
            characterCount: 0, episodeCount: 0, sceneCount: 0
          }
        ]
      };
    }
    case 'UPDATE_SHOW': {
      if (!state.currentShow) return state;
      let nextShow = { ...state.currentShow, ...action.updates, lastModified: Date.now() };

      const { assignments, gallery } = syncShowAssignmentsAndGallery(
        nextShow.id,
        nextShow.issuePageAssignments,
        nextShow.comicGallery
      );
      nextShow.issuePageAssignments = assignments;
      nextShow.comicGallery = gallery;

      return { 
        ...state, 
        currentShow: nextShow,
        isDirty: true
      };
    }
    case 'UPDATE_COMIC_STYLE':
      if (!state.currentShow) return state;
      return { 
        ...state, 
        currentShow: { ...state.currentShow, comicStyle: action.comicStyle, lastModified: Date.now() },
        isDirty: true
      };
    case 'DELETE_SHOW':
      return { 
        ...state, 
        summaries: state.summaries.filter(s => s.id !== action.id),
        currentShow: state.currentShow?.id === action.id ? null : state.currentShow,
        view: state.currentShow?.id === action.id ? 'vault' : state.view,
        deletedShowId: action.id
      };
    
    // NAVIGATION ACTIONS
    case 'SET_VIEW':
      return { 
        ...state, 
        view: action.view, 
        activePath: action.path ? { ...state.activePath, ...action.path } : state.activePath 
      };
    case 'SET_PATH':
      return { ...state, activePath: { ...state.activePath, ...action.path } };
    case 'SET_SAVING':
      return { ...state, isSaving: action.isSaving };
    case 'SET_DIRTY':
      return { ...state, isDirty: action.isDirty };
    case 'TOGGLE_MOBILE_MENU':
      return { ...state, isMobileMenuOpen: !state.isMobileMenuOpen };
    case 'TOGGLE_FORCE_SHOW_TREE':
      return { ...state, forceShowTree: !state.forceShowTree };
    
    // TOAST ACTIONS
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    case 'SET_AUTO_IGNITE':
      return { ...state, autoIgnite: action.enabled };
    case 'CLEAR_DELETED_SHOW_ID':
      return { ...state, deletedShowId: null };

    // PIPELINE ACTIONS
    case 'PIPELINE_START':
      return { 
        ...state, 
        pipeline: { 
          ...state.pipeline, 
          isRunning: true, 
          currentTask: action.task, 
          subTask: 'Initializing...', 
          logs: [`System: Pipeline triggered [${action.task}]`],
          progress: { current: 0, total: 0 },
          readinessWarnings: undefined,
          readinessBeatFid: undefined
        } 
      };
    case 'PIPELINE_UPDATE':
      return { 
        ...state, 
        pipeline: { 
          ...state.pipeline, 
          currentTask: action.task || state.pipeline.currentTask,
          subTask: action.subTask || state.pipeline.subTask,
          progress: action.progress || state.pipeline.progress,
          pendingConfirmation: (action as any).pendingConfirmation !== undefined ? (action as any).pendingConfirmation : state.pipeline.pendingConfirmation
        } 
      };
    case 'PIPELINE_LOG':
      return { 
        ...state, 
        pipeline: { 
          ...state.pipeline, 
          logs: [action.log, ...state.pipeline.logs].slice(0, 100) 
        } 
      };
    case 'PIPELINE_END':
      return { 
        ...state, 
        pipeline: { 
          ...state.pipeline, 
          isRunning: false, 
          currentTask: action.task, 
          subTask: action.subTask,
          pendingConfirmation: false,
          logs: [`System: Pipeline execution finalized.`, ...state.pipeline.logs]
        } 
      };
    case 'PIPELINE_CONFIRM':
      return {
        ...state,
        pipeline: {
          ...state.pipeline,
          pendingConfirmation: false,
          readinessWarnings: undefined,
          readinessBeatFid: undefined
        }
      };
    case 'PIPELINE_READINESS_WARNINGS':
      return {
        ...state,
        pipeline: {
          ...state.pipeline,
          readinessWarnings: action.warnings,
          readinessBeatFid: action.beatFid
        }
      };
      
    default:
      return state;
  }
}

const StoreContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  save: (customShow?: Show) => Promise<void>;
} | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = React.useRef(state);

  const { reloadTrigger, currentShow } = state;

  useEffect(() => {
    if (reloadTrigger === 0 || !currentShow?.id) return;
    ShowStorage.getById(currentShow.id).then(fresh => {
      if (fresh) dispatch({ type: 'LOAD_SHOW_SUCCESS', show: fresh });
    }).catch(err => {
      console.error('[StoreContext] RELOAD_SHOW failed:', err);
    });
  }, [reloadTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useStorageInit(
    (summaries) => dispatch({
      type: 'HYDRATE_LIST', summaries
    })
  );

  useEffect(() => {
    if (state.deletedShowId) {
      VaultStorage.deleteOne(state.deletedShowId)
        .then(() => {
          dispatch({ type: 'CLEAR_DELETED_SHOW_ID' });
        })
        .catch(err => {
          console.error("Failed to delete show from storage:", err);
          dispatch({ type: 'CLEAR_DELETED_SHOW_ID' });
        });
    }
  }, [state.deletedShowId]);
  
  // Auto-save only when isDirty.
  // Depends on isDirty + show id — not on the full show
  // object reference, so toast/view changes do not trigger it.
  useEffect(() => {
    if (!state.currentShow || !state.isDirty) return;
    const timer = setTimeout(async () => {
      try {
        await VaultStorage.saveOne(state.currentShow!, false);
        dispatch({ type: 'SET_DIRTY', isDirty: false });
      } catch (e) {
        console.warn("[Storage] Local auto-save failed:", e);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [state.isDirty, state.currentShow?.id]);

  const save = async (customShow?: Show) => {
    // Guard: reject if called with a DOM event (e.g. from onClick={save})
    if (customShow && typeof (customShow as any).preventDefault === 'function') {
      console.warn('[save] Called with a DOM event instead of a Show — ignoring event argument');
      customShow = undefined;
    }
    const currentShow = customShow || stateRef.current.currentShow;
    const { isSaving } = stateRef.current;
    if (!currentShow || isSaving) return;
    
    dispatch({ type: 'SET_SAVING', isSaving: true });
    try {
      // D265: Manual save forces cloud push to reconcile local changes with production storage.
      await VaultStorage.saveOne(currentShow, true);
      dispatch({ type: 'SET_DIRTY', isDirty: false });
      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { 
          id: `save-success-${Date.now()}`, 
          type: 'success', 
          message: "Show saved successfully." 
        } 
      });
    } catch (err) {
      console.error("Manual save failed:", err);
      dispatch({ 
        type: 'ADD_TOAST', 
        toast: { 
          id: `save-error-${Date.now()}`, 
          type: 'error', 
          message: "Save failed. Check storage quota." 
        } 
      });
    } finally {
      dispatch({ type: 'SET_SAVING', isSaving: false });
    }
  };

  return (
    <StoreContext.Provider value={{ state, dispatch, save }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  const reloadShow = () => context.dispatch({ type: 'RELOAD_SHOW' });
  return { ...context, reloadShow };
};
