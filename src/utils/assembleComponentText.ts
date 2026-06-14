import { Show, Season, Episode, Act, Scene, CinematicBeat, ScriptLine, CaptionEntry } from "../types/models";
import { resolveLines, resolveCharacter, resolveEntries, isCaption, resolveCanonicalCharacters } from "../domainUtils";

// ---- EXPORT -------------------------------------------------------

/**
 * D310: A key is treated as unrecognized metadata (and ignored) rather than
 * a character handle when:
 *   - It is all uppercase letters/digits/underscores (no lowercase)
 *   - AND it is longer than one character
 */
function isProbablyMetadataKey(key: string): boolean {
  if (key.length < 2) return false;
  return /^[A-Z0-9_]+$/.test(key);
}

function wrapField(text: string): string {
  if (!text) return "";
  if (text.length < 100 && !text.includes('\n')) return text;
  
  // Wrap to ~80 chars, indent continuation lines with 2 spaces
  const words = text.replace(/\n/g, ' ').split(' ');
  const lines: string[] = [];
  let current = "";
  
  words.forEach(word => {
    if (current.length + (current ? 1 : 0) + word.length > 80) {
      lines.push(current.trimEnd());
      current = "  " + word;
    } else {
      current += (current ? " " : "") + word;
    }
  });
  if (current) lines.push(current.trimEnd());
  
  return lines.join('\n');
}

function parseIntList(val: string, result: ImportResult, fid?: string): number[] {
  if (!val.trim()) return [];
  const parts = val.split(',').map(s => s.trim()).filter(s => s !== "");
  const nums: number[] = [];
  parts.forEach(p => {
    const n = parseInt(p, 10);
    if (isNaN(n)) {
      result.errors.push({ fid, message: `Non-numeric index in list: ${p}` });
    } else {
      nums.push(n);
    }
  });
  return nums;
}

function header(show: Show, scope: string): string {
  return [
    "## PRESTIGE SHOW BUILDER -- COMPONENT EXPORT",
    "## SHOW: " + (show.titleSuggestion || show.name) + " (" + show.showCode + ")",
    "## SCOPE: " + scope,
    "## EXPORTED: " + new Date().toISOString(),
    "## DO NOT EDIT lines starting with ##",
    "## Edit any other line and import to apply changes.",
    "",
  ].join("\n");
}

function assembleBeat(beat: CinematicBeat, show: Show): string {
  const lines = [
    "#### BEAT " + beat.fid,
    "DESCRIPTION: " + (beat.description || ""),
    "VISUAL_DESCRIPTION: " + (beat.visualDescription || ""),
    "SUBTEXT: " + (beat.subtext || ""),
    "BEAT_TYPE: " + (beat.beatType || "DIALOGUE"),
    "PANEL_COUNT: " + (beat.panelCountOverride || "Auto"),
    "DIRECTION: " + (beat.direction || ""),
    "CONTINUITY: " + (beat.continuityAnchor || ""),
    "GROUNDING: " + (beat.groundingEnsemble || ""),
  ];

  if (beat.panelPlans && beat.panelPlans.length > 0) {
    const sourceLabel = beat.panelPlanSource === 'heuristic-plan' ? 'HEURISTIC' : 
                       beat.panelPlanSource === 'ai-plan' ? 'AI' : 'MANUAL';
    lines.push(`## PANEL_PLAN_SOURCE: ${sourceLabel}`);
    lines.push("");
    beat.panelPlans.forEach((p, i) => {
      lines.push(`##### PANEL ${i + 1}`);
      lines.push(`SHOT_TYPE: ${p.shotType || ""}`);
      lines.push(`ACTION: ${wrapField(p.action || "")}`);
      if (p.subtext) lines.push(`SUBTEXT: ${wrapField(p.subtext)}`);
      if (p.direction) lines.push(`DIRECTION: ${wrapField(p.direction)}`);
      lines.push(`DIALOGUE_INDICES: ${(p.dialogueIndices || []).join(", ")}`);
      lines.push(`CAPTION_INDICES: ${(p.captionIndices || []).join(", ")}`);
      lines.push("");
    });
  }

  lines.push("## SCRIPT ENTRIES");
  resolveEntries(beat).forEach(e => {
    if (isCaption(e)) {
      lines.push("CAPTION: " + e.text);
    } else {
      const res = resolveCanonicalCharacters(show, [e.characterHandle]);
      const char = res.resolvedCharacters.length > 0 ? res.resolvedCharacters[0] : null;
      const handle = char ? char.handle : e.characterHandle;
      lines.push(handle + ": " + e.text);
      if (e.parenthetical) lines.push("  (" + e.parenthetical + ")");
    }
  });
  lines.push("");
  return lines.join("\n");
}

function assembleScene(scene: Scene, show: Show): string {
  const lines = [
    "### SCENE " + scene.fid,
    "TITLE: " + (scene.title || ""),
    "SUMMARY: " + (scene.summary || ""),
    "DRAMATIC_WANT: " + (scene.dramaticWant || ""),
    "SETTING: " + (scene.setting || ""),
    "",
  ];
  (scene.cinematicBeats ?? []).forEach(b => {
    lines.push(assembleBeat(b, show));
  });
  return lines.join("\n");
}

function assembleAct(act: Act, show: Show): string {
  const lines = [
    "## ACT " + act.fid,
    "SUMMARY: " + (act.summary || ""),
    "",
  ];
  (act.scenes ?? []).forEach(sc => lines.push(assembleScene(sc, show)));
  return lines.join("\n");
}

function assembleEpisode(ep: Episode, show: Show): string {
  const lines = [
    "# EPISODE " + ep.fid,
    "TITLE: " + (ep.title || ""),
    "ONE_LINER: " + (ep.oneLiner || ""),
    "SUMMARY: " + (ep.summary || ""),
    "",
  ];
  (ep.acts ?? []).forEach(a => lines.push(assembleAct(a, show)));
  return lines.join("\n");
}

// Public export functions:
export function exportEpisodeText(show: Show, sIdx: number, eIdx: number): string {
  const ep = show.seasons[sIdx]?.episodes[eIdx];
  if (!ep) return "";
  return header(show, "Episode S" + (sIdx+1) + "-E" + (eIdx+1))
    + assembleEpisode(ep, show);
}

export function exportActText(show: Show, sIdx: number, eIdx: number, aIdx: number): string {
  const act = show.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx];
  if (!act) return "";
  return header(show, "Act S" + (sIdx+1) + "-E" + (eIdx+1) + "-A" + (aIdx+1))
    + assembleAct(act, show);
}

export function exportSceneText(show: Show, sIdx: number, eIdx: number, aIdx: number, scIdx: number): string {
  const scene = show.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx];
  if (!scene) return "";
  return header(show, "Scene S" + (sIdx+1) + "-E" + (eIdx+1) + "-A" + (aIdx+1) + "-Sc" + (scIdx+1))
    + assembleScene(scene, show);
}

export function exportBeatText(show: Show, sIdx: number, eIdx: number, aIdx: number, scIdx: number, bIdx: number): string {
  const beat = show.seasons[sIdx]?.episodes[eIdx]?.acts[aIdx]?.scenes[scIdx]?.cinematicBeats[bIdx];
  if (!beat) return "";
  return header(show, "Beat " + beat.fid)
    + assembleBeat(beat, show);
}


// ---- IMPORT / MERGE -----------------------------------------------

export interface ImportResult {
  updated: string[];      // FIDs of components whose fields were modified
  created: string[];      // FIDs of new components created (stage 2; empty in stage 1)
  skipped: string[];      // Anchors that resolved but had no editable change
  panelsModified: number; // D315: count of panels added or modified
  errors: { fid?: string; message: string }[];  // Parse/validation failures
}

/**
 * Parse an exported component text file and merge changed fields
 * back into the show. Only text fields are updated. Structural data
 * (IDs, FIDs, characterIds, assetIds) is never touched.
 *
 * Returns the updated Show and an ImportResult or throws with a descriptive error.
 */
export function mergeComponentText(text: string, show: Show): { show: Show; result: ImportResult } {
  const lines = text.split("\n");
  const updatedShow = structuredClone(show) as Show;
  const result: ImportResult = {
    updated: [],
    created: [],
    skipped: [],
    panelsModified: 0,
    errors: []
  };

  const modifiedBeats = new Set<string>();

  // Index every beat, scene, act, episode by FID for O(1) lookup
  const beatMap   = new Map<string, CinematicBeat>();
  const sceneMap  = new Map<string, Scene>();
  const actMap    = new Map<string, Act>();
  const epMap     = new Map<string, Episode>();

  updatedShow.seasons.forEach(s => {
    s.episodes.forEach(ep => {
      if (ep.fid) epMap.set(ep.fid, ep);
      ep.acts.forEach(a => {
        if (a.fid) actMap.set(a.fid, a);
        a.scenes.forEach(sc => {
          if (sc.fid) sceneMap.set(sc.fid, sc);
          (sc.cinematicBeats ?? []).forEach(b => {
            if (b.fid) beatMap.set(b.fid, b);
          });
        });
      });
    });
  });

  let currentBeat:  CinematicBeat | null = null;
  let currentScene: Scene | null = null;
  let currentAct:   Act | null = null;
  let currentEp:    Episode | null = null;
  
  let currentPanel: {
    index: number;
    shotType: string;
    action: string;
    subtext?: string;
    direction?: string;
    dialogueIndices: number[];
    captionIndices: number[];
  } | null = null;
  let pendingPanels: any[] = [];
  let lastPanelTextField: "action" | "subtext" | "direction" | null = null;

  let pendingEntries: (ScriptLine | CaptionEntry)[] = [];
  let matchedTargetCount = 0;

  const flushPanels = () => {
    if (currentBeat && pendingPanels.length > 0) {
      modifiedBeats.add(currentBeat.fid);
      const existing = currentBeat.panelPlans || [];
      const merged = [...existing];
      
      for (const p of pendingPanels) {
        result.panelsModified++;
        if (merged[p.index]) {
          merged[p.index] = {
            ...merged[p.index],
            shotType: p.shotType || merged[p.index].shotType,
            action: p.action || merged[p.index].action,
            subtext: p.subtext !== undefined ? p.subtext : merged[p.index].subtext,
            direction: p.direction !== undefined ? p.direction : merged[p.index].direction,
            dialogueIndices: p.dialogueIndices,
            captionIndices: p.captionIndices,
          };
        } else {
          while (merged.length < p.index) {
            merged.push({ shotType: "", action: "", dialogueIndices: [], captionIndices: [] });
          }
          merged[p.index] = {
            shotType: p.shotType,
            action: p.action,
            subtext: p.subtext,
            direction: p.direction,
            dialogueIndices: p.dialogueIndices,
            captionIndices: p.captionIndices,
          };
        }
      }
      currentBeat.panelPlans = merged;
    }
    pendingPanels = [];
    currentPanel = null;
    lastPanelTextField = null;
  };

  const flushLines = () => {
    flushPanels();
    if (currentBeat) {
      if (pendingEntries.length > 0) {
        modifiedBeats.add(currentBeat.fid);
        const existing = currentBeat.script?.entries ?? currentBeat.lines ?? [];

        // D310: Track FIDs already in use to avoid collisions.
        // Existing entries that survive the merge keep their FIDs.
        // New entries get the next available numbered FID per kind.
        const usedFids = new Set<string>();
        let nextLineCounter = 0;
        let nextCaptionCounter = 0;

        const nextLineFid = (): string => {
          let candidate = `${currentBeat!.fid}-L${nextLineCounter}`;
          while (usedFids.has(candidate)) {
            nextLineCounter++;
            candidate = `${currentBeat!.fid}-L${nextLineCounter}`;
          }
          usedFids.add(candidate);
          nextLineCounter++;
          return candidate;
        };

        const nextCaptionFid = (): string => {
          let candidate = `${currentBeat!.fid}-C${nextCaptionCounter}`;
          while (usedFids.has(candidate)) {
            nextCaptionCounter++;
            candidate = `${currentBeat!.fid}-C${nextCaptionCounter}`;
          }
          usedFids.add(candidate);
          nextCaptionCounter++;
          return candidate;
        };

        // First pass: identify which existing entries will be preserved.
        // An existing entry at index i is preserved iff its kind matches
        // pendingEntries[i]'s kind. Record their FIDs as used.
        pendingEntries.forEach((pe, i) => {
          const ex = existing[i];
          if (!ex) return;
          const exIsCap = isCaption(ex);
          const peIsCap = isCaption(pe);
          if (exIsCap === peIsCap && ex.fid) {
            usedFids.add(ex.fid);
          }
        });

        // Second pass: build the merged entries.
        const merged = pendingEntries.map((pe, i) => {
          const ex = existing[i];

          if (isCaption(pe)) {
            if (ex && isCaption(ex)) {
              return { ...ex, text: pe.text };
            }
            return {
              fid: nextCaptionFid(),
              kind: "caption" as const,
              text: pe.text,
              style: "yellow" as const,
            };
          }

          const sl = pe as ScriptLine;
          // Try to resolve character handle to keep it clean
          const char = resolveCharacter(show, sl.characterHandle);
          const handle = char ? char.handle : sl.characterHandle;

          if (ex && !isCaption(ex)) {
            return {
              ...ex,
              text: sl.text,
              characterHandle: handle,
              parenthetical: sl.parenthetical ?? ex.parenthetical,
            };
          }
          return {
            fid: nextLineFid(),
            order: i,
            characterHandle: handle,
            text: sl.text,
            parenthetical: sl.parenthetical ?? "",
            isDone: false,
          };
        });

        if (!currentBeat.script) currentBeat.script = { lines: [], entries: [] };
        currentBeat.script.entries = merged;
        currentBeat.script.lines = merged.filter(e => !isCaption(e)) as ScriptLine[];

        // D310: Clear deprecated legacy top-level beat.lines after merge.
        // Otherwise stale legacy data persists alongside the new script.entries.
        if (currentBeat.lines) {
          delete (currentBeat as any).lines;
        }
      }

    }
    pendingEntries = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Beat anchor
    if (line.startsWith("#### BEAT ")) {
      flushLines();
      const fid = line.replace("#### BEAT ", "").trim();
      currentBeat = beatMap.get(fid) ?? null;
      if (currentBeat) matchedTargetCount++;
      continue;
    }

    // Panel anchor (within a beat)
    if (line.startsWith("##### PANEL ") && currentBeat) {
      if (currentPanel) {
        pendingPanels.push(currentPanel);
      }
      const m = line.match(/^##### PANEL (\d+)/);
      if (!m) {
        result.errors.push({
          fid: currentBeat.fid,
          message: `Malformed panel header: ${line}`
        });
        continue;
      }
      const panelNum = parseInt(m[1], 10);
      if (panelNum < 1) {
        result.errors.push({
          fid: currentBeat.fid,
          message: `Panel number must be >= 1, got ${panelNum}`
        });
        continue;
      }
      currentPanel = {
        index: panelNum - 1,
        shotType: "",
        action: "",
        dialogueIndices: [],
        captionIndices: [],
      };
      lastPanelTextField = null;
      continue;
    }

    // Continuation line
    if (line.startsWith("  ") && currentPanel && lastPanelTextField) {
      currentPanel[lastPanelTextField] += " " + line.trim();
      continue;
    }

    // Scene anchor
    if (line.startsWith("### SCENE ")) {
      flushLines();
      const fid = line.replace("### SCENE ", "").trim();
      currentScene = sceneMap.get(fid) ?? null;
      currentBeat = null;
      if (currentScene) matchedTargetCount++;
      continue;
    }

    // Act anchor
    if (line.startsWith("## ACT ")) {
      flushLines();
      const fid = line.replace("## ACT ", "").trim();
      currentAct = actMap.get(fid) ?? null;
      currentScene = null; currentBeat = null;
      if (currentAct) matchedTargetCount++;
      continue;
    }

    // Episode anchor
    if (line.startsWith("# EPISODE ")) {
      flushLines();
      const fid = line.replace("# EPISODE ", "").trim();
      currentEp = epMap.get(fid) ?? null;
      currentAct = null; currentScene = null; currentBeat = null;
      if (currentEp) matchedTargetCount++;
      continue;
    }

    // Skip comment lines
    if (line.startsWith("##")) continue;

    // Field: key: value
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toUpperCase();
      const val = line.substring(colonIdx + 2).trim();

      if (currentPanel) {
        if (key === "SHOT_TYPE") {
          currentPanel.shotType = val;
          lastPanelTextField = null;
        } else if (key === "ACTION") {
          currentPanel.action = val;
          lastPanelTextField = "action";
        } else if (key === "SUBTEXT") {
          currentPanel.subtext = val;
          lastPanelTextField = "subtext";
        } else if (key === "DIRECTION") {
          currentPanel.direction = val;
          lastPanelTextField = "direction";
        } else if (key === "DIALOGUE_INDICES") {
          currentPanel.dialogueIndices = parseIntList(val, result, currentBeat?.fid);
          lastPanelTextField = null;
        } else if (key === "CAPTION_INDICES") {
          currentPanel.captionIndices = parseIntList(val, result, currentBeat?.fid);
          lastPanelTextField = null;
        } else {
          result.errors.push({ fid: currentBeat?.fid, message: `Unknown panel field: ${key}` });
        }
        continue;
      }

      if (currentBeat) {
        modifiedBeats.add(currentBeat.fid);
        if (key === "DESCRIPTION")         currentBeat.description    = val;
        if (key === "VISUAL_DESCRIPTION")  currentBeat.visualDescription = val;
        if (key === "SUBTEXT")             currentBeat.subtext        = val;
        if (key === "BEAT_TYPE")           currentBeat.beatType       = val as any;
        if (key === "PANEL_COUNT")         currentBeat.panelCountOverride = val === "Auto" ? undefined : parseInt(val);
        if (key === "DIRECTION")           currentBeat.direction      = val;
        if (key === "CONTINUITY")          currentBeat.continuityAnchor = val;
        if (key === "GROUNDING")           currentBeat.groundingEnsemble = val;
        
        // Caption entry
        if (key === "CAPTION") {
          pendingEntries.push({ kind: "caption", text: val, style: "yellow", fid: "" });
        }
        // Dialogue line: if not a known metadata key, assume it's a character handle/name.
        // D310: Filter out keys that look like metadata (SCREAMING_SNAKE, no spaces) but 
        // aren't in the known list. These almost certainly came from a user typo or a 
        // future metadata field we don't recognize — not a character handle.
        else if (
          key && 
          !["DESCRIPTION", "VISUAL_DESCRIPTION", "SUBTEXT", "BEAT_TYPE", "PANEL_COUNT", "DIRECTION", "CONTINUITY", "GROUNDING"].includes(key) &&
          !isProbablyMetadataKey(key) &&
          !key.startsWith("@[")
        ) {
          const res = resolveCanonicalCharacters(updatedShow, [key]);
          const resolvedChar = res.resolvedCharacters.length > 0 ? res.resolvedCharacters[0] : null;
          const canonicalHandle = resolvedChar ? resolvedChar.handle : key;
          pendingEntries.push({ characterHandle: canonicalHandle, text: val, fid: "", isDone: false });
        }
        continue;
      }
      if (currentScene) {
        if (key === "TITLE")         currentScene.title        = val;
        if (key === "SUMMARY")       currentScene.summary      = val;
        if (key === "DRAMATIC_WANT") currentScene.dramaticWant = val;
        if (key === "SETTING")       currentScene.setting      = val;
        continue;
      }
      if (currentAct) {
        if (key === "SUMMARY") currentAct.summary = val;
        continue;
      }
      if (currentEp) {
        if (key === "TITLE")     currentEp.title    = val;
        if (key === "ONE_LINER") currentEp.oneLiner = val;
        if (key === "SUMMARY")   currentEp.summary  = val;
        continue;
      }
    }

    // Parenthetical continuation: line starting with spaces + (
    if (line.startsWith("  (") && pendingEntries.length > 0) {
      const last = pendingEntries[pendingEntries.length - 1];
      if (!isCaption(last)) {
        last.parenthetical = line.trim().replace(/^\(|\)$/g, "");
      }
      continue;
    }
  }

  flushLines();
  if (matchedTargetCount === 0) {
    throw new Error("Import failed: no matching BEAT/SCENE/ACT/EPISODE anchors were resolved.");
  }
  
  // Mark modified beats as stale
  modifiedBeats.forEach(fid => {
    const b = beatMap.get(fid);
    if (b) {
      b.scriptVersion = (b.scriptVersion || 0) + 1;
      b.visualsStale = true;
      b.panelPlanStale = true;
      b.beatPageStale = true;
      b.letteringStale = true;
      result.updated.push(fid);
    }
  });

  return { show: updatedShow, result };
}

// ---- GRAFT (CROSS-VAULT) -------------------------------------------

function findTargetInShow(show: Show, fid: string): { obj: any; actualFid: string } | null {
  // Season check: S1, Season 1, VIK-S1
  const sMatch = fid.match(/^(?:.*-S|Season |S)(\d+)$/);
  if (sMatch) {
    const sNum = parseInt(sMatch[1], 10);
    const s = show.seasons.find(sea => sea.number === sNum);
    if (s) return { obj: s, actualFid: `${show.showCode}-S${sNum}` };
  }

  // Deeper search
  for (const s of show.seasons) {
    for (const ep of s.episodes) {
      if (ep.fid === fid) return { obj: ep, actualFid: fid };
      for (const a of ep.acts) {
        if (a.fid === fid) return { obj: a, actualFid: fid };
        for (const sc of a.scenes) {
          if (sc.fid === fid) return { obj: sc, actualFid: fid };
          for (const b of sc.cinematicBeats) {
            if (b.fid === fid) return { obj: b, actualFid: fid };
          }
        }
      }
    }
  }
  return null;
}

function resolveCharacterId(show: Show, handle: string): string {
  const res = resolveCanonicalCharacters(show, [handle]);
  return res.resolvedCharacters.length > 0 ? res.resolvedCharacters[0].id : "";
}

function buildGraftFid(parentFid: string, kind: 'episode' | 'act' | 'scene' | 'beat', index: number): string {
  if (kind === 'episode') return `${parentFid}-E${index}`;
  if (kind === 'act') return `${parentFid}-A${index}`;
  if (kind === 'scene') return `${parentFid}-Sc${index}`;
  if (kind === 'beat') return `${parentFid}-B${index}`;
  return parentFid;
}

function nextChildIndex(parent: any, kind: 'episode' | 'act' | 'scene' | 'beat'): number {
  if (kind === 'episode') return (parent.episodes?.length || 0) + 1;
  if (kind === 'act') return (parent.acts?.length || 0) + 1;
  if (kind === 'scene') return (parent.scenes?.length || 0) + 1;
  if (kind === 'beat') return (parent.cinematicBeats?.length || 0) + 1;
  return 1;
}

/**
 * Graft a subtree from one vault into another.
 * Creates new components with new IDs and FIDs.
 * Returns the updated show and result.
 */
export function graftComponentText(
  text: string,
  show: Show,
  targetParentFid: string,
  sourceTopLevel: 'episode' | 'act' | 'scene' | 'beat'
): { show: Show; result: ImportResult; fidMapping: Map<string, string> } {
  const lines = text.split("\n");
  const updatedShow = structuredClone(show) as Show;
  const result: ImportResult = {
    updated: [],
    created: [],
    skipped: [],
    panelsModified: 0,
    errors: []
  };
  const fidMapping = new Map<string, string>();

  // 1. Find target parent
  const target = findTargetInShow(updatedShow, targetParentFid);
  if (!target) {
    result.errors.push({ message: `Target parent not found: ${targetParentFid}` });
    return { show: updatedShow, result, fidMapping };
  }
  const { obj: targetParent, actualFid: targetParentFidBound } = target;

  let currentEp:    Episode | null = null;
  let currentAct:   Act | null = null;
  let currentScene: Scene | null = null;
  let currentBeat:  CinematicBeat | null = null;

  let currentPanel: any = null;
  let pendingPanels: any[] = [];
  let pendingEntries: any[] = [];
  let lastPanelTextField: "action" | "subtext" | "direction" | null = null;

  const flushBeat = () => {
    if (currentBeat) {
      // Finalize panels
      if (currentPanel) {
        pendingPanels.push(currentPanel);
        currentPanel = null;
      }
      if (pendingPanels.length > 0) {
        currentBeat.panelPlans = pendingPanels.map(p => ({
          shotType: p.shotType || "",
          action: p.action || "",
          subtext: p.subtext,
          direction: p.direction,
          dialogueIndices: p.dialogueIndices || [],
          captionIndices: p.captionIndices || [],
        }));
        currentBeat.panelPlanSource = 'none';
        result.panelsModified += pendingPanels.length;
      }
      
      // Finalize script entries
      if (pendingEntries.length > 0) {
        const entries = pendingEntries.map((pe, idx) => {
          if (pe.kind === "caption") {
            return {
              fid: `${currentBeat!.fid}-C${idx + 1}`,
              kind: "caption" as const,
              text: pe.text,
              style: pe.style || "yellow",
            };
          } else {
            const charId = resolveCharacterId(updatedShow, pe.characterHandle);
            if (!charId) {
              const h = pe.characterHandle;
              if (!result.errors.find(ed => ed.message === `Unmatched character handle: ${h}`)) {
                result.errors.push({ fid: currentBeat!.fid, message: `Unmatched character handle: ${h}` });
              }
            }
            return {
              fid: `${currentBeat!.fid}-L${idx + 1}`,
              characterHandle: pe.characterHandle,
              characterId: charId,
              text: pe.text,
              parenthetical: pe.parenthetical || "",
              isDone: false,
            };
          }
        });
        currentBeat.script = { 
          entries, 
          lines: entries.filter(e => (e as any).kind !== "caption") as ScriptLine[] 
        };
      }

      // Metadata/State for fresh beat
      currentBeat.scriptVersion = 1;
      currentBeat.visualsStale = true;
      currentBeat.panelPlanStale = true;
      currentBeat.beatPageStale = true;
      currentBeat.letteringStale = true;
    }
    pendingPanels = [];
    pendingEntries = [];
    currentPanel = null;
    lastPanelTextField = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Episode anchor
    if (line.startsWith("# EPISODE ")) {
      flushBeat();
      const sourceFid = line.replace("# EPISODE ", "").trim();
      const idx = nextChildIndex(targetParent, 'episode');
      const newFid = buildGraftFid(targetParentFidBound, 'episode', idx);
      const newEp: Episode = {
        id: crypto.randomUUID(),
        fid: newFid,
        number: idx,
        title: "",
        oneLiner: "",
        summary: "",
        acts: []
      };
      targetParent.episodes.push(newEp);
      currentEp = newEp;
      fidMapping.set(sourceFid, newFid);
      result.created.push(newFid);
      currentAct = null; currentScene = null; currentBeat = null;
      continue;
    }

    // Act anchor
    if (line.startsWith("## ACT ")) {
      flushBeat();
      const sourceFid = line.replace("## ACT ", "").trim();
      const parent = currentEp || (sourceTopLevel === 'act' ? targetParent : null);
      if (!parent) {
        // Only error if we actually need a parent (i.e. not top level bypass)
        if (sourceTopLevel !== 'act' || !targetParent) {
          result.errors.push({ message: `Graft act failed: no current episode or incorrect level.` });
          continue;
        }
      }
      const actualParent = currentEp || targetParent;
      const idx = nextChildIndex(actualParent, 'act');
      const newFid = buildGraftFid(actualParent.fid!, 'act', idx);
      const newAct: Act = {
        id: crypto.randomUUID(),
        fid: newFid,
        number: idx,
        summary: "",
        scenes: []
      };
      actualParent.acts.push(newAct);
      currentAct = newAct;
      fidMapping.set(sourceFid, newFid);
      result.created.push(newFid);
      currentScene = null; currentBeat = null;
      continue;
    }

    // Scene anchor
    if (line.startsWith("### SCENE ")) {
      flushBeat();
      const sourceFid = line.replace("### SCENE ", "").trim();
      const parent = currentAct || (sourceTopLevel === 'scene' ? targetParent : null);
      if (!parent) {
        if (sourceTopLevel !== 'scene' || !targetParent) {
          result.errors.push({ message: `Graft scene failed: no current act or incorrect level.` });
          continue;
        }
      }
      const actualParent = currentAct || targetParent;
      const idx = nextChildIndex(actualParent, 'scene');
      const newFid = buildGraftFid(actualParent.fid!, 'scene', idx);
      const newScene: Scene = {
        id: crypto.randomUUID(),
        fid: newFid,
        number: idx,
        title: "",
        summary: "",
        cinematicBeats: []
      };
      actualParent.scenes.push(newScene);
      currentScene = newScene;
      fidMapping.set(sourceFid, newFid);
      result.created.push(newFid);
      currentBeat = null;
      continue;
    }

    // Beat anchor
    if (line.startsWith("#### BEAT ")) {
      flushBeat();
      const sourceFid = line.replace("#### BEAT ", "").trim();
      const parent = currentScene || (sourceTopLevel === 'beat' ? targetParent : null);
      if (!parent) {
        if (sourceTopLevel !== 'beat' || !targetParent) {
          result.errors.push({ message: `Graft beat failed: no current scene or incorrect level.` });
          continue;
        }
      }
      const actualParent = currentScene || targetParent;
      const idx = nextChildIndex(actualParent, 'beat');
      const newFid = buildGraftFid(actualParent.fid!, 'beat', idx);
      const newBeat: CinematicBeat = {
        id: crypto.randomUUID(),
        fid: newFid,
        description: "",
        subtext: "",
        characterIds: [],
        panelPlans: [],
      };
      actualParent.cinematicBeats.push(newBeat);
      currentBeat = newBeat;
      fidMapping.set(sourceFid, newFid);
      result.created.push(newFid);
      continue;
    }

    // Panel anchor
    if (line.startsWith("##### PANEL ") && currentBeat) {
      if (currentPanel) {
        pendingPanels.push(currentPanel);
      }
      const m = line.match(/^##### PANEL (\d+)/);
      if (m) {
        currentPanel = {
          index: parseInt(m[1], 10) - 1,
          shotType: "",
          action: "",
          dialogueIndices: [],
          captionIndices: [],
        };
        lastPanelTextField = null;
      }
      continue;
    }

    // continuation line
    if (line.startsWith("  ")) {
      if (currentPanel && lastPanelTextField) {
        currentPanel[lastPanelTextField] += " " + line.trim();
        continue;
      }
      // Parenthetical for dialogue
      if (line.startsWith("  (") && pendingEntries.length > 0) {
        const last = pendingEntries[pendingEntries.length - 1];
        if (last.kind !== "caption") {
          last.parenthetical = line.trim().replace(/^\(|\)$/g, "");
        }
        continue;
      }
    }

    if (line.startsWith("##")) continue;

    // key: value
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toUpperCase();
      const val = line.substring(colonIdx + 2).trim();

      if (currentPanel) {
        if (key === "SHOT_TYPE") { currentPanel.shotType = val; lastPanelTextField = null; }
        else if (key === "ACTION") { currentPanel.action = val; lastPanelTextField = "action"; }
        else if (key === "SUBTEXT") { currentPanel.subtext = val; lastPanelTextField = "subtext"; }
        else if (key === "DIRECTION") { currentPanel.direction = val; lastPanelTextField = "direction"; }
        else if (key === "DIALOGUE_INDICES") { currentPanel.dialogueIndices = parseIntList(val, result, currentBeat?.fid); lastPanelTextField = null; }
        else if (key === "CAPTION_INDICES") { currentPanel.captionIndices = parseIntList(val, result, currentBeat?.fid); lastPanelTextField = null; }
        continue;
      }

      if (currentBeat) {
        if (key === "DESCRIPTION")         currentBeat.description    = val;
        else if (key === "VISUAL_DESCRIPTION")  currentBeat.visualDescription = val;
        else if (key === "SUBTEXT")             currentBeat.subtext        = val;
        else if (key === "BEAT_TYPE")           currentBeat.beatType       = val as any;
        else if (key === "PANEL_COUNT")         currentBeat.panelCountOverride = val === "Auto" ? undefined : parseInt(val);
        else if (key === "DIRECTION")           currentBeat.direction      = val;
        else if (key === "CONTINUITY")          currentBeat.continuityAnchor = val;
        else if (key === "GROUNDING")           currentBeat.groundingEnsemble = val;
        else if (key === "CAPTION") {
          pendingEntries.push({ kind: "caption", text: val });
        }
        else if (key && !isProbablyMetadataKey(key) && !key.startsWith("@[")) {
          const res = resolveCanonicalCharacters(show, [key]);
          const resolvedChar = res.resolvedCharacters.length > 0 ? res.resolvedCharacters[0] : null;
          const canonicalHandle = resolvedChar ? resolvedChar.handle : key;
          pendingEntries.push({ characterHandle: canonicalHandle, text: val });
        }
        continue;
      }

      if (currentScene) {
        if (key === "TITLE")         currentScene.title        = val;
        else if (key === "SUMMARY")       currentScene.summary      = val;
        else if (key === "DRAMATIC_WANT") currentScene.dramaticWant = val;
        else if (key === "SETTING")       currentScene.setting      = val;
        continue;
      }
      if (currentAct) {
        if (key === "SUMMARY") currentAct.summary = val;
        continue;
      }
      if (currentEp) {
        if (key === "TITLE")     currentEp.title    = val;
        else if (key === "ONE_LINER") currentEp.oneLiner = val;
        else if (key === "SUMMARY")   currentEp.summary  = val;
        continue;
      }
    }
  }

  flushBeat();

  if (result.created.length === 0) {
    result.errors.push({ message: "Graft failed: no items created. Check source top-level anchors." });
  }

  return { show: updatedShow, result, fidMapping };
}
