// finalPageContract.ts — DA-076
// The FinalPageBeat contract: one normalized object, built from a canonical
// PageBeat, consumed by generateFinalComicPage. Replaces the
// PageBeat→CinematicBeat shim on the production path.
//
// Design rules (from the one-pass spec):
// — beatType is NOT an input. Silence is derived from content.
// — Every panel either lists exact text to render or declares NO TEXT.
// — Speakers are resolved display names. Raw @ids never reach the prompt.
// — No dialogue context, no hidden script payload, no quoted-dialogue ACTION.
 
import { Show } from '../../types/show';
import { PageBeat } from '../../types/production';
import {
  resolveCanonicalCharacters,
  resolveCharacter,
  resolveScriptLineCharacter,
} from '../../domainUtils';
import {
  splitBalloonText,
  placementFromSpeaker,
  cleanLetteringText,
} from '../../utils/prompts/letteringUtils';
import { LINE_COUNT_TO_PANEL_COUNT } from '../../utils/prompts/panelCountUtils';
 
// ── Contract types ────────────────────────────────────────────────────
 
export interface TextRenderItem {
  kind: 'balloon' | 'caption';
  text: string;                 // verbatim, cleaned
  speakerName?: string;         // balloons: resolved display name
  speakerAnchor?: string;       // short visual disambiguator
  speakerZone?: string;         // declared position if planned
  speakerDepth?: string;
  position: string;             // balloon body position in panel
  tailDirection?: string;
  chained: boolean;             // true = stacked under previous, no tail
  captionStyle?: 'narrator' | 'location' | 'internal';
}
 
export interface FinalPanelSpec {
  index: number;
  shotType: string;
  action: string;
  foreground?: string;
  midground?: string;
  background?: string;
  relationalStaging?: string;
  directAddress?: boolean;
  characterPositions: {
    name: string;
    anchor: string;
    zone: string;
    depth: string;
    facing?: string;
    bodyLanguage?: string;
    facialExpression?: string;
    inResponseTo?: string;
  }[];
  text: TextRenderItem[];       // empty array == NO TEXT IN THIS PANEL
}
 
export interface FinalPageCharacter {
  id: string;
  name: string;
  portraitAssetId: string | null;
}
 
export interface FinalPageBeat {
  pageBeatUid: string;
  address: string;
  issueUid: string;
  sceneUid: string;
  panelCount: number;
  layoutName: string;
  focalPanelIndex?: number;
  silentPage: boolean;          // derived: zero balloons AND zero captions
  characters: FinalPageCharacter[];
  visualDirection?: {
    lighting?: string; mood?: string;
    emotionalRegister?: string; environmentalDetail?: string;
  };
  panelProps?: { label: string; description: string }[];
  panels: FinalPanelSpec[];
}
 
// ── Canonical PageBeat resolution (spec §2) ───────────────────────────
// Exactly one valid PageBeat. Duplicate uids or address-twins block.
 
export interface CanonicalBeatResult {
  pb: PageBeat | null;
  issueUid: string;
  sceneUid: string;
  errors: string[];
}
 
export function findCanonicalPageBeat(
  show: Show,
  pageBeatUid: string
): CanonicalBeatResult {
  const uidMatches: { pb: PageBeat; issueUid: string; sceneUid: string }[] = [];
  const addressIndex = new Map<string, { uid: string; issueUid: string }[]>();
 
  for (const iss of show.issues ?? []) {
    for (const act of iss.acts ?? []) {
      for (const sc of act.scenes ?? []) {
        for (const pb of sc.pageBeats ?? []) {
          if (pb.uid === pageBeatUid) {
            uidMatches.push({ pb, issueUid: iss.uid, sceneUid: sc.uid });
          }
          if (pb.address) {
            const list = addressIndex.get(pb.address) ?? [];
            list.push({ uid: pb.uid, issueUid: iss.uid });
            addressIndex.set(pb.address, list);
          }
        }
      }
    }
  }
 
  const errors: string[] = [];
  if (uidMatches.length === 0) {
    return { pb: null, issueUid: '', sceneUid: '', errors: ['PageBeat not found by uid.'] };
  }
  if (uidMatches.length > 1) {
    errors.push(
      `Duplicate PageBeat uid across ${uidMatches.length} issue copies. ` +
      `Run the Vault storage audit (promotion cleanup) before generating.`
    );
  }
  const target = uidMatches[0];
  const twins = (addressIndex.get(target.pb.address) ?? [])
    .filter(t => t.uid !== target.pb.uid);
  if (twins.length > 0) {
    errors.push(
      `Address ${target.pb.address} exists on ${twins.length + 1} PageBeats ` +
      `(divergent issue copies). Generation from ambiguous data is blocked — ` +
      `run the Vault storage audit (promotion cleanup), then retry.`
    );
  }
  return { pb: target.pb, issueUid: target.issueUid, sceneUid: target.sceneUid, errors };
}
 
// ── Contract construction ─────────────────────────────────────────────
 
 
 
type ScriptEntry = {
  kind?: string;
  characterHandle?: string;
  characterId?: string | null;
  speakerName?: string;
  text?: string;
  style?: string;
};
 
const entriesOf = (pb: PageBeat): ScriptEntry[] => {
  const s: any = pb.script;
  if (!s) return [];
  if (Array.isArray(s.entries) && s.entries.length) return s.entries;
  if (Array.isArray(s.lines) && s.lines.length) return s.lines;
  return [];
};
 
const isCaption = (e: ScriptEntry) => e.kind === 'caption';
 
const captionStyleOf = (e: ScriptEntry): TextRenderItem['captionStyle'] =>
  e.style === 'white' ? 'internal'
  : e.style === 'none' ? 'narrator'
  : e.style === 'grey' ? 'location'
  : 'narrator';
 
export function buildFinalPageBeat(
  show: Show,
  pb: PageBeat,
  issueUid: string,
  sceneUid: string
): { contract: FinalPageBeat; problems: string[] } {
  const problems: string[] = [];
 
  // Characters: canonical resolution from characterIds (spec §5: names, never ids)
  const ids = pb.characterIds ?? [];
  const res = resolveCanonicalCharacters(show, ids);
  if (res.unresolvedIdentifiers.length > 0) {
    problems.push(
      `Unresolved character identifier(s): ${res.unresolvedIdentifiers.join(', ')}`
    );
  }
  // DA-085: the attached portrait is the SOLE identity source. The physical
  // description was authored to GENERATE the portrait in an earlier process;
  // it has no place in the page prompt, where it competes with and overrides
  // the reference image. It is never emitted. A character with no portrait is
  // a hard preflight failure (validateFinalPage), not a description fallback —
  // a fallback would silently reintroduce this bug whenever an asset id is
  // missing for any reason.
  const characters: FinalPageCharacter[] = res.resolvedCharacters.map((c: any) => ({
    id: c.id,
    name: c.name || c.handle || c.id,
    portraitAssetId: c.portraitAssetId ?? c.visualAnchorAssetId ?? null,
  }));
 
  // Script → text items
  const allEntries = entriesOf(pb);
  const captionEntries = allEntries.filter(isCaption);
  const lineEntries = allEntries.filter(
    e => !isCaption(e) && (e.text || '').trim()
  );
 
  // Resolve every speaker via the full field chain (id -> handle -> name),
  // identical to the narrative panel. Takes the whole line, not just a handle.
  const speakerName = (line?: ScriptEntry): { name: string; char: any | null } => {
    const c = resolveScriptLineCharacter(show, line as any);
    if (!c) {
      const fallback = (line?.speakerName || line?.characterHandle || '').trim();
      if (fallback) return { name: fallback.toUpperCase(), char: null };
      problems.push(`Unresolved speaker in script line`);
      return { name: '', char: null };
    }
    return { name: c.name || c.handle || '', char: c };
  };
 
  // Panel plan source
  const aiPlans: any[] = pb.panelPlans ?? [];
  const hasPlans = aiPlans.length > 0;
  const silentByContent = lineEntries.length === 0 && captionEntries.length === 0;
 
  const panelCount = hasPlans
    ? aiPlans.length
    : (pb as any).panelCountOverride && (pb as any).panelCountOverride >= 1
      ? Math.min((pb as any).panelCountOverride, 6)
      : silentByContent
        ? 1
        : LINE_COUNT_TO_PANEL_COUNT(lineEntries.length);
 
  const linesPerPanel = lineEntries.length
    ? Math.ceil(lineEntries.length / panelCount)
    : 1;
 
  const layoutName = (pb as any).layoutName
    ? String((pb as any).layoutName).split(':')[0]
    : `${panelCount}-panel grid`;
 
  const panels: FinalPanelSpec[] = [];
 
  for (let p = 0; p < panelCount; p++) {
    const ai = hasPlans ? aiPlans[p] : null;
 
    // Which entries land on this panel
    let panelLines: ScriptEntry[];
    let panelCaptions: ScriptEntry[];
    if (ai) {
      const di: number[] = ai.dialogueIndices ?? [];
      const ci: number[] = ai.captionIndices ?? [];
      panelLines = di.map(i => allEntries[i]).filter(e => e && !isCaption(e));
      panelCaptions = ci.map(i => allEntries[i]).filter(e => e && isCaption(e));
    } else {
      panelLines = lineEntries.slice(p * linesPerPanel, (p + 1) * linesPerPanel);
      panelCaptions = p === 0 ? captionEntries : [];
    }
 
    // Text Render Contract for this panel (spec §5)
    const text: TextRenderItem[] = [];
    for (const cap of panelCaptions) {
      text.push({
        kind: 'caption',
        text: cleanLetteringText(cap.text ?? ''),
        position: 'top-full',
        chained: false,
        captionStyle: captionStyleOf(cap),
      });
    }
    const alreadyPlaced: { position: any }[] = [];
    for (const line of panelLines) {
      const { name, char } = speakerName(line);
      const declared = ai?.characterPositions?.find((cp: any) =>
        cp.characterHandle &&
        (cp.characterHandle === line.characterHandle ||
         (char && (cp.characterHandle === char.name ||
                   cp.characterHandle === char.handle ||
                   cp.characterHandle === char.id)))
      );
      const { position, tailDirection } = placementFromSpeaker(declared, alreadyPlaced);
      alreadyPlaced.push({ position });
      const chunks = splitBalloonText(cleanLetteringText(line.text ?? ''));
      chunks.forEach((chunk, ci2) => {
        text.push({
          kind: 'balloon',
          text: chunk,
          speakerName: name,
          speakerAnchor: '',  // DA-085: portrait is identity; never describe the speaker
          speakerZone: declared?.zone,
          speakerDepth: declared?.depth,
          position,
          tailDirection,
          chained: ci2 < chunks.length - 1,
        });
      });
    }
 
    // Shot: plan → author direction (panel 1) → content-derived. Never beatType.
    const speakersInPanel = [...new Set(
      panelLines.map(l => speakerName(l).name).filter(Boolean)
    )];
    let shotType: string;
    if (ai?.shotType) shotType = ai.shotType;
    else if (p === 0 && (pb.direction || '').trim()) shotType = (pb.direction as string).trim();
    else if (speakersInPanel.length === 0) shotType = 'WIDE SHOT: Environment. No primary subject.';
    else if (speakersInPanel.length === 1) shotType = `CLOSE-UP: ${speakersInPanel[0]}. Face fills the frame. Expression is the subject.`;
    else shotType = `MEDIUM TWO-SHOT: ${speakersInPanel.slice(0, 2).join(' and ')} in conversation.`;
 
    // Action: plan action → visualNote. NEVER quoted dialogue (spec §5).
    const rawAction = (ai?.action || '').trim() || (pb.visualNote || '').trim();
    if (!rawAction) problems.push(`Panel ${p + 1}: no action text (plan action and visualNote both empty).`);

    const dialogTexts = allEntries.map(e => cleanLetteringText(e.text ?? '').trim()).filter(Boolean);

    const action = sanitizeVisualField(rawAction, dialogTexts, problems, `panel ${p + 1} action`) || 'No action text.';
    const foreground = sanitizeVisualField(ai?.foreground, dialogTexts, problems, `panel ${p + 1} foreground`);
    const midground = sanitizeVisualField(ai?.midground, dialogTexts, problems, `panel ${p + 1} midground`);
    const background = sanitizeVisualField(ai?.background, dialogTexts, problems, `panel ${p + 1} background`);
    const relationalStaging = sanitizeVisualField(ai?.relationalStaging, dialogTexts, problems, `panel ${p + 1} relational staging`);

    // Character positions with resolved names
    const characterPositions = (ai?.characterPositions ?? []).map((cp: any) => {
      const c = resolveCharacter(show, cp.characterHandle);
      return {
        name: c ? (c.name || c.handle || cp.characterHandle) : cp.characterHandle,
        anchor: '',  // DA-085: portrait is identity; never describe in positions
        zone: cp.zone,
        depth: cp.depth,
        facing: cp.facing,
        bodyLanguage: cp.bodyLanguage,
        facialExpression: cp.facialExpression,
        inResponseTo: cp.inResponseTo,
      };
    });

    panels.push({
      index: p,
      shotType,
      action,
      foreground,
      midground,
      background,
      relationalStaging,
      directAddress: ai?.directAddress === true || ai?.directAddress === 'True',
      characterPositions,
      text,
    });
  }

  const silentPage = panels.every(pl => pl.text.length === 0);

  const contract: FinalPageBeat = {
    pageBeatUid: pb.uid,
    address: pb.address,
    issueUid,
    sceneUid,
    panelCount,
    layoutName,
    focalPanelIndex: (pb as any).focalPanelIndex,
    silentPage,
    characters,
    visualDirection: pb.visualDirection as any,
    panelProps: (pb as any).panelProps,
    panels,
  };
  return { contract, problems };
}

function sanitizeVisualField(
  fieldValue: string | undefined,
  dialogueTexts: string[],
  problems: string[],
  fieldName: string
): string | undefined {
  if (!fieldValue) return fieldValue;
  let next = fieldValue;

  for (const text of dialogueTexts) {
    if (text.length < 4) continue; // Skip short sentences/words

    const quotedVariants = [
      `"${text}"`,
      `'${text}'`,
      `“${text}”`,
      `‘${text}’`,
    ];

    for (const qv of quotedVariants) {
      if (next.includes(qv)) {
        problems.push(
          `Warning: Dialogue content ${qv} was found inside visual field "${fieldName}". Strip/clean applied to maintain visual/text consistency.`
        );
        next = next.replace(qv, '').trim();
      }
    }

    if (next.toLowerCase().trim() === text.toLowerCase().trim()) {
      problems.push(
        `Warning: Visual field "${fieldName}" matches dialogue verbatim: "${text}". Stripped to prevent text leakage.`
      );
      next = '';
    }
  }

  return next;
}
 
// ── Preflight validation (spec §9) — errors block, warnings log ───────
 
export interface PreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}
 
export function validateFinalPage(
  contract: FinalPageBeat,
  buildProblems: string[],
  refCounts: { characterRefs: number; settingRefs: number; lockedRefs: number; priorPages: number }
): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];
 
  // Build-time problems that are contract violations
  for (const p of buildProblems) {
    if (p.startsWith('Unresolved')) errors.push(p);
    else warnings.push(p);
  }
 
  // Silent-page purity: no text payload anywhere (by construction text[] is
  // the only payload; this guards future regressions).
  if (contract.silentPage) {
    const leaked = contract.panels.some(p => p.text.length > 0);
    if (leaked) errors.push('Silent page contains text items — contract corruption.');
  } else {
    // Every balloon must carry a resolved display name.
    for (const p of contract.panels) {
      for (const t of p.text) {
        if (t.kind === 'balloon' && (!t.speakerName || t.speakerName.startsWith('@'))) {
          errors.push(`Panel ${p.index + 1}: balloon speaker is not a resolved display name ("${t.speakerName}").`);
        }
        if (!t.text.trim()) errors.push(`Panel ${p.index + 1}: empty text item.`);
      }
    }
  }
 
  // Every speaker must be staged in the exact panel where they speak.
  if (!contract.silentPage) {
    for (const p of contract.panels) {
      const stagedInPanel = new Set<string>();
      for (const cp of p.characterPositions) {
        if (cp.name) stagedInPanel.add(cp.name);
      }
      for (const t of p.text) {
        if (t.kind === 'balloon' && t.speakerName) {
          if (!stagedInPanel.has(t.speakerName)) {
            errors.push(`Panel ${p.index + 1}: speech item for "${t.speakerName}" exists, but that character is not staged in this panel.`);
          }
        }
      }
    }
  }

  // Portraits required for every contract character.
  for (const c of contract.characters) {
    if (!c.portraitAssetId) {
      errors.push(`Character ${c.name} has no portrait/visual-anchor asset.`);
    }
  }
 
  // Visual-anchor floor: a page with zero image references of any kind is
  // a drift machine (spec §3/§9). Block with a path to fix.
  const totalRefs = refCounts.characterRefs + refCounts.settingRefs +
    refCounts.lockedRefs + refCounts.priorPages;
  if (totalRefs === 0) {
    errors.push(
      'No visual references resolved for this page (no portraits, no setting anchor, ' +
      'no prior approved pages in this scene). Assign a Setting Anchor in Scene ' +
      'Workbench, or approve an adjacent page first, then retry.'
    );
  }
 
  if (contract.characters.length === 0 && !contract.silentPage) {
    warnings.push('Page has dialogue but no characterIds — speakers resolved from script handles only.');
  }
 
  return { ok: errors.length === 0, errors, warnings };
}
