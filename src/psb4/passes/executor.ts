import { ArtifactType, PassSpec, Psb4Run, Psb4Artifact, ConversationTurn, AnchorScopeEntry } from '../types';
import { 
  getRun, 
  getSourceByRun, 
  getLatestArtifactByShow, 
  getArtifactsByType, 
  writeArtifact, 
  supersedeArtifact, 
  updateRunPhase,
  buildConversationHistory
} from '../storage';
import { getPromptTemplate } from './prompts';
import './prompts/register_all';
import { getParser } from './parsers';
import './parsers/register_all';
import { parseSingleWrittenScene, parseScreenplayToScriptUnits } from './parsers/scene_script';
import { parseSingleSegPlan } from './parsers/segmentation_plan';
import { capturePrompt, captureAssembly, captureSynthesis, captureError } from '../console';
import { computeAnchorOrder } from './anchorOrder';
import { buildVoiceContext } from './buildVoiceContext';
import { assembleSceneStructure } from './assembleSceneStructure';

function formatOneSceneForG(scene: any, showCharacters?: any[]): string {
  if (!scene) return '';
  let output = `Scene A${scene.actNumber}S${scene.sceneNumber} — ${scene.title || 'Untitled'}\n`;
  if (scene.setting) {
    output += `Setting: ${scene.setting}\n`;
  }
  let script = Array.isArray(scene.script) && scene.script.length > 0
    ? scene.script
    : parseScreenplayToScriptUnits(scene.screenplay || '', showCharacters);

  if (!script || script.length === 0) {
    throw new Error(
      `0.9G cannot segment A${scene.actNumber}S${scene.sceneNumber}: no script units derived from screenplay.`
    );
  }

  script.forEach((unit: any, idx: number) => {
    if (unit.kind === 'action') {
      output += `  [${idx}] (action) ${unit.text}\n`;
    } else if (unit.kind === 'caption') {
      output += `  [${idx}] (caption) ${unit.text}\n`;
    } else if (unit.kind === 'line') {
      const paren = unit.parenthetical ? ` (${unit.parenthetical})` : '';
      output += `  [${idx}] ${unit.characterHandle || '@unknown'}:${paren} ${unit.text}\n`;
    }
  });
  return output;
}

async function buildCompactSummaryHistory(runId: string): Promise<ConversationTurn[]> {
  const summaryParts: string[] = [];
  
  // 1. Season/Show Overview
  const spineArts = await getArtifactsByType(runId, ArtifactType.CLEAN_SPINE);
  if (spineArts && spineArts.length > 0) {
    const spine = spineArts.sort((a,b) => b.createdAt - a.createdAt)[0].payload as any;
    if (spine && Array.isArray(spine.issues)) {
      summaryParts.push(`=== SERIES SPINE ===`);
      spine.issues.forEach((issue: any) => {
        summaryParts.push(`Issue ${issue.issueNumber}: ${issue.title || 'Untitled'} - ${issue.premise || ''}`);
      });
    }
  }

  const ladderArts = await getArtifactsByType(runId, ArtifactType.ARC_LADDER);
  if (ladderArts && ladderArts.length > 0 && summaryParts.length === 0) {
    const ladder = ladderArts.sort((a,b) => b.createdAt - a.createdAt)[0].payload as any;
    if (ladder && Array.isArray(ladder.issues)) {
      summaryParts.push(`=== ARC LADDER ===`);
      ladder.issues.forEach((issue: any) => {
        summaryParts.push(`Issue ${issue.issueNumber}: ${issue.title || 'Untitled'}`);
      });
    }
  }

  // 2. Episode Scene Summaries
  const structureArts = await getArtifactsByType(runId, ArtifactType.SCENE_STRUCTURE);
  if (structureArts && structureArts.length > 0) {
    const structure = structureArts.sort((a,b) => b.createdAt - a.createdAt)[0].payload as any;
    if (structure && Array.isArray(structure.acts)) {
      summaryParts.push(`=== ACTIVE EPISODE SCENE STRUCTURE ===`);
      structure.acts.forEach((act: any) => {
        summaryParts.push(`Act ${act.actNumber}:`);
        if (Array.isArray(act.scenes)) {
          act.scenes.forEach((scene: any) => {
            summaryParts.push(`  Scene ${scene.sceneNumber}: ${scene.title || 'Untitled'} (${scene.setting || 'Unknown Setting'})`);
            if (Array.isArray(scene.beats)) {
              scene.beats.forEach((b: any, bIdx: number) => {
                summaryParts.push(`    Beat ${bIdx + 1} [${b.beatType}]: ${b.description || ''}`);
              });
            }
          });
        }
      });
    }
  }

  const text = summaryParts.join('\n');
  if (!text) {
    return [];
  }

  return [
    {
      role: 'user',
      parts: [{ text: 'Please provide a compact summary of the high-level decisions, show structures, and scene states defined so far.' }]
    },
    {
      role: 'model',
      parts: [{ text }]
    }
  ];
}

function formatSceneScriptForG(payload: any, showCharacters?: any[]): string {
  if (!payload || !Array.isArray(payload.scenes)) return '';
  let output = '';
  for (const scene of payload.scenes) {
    output += `Scene A${scene.actNumber}S${scene.sceneNumber} — ${scene.title || 'Untitled'}\n`;
    if (scene.setting) {
      output += `Setting: ${scene.setting}\n`;
    }
    let script = Array.isArray(scene.script) ? scene.script : [];
    if (script.length === 0 && scene.screenplay) {
      script = parseScreenplayToScriptUnits(scene.screenplay, showCharacters);
    }
    script.forEach((unit: any, idx: number) => {
      if (unit.kind === 'action') {
        output += `  [${idx}] (action) ${unit.text}\n`;
      } else if (unit.kind === 'caption') {
        output += `  [${idx}] (caption) ${unit.text}\n`;
      } else if (unit.kind === 'line') {
        const paren = unit.parenthetical ? ` (${unit.parenthetical})` : '';
        output += `  [${idx}] ${unit.characterHandle || '@unknown'}:${paren} ${unit.text}\n`;
      }
    });
    output += '\n';
  }
  return output.trim();
}

// ----------------------------------------------------------------------------
// DATA FORMATTING HELPERS FOR ASSEMBLING PROMPTS
// ----------------------------------------------------------------------------

function formatSource(source: any): string {
  let out = `# ${source.show?.titleSuggestion || source.show?.title || source.show?.name || 'Untitled Show'}\n\n`;
  if (source.show?.register) {
    out += `**Register**: ${source.show.register}\n\n`;
  }
  if (source.season?.arcSummary) {
    out += `## Season Arc Summary\n${source.season.arcSummary}\n\n`;
  }
  if (source.episodes && source.episodes.length > 0) {
    out += `## Teleplay Content & Structure\n\n`;
    source.episodes.forEach((ep: any, epIdx: number) => {
      out += `### Episode ${ep.index || (epIdx + 1)}: ${ep.title || 'Untitled'}\n`;
      if (ep.oneLiner) out += `*One-Liner*: ${ep.oneLiner}\n\n`;
      if (ep.summary) out += `*Summary*: ${ep.summary}\n\n`;
      
      if (ep.scenes && ep.scenes.length > 0) {
        ep.scenes.forEach((sc: any, scIdx: number) => {
          out += `#### Scene ${sc.index || (scIdx + 1)}: ${sc.heading || 'Untitled Scene'}\n\n`;
          
          if (sc.beats && sc.beats.length > 0) {
            sc.beats.forEach((bt: any, btIdx: number) => {
              out += `##### Beat ${bt.index || (btIdx + 1)}\n`;
              if (bt.description) {
                out += `- **Action/Description**: ${bt.description}\n`;
              }
              if (bt.direction) {
                out += `- **Prose/Direction**: ${bt.direction}\n`;
              }
              if (bt.characterIds && bt.characterIds.length > 0) {
                out += `- **Active Characters**: ${bt.characterIds.join(', ')}\n`;
              }
              if (bt.lines && bt.lines.length > 0) {
                out += `- **Dialogue Script Lines**:\n`;
                bt.lines.forEach((ln: any) => {
                  const speaker = ln.characterId || 'Unknown Character';
                  const typeLabel = ln.type && ln.type !== 'dialogue' ? ` [${ln.type}]` : '';
                  out += `  - **${speaker}**${typeLabel}: "${ln.text}"\n`;
                });
              }
              out += `\n`;
            });
          } else {
            out += `*(No cinematic beats in this scene)*\n\n`;
          }
        });
      } else {
        out += `*(No scenes in this episode)*\n\n`;
      }
    });
  }
  return out;
}

function formatCharacters(characters: any[]): string {
  if (!characters || characters.length === 0) return 'No characters found.';
  let out = '';
  characters.forEach((char) => {
    out += `- **${char.name || char.handle}**: ${char.description || char.role || ''}\n`;
    if (char.personality) out += `  *Personality*: ${char.personality}\n`;
    if (char.arc) out += `  *Arc*: ${char.arc}\n`;
  });
  return out;
}

// ----------------------------------------------------------------------------
// PASS EXECUTOR IMPLEMENTATION
// ----------------------------------------------------------------------------

export interface RunPassOptions {
  modelOverride?: 'gemini-pro' | 'gemini-flash';
  temperatureOverride?: number;
  forceRegenerate?: boolean;
  readOnly?: boolean;
}

export type RunPassResult = {
  success: boolean;
  artifacts: Psb4Artifact[];
  error?: string;
};

/**
 * Execute a single pipeline pass following the exact 9-step execution logic.
 */
export async function runPass(
  runId: string,
  spec: PassSpec,
  options: RunPassOptions = {}
): Promise<RunPassResult> {
  try {
    // Check if Firestore write quota is exhausted
    const { isFirestoreQuotaExhausted, getStorageMode } = await import('../storage');
    if (getStorageMode() !== 'local' && isFirestoreQuotaExhausted()) {
      return {
        success: false,
        artifacts: [],
        error: 'Firestore write quota exhausted. Pipeline execution is paused. Use local/emulator mode or wait for quota reset.'
      };
    }

    // -------------------------------------------------------------------------
    // STEP 1: PRE-CONDITIONS & MODEL ROUTING
    // -------------------------------------------------------------------------
    const run = await getRun(runId);
    if (!run) {
      return { success: false, artifacts: [], error: `Run ${runId} not found` };
    }

    const { ShowStorage } = await import('../../storage/ShowStorage');
    const show = await ShowStorage.getById(run.showId);

    if (show) {
      if (
        (show.activeRunId && run.id !== show.activeRunId) ||
        run.status !== 'active' ||
        run.hydrationStatus !== 'complete' ||
        options.readOnly
      ) {
        return {
          success: false,
          artifacts: [],
          error: `Executor guard check failed. Run ${runId} is not executable. status=${run.status}, hydrationStatus=${run.hydrationStatus}, showActiveRunId=${show.activeRunId}, readOnly=${!!options.readOnly}`
        };
      }
    } else {
      if (run.status !== 'active' || options.readOnly) {
        return {
          success: false,
          artifacts: [],
          error: `Executor guard check failed (Mock Test Context). Run ${runId} is not active or readOnly.`
        };
      }
    }

    // Check pre-condition artifacts are present
    for (const reqType of spec.requires) {
      const existing = await getArtifactsByType(runId, reqType);
      if (!existing || existing.length === 0) {
        return { 
          success: false, 
          artifacts: [], 
          error: `Pre-condition failed: Required artifact '${reqType}' is missing` 
        };
      }
    }

    // Resolve routing & map 'gemini-pro' -> 'gemini-3.1-pro-preview' and 'gemini-flash' -> 'gemini-flash-latest'
    const modelRaw = options.modelOverride || (run.overrides && run.overrides[spec.id]) || spec.defaultModel;
    const model = modelRaw === 'gemini-pro' ? 'gemini-3.1-pro-preview' : modelRaw === 'gemini-flash' ? 'gemini-flash-latest' : modelRaw;
    const temperature = options.temperatureOverride !== undefined ? options.temperatureOverride : spec.defaultTemperature;

    // Fetch dependencies
    const source = await getSourceByRun(runId);
    if (!source) {
      return { success: false, artifacts: [], error: `Telemetry source not found for run ${runId}` };
    }

    // -------------------------------------------------------------------------
    // STEP 2: ITERATION (SUPPORT NON-ARC SCOPES — EPS/CHARACTERS)
    // -------------------------------------------------------------------------
    // Phase 0 passes are arc-scoped, but we support loops for episode scope perfectly.
    const scopes: ({ episodeId: string | null; prefixLabel?: string } | AnchorScopeEntry)[] = [];
    if (spec.scope === 'arc') {
      scopes.push({ episodeId: null });
    } else if (spec.scope === 'episode') {
      const allEpisodes = source.episodes || [];
      const scopedEpisodes = (run.scopeEpisodeIds && run.scopeEpisodeIds.length > 0)
        ? allEpisodes.filter(ep => run.scopeEpisodeIds!.includes(ep.id))
        : allEpisodes;

      const episodesToRun = scopedEpisodes.length > 0 ? scopedEpisodes : allEpisodes;
      episodesToRun.forEach(ep => {
        scopes.push({ episodeId: ep.id, prefixLabel: `Episode: ${ep.title}` });
      });
    } else if (spec.scope === 'episode-anchored') {
      const allEpisodes = source.episodes || [];
      const scopedEpisodes = (run.scopeEpisodeIds && run.scopeEpisodeIds.length > 0)
        ? allEpisodes.filter(ep => run.scopeEpisodeIds!.includes(ep.id))
        : allEpisodes;
      const episodesToRun = scopedEpisodes.length > 0 ? scopedEpisodes : allEpisodes;
      const anchorEntries = computeAnchorOrder(episodesToRun);
      anchorEntries.forEach(entry => scopes.push(entry));  // AnchorScopeEntry extends the base shape
    } else {
      // General fallback
      scopes.push({ episodeId: null });
    }

    const producedArtifacts: Psb4Artifact[] = [];

    let conversationHistory: ConversationTurn[] = [];
    const isFoundationPass = spec.id === '0.0';
    const isReductionPass = spec.phase === 'reduction';  // covers 0.0 through 0.7

    if (!isReductionPass) {
      if (spec.needsPriorContext) {
        conversationHistory = await buildCompactSummaryHistory(runId);
      } else {
        conversationHistory = [];
      }
    }

    let episodeHistory = [...conversationHistory]; // copy, will grow per episode

    // Fetch ARC_LADDER artifact once before the loop (for NEXT_ANCHOR_SPEC bridge issues)
    const arcLadderArts = await getArtifactsByType(runId, ArtifactType.ARC_LADDER);
    const arcLadderArtifact = arcLadderArts && arcLadderArts.length > 0 ? arcLadderArts[0] : null;

    let scopeSequence = 0;
    // Loop through each scoped run
    for (const scopeInst of scopes) {
      scopeSequence++;
      // -----------------------------------------------------------------------
      // STEP 3: CONTEXT ASSEMBLY
      // -----------------------------------------------------------------------
      const slotValues: Record<string, string> = {};

      if (isReductionPass) {
        slotValues['TELEPLAY_SOURCE'] = formatSource(source);
        slotValues['CHARACTERS_ROSTER'] = formatCharacters(source.show?.characters || []);
      }
      if (isFoundationPass) {
        slotValues['GN_PACKET'] = source.show?.gnPacket
          ? JSON.stringify(source.show.gnPacket, null, 2)
          : '(GN Packet not yet filled)';
      }

      // For reduction passes 0.1–0.7: inject required artifacts as slot values.
      // Arc lock and beyond receive prior context via conversation history (D348).
      if (isReductionPass && !isFoundationPass) {
        for (const reqType of spec.requires) {
          const arts = await getArtifactsByType(runId, reqType);
          if (arts && arts.length > 0) {
            arts.sort((a, b) => b.createdAt - a.createdAt);
            const p = arts[0].payload;
            slotValues[reqType.toUpperCase()] = typeof p === 'object'
              ? JSON.stringify(p, null, 2)
              : String(p);
          }
        }
      }

      // After the general isReductionPass slot injection block:
      if (spec.id === '0.9' || spec.id === '12D' || spec.id === '0.8R' || spec.id === '0.8RA') {
        const targetTypes = spec.id === '12D' 
          ? [
              ArtifactType.SCENE_STRUCTURE,
              ArtifactType.EARNED_LINE,
              ArtifactType.CALLBACK_MAP,
              ArtifactType.VISUAL_MOTIF,
              ArtifactType.QUIET_PANEL_PLAN,
              ArtifactType.MORAL_AFTERTASTE,
              ArtifactType.GRIEF_INVENTORY,
              ArtifactType.PAGE_RHYTHM
            ]
          : spec.id === '0.8R' || spec.id === '0.8RA'
            ? [ArtifactType.CLEAN_SPINE, ArtifactType.ARC_LADDER]
            : spec.requires;

        for (const reqType of targetTypes) {
          const arts = await getArtifactsByType(runId, reqType);
          slotValues[reqType.toUpperCase()] = ''; // Default/Placeholder
          if (arts && arts.length > 0) {
            // For SCENE_STRUCTURE: filter to current episode only
            const relevant = (reqType === ArtifactType.SCENE_STRUCTURE && scopeInst.episodeId)
              ? arts.filter(a => a.episodeId === scopeInst.episodeId)
              : arts.filter(a => !a.episodeId);  // arc-scoped artifacts have no episodeId
            const toInject = relevant.sort((a, b) => b.createdAt - a.createdAt)[0];
            if (toInject) {
              const p = toInject.payload;
              slotValues[reqType.toUpperCase()] = typeof p === 'object'
                ? JSON.stringify(p, null, 2) : String(p);
            }
          }
        }
      }

      if (['0.9S','0.9W','0.9G'].includes(spec.id)) {
        // Explicitly inject required artifacts for our new rebuild passes, filtered by episode scope
        for (const reqType of spec.requires) {
          const arts = await getArtifactsByType(runId, reqType);
          if (arts && arts.length > 0) {
            const filteredArts = scopeInst.episodeId 
              ? arts.filter(a => a.episodeId === scopeInst.episodeId)
              : [];
            const targetArts = filteredArts.length > 0 ? filteredArts : arts;
            targetArts.sort((a, b) => b.createdAt - a.createdAt);
            const p = targetArts[0].payload;
            if (spec.id === '0.9G' && reqType === ArtifactType.SCENE_SCRIPT) {
              slotValues[reqType.toUpperCase()] = formatSceneScriptForG(p, source.show?.characters);
            } else {
              slotValues[reqType.toUpperCase()] = typeof p === 'object'
                ? JSON.stringify(p, null, 2)
                : String(p);
            }
          } else {
            slotValues[reqType.toUpperCase()] = '';
          }
        }
      }

      if (['0.9W', '0.9G'].includes(spec.id) && source.show) {
        slotValues['CHARACTER_VOICES'] = buildVoiceContext(source.show);
      }

      // Register guidance still applies to any pass with registerFraming.enabled
      if (spec.registerFraming?.enabled && source.show?.register) {
        const key = source.show.register;
        slotValues['REGISTER_GUIDANCE'] = spec.registerFraming.proseGuidance[key] || '';
      }

      // Scope issue count for 0.8A
      if (spec.id === '0.8A') {
        slotValues['SCOPE_ISSUE_COUNT'] = run.scopeIssueCount
          ? String(run.scopeIssueCount)
          : 'not specified (assess from material)';
      }

      // Inject AUTHOR_NOTES slot (D351)
      const authorNotes = run.arcLockNotes || '';
      if (authorNotes) {
        slotValues['AUTHOR_NOTES'] = `[AUTHOR_NOTES]\n${authorNotes}\n[/AUTHOR_NOTES]`;
      } else {
        slotValues['AUTHOR_NOTES'] = ''; // Ensure slot resolves to empty string
      }

      if (scopeInst.episodeId && scopeInst.prefixLabel) {
        let epContext = scopeInst.prefixLabel;
        if (source.episodes) {
          const matchingEp = source.episodes.find(e => e.id === scopeInst.episodeId);
          if (matchingEp) {
            epContext += `\nEpisode Title: ${matchingEp.title || 'Untitled'}`;
            if (matchingEp.summary) {
              epContext += `\nEpisode Summary: ${matchingEp.summary}`;
            }
            const totalEps = source.episodes.length;
            epContext += `\nPosition in Series: Episode ${matchingEp.index} of ${totalEps}`;
          }
        }
        slotValues['EPISODE_CONTEXT'] = epContext;
      }

      // For episode-anchored passes — inject anchor-specific context slots
      const anchorEntry = scopeInst as Partial<AnchorScopeEntry>;
      if (anchorEntry.isAnchor !== undefined) {
        // ISSUE_ROLE: tells the model what structural role this issue plays
        const storyN = (anchorEntry.storyIndex ?? 0) + 1;
        const totalN = source.episodes?.length ?? 0;
        if (anchorEntry.isAnchor) {
          const roleLabels: Record<number, string> = {
            0: 'ANCHOR — Opening Issue (Issue 1). Establish world, protagonist, problem, voice.',
            [totalN - 1]: 'ANCHOR — Finale (Final Issue). Maximum creative attention. This is what the reader carries away.',
          };
          const midIdx = Math.ceil(totalN / 2) - 1;
          const penultIdx = totalN - 2;
          if (storyN - 1 === midIdx) roleLabels[midIdx] = 'ANCHOR — Structural Midpoint. The arc pivot.';
          if (storyN - 1 === penultIdx) roleLabels[penultIdx] = 'ANCHOR — Penultimate Issue. Creates conditions that make the finale inevitable.';
          slotValues['ISSUE_ROLE'] = roleLabels[anchorEntry.storyIndex ?? 0]
            ?? `ANCHOR — Issue ${storyN} of ${totalN}.`;
        } else {
          slotValues['ISSUE_ROLE'] = `BRIDGE — Issue ${storyN} of ${totalN}. Connects directly from story-prior issue to the next anchor.`;
        }

        // NEXT_ANCHOR_SPEC: for bridge issues, the arc ladder data for the next anchor
        if (!anchorEntry.isAnchor && anchorEntry.nextAnchorEpisodeId && arcLadderArtifact) {
          const ladder = arcLadderArtifact.payload as any;
          const nextAnchorEntry = (ladder?.issues || []).find(
            (e: any) => e.episodeId === anchorEntry.nextAnchorEpisodeId
          );
          if (nextAnchorEntry) {
            slotValues['NEXT_ANCHOR_SPEC'] = JSON.stringify(nextAnchorEntry, null, 2);
          }
        }
      }

      // Special-case 0.9G: Deterministic segmentation that divides scenes into contiguous groups of 5
      if (spec.id === '0.9G') {
        const scriptArts = await getArtifactsByType(runId, ArtifactType.SCENE_SCRIPT);
        const targetScriptArts = scopeInst.episodeId 
          ? scriptArts.filter(a => a.episodeId === scopeInst.episodeId)
          : scriptArts;
        
        targetScriptArts.sort((a,b) => b.createdAt - a.createdAt);
        const written = targetScriptArts[0]?.payload as any;
        if (!written || !Array.isArray(written.scenes)) {
          return {
            success: false,
            artifacts: [],
            error: `Failed to execute 0.9G: No SCENE_SCRIPT artifact found for episode ${scopeInst.episodeId || ''}`
          };
        }

        // Also load the 0.9S SCENE_STRUCTURE to backfill metadata
        const structureArts = await getArtifactsByType(runId, ArtifactType.SCENE_STRUCTURE);
        const targetStructureArts = scopeInst.episodeId
          ? structureArts.filter(a => a.episodeId === scopeInst.episodeId)
          : structureArts;
        const priorS = targetStructureArts
          .filter(a => a.createdByPass === '0.9S')
          .sort((a,b) => b.createdAt - a.createdAt)[0]?.payload as any;

        // Load latest existing 0.9G artifact for target scope to enable checkpointing
        let targetStructureGArtifact = targetStructureArts
          .filter(a => a.createdByPass === '0.9G')
          .sort((a,b) => b.createdAt - a.createdAt)[0] || null;

        const isValidCompletedScene = (sc: any): boolean => {
          if (!sc) return false;
          const beats = sc.beats || sc.pageBeats || [];
          return Array.isArray(beats) && beats.length > 0;
        };

        const completedScenesMap = new Map<string, any>();
        if (!options.forceRegenerate && targetStructureGArtifact && targetStructureGArtifact.payload) {
          const priorPayload = targetStructureGArtifact.payload as any;
          if (Array.isArray(priorPayload.acts)) {
            for (const act of priorPayload.acts) {
              if (act && Array.isArray(act.scenes)) {
                for (const sc of act.scenes) {
                  if (sc && sc.sceneNumber !== undefined) {
                    const key = `A${act.actNumber}S${sc.sceneNumber}`;
                    if (isValidCompletedScene(sc)) {
                      completedScenesMap.set(key, sc);
                    }
                  }
                }
              }
            }
          }
        }

        let isEpisodeFullySegmented = false;
        if (!options.forceRegenerate && written && Array.isArray(written.scenes) && written.scenes.length > 0) {
          isEpisodeFullySegmented = written.scenes.every((scene: any) => {
            const key = `A${scene.actNumber}S${scene.sceneNumber}`;
            return completedScenesMap.has(key);
          });
        }

        if (isEpisodeFullySegmented && targetStructureGArtifact) {
          producedArtifacts.push(targetStructureGArtifact);
          continue;
        }

        const priorStructureSArtifact = targetStructureArts
          .filter(a => a.createdByPass === '0.9S')
          .sort((a,b) => b.createdAt - a.createdAt)[0] || null;

        let currentLatestArtifact: Psb4Artifact | null = targetStructureGArtifact || priorStructureSArtifact;
        const plans: any[] = [];

        for (const scene of written.scenes) {
          const key = `A${scene.actNumber}S${scene.sceneNumber}`;

          // Checkpointing: Skip completed scenes unless forceRegenerate is true
          if (!options.forceRegenerate && completedScenesMap.has(key)) {
            const priorSc = completedScenesMap.get(key);
            const priorBeats = priorSc.beats || priorSc.pageBeats || [];
            
            const pBeats = priorBeats.map((b: any) => ({
              unitIndices: b.unitIndices || [],
              beatType: b.beatType || 'DIALOGUE',
              description: b.description || '',
              visualNote: b.visualNote,
              direction: b.direction,
            }));
            
            plans.push({
              actNumber: scene.actNumber,
              sceneNumber: scene.sceneNumber,
              pageBeats: pBeats
            });
            continue;
          }

          // Deterministic segmenter: Split units into contiguous groups of 5
          const unitsRaw = Array.isArray(scene.script) && scene.script.length > 0
            ? scene.script
            : parseScreenplayToScriptUnits(scene.screenplay || '', source.show?.characters);
          const units = unitsRaw || [];

          if (units.length === 0) {
            return {
              success: false,
              artifacts: currentLatestArtifact ? [currentLatestArtifact] : [],
              error: `0.9G cannot segment A${scene.actNumber}S${scene.sceneNumber}: no script units derived from screenplay.`
            };
          }

          const pageBeats = [];
          const size = 5;
          for (let i = 0; i < units.length; i += size) {
            const group = units.slice(i, i + size);
            const unitIndices = group.map((u: any, gIdx: number) => (u.unitIndex !== undefined ? u.unitIndex : i + gIdx));
            
            pageBeats.push({
              unitIndices,
              beatType: 'DIALOGUE' as const,
              description: 'Scene continuation',
            });
          }

          // In-situ validation of coverage to prevent downstream pipeline errors
          const seenIndices = pageBeats.flatMap(b => b.unitIndices);
          if (seenIndices.length !== units.length) {
            return {
              success: false,
              artifacts: currentLatestArtifact ? [currentLatestArtifact] : [],
              error: `0.9G validation failed for A${scene.actNumber}S${scene.sceneNumber}: coverage count mismatch.`
            };
          }
          if (new Set(seenIndices).size !== units.length) {
            return {
              success: false,
              artifacts: currentLatestArtifact ? [currentLatestArtifact] : [],
              error: `0.9G validation failed for A${scene.actNumber}S${scene.sceneNumber}: duplicate unit coverage.`
            };
          }
          if (!units.every((u: any, idx: number) => seenIndices.includes(u.unitIndex !== undefined ? u.unitIndex : idx))) {
            return {
              success: false,
              artifacts: currentLatestArtifact ? [currentLatestArtifact] : [],
              error: `0.9G validation failed for A${scene.actNumber}S${scene.sceneNumber}: missing unit coverage.`
            };
          }

          plans.push({
            actNumber: scene.actNumber,
            sceneNumber: scene.sceneNumber,
            pageBeats
          });
        }

        // Assemble the full deterministic SCENE_STRUCTURE artifact representation
        const finalPayload = assembleSceneStructure(
          { scenes: plans },
          written,
          priorS,
          { showCharacters: source.show?.characters }
        );

        // Populate artifact metadata for tracing and downstream passes
        const source09WArtifactId = targetScriptArts[0]?.id || '';
        const source09SArtifactId = targetStructureArts.filter(a => a.createdByPass === '0.9S').sort((a,b) => b.createdAt - a.createdAt)[0]?.id || '';
        const allSceneKeys = written.scenes.map((s: any) => `A${s.actNumber}S${s.sceneNumber}`);
        const completedSceneKeys = plans.map((p: any) => `A${p.actNumber}S${p.sceneNumber}`);
        const missingSceneKeys = allSceneKeys.filter((k: string) => !completedSceneKeys.includes(k));

        finalPayload.metadata = {
          showId: source.show.id,
          projectId: source.show.id,
          source09WArtifactId,
          source09SArtifactId,
          expectedSceneCount: written.scenes.length,
          completedSceneCount: plans.length,
          completedSceneKeys,
          missingSceneKeys,
          passId: spec.id,
          scope: scopeInst.episodeId ? `episode:${scopeInst.episodeId}` : 'show',
          episodeId: scopeInst.episodeId || undefined
        };

        const artifactInput = {
          runId,
          showId: source.show.id,
          artifactType: spec.outputArtifactType,
          episodeId: scopeInst.episodeId,
          scope: spec.scope === 'episode-anchored' ? 'episode' : spec.scope,
          payload: finalPayload,
          payloadVersion: spec.outputPayloadVersion,
          createdByPass: spec.id,
          consoleEntryId: currentLatestArtifact ? currentLatestArtifact.consoleEntryId : undefined
        };

        if (currentLatestArtifact) {
          currentLatestArtifact = await supersedeArtifact(currentLatestArtifact.id, artifactInput, { force: true });
        } else {
          currentLatestArtifact = await writeArtifact(artifactInput);
        }

        producedArtifacts.push(currentLatestArtifact);
        continue;
      }

      // Special-case 0.9W to iterate through its scenes, calling Gemini with single-scene writing prompt and accumulating with checkpointing
      if (spec.id === '0.9W') {
        const structureArts = await getArtifactsByType(runId, ArtifactType.SCENE_STRUCTURE);
        const targetStructureArts = scopeInst.episodeId 
          ? structureArts.filter(a => a.episodeId === scopeInst.episodeId)
          : structureArts;
        
        targetStructureArts.sort((a,b) => b.createdAt - a.createdAt);
        const structure = targetStructureArts[0]?.payload as any;
        if (!structure || !Array.isArray(structure.acts)) {
          return {
            success: false,
            artifacts: [],
            error: `Failed to execute 0.9W: No SCENE_STRUCTURE artifact found for episode ${scopeInst.episodeId || ''}`
          };
        }

        const scriptArts = await getArtifactsByType(runId, spec.outputArtifactType);
        const targetScriptArts = scopeInst.episodeId 
          ? scriptArts.filter(a => a.episodeId === scopeInst.episodeId)
          : scriptArts;
        targetScriptArts.sort((a, b) => b.createdAt - a.createdAt);
        let priorScriptArtifact = targetScriptArts[0] ?? null;

        if (priorScriptArtifact && priorScriptArtifact.authorEdited && !options.forceRegenerate) {
          return {
            success: false,
            artifacts: [],
            error: `Conflict: Artifact of type '${spec.outputArtifactType}' was manually edited by the author. Use forceRegenerate to re-generate and override.`
          };
        }

        const completedScenesMap = new Map<string, any>();
        if (!options.forceRegenerate && priorScriptArtifact && priorScriptArtifact.payload && Array.isArray((priorScriptArtifact.payload as any).scenes)) {
          for (const s of (priorScriptArtifact.payload as any).scenes) {
            if (s && s.actNumber !== undefined && s.sceneNumber !== undefined) {
              const key = `${s.actNumber}_${s.sceneNumber}`;
              completedScenesMap.set(key, s);
            }
          }
        }

        const writtenScenes: any[] = [];
        let sceneSequence = 0;

        const sceneSummaries = structure.acts.flatMap((a: any) =>
          (a.scenes || []).map((sc: any) => ({
            act: a.actNumber,
            num: sc.sceneNumber,
            title: sc.title,
            want: sc.dramaticWant || sc.function || '',
            beats: (sc.beats || []).map((b: any) => b.description).filter(Boolean),
          }))
        );

        for (const act of structure.acts) {
          if (!act || !Array.isArray(act.scenes)) continue;
          for (const scene of act.scenes) {
            sceneSequence++;
            
            const key = `${act.actNumber}_${scene.sceneNumber}`;
            if (completedScenesMap.has(key)) {
              writtenScenes.push(completedScenesMap.get(key));
              continue;
            }

            // Narrow characters voices
            const sceneHandles = scene.beats?.flatMap((b: any) => b.characterHandles || []) || [];
            const sceneVoicesAll = buildVoiceContext(source.show, sceneHandles);

            const sceneBeatsText = scene.beats?.map((b: any, bIdx: number) => {
              return `Beat ${bIdx + 1}:
  - Type: ${b.beatType}
  - Description: ${b.description}
  - Supporting Prose/Direction: ${b.direction || '(None)'}
  - Characters: ${b.characterHandles?.join(', ') || 'None'}
  - Subtext: ${b.subtext || 'None'}
  - Visual Note: ${b.visualNote || 'None'}`;
            }).join('\n\n') || '(No beats defined)';

            const here = sceneSummaries.findIndex((s: any) =>
              s.act === act.actNumber && s.num === scene.sceneNumber
            );
            const line = (s: any) => `A${s.act}S${s.num} "${s.title}" — ${s.want}` +
              (s.beats.length ? ` [${s.beats.join('; ')}]` : '');
            const earlier = sceneSummaries.slice(0, here).map(line).join('\n') || '(none)';
            const later   = sceneSummaries.slice(here + 1).map(line).join('\n') || '(none)';
            const sceneMap = `EARLIER SCENES (already established):\n${earlier}\n\n` +
              `LATER SCENES (still to come):\n${later}`;

            const sceneSlotValues: Record<string, string> = {
              EPISODE_CONTEXT: slotValues['EPISODE_CONTEXT'] || `Episode Scope: ${scopeInst.prefixLabel || ''}`,
              REGISTER_GUIDANCE: slotValues['REGISTER_GUIDANCE'] || '',
              CHARACTER_VOICES: sceneVoicesAll,
              EPISODE_SCENE_MAP: sceneMap,
              ACT_NUMBER: String(act.actNumber),
              SCENE_NUMBER: String(scene.sceneNumber),
              SCENE_TITLE: scene.title || 'Untitled',
              SCENE_SETTING: scene.setting || 'Unknown Setting',
              SCENE_WANT: scene.dramaticWant || '',
              SCENE_FUNCTION: scene.function || '',
              SCENE_BEATS: sceneBeatsText
            };

            const template = getPromptTemplate(spec.promptTemplateId);
            if (!template) {
              throw new Error(`Prompt template ${spec.promptTemplateId} not found`);
            }
            const promptText = template.render(sceneSlotValues);

            const fragments = Object.entries(sceneSlotValues).map(([key, val]) => ({
              name: key,
              content: val
            }));

            // Capture assembly per scene
            const { entryId: assemblyEntryId } = await captureAssembly({
              runId,
              phase: spec.phase,
              pass: spec.id,
              step: `${scopeInst.episodeId || ''}_act${act.actNumber}_scene${scene.sceneNumber}`,
              inputs: {
                artifactIds: spec.requires.map(type => type.toLowerCase()),
                fragments
              },
              output: promptText,
              executionSequence: scopeSequence
            });

            let attempts = 0;
            const maxAttempts = 3;
            let lastError = '';
            let parsedPayload: any = null;
            let promptConsoleEntryId = '';
            let responseText = '';

            while (attempts < maxAttempts) {
              attempts++;
              try {
                const { result, entryId, responseText: respText } = await capturePrompt<any>({
                  runId,
                  phase: spec.phase,
                  pass: spec.id,
                  step: `${scopeInst.episodeId || ''}_act${act.actNumber}_scene${scene.sceneNumber}`,
                  model,
                  temperature: 0.85,
                  maxOutputTokens: 8192,
                  prompt: promptText,
                  parser: (raw) => {
                    return parseSingleWrittenScene(raw, act.actNumber, scene.sceneNumber, source.show?.characters);
                  },
                  parentEntryId: assemblyEntryId,
                  history: [],
                  executionSequence: scopeSequence
                });

                parsedPayload = result;
                promptConsoleEntryId = entryId;
                responseText = respText;
                break;
              } catch (err) {
                lastError = err instanceof Error ? err.message : String(err);
                await new Promise((r) => setTimeout(r, 600));
              }
            }

            if (!parsedPayload) {
              await captureError({
                runId,
                phase: spec.phase,
                pass: spec.id,
                step: `${scopeInst.episodeId || ''}_act${act.actNumber}_scene${scene.sceneNumber}`,
                error: `Scene ${scene.sceneNumber} failed after ${maxAttempts} attempts. Last: ${lastError}`,
                parentEntryId: assemblyEntryId,
                executionSequence: scopeSequence,
              });
              const failureArtifacts = priorScriptArtifact ? [priorScriptArtifact] : [];
              return { 
                success: false, 
                artifacts: failureArtifacts, 
                error: `Execution of pass ${spec.id} failed (Act ${act.actNumber}, Scene ${scene.sceneNumber}) after ${maxAttempts} attempts. Last error: ${lastError}` 
              };
            }

            // Per-scene passes are independent (CDC): do NOT accumulate
            // prior scenes into history. Each scene gets only its own inputs.

            const { entryId: synthEntryId } = await captureSynthesis({
              runId,
              phase: spec.phase,
              pass: spec.id,
              step: `${scopeInst.episodeId || ''}_act${act.actNumber}_scene${scene.sceneNumber}`,
              input: promptText,
              synthesized: parsedPayload,
              parserName: spec.parserId,
              parentEntryId: promptConsoleEntryId,
              executionSequence: scopeSequence
            });

            writtenScenes.push(parsedPayload);

            // Write or supersede the artifact immediately!
            const currentPayload = { scenes: [...writtenScenes] };
            const artifactInput = {
              runId,
              showId: source.show.id,
              artifactType: spec.outputArtifactType,
              episodeId: scopeInst.episodeId,
              scope: spec.scope === 'episode-anchored' ? 'episode' : spec.scope,
              payload: currentPayload,
              payloadVersion: spec.outputPayloadVersion,
              createdByPass: spec.id,
              consoleEntryId: priorScriptArtifact ? priorScriptArtifact.consoleEntryId : undefined
            };

            if (priorScriptArtifact) {
              priorScriptArtifact = await supersedeArtifact(priorScriptArtifact.id, artifactInput, { force: true });
            } else {
              priorScriptArtifact = await writeArtifact(artifactInput);
            }
          }
        }

        if (!priorScriptArtifact) {
          const finalPayload = { scenes: [] };
          const artifactInput = {
            runId,
            showId: source.show.id,
            artifactType: spec.outputArtifactType,
            episodeId: scopeInst.episodeId,
            scope: spec.scope === 'episode-anchored' ? 'episode' : spec.scope,
            payload: finalPayload,
            payloadVersion: spec.outputPayloadVersion,
            createdByPass: spec.id,
          };
          priorScriptArtifact = await writeArtifact(artifactInput);
        }

        producedArtifacts.push(priorScriptArtifact);
        continue;
      }

      // -----------------------------------------------------------------------
      // STEP 4: PROMPT GENERATION & LOG ASSEMBLY
      // -----------------------------------------------------------------------
      const template = getPromptTemplate(spec.promptTemplateId);
      if (!template) {
        throw new Error(`Prompt template ${spec.promptTemplateId} not found`);
      }

      const promptText = template.render(slotValues);

      // Map slots to fragments according to CaptureAssemblyParams
      const fragments = Object.entries(slotValues).map(([key, val]) => ({
        name: key,
        content: val
      }));

      // Log assembly step
      const { entryId: assemblyEntryId } = await captureAssembly({
        runId,
        phase: spec.phase,
        pass: spec.id,
        step: scopeInst.episodeId,
        inputs: {
          artifactIds: spec.requires.map(type => type.toLowerCase()),
          fragments
        },
        output: promptText,
        executionSequence: scopeSequence
      });

      // -----------------------------------------------------------------------
      // STEP 5 & 6: EXECUTION & PARSING (RETRIES INCLUDED)
      // -----------------------------------------------------------------------
      const parser = getParser(spec.parserId);
      if (!parser) {
        throw new Error(`Parser ${spec.parserId} not found`);
      }

      // Implement robust retry mechanism
      let attempts = 0;
      const maxAttempts = 3;
      let lastError = '';
      let parsedPayload: any = null;
      let promptConsoleEntryId = '';
      let responseText = '';

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const { result, entryId, responseText: respText } = await capturePrompt<any>({
            runId,
            phase: spec.phase,
            pass: spec.id,
            step: scopeInst.episodeId,
            model,
            temperature,
            prompt: promptText,
            // Pass a wrapper to capturePrompt so it catches any validation/parse failures
            parser: (raw) => {
              const parseResult = parser.parse(raw);
              if (parseResult.ok === false) {
                throw new Error((parseResult as any).error);
              }
              return parseResult.payload;
            },
            parentEntryId: assemblyEntryId,
            history: episodeHistory,
            executionSequence: scopeSequence
          });

          parsedPayload = result;
          promptConsoleEntryId = entryId;
          responseText = respText;
          break; // success!
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          // Wait slightly before retry
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (!parsedPayload) {
        await captureError({
          runId,
          phase: spec.phase,
          pass: spec.id,
          step: scopeInst.episodeId ?? null,
          error: `Failed after ${maxAttempts} attempts. Last: ${lastError}`,
          parentEntryId: assemblyEntryId,
          executionSequence: scopeSequence,
        });
        return { 
          success: false, 
          artifacts: [], 
          error: `Execution of pass ${spec.id} failed after ${maxAttempts} attempts. Last error: ${lastError}` 
        };
      }

      // After a successful episode turn, append it to history for the next episode if needed
      if (responseText && spec.needsPriorContext) {
        episodeHistory = [
          ...episodeHistory,
          { role: 'user', parts: [{ text: promptText }] },
          { role: 'model', parts: [{ text: responseText }] }
        ];
      }

      // Register success in synthesis step
      const { entryId: synthEntryId } = await captureSynthesis({
        runId,
        phase: spec.phase,
        pass: spec.id,
        step: scopeInst.episodeId,
        input: promptText,
        synthesized: parsedPayload,
        parserName: spec.parserId,
        parentEntryId: promptConsoleEntryId,
        executionSequence: scopeSequence
      });

      // -----------------------------------------------------------------------
      // STEP 7: ARTIFACT WRITING
      // -----------------------------------------------------------------------
      const runArtifacts = await getArtifactsByType(runId, spec.outputArtifactType);
      const priorArtifact = runArtifacts.length > 0
        ? runArtifacts
            .filter(a => scopeInst.episodeId ? a.episodeId === scopeInst.episodeId : !a.episodeId)
            .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
        : null;

      if (priorArtifact && priorArtifact.authorEdited && !options.forceRegenerate) {
        return {
          success: false,
          artifacts: [],
          error: `Conflict: Artifact of type '${spec.outputArtifactType}' was manually edited by the author. Use forceRegenerate to re-generate and override.`
        };
      }

      let finalPayload = parsedPayload;

      const artifactInput = {
        runId,
        showId: source.show.id,
        artifactType: spec.outputArtifactType,
        episodeId: scopeInst.episodeId,
        scope: spec.scope === 'episode-anchored' ? 'episode' : spec.scope,
        payload: finalPayload,
        payloadVersion: spec.outputPayloadVersion,
        createdByPass: spec.id,
        consoleEntryId: synthEntryId
      };

      let artifact: Psb4Artifact;
      if (priorArtifact) {
        artifact = await supersedeArtifact(priorArtifact.id, artifactInput, { force: options.forceRegenerate });
      } else {
        artifact = await writeArtifact(artifactInput);
      }

      producedArtifacts.push(artifact);
    }

    // -------------------------------------------------------------------------
    // STEP 8: PIPELINE STATE PROGRESSION
    // -------------------------------------------------------------------------
    const PASS_CHAIN: Record<string, { nextPass: string | null; phase: string; completesPhase?: string }> = {
      '0.0':  { nextPass: '0.1',  phase: 'reduction' },
      '0.1':  { nextPass: '0.2',  phase: 'reduction' },
      '0.2':  { nextPass: '0.3',  phase: 'reduction' },
      '0.3':  { nextPass: '0.4',  phase: 'reduction' },
      '0.4':  { nextPass: '0.5',  phase: 'reduction' },
      '0.5':  { nextPass: '0.6',  phase: 'reduction' },
      '0.6':  { nextPass: '0.7',  phase: 'reduction' },
      '0.7':  { nextPass: '0.8',  phase: 'arc_lock',  completesPhase: 'reduction' },
      '0.8':  { nextPass: '0.8A', phase: 'arc_lock' },
      '0.8A':  { nextPass: '0.9',   phase: 'rebuild',   completesPhase: 'arc_lock' },
      '0.8RA': { nextPass: '0.9',   phase: 'rebuild',   completesPhase: 'arc_lock' },
      '0.9':   { nextPass: '0.9S',  phase: 'rebuild' },
      '0.9S':  { nextPass: '0.9W',  phase: 'rebuild' },
      '0.9W':  { nextPass: '0.9G',  phase: 'rebuild' },
      '0.9G':  { nextPass: '0.9A',  phase: 'rebuild' },
      '0.9A':  { nextPass: '0.12',  phase: 'rebuild' },
      '0.12':  { nextPass: '0.14',  phase: 'rebuild' },
      '0.14':  { nextPass: '1',     phase: 'rebuild' },
      '1':    { nextPass: '2',    phase: 'rebuild' },
      '2':    { nextPass: '3',    phase: 'rebuild' },
      '3':    { nextPass: '4',    phase: 'rebuild' },
      '4':    { nextPass: '5',    phase: 'rebuild' },
      '5':    { nextPass: '6',    phase: 'enrichment', completesPhase: 'rebuild' },
      '6':    { nextPass: '7',    phase: 'enrichment' },
      '7':    { nextPass: '8',    phase: 'enrichment' },
      '8':    { nextPass: '9',    phase: 'enrichment' },
      '9':    { nextPass: '10',   phase: 'enrichment' },
      '10':   { nextPass: '11',   phase: 'enrichment' },
      '11':   { nextPass: '12',   phase: 'enrichment' },
      '12':   { nextPass: null,   phase: 'done',       completesPhase: 'enrichment' },
      '12D':  { nextPass: null,   phase: 'done',       completesPhase: 'enrichment' },
    };

    const transition = PASS_CHAIN[spec.id];
    if (transition) {
      if (transition.completesPhase) {
        // Mark the phase we just finished as complete
        await updateRunPhase(runId, transition.completesPhase as any, null, 'complete');
      }
      // Set the new phase as running (or done if terminal)
      const newStatus = transition.phase === 'done' ? 'complete' : 'running';
      await updateRunPhase(runId, transition.phase as any, transition.nextPass, newStatus);
    } else {
      // Unknown pass — leave phase unchanged
      await updateRunPhase(runId, spec.phase as any, null, 'running');
    }

    return {
      success: true,
      artifacts: producedArtifacts
    };
  } catch (err) {
    return {
      success: false,
      artifacts: [],
      error: `Fatal Executor Error: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
