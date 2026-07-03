// finalPagePromptPreview.ts — DA-082, DA-114
// Pure, model-free assembly of the EXACT composite prompt + reference manifest
// for a page. Single source of truth: generateFinalComicPage calls
// buildCompositePrompt() for the string it actually sends, and the Scene
// Workbench prompt panel calls buildPagePromptPreview() to show that same
// string live, before any generation. No drift between preview and dispatch.
//
// DA-114 changes (prompt structure recalibration for gemini-3-pro-image):
// — Prompt order: who/what → composition → panels → lettering → style.
//   This model reads a brief top-to-bottom; subject first, style last.
// — ONE PASS process narration removed (tells the model nothing visual).
// — Duplicate layout line removed (was stated twice: header + body sentence).
// — Layout names expanded to literal geometry (DIALOGUE_ROW → "three equal
//   horizontal panels in a single row"). Internal enum names are opaque to
//   the model.
// — FOCAL PANEL gated on layouts that actually support a dominant cell.
//   Fixed-grid layouts (2×2, equal rows, equal columns) can't honor it.
// — (declared position: ...) metadata stripped from balloon tail instructions.
//   It's internal bookkeeping; the model read it as text to position.
// — (responding to ...) annotation stripped from CHARACTER POSITIONS.
//   inResponseTo informed the plan; the visible bodyLanguage and
//   facialExpression fields already carry that forward. The annotation
//   leaked authorial intent (not a visible behavior) into the prompt.
// — CONSISTENCY RULES character-appearance clause removed — identical to
//   the appearance contract already stated in the CHARACTERS block.
//   Direct-address constraint kept as a single terse line.
// — LETTERING consolidated: the style header no longer has a LETTERING block.
//   One LETTERING SPEC appears at the bottom of this prompt, immediately
//   before STYLE, adjacent to the text it governs.
// — settingNote param added to buildCompositePrompt so the DIRECTOR'S NOTE
//   (location info) appears inside the composite string, between CHARACTERS
//   and the layout header, rather than being prepended externally.
// — buildPagePromptPreview now puts styleHeader last in fullPrompt.

import { Show } from '../../types/show';
import {
  FinalPageBeat,
  TextRenderItem,
  findCanonicalPageBeat,
  buildFinalPageBeat,
  validateFinalPage,
} from './finalPageContract';
import { assembleComicStyleHeader, DEFAULT_LETTERING_STYLE } from './comicStyleHeader';

// ── Layout name → human-readable geometry ────────────────────────────────────
// Internal enum strings (DIALOGUE_ROW, TRIPTYCH_H, etc.) are opaque to the
// model. This map expands them to literal layout descriptions the model can
// actually follow.

const LAYOUT_GEOMETRY: Record<string, string> = {
  'SPLASH':                  'full-page splash — single panel fills the entire canvas',
  'EQUAL_CONFRONTATION':     'two equal panels stacked vertically',
  'DIALOGUE_ROW':            'three equal horizontal panels in a single row',
  'THREE-PANEL SEQUENCE':    'three equal horizontal panels in a single row',
  'THREE-PANEL FOCUS':       'three panels: large left panel, two smaller panels stacked on the right',
  'THREE-PANEL ESCALATION':  'three panels increasing in height left to right',
  'TRIPTYCH_H':              'three equal horizontal panels in a single row',
  'TRIPTYCH_V':              'three equal vertical panels side by side',
  'ACTION_SEQUENCE':         'three panels: large top panel spanning full width, two equal panels below',
  'FEATURE_DETAIL':          'three panels: large left panel, two smaller panels stacked on the right',
  'ESCALATION':              'three panels increasing in height left to right',
  'WIDE_SPLIT':              'wide top panel spanning full width above two equal panels side by side',
  'SPLIT_WIDE':              'two equal panels side by side above a wide bottom panel spanning full width',
  'FOUR-PANEL 2x2 GRID':    'four equal panels in a 2×2 grid',
  '4-panel grid':            'four equal panels in a 2×2 grid',
  'FOUR_UP':                 'four equal panels in a 2×2 grid',
  'ASYMMETRIC_LEFT_FEATURE': 'large left panel and two smaller panels stacked on the right',
};

// Layouts where a FOCAL PANEL instruction makes sense — those with
// inherent size asymmetry. Fixed-grid layouts (all panels equal) cannot
// honor it and should not emit it.
const FOCAL_PANEL_ELIGIBLE = new Set([
  'SPLASH',
  'ACTION_SEQUENCE',
  'FEATURE_DETAIL',
  'THREE-PANEL FOCUS',
  'THREE-PANEL ESCALATION',
  'ESCALATION',
  'WIDE_SPLIT',
  'SPLIT_WIDE',
  'ASYMMETRIC_LEFT_FEATURE',
]);

function expandLayoutName(raw: string, panelCount: number): string {
  if (LAYOUT_GEOMETRY[raw]) return LAYOUT_GEOMETRY[raw];
  if (/^\d+-panel grid$/i.test(raw)) return `${panelCount} equal panels in a grid`;
  return raw;
}

// ── renderTextItem ────────────────────────────────────────────────────────────
// DA-114: (declared position: ...) annotation removed from tail instructions.
// It was internal bookkeeping from the panel plan; the model read it as a
// literal positioning constraint, creating noise.

export const renderTextItem = (t: TextRenderItem): string[] => {
  if (t.kind === 'caption') {
    const box =
      t.captionStyle === 'location'
        ? 'LOCATION CAPTION (rectangular box, dark fill #1A1A1A, thin black border, white uppercase text)'
        : t.captionStyle === 'internal'
          ? 'INTERNAL CAPTION (rectangular box, white fill, thin black border, italic black text)'
          : 'NARRATOR CAPTION (rectangular box, yellow fill #FFE100, thin black border, black uppercase text)';
    return [
      `    - ${box}, placed at the top edge of the panel.`,
      `      Render verbatim: "${t.text}"`,
    ];
  }

  const head = t.chained
    ? `    - TAILLESS JOINED SPEECH BALLOON segment for ${t.speakerName} (same speaker, connected within the same balloon group by a clean balloon bridge, NO separate tail):`
    : `    - SPEECH BALLOON for ${t.speakerName}:`;

  const lines = [head, `      Render verbatim: "${t.text}"`];

  if (!t.chained) {
    lines.push(
      `      Placement: ${t.position}; tail ${t.tailDirection ?? 'points toward the speaker'} — ` +
      `terminate at ${t.speakerName}'s mouth.`
    );
    if (t.speakerAnchor) lines.push(`      Speaker visual: ${t.speakerAnchor}.`);
  }

  return lines;
};

// ── buildCompositePrompt ──────────────────────────────────────────────────────
// DA-114 prompt order (subject → composition → panels → lettering → style):
//   1. CHARACTERS ON THIS PAGE
//   2. DIRECTOR'S NOTE / location (settingNote param, optional)
//   3. FINAL COMIC PAGE — N PANELS — [expanded geometry]
//   4. PAGE REGISTER
//   5. PANEL SEQUENCE
//   6. PROP CONTINUITY
//   7. LETTERING SPEC (single consolidated block — no duplicate in style header)
//   8. [SILENT PAGE if applicable]
// STYLE is appended outside this function (in fullPrompt, last).

export function buildCompositePrompt(contract: FinalPageBeat, settingNote?: string, show?: Show): string {
  const c = contract;

  const layoutGeometry = expandLayoutName(c.layoutName, c.panelCount);
  const focalEligible = FOCAL_PANEL_ELIGIBLE.has(c.layoutName);

  const namedLine = c.characters.map(ch => ch.name).join(', ');

  // ── 1. CHARACTERS block ───────────────────────────────────────────────────
  const charactersBlock = c.characters.length > 0
    ? `CHARACTERS ON THIS PAGE — Whenever a named character appears, the attached reference image for that character is the single source of truth for their appearance. Match the attached portrait exactly wherever that character appears: same face, same hair, same build, same costume. Do not add characters to panels where they are not staged.\n${namedLine}`
    : '';

  // ── 3. Page header ────────────────────────────────────────────────────────
  const pageHeader = [
    `FINAL COMIC PAGE — ${c.panelCount} PANEL${c.panelCount > 1 ? 'S' : ''} — ${layoutGeometry}.`,
    'Panels are separated by thin black gutters. The full 3:4 page is the canvas.',
  ].join('\n');

  // ── 4. PAGE REGISTER ──────────────────────────────────────────────────────
  const vd = c.visualDirection;
  const vdBlock = vd ? [
    'PAGE REGISTER (shared by all panels):',
    vd.lighting ? `Lighting: ${vd.lighting}` : '',
    vd.mood ? `Mood: ${vd.mood}` : '',
    vd.emotionalRegister ? `Register: ${vd.emotionalRegister}` : '',
    vd.environmentalDetail ? `Environmental detail: ${vd.environmentalDetail}` : '',
  ].filter(Boolean).join('\n') : '';

  // ── 5. PANEL SEQUENCE ─────────────────────────────────────────────────────
  const panelBlocks = c.panels.map(p => {
    const L: string[] = [];
    L.push(`PANEL ${p.index + 1} — ${p.shotType}`);
    L.push(`ACTION: ${p.action}`);
    if (p.foreground) L.push(`  FOREGROUND: ${p.foreground}`);
    if (p.midground) L.push(`  MIDGROUND: ${p.midground}`);
    if (p.background) L.push(`  BACKGROUND: ${p.background}`);
    if (p.relationalStaging) L.push(`  STAGING: ${p.relationalStaging}`);
    if (p.characterPositions.length > 0) {
      const pos = p.characterPositions.map(cp => {
        const facing = cp.facing ? `, facing ${cp.facing}` : '';
        const anchorNote = cp.anchor ? ` [${cp.anchor}]` : '';
        const expr = [cp.bodyLanguage, cp.facialExpression].filter(Boolean).join('; ');
        const exprNote = expr ? ` — ${expr}` : '';
        return `    - ${cp.name}${anchorNote}: ${cp.zone} ${cp.depth}${facing}${exprNote}`;
      }).join('\n');
      L.push(`  CHARACTER POSITIONS:\n${pos}`);
    }
    if (focalEligible && c.focalPanelIndex === p.index) {
      L.push('  FOCAL PANEL: this panel carries the most visual weight — give it the largest area.');
    }
    if (p.directAddress) {
      L.push('  DIRECT ADDRESS: a character looks at the reader here — intentional, high-impact.');
    }
    if (p.text.length > 0) {
      L.push('  TEXT TO RENDER IN THIS PANEL:');
      for (const t of p.text) L.push(...renderTextItem(t));
    } else {
      L.push('  NO TEXT IN THIS PANEL. No balloons, no captions, no labels.');
    }
    return L.join('\n');
  }).join('\n\n');

  // ── 6. PROP CONTINUITY ────────────────────────────────────────────────────
  const propsBlock = (c.panelProps?.length ?? 0) > 0
    ? [
        'PROP CONTINUITY — draw these objects identically in every panel they appear. Description is the spec:',
        ...c.panelProps!.map(pr => `— ${pr.label}: ${pr.description}`),
        '',
      ].join('\n')
    : '';

  // ── 7. LETTERING SPEC (single consolidated block) ────────────────────────
  const letteringStyle = (show?.comicStyle as any)?.letteringStyle || DEFAULT_LETTERING_STYLE;
  const letteringSpec = c.silentPage ? '' : [
    `LETTERING: ${letteringStyle}`,
    '— Render ONLY the text listed above, character-for-character. Never invent balloon, caption, label, sign, or sound effect text.',
    '— Tails must terminate at the speaker\'s mouth unless the item is marked as a joined continuation.',
    '— Captions: rectangular boxes at the panel\'s top edge, styled as specified.',
    '— FACE PROTECTION: no balloon, caption, or tail may cover any character\'s face. Move to negative space if needed.',
    '— Balloons must be large enough that all text is fully legible.',
    '',
  ].join('\n');

  const silentBlock = c.silentPage ? [
    'SILENT PAGE.',
    'No dialogue, no captions, no signage, no sound effects, no readable text of any kind.',
    'Pure visual storytelling. Any text in the output is a failure.',
    '',
  ].join('\n') : '';

  const anyDirect = c.panels.some(p => p.directAddress);
  const stagingConstraint = anyDirect
    ? '— Direct address only in panels marked above; all other panels keep characters engaged with the scene.'
    : '— Characters face and engage each other and the scene, not the reader.';

  return [
    charactersBlock,
    charactersBlock ? '' : null,
    settingNote || null,
    settingNote ? '' : null,
    pageHeader,
    '',
    vdBlock || null,
    vdBlock ? '' : null,
    'PANEL SEQUENCE — render in reading order (left to right, top to bottom):',
    '',
    panelBlocks,
    '',
    propsBlock || null,
    propsBlock ? '' : null,
    stagingConstraint,
    '',
    letteringSpec,
    silentBlock,
  ].filter(s => s !== null && s !== undefined).join('\n');
}

// ── Live preview (no model call) ──────────────────────────────────────────────

export interface PromptManifestItem {
  kind: 'style' | 'character' | 'setting' | 'prior';
  label: string;
  detail?: string;
}

export interface PagePromptPreview {
  ok: boolean;
  blocked: boolean;
  styleHeader: string;
  compositePrompt: string;
  fullPrompt: string;
  manifest: PromptManifestItem[];
  errors: string[];
  warnings: string[];
}

export function buildPagePromptPreview(
  show: Show,
  pageBeatUid: string,
  refCounts: { characterRefs: number; settingRefs: number; lockedRefs: number; priorPages: number },
  characterNames: string[],
  continuity: boolean,
  settingAnchorId?: string
): PagePromptPreview {
  const canonical = findCanonicalPageBeat(show, pageBeatUid);
  if (canonical.errors.length > 0 || !canonical.pb) {
    return {
      ok: false, blocked: true, styleHeader: '', compositePrompt: '', fullPrompt: '',
      manifest: [], errors: canonical.errors.length ? canonical.errors : ['PageBeat not found.'], warnings: [],
    };
  }

  const { contract, problems } = buildFinalPageBeat(show, canonical.pb, canonical.issueUid, canonical.sceneUid);
  const preflight = validateFinalPage(contract, problems, refCounts);

  const styleHeader = assembleComicStyleHeader(show, contract.silentPage);

  let settingNote: string | undefined;
  if (settingAnchorId) {
    const anchor = (show.settingAnchors ?? []).find(a => a.id === settingAnchorId);
    if (anchor) {
      const descParts: string[] = [];
      if (anchor.physicalDescription) descParts.push(anchor.physicalDescription);
      if (anchor.visualDescription) descParts.push(anchor.visualDescription);
      if (anchor.mood) descParts.push(`Mood: ${anchor.mood}.`);
      if (descParts.length > 0) {
        settingNote = `DIRECTOR'S NOTE (PRIORITY): LOCATION — ${anchor.name}: ${descParts.join(' ')}`;
      }
    }
  }

  const compositePrompt = buildCompositePrompt(contract, settingNote, show);

  // DA-114: styleHeader last — subject/action/lettering first, aesthetics last.
  const fullPrompt = [
    compositePrompt,
    styleHeader,
  ].filter(Boolean).join('\n\n');

  const manifest: PromptManifestItem[] = [];
  manifest.push({ kind: 'style', label: 'Style header', detail: 'comicStyle' });
  characterNames.forEach(n => manifest.push({ kind: 'character', label: `Character portrait: ${n}` }));
  if (refCounts.settingRefs > 0) manifest.push({ kind: 'setting', label: 'Environment reference' });
  if (continuity && refCounts.priorPages > 0) {
    manifest.push({ kind: 'prior', label: 'Previous page (continuity)', detail: 'following page in the book' });
  }

  return {
    ok: preflight.ok,
    blocked: !preflight.ok,
    styleHeader,
    compositePrompt,
    fullPrompt,
    manifest,
    errors: preflight.errors,
    warnings: preflight.warnings,
  };
}
