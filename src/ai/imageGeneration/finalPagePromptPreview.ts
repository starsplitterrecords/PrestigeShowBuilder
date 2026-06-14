// finalPagePromptPreview.ts — DA-082
// Pure, model-free assembly of the EXACT composite prompt + reference manifest
// for a page. Single source of truth: generateFinalComicPage calls
// buildCompositePrompt() for the string it actually sends, and the Scene
// Workbench prompt panel calls buildPagePromptPreview() to show that same
// string live, before any generation. No drift between preview and dispatch.
 
import { Show } from '../../types/show';
import {
  FinalPageBeat,
  TextRenderItem,
  findCanonicalPageBeat,
  buildFinalPageBeat,
  validateFinalPage,
} from './finalPageContract';
 
// renderTextItem — moved here from generateFinalComicPage so the preview and
// the live call share it verbatim. (Delete the copy in generateFinalComicPage
// and import this one — see DA-082 Edit 2.)
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
    ? `    - CHAINED SPEECH BALLOON for ${t.speakerName} (stacked directly below the previous balloon, same corner, NO tail):`
    : `    - SPEECH BALLOON for ${t.speakerName}:`;
  const lines = [head, `      Render verbatim: "${t.text}"`];
  if (!t.chained) {
    const declared = t.speakerZone
      ? ` (declared position: ${t.speakerZone} ${t.speakerDepth ?? ''})`.trimEnd() + ')'
      : '';
    lines.push(
      `      Placement: ${t.position}; tail ${t.tailDirection ?? 'points toward the speaker'} — ` +
      `terminate at ${t.speakerName}'s mouth${declared}.`
    );
    if (t.speakerAnchor) lines.push(`      Speaker visual: ${t.speakerAnchor}.`);
  }
  return lines;
};
 
// buildCompositePrompt — the EXACT string sent to the model. Extracted verbatim
// from generateFinalComicPage (lines 108–221). Pure function of the contract.
export function buildCompositePrompt(contract: FinalPageBeat): string {
  const c = contract;
 
  // DA-085: names only. The attached portrait is the identity; descriptions
  // are never emitted (they override the reference image).
  const charBlock = c.characters
    .map(ch => ch.name)
    .join('\n');
 
  const namedLine = c.characters
    .map(ch => ch.name)
    .join(', ');
 
  const vd = c.visualDirection;
  const vdBlock = vd ? [
    'PAGE REGISTER (shared by all panels):',
    vd.lighting ? `Lighting: ${vd.lighting}` : '',
    vd.mood ? `Mood: ${vd.mood}` : '',
    vd.emotionalRegister ? `Register: ${vd.emotionalRegister}` : '',
    vd.environmentalDetail ? `Environmental detail: ${vd.environmentalDetail}` : '',
  ].filter(Boolean).join('\n') : '';
 
  const anyDirect = c.panels.some(p => p.directAddress);
 
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
        const respNote = cp.inResponseTo ? ` (responding to ${cp.inResponseTo})` : '';
        return `    - ${cp.name}${anchorNote}: ${cp.zone} ${cp.depth}${facing}${exprNote}${respNote}`;
      }).join('\n');
      L.push(`  CHARACTER POSITIONS:\n${pos}`);
    }
    if (c.focalPanelIndex === p.index) {
      L.push('  FOCAL PANEL: this panel dominates the page — give it the most space and visual weight.');
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
 
  const propsBlock = (c.panelProps?.length ?? 0) > 0
    ? [
        'PROP CONTINUITY — draw these objects identically in every panel they appear. Description is the spec:',
        ...c.panelProps!.map(pr => `— ${pr.label}: ${pr.description}`),
        '',
      ].join('\n')
    : '';
 
  const letteringSpec = c.silentPage ? '' : [
    'LETTERING SPEC (applies to every TEXT TO RENDER item above):',
    '— Render ONLY the text listed above, character-for-character. If a balloon, caption, label, sign, or sound effect is not listed, it does not exist on this page. Never invent text.',
    '— Speech balloons: white fill, thin black border (1px, not heavy), slightly irregular oval. Professional bold all-caps comic font, uniform line weight. NO handwriting, NO calligraphy, NO serif, NO standard sans-serif like Arial.',
    '— Tails: slim, smooth, terminate at the speaker\'s mouth. Chained balloons stack vertically; only the last in a chain has a tail.',
    '— Captions: rectangular boxes at the panel\'s top edge, styles as specified per item.',
    '— FACE PROTECTION: no balloon, caption, or tail may cover any character\'s face. If text would cover a face, move it to negative space (sky, wall, shadow).',
    '— Balloons must be large enough that all text is fully legible.',
    '',
  ].join('\n');
 
  const silentBlock = c.silentPage ? [
    'SILENT PAGE.',
    'This page contains no dialogue, no captions, no signage, no sound effects, and no readable text of any kind.',
    'Pure visual storytelling. Any text in the output is a failure.',
    '',
  ].join('\n') : '';
 
  return [
    `FINAL COMIC PAGE — ${c.panelCount} PANEL${c.panelCount > 1 ? 'S' : ''} — LAYOUT: ${c.layoutName}`,
    'ONE PASS: artwork and lettering are produced together. The output is the finished, lettered comic page.',
    '',
    'Generate a single image that is a complete comic book page.',
    `The page contains exactly ${c.panelCount} panel${c.panelCount > 1 ? 's' : ''} arranged in the ${c.layoutName} layout.`,
    'Panels are separated by thin black gutters. The full 3:4 page is the canvas.',
    '',
    c.characters.length > 0
      ? `CHARACTERS ON THIS PAGE — the attached reference image for each named character is the single source of truth for their appearance. Match each attached portrait exactly in every panel: same face, same hair, same build, same costume. Render only what the portrait shows; do not invent or embellish features.\n${c.characters.map(ch => ch.name).join(', ')}`
      : '',
    '',
    vdBlock,
    vdBlock ? '' : null,
    'PANEL SEQUENCE — render in reading order (left to right, top to bottom):',
    '',
    panelBlocks,
    '',
    propsBlock,
    'CONSISTENCY RULES:',
    anyDirect
      ? '— Direct address is used only in the panel(s) marked above; all other panels keep characters engaged with the scene, not the reader.'
      : '— Characters face and engage each other and the scene, not the reader. No forward-facing direct-to-camera poses; direct address is not used on this page.',
    namedLine
      ? `— ${namedLine}: identical appearance in every panel — same face, same costume, same build.`
      : '— Characters: identical appearance in every panel. Same face, same costume, same build.',
    '— Lighting direction, color palette, and art style must be consistent across all panels.',
    '— Panels flow in reading order: left to right, top to bottom.',
    '',
    letteringSpec,
    silentBlock,
  ].filter(s => s !== null && s !== undefined).join('\n');
}
 
// ── Live preview (no model call) ──────────────────────────────────────────
 
export interface PromptManifestItem {
  kind: 'style' | 'character' | 'setting' | 'prior';
  label: string;
  detail?: string;
}
 
export interface PagePromptPreview {
  ok: boolean;
  blocked: boolean;            // hard preflight failure (duplicate / zero-ref / unresolved)
  styleHeader: string;
  compositePrompt: string;     // identical to what generateFinalComicPage will send
  fullPrompt: string;          // styleHeader + composite, as the model receives text parts
  manifest: PromptManifestItem[];
  errors: string[];
  warnings: string[];
}
 
// assembleComicStyleHeader is defined in generateFinalComicPage; to keep this
// module free of the GoogleGenAI import we re-derive the header here from the
// same comicStyle fields. (DA-082 note: if you prefer one definition, move
// assembleComicStyleHeader into this file and import it into the generator.)
function styleHeaderOf(show: Show): string {
  const cs: any = show.comicStyle || {};
  const styleBits = [
    cs.artistStyle,
    cs.colorPalette ? `Color palette: ${cs.colorPalette}` : '',
    cs.lineWeight ? `Line weight: ${cs.lineWeight}` : '',
  ].filter(Boolean).join('. ');
  const out = [`STYLE: ${styleBits || 'professional comic book art, clean linework'}.`];
  if (cs.compositionPrompt) out.push(`COMPOSITION: ${cs.compositionPrompt}.`);
  if (cs.negativePrompt) out.push(`EXCLUDE: ${cs.negativePrompt}.`);
  return out.join('\n');
}
 
export function buildPagePromptPreview(
  show: Show,
  pageBeatUid: string,
  refCounts: { characterRefs: number; settingRefs: number; lockedRefs: number; priorPages: number },
  characterNames: string[],
  continuity: boolean
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
 
  const styleHeader = styleHeaderOf(show);
  const compositePrompt = buildCompositePrompt(contract);
  const fullPrompt = `${styleHeader}\n\n${compositePrompt}`;
 
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
