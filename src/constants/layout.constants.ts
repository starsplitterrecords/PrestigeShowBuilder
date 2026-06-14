export interface Region { left: number; top: number; width: number; height: number; }

// ── PANEL_REGIONS ──────────────────────────────────────────────────────────
// Authoritative single source for all panel geometry.
// Used by: TextOverlayRenderer (canvas), buildLetteringPrompt (AI lettering).
// Contains BOTH old layout names (beat path / ComicPagePlan)
// AND new layout names (scene path / ScenePagePlan).
export const PANEL_REGIONS: Record<string, Region[]> = {
  // ── Single panel ───────────────────────────────────────────────────────
  'SINGLE PANEL':            [{ left:0, top:0, width:1, height:1 }],
  'SPLASH':                  [{ left:0, top:0, width:1, height:1 }],
  'FULL_PAGE_COMPOSITE':     [{ left:0, top:0, width:1, height:1 }],
  // ── Two-panel (old beat-path names) ────────────────────────────────────
  'TWO-PANEL VERTICAL SPLIT':[{ left:0,top:0,width:1,height:0.55 },{left:0,top:0.55,width:1,height:0.45}],
  'TWO-PANEL EQUAL STACK':   [{ left:0,top:0,width:1,height:0.5  },{left:0,top:0.5, width:1,height:0.5 }],
  'TWO-PANEL CINEMATIC':     [{ left:0,top:0,width:1,height:0.35 },{left:0,top:0.35,width:1,height:0.65}],
  'TWO-PANEL ASYMMETRIC':    [{ left:0,top:0,width:1,height:0.25 },{left:0,top:0.25,width:1,height:0.75}],
  // ── Two-panel (scene-path names from PAGE_LAYOUTS) ─────────────────────
  'WIDE_TIGHT':              [{ left:0,top:0,width:1,height:0.60 },{left:0,top:0.60,width:1,height:0.40}],
  'EQUAL_CONFRONTATION':     [{ left:0,top:0,width:1,height:0.5  },{left:0,top:0.5, width:1,height:0.5 }],
  'CINEMATIC_STRIP':         [{ left:0,top:0,width:1,height:0.35 },{left:0,top:0.35,width:1,height:0.65}],
  'ASYMMETRIC_WEIGHT':       [{ left:0,top:0,width:1,height:0.25 },{left:0,top:0.25,width:1,height:0.75}],
  'TIGHT_WIDE':              [{left:0,top:0,width:1,height:0.40},{left:0,top:0.40,width:1,height:0.60}],
  // ── Three-panel (old beat-path names) ──────────────────────────────────
  'THREE-PANEL SEQUENCE':    [{left:0,top:0,width:0.333,height:1},{left:0.333,top:0,width:0.334,height:1},{left:0.667,top:0,width:0.333,height:1}],
  'THREE-PANEL FOCUS':       [{left:0,top:0,width:0.60,height:1},{left:0.60,top:0,width:0.40,height:0.5},{left:0.60,top:0.5,width:0.40,height:0.5}],
  'THREE-PANEL ESCALATION':  [{left:0,top:0,width:0.25,height:1},{left:0.25,top:0,width:0.35,height:1},{left:0.60,top:0,width:0.40,height:1}],
  // ── Three-panel (scene-path names) ─────────────────────────────────────
  'ACTION_SEQUENCE':         [{left:0,top:0,width:0.40,height:1},{left:0.40,top:0,width:0.30,height:1},{left:0.70,top:0,width:0.30,height:1}],
  'DIALOGUE_ROW':            [{left:0,top:0,width:0.333,height:1},{left:0.333,top:0,width:0.334,height:1},{left:0.667,top:0,width:0.333,height:1}],
  'FEATURE_DETAIL':          [{left:0,top:0,width:0.60,height:1},{left:0.60,top:0,width:0.40,height:0.5},{left:0.60,top:0.5,width:0.40,height:0.5}],
  'ESCALATION':              [{left:0,top:0,width:0.25,height:1},{left:0.25,top:0,width:0.35,height:1},{left:0.60,top:0,width:0.40,height:1}],
  'TRIPTYCH_H':              [{left:0,top:0,width:1,height:0.333},{left:0,top:0.333,width:1,height:0.334},{left:0,top:0.667,width:1,height:0.333}],
  'TRIPTYCH_V':              [{left:0,top:0,width:0.333,height:1},{left:0.333,top:0,width:0.334,height:1},{left:0.667,top:0,width:0.333,height:1}],
  'WIDE_SPLIT':              [{left:0,top:0,width:1,height:0.50},{left:0,top:0.50,width:0.50,height:0.50},{left:0.50,top:0.50,width:0.50,height:0.50}],
  'SPLIT_WIDE':              [{left:0,top:0,width:0.50,height:0.50},{left:0.50,top:0,width:0.50,height:0.50},{left:0,top:0.50,width:1,height:0.50}],
  // ── Four-panel (old beat-path names) ───────────────────────────────────
  'FOUR-PANEL 2x2 GRID':     [{left:0,top:0,width:0.5,height:0.5},{left:0.5,top:0,width:0.5,height:0.5},{left:0,top:0.5,width:0.5,height:0.5},{left:0.5,top:0.5,width:0.5,height:0.5}],
  'FOUR-PANEL FEATURE':      [{left:0,top:0,width:0.60,height:0.55},{left:0.60,top:0,width:0.40,height:0.55},{left:0,top:0.55,width:0.50,height:0.45},{left:0.50,top:0.55,width:0.50,height:0.45}],
  // ── Four-panel (scene-path names) ──────────────────────────────────────
  'GRID_2x2':                [{left:0,top:0,width:0.5,height:0.5},{left:0.5,top:0,width:0.5,height:0.5},{left:0,top:0.5,width:0.5,height:0.5},{left:0.5,top:0.5,width:0.5,height:0.5}],
  'FEATURE_STRIP':           [{left:0,top:0,width:0.60,height:0.55},{left:0.60,top:0,width:0.40,height:0.55},{left:0,top:0.55,width:0.50,height:0.45},{left:0.50,top:0.55,width:0.50,height:0.45}],
  'MAGAZINE':                [{left:0,top:0,width:1,height:0.30},{left:0,top:0.30,width:0.333,height:0.70},{left:0.333,top:0.30,width:0.334,height:0.70},{left:0.667,top:0.30,width:0.333,height:0.70}],
  // ── Five-panel (scene-path names) ──────────────────────────────────────
  'DYNAMIC_5':               [{left:0,top:0,width:0.55,height:0.65},{left:0.55,top:0,width:0.45,height:0.33},{left:0.55,top:0.33,width:0.45,height:0.32},{left:0,top:0.65,width:0.50,height:0.35},{left:0.50,top:0.65,width:0.50,height:0.35}],
  'ESCALATING_5':            [{left:0,top:0,width:0.45,height:0.40},{left:0.45,top:0,width:0.28,height:0.40},{left:0.73,top:0,width:0.27,height:0.40},{left:0,top:0.40,width:1,height:0.30},{left:0,top:0.70,width:1,height:0.30}],
  // ── Six-panel (scene-path names) ───────────────────────────────────────
  'GRID_2x3':                [{left:0,top:0,width:0.5,height:0.333},{left:0.5,top:0,width:0.5,height:0.333},{left:0,top:0.333,width:0.5,height:0.334},{left:0.5,top:0.333,width:0.5,height:0.334},{left:0,top:0.667,width:0.5,height:0.333},{left:0.5,top:0.667,width:0.5,height:0.333}],
  'FEATURE_6':               [{left:0,top:0,width:1,height:0.35},{left:0,top:0.35,width:0.333,height:0.325},{left:0.333,top:0.35,width:0.334,height:0.325},{left:0.667,top:0.35,width:0.333,height:0.325},{left:0,top:0.675,width:0.50,height:0.325},{left:0.50,top:0.675,width:0.50,height:0.325}],
};

// ── POSITION_INFO ──────────────────────────────────────────────────────────
// Balloon corner descriptions and tail directions for the AI lettering prompt.
export const POSITION_INFO: Record<string, { desc: string; tail: string }> = {
  'top-left':    { desc: 'top-left corner',    tail: 'Tail curves down-right toward the speaker.' },
  'top-right':   { desc: 'top-right corner',   tail: 'Tail curves down-left toward the speaker.' },
  'bottom-left': { desc: 'bottom-left corner', tail: 'Tail curves up-right toward the speaker.' },
  'bottom-right':{ desc: 'bottom-right corner',tail: 'Tail curves up-left toward the speaker.' },
  'top-full':    { desc: 'top edge, full width',tail: '' },
};

// ── PAGE_LAYOUTS ───────────────────────────────────────────────────────────
// Scene-path layout definitions. Used by planScenePages → selectPageLayout.
export const PAGE_LAYOUTS: Record<number, Array<{ name: string; description: string; tags: string[] }>> = {
  1: [
    { name: 'SPLASH',
      description: 'Full-page splash. Single image fills the entire page edge to edge.',
      tags: ['any'] },
    { name: 'FULL_PAGE_COMPOSITE',
      description: 'Single full-page panel with two simultaneous visual registers. A grounded reality layer and a looming memory/vision layer occupying the negative space.',
      tags: ['memory_bleed'] }
  ],
  2: [
    { name: 'WIDE_TIGHT',
      description: 'Two panels stacked. Top panel: full-width establishing (60% height). Bottom panel: tight close-up reaction (40% height).',
      tags: ['establishing', 'dialogue'] },
    { name: 'EQUAL_CONFRONTATION',
      description: 'Two equal panels stacked. Direct comparison — mirrors the characters across the gutter.',
      tags: ['dialogue', 'confrontation'] },
    { name: 'CINEMATIC_STRIP',
      description: 'Top panel: full-width widescreen strip (16:9 proportion). Bottom panel: portrait close-up, centered.',
      tags: ['action', 'establishing'] },
    { name: 'ASYMMETRIC_WEIGHT',
      description: 'Top panel narrow atmosphere strip (25% height). Bottom panel: large, confrontational, fills remaining page.',
      tags: ['dialogue', 'tension'] },
  ],
  3: [
    { name: 'ACTION_SEQUENCE', description: 'Three panels across. Left panel large (40%). Centre and right equal (30% each). Left panel dominates.', tags: ['action'] },
    { name: 'DIALOGUE_ROW', description: 'Three equal panels in a horizontal row. Steady rhythm for conversation.', tags: ['dialogue'] },
    { name: 'FEATURE_DETAIL', description: 'Left panel large portrait (60% width). Right side: two panels stacked equal. Emphasis then detail.', tags: ['establishing', 'dialogue'] },
    { name: 'ESCALATION', description: 'Panels increase in size left to right. Small narrow opener, medium mid, large wide closer. Builds intensity.', tags: ['action', 'tension'] },
  ],
  4: [
    { name: 'GRID_2x2', description: 'Four equal panels in a 2x2 grid. Clear white gutters. Even, steady rhythm.', tags: ['dialogue'] },
    { name: 'FEATURE_STRIP', description: 'Large feature panel top-left (portrait). Small panel top-right. Full-width cinematic strip at bottom split into two.', tags: ['action', 'dialogue'] },
    { name: 'MAGAZINE', description: 'Full-width panel at top (widescreen establishing). Three equal panels below in a row.', tags: ['establishing', 'dialogue'] },
  ],
  5: [
    { name: 'DYNAMIC_5', description: 'Large panel top-left (2x2 units). Small panel top-right. Full-width middle panel. Two equal panels bottom row.', tags: ['action', 'dialogue'] },
    { name: 'ESCALATING_5', description: 'Three panels top row (left large, two small). Full-width middle. One large bottom panel. Cinematic pacing.', tags: ['action'] },
  ],
  6: [
    { name: 'GRID_2x3', description: 'Six equal panels in a 2-column, 3-row grid. Maximum information density. Rapid time passage.', tags: ['action', 'montage'] },
    { name: 'FEATURE_6', description: 'Large feature panel spanning full width at top. Five smaller panels in two rows below.', tags: ['establishing', 'dialogue'] },
  ],
};

// ── PANEL_COUNT_TO_LAYOUT ──────────────────────────────────────────────────
// Beat-path layout strings. Used by planComicPage in assembleComicPrompt.
export const PANEL_COUNT_TO_LAYOUT: Record<number, string[]> = {
  1: ['SINGLE PANEL: One full-width panel. Characters and action fill the frame.'],
  2: [
    'TWO-PANEL VERTICAL SPLIT: Two panels stacked. Top panel taller and wider, establishing the moment. Bottom panel tighter and reactive.',
    'TWO-PANEL EQUAL STACK: Two equal-height panels stacked. Direct comparison — mirror the tension between them.',
    'TWO-PANEL CINEMATIC: Top panel is a full-width widescreen establishing shot (16:9 crop). Bottom panel is a tight close-up reaction shot.',
    'TWO-PANEL ASYMMETRIC: Top panel is a narrow atmospheric strip. Bottom panel is large and confrontational, filling three-quarters of the page.',
  ],
  3: [
    'THREE-PANEL SEQUENCE: Three equal panels across the page. Left panel: the action. Centre panel: the reaction. Right panel: the consequence.',
    'THREE-PANEL FOCUS: Left panel large (60% of page width). Right side: two smaller panels stacked — emphasis then detail.',
    'THREE-PANEL ESCALATION: Panels increase in size left to right. Small opener, medium mid, large closer. Builds intensity.',
  ],
  4: [
    'FOUR-PANEL 2x2 GRID: Four equal panels in a 2-by-2 grid. Clear white gutters between all panels.',
    'FOUR-PANEL FEATURE: Large panel top-left (portrait proportion). Small panel top-right. Full-width cinematic strip at the bottom split into two equal panels.',
  ],
};

// ── selectPageLayout ───────────────────────────────────────────────────────
// Moved here from planScenePages.ts so it lives with the data it selects from.
import { CinematicBeat } from '../types/models';
import { hasSignificantAction } from '../domainUtils';

export function selectPageLayout(
  panelCount: number,
  beats: CinematicBeat[]
): { name: string; description: string } {
  if (beats.some(b => b.beatType === 'MEMORY_BLEED')) {
    return PAGE_LAYOUTS[1].find(l => l.name === 'FULL_PAGE_COMPOSITE')!;
  }

  const layouts = PAGE_LAYOUTS[Math.min(panelCount, 6)] ?? PAGE_LAYOUTS[4];
  const hasEstablishing = beats.some(b => b.beatType === 'ESTABLISHING');
  const hasAction = beats.some(b => hasSignificantAction(b));
  const seed = beats.reduce((acc, b) => acc + b.fid.length, 0);
  const preferred = layouts.filter(l =>
    (hasEstablishing && l.tags.includes('establishing')) ||
    (hasAction && l.tags.includes('action')) ||
    l.tags.includes('dialogue')
  );
  const pool = preferred.length > 0 ? preferred : layouts;
  return pool[seed % pool.length];
}

// ── getRegion ──────────────────────────────────────────────────────────────
// Shared panel region lookup. Used by TextOverlayRenderer and buildLetteringPrompt.
export function getRegion(layoutName: string | undefined, pIdx: number, total: number): Region {
  const tbl = layoutName ? PANEL_REGIONS[layoutName] : undefined;
  if (tbl?.[pIdx]) return tbl[pIdx];
  const h = 1 / Math.max(1, total);
  return { left: 0, top: Math.min(pIdx, total - 1) * h, width: 1, height: h };
}

export function regionToPct(r: Region): string {
  const l = Math.round(r.left * 100);
  const r2 = Math.round((r.left + r.width) * 100);
  const t = Math.round(r.top * 100);
  const b = Math.round((r.top + r.height) * 100);
  return `left ${l}% to ${r2}%, top ${t}% to ${b}%`;
}
