
import { Show, Season, Episode, CharacterArcLane, EpisodePairing, CharacterPhilosophy, Character } from '../../types/models';
import { compareHandles } from '../../utils/handleUtils';
import { generateShowBiblePart, prompts, schemas } from '../../geminiService';
import { appendTextGenerationLog } from '../../apiUtils';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function extractCharacterPhilosophies(
  arcText: string,
  characters: Character[]
): CharacterPhilosophy[] {
  // Never throw — if extraction fails, return empty array.
  try {
    const philosophies: CharacterPhilosophy[] = [];

    // Look for the "Philosophical Faction Map" section in the arc text
    const sectionMatch = arcText.match(
      /philosophical faction map[:\s]+(.*?)(?=\n\d+\.|$)/is
    );
    if (!sectionMatch) return [];

    const sectionText = sectionMatch[1];
    // Parse lines like: @show.atlas | Vanguard | "philosophy text"
    const lines = sectionText.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length < 2) continue;
      const handleRaw = parts[0].replace(/[^@a-z0-9_.]/gi, '');
      const char = characters.find(c =>
        compareHandles(c.handle, handleRaw) ||
        (c.handle && c.handle.toLowerCase().endsWith(handleRaw.toLowerCase().replace(/^@[^.]+\./, '')))
      );
      if (!char) continue;
      philosophies.push({
        handle: char.handle,
        faction: parts.length >= 3 ? parts[1] : undefined,
        philosophy: parts.length >= 3
          ? parts[2].replace(/^["']+|["']+$/g, '')
          : parts[1].replace(/^["']+|["']+$/g, ''),
      });
    }
    return philosophies;
  } catch {
    return [];
  }
}

interface EpisodeBrief {
  episodeNumber: number;
  title?: string;
  aStory?: string;
  bStory?: string;
  spineMovement?: string;
  turn?: string;
  endState?: string;
}

/**
 * extractEpisodeBriefs — D124
 * Parses the season arc description for the structured episode outline grid.
 * Returns a map of episode number → brief so downstream stages can anchor to it.
 * Works on any show — it just looks for 'Ep N / ...' patterns in the arc text.
 */
function extractEpisodeBriefs(arcDescription: string): Map<number, EpisodeBrief> {
  const briefs = new Map<number, EpisodeBrief>();
  if (!arcDescription) return briefs;

  // Locate the outline grid section — look for 'Ep 1' as the anchor
  // The grid may be preceded by a section header like '9) Season Outline Grid:'
  const gridStart = arcDescription.search(/Ep\s+1\s*[\/\|]/i);
  if (gridStart === -1) return briefs;  // no grid found — return empty
  const gridText = arcDescription.slice(gridStart);

  // Split on 'Ep N' boundaries
  // Each entry looks like: 'Ep 5 / Title / A-Story: ... / B-Story: ... / ...'
  const epPattern = /Ep\s+(\d+)\s*[\/\|]([^]+?)(?=Ep\s+\d+\s*[\/\|]|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = epPattern.exec(gridText)) !== null) {
    const epNum = parseInt(match[1], 10);
    const body = match[2];

    const extract = (label: string): string | undefined => {
      // Match 'Label: text' up to the next label or end
      const re = new RegExp(`${label}:\\s*([^/]+?)(?=\\s*(?:[A-Z][a-z]+ [a-z]+:|Ep\\s+\\d+|$))`, 'i');
      const m = body.match(re);
      return m ? m[1].trim() : undefined;
    };

    // Extract title — first segment after 'Ep N /'
    const titleMatch = body.match(/^\s*([^\/]+)/);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    briefs.set(epNum, {
      episodeNumber: epNum,
      title,
      aStory:        extract('A-Story') ?? extract('A-story'),
      bStory:        extract('B-Story') ?? extract('B-story'),
      spineMovement: extract('Spine movement') ?? extract('Spine'),
      turn:          extract('Turn'),
      endState:      extract('End state') ?? extract('End-state'),
    });
  }

  return briefs;
}

/**
 * extractCharacterArcLanes — D125
 * Parses the season arc description for character arc lane sections.
 * Format: '@handle: Want: ... Need: ... Lie: ... Pressure: ... Breaking Point: ... Final Choice: ...'
 * Returns one entry per character found. Works on any show.
 */
function extractCharacterArcLanes(
  arcDescription: string,
  characters: { handle: string }[]
): CharacterArcLane[] {
  const lanes: CharacterArcLane[] = [];
  if (!arcDescription) return lanes;

  for (const char of characters) {
    // Find this character's handle in the arc text
    const handleEscaped = char.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startRe = new RegExp(handleEscaped + '\\s*:', 'i');
    const startMatch = arcDescription.match(startRe);
    if (!startMatch || startMatch.index === undefined) continue;

    // Extract up to the next @handle: or numbered section
    const fromHere = arcDescription.slice(startMatch.index);
    const endRe = /(?=@\w+\.\w+\s*:|\d+\)\s+[A-Z])/;
    const endMatch = fromHere.slice(char.handle.length + 1).search(endRe);
    const block = endMatch > 0
      ? fromHere.slice(0, char.handle.length + 1 + endMatch)
      : fromHere.slice(0, 600);  // max 600 chars per character

    // Extract each labelled field
    const extract = (label: string): string | undefined => {
      const re = new RegExp(label + '\\s*:\\s*([^.!?]+[.!?]?)', 'i');
      const m = block.match(re);
      return m ? m[1].trim().slice(0, 200) : undefined;
    };

    const lane: CharacterArcLane = {
      handle: char.handle,
      want:          extract('Want'),
      need:          extract('Need'),
      lie:           extract('Lie'),
      pressure:      extract('Pressure'),
      breakingPoint: extract('Breaking Point'),
      finalChoice:   extract('Final Choice'),
    };

    // Only store if we found at least one field
    if (lane.want || lane.need || lane.pressure) {
      lanes.push(lane);
    }
  }

  return lanes;
}

/**
 * extractEpisodePairings — D125
 * Parses the 'Episode Beat Template' section of the season arc.
 * Finds recurring character pairings at structural beat positions.
 * Returns empty array if no template section found.
 */
function extractEpisodePairings(arcDescription: string): EpisodePairing[] {
  const pairings: EpisodePairing[] = [];
  if (!arcDescription) return pairings;

  // Find the episode beat template section
  const templateMarkers = [
    'Episode Beat Template',
    'Episode beat template',
    'EPISODE BEAT TEMPLATE',
  ];
  let templateStart = -1;
  for (const marker of templateMarkers) {
    const idx = arcDescription.indexOf(marker);
    if (idx > -1) { templateStart = idx; break; }
  }
  if (templateStart === -1) return pairings;

  // Extract until the next numbered section
  const fromTemplate = arcDescription.slice(templateStart);
  const nextSection = fromTemplate.slice(1).search(/\d+\)\s+[A-Z]/);
  const templateText = nextSection > 0
    ? fromTemplate.slice(0, nextSection + 1)
    : fromTemplate.slice(0, 3000);

  // Match each position: 'Label: @handle1 and @handle2' or
  // 'Label: @handle1 ... @handle2'
  // Positions vary by show; extract whatever labels appear
  const positionRe = /([A-Za-z][A-Za-z\s]+?):\s[^@]*(@[\w.]+)[^@]{0,200}(@[\w.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = positionRe.exec(templateText)) !== null) {
    const position = m[1].trim();
    const char1 = m[2].trim();
    const char2 = m[3].trim();
    // Skip if same character appears twice
    if (char1 === char2) continue;
    // Skip duplicate positions
    if (pairings.some(p => p.position === position)) continue;
    pairings.push({ position, char1, char2 });
  }

  return pairings;
}

export const stageSeason = async (
  liveShowRef: { current: Show },
  sIdx: number,
  forceRedraft: boolean,
  { log, updateStatus, checkCancelled, commit, mode, dispatch }: any
) => {
  const liveShow = () => liveShowRef.current;

  if (!liveShow().seasons[sIdx] || forceRedraft) {
    checkCancelled();
    log("AI: Drafting Season Manifesto...");
    updateStatus("Synthesizing Season Arc...");
    const data = await generateShowBiblePart(
      liveShow(),
      prompts.generateSeasonArc(sIdx),
      schemas.seasonArc,
      { s: sIdx },
      mode,
      (log) => {
        appendTextGenerationLog(dispatch, liveShow(), {
          generator: 'generateSeasonArc',
          targetKind: 'season',
          targetFid: `S${sIdx + 1}`,
          ...log
        });
      }
    );
    
    // D292: build description from structured fields for backward compat.
    const description = [
      `THESIS: ${data.thesis}`,
      `ENGINE: ${data.engine}`,
      `SPINE: ${data.spine}`,
      data.characterArcs?.length && "CHARACTER ARCS:\n" + data.characterArcs.map((a: any) => 
        `${a.handle}: Want: ${a.want}. Need: ${a.need}. Lie: ${a.lie}. Pressure: ${a.pressure || ""}. Breaking Point: ${a.breakingPoint || ""}. Final Choice: ${a.finalChoice || ""}.`
      ).join('\n'),
      data.episodeTurns?.length && "EPISODE TURNS:\n" + data.episodeTurns.map((t: any) => 
        `Ep ${t.episodeNumber}: ${t.turnLabel} — ${t.turnDescription}`
      ).join('\n'),
      data.ensembleMap && `ENSEMBLE: ${data.ensembleMap}`,
      data.episodeBeatTemplate && `BEAT TEMPLATE: ${data.episodeBeatTemplate}`,
      data.escalation && `ESCALATION: ${data.escalation}`,
      `FINALE: ${data.finale}`,
      data.outlineGrid?.length && "OUTLINE GRID:\n" + data.outlineGrid.map((e: any) => 
        `Ep ${e.episodeNumber} / ${e.title} / A-Story: ${e.aStory} / B-Story: ${e.bStory} / End state: ${e.endState}`
      ).join('\n'),
      data.philosophicalMap?.length && "PHILOSOPHICAL FACTION MAP:\n" + data.philosophicalMap.map((p: any) => 
        `${p.handle} | ${p.faction} | ${p.philosophy}`
      ).join('\n'),
    ].filter(Boolean).join('\n\n');
    
    const newSeason: Season = { 
      id: Math.random().toString(36).substring(2, 9), 
      number: sIdx + 1, 
      description,
      // D292: structured fields
      thesis: data.thesis,
      engine: data.engine,
      spine: data.spine,
      characterArcs: data.characterArcs,
      episodeTurns: data.episodeTurns,
      ensembleMap: data.ensembleMap,
      episodeBeatTemplate: data.episodeBeatTemplate,
      escalation: data.escalation,
      finale: data.finale,
      outlineGrid: data.outlineGrid,
      philosophicalMap: data.philosophicalMap,
      episodes: liveShow().seasons[sIdx]?.episodes || [] 
    };
    
    const seasons = [...liveShow().seasons];
    seasons[sIdx] = newSeason;
    await commit({ seasons });
    await sleep(1000);
  }

  const season = liveShow().seasons[sIdx];
  const targetCount = liveShow().structureConfig?.episodesPerSeason ?? 1;
  const needsEpisodes = !season.episodes || season.episodes.length < targetCount;
  if (needsEpisodes || forceRedraft) {
    checkCancelled();
    log("AI: Constructing Episode Manifest...");
    updateStatus("Cataloging Broadcast Units...");
    const epData = await generateShowBiblePart(
      liveShow(),
      prompts.generateEpisodes(sIdx, liveShow()),
      schemas.episodes,
      { s: sIdx },
      mode,
      (log) => {
        appendTextGenerationLog(dispatch, liveShow(), {
          generator: 'generateEpisodes',
          targetKind: 'season',
          targetFid: `S${sIdx + 1}`,
          ...log
        });
      }
    );
    
    const newEpisodes: Episode[] = epData.map((ep: any, i: number) => ({ 
      id: Math.random().toString(36).substring(2, 9), 
      number: i + 1, 
      title: ep.title,
      oneLiner: ep.oneLiner,
      aStory: ep.aStory || '',
      bStory: ep.bStory || '',
      endState: ep.endState || '',
      summary: '', 
      acts: [] 
    }));
    
    const seasons = [...liveShow().seasons];
    let mergedEpisodes = [...(season.episodes || [])];
    if (forceRedraft) {
      mergedEpisodes = newEpisodes;
    } else {
      newEpisodes.forEach((ep, i) => {
        if (!mergedEpisodes[i]) mergedEpisodes[i] = ep;
      });
    }
    seasons[sIdx].episodes = mergedEpisodes;
    await commit({ seasons });
    await sleep(1000);
  }

  // D124: After committing the season arc, extract per-episode briefs
  // and write them directly onto each episode as structured story fields.
  // This anchors all downstream generation to the arc's intended story.
  const arcDescription = liveShowRef.current.seasons[sIdx]?.description ?? '';
  const episodeBriefs = extractEpisodeBriefs(arcDescription);

  if (episodeBriefs.size > 0) {
    log(`D124: Anchoring ${episodeBriefs.size} episodes to season arc entries...`);
    const seasons = structuredClone(liveShowRef.current.seasons);
    const eps = seasons[sIdx].episodes;
    eps.forEach((ep, i) => {
      const brief = episodeBriefs.get(ep.number ?? i + 1);
      if (!brief) return;
      // Write arc entry fields — these become the mandate for stageEpisode
      if (brief.title && !ep.title)           ep.title    = brief.title;
      if (brief.aStory)                        ep.aStory   = brief.aStory;
      if (brief.bStory)                        ep.bStory   = brief.bStory;
      if (brief.endState)                      ep.endState = brief.endState;
      // Store turn and spine as oneLiner — used by stageEpisode prompt
      if (brief.turn || brief.spineMovement) {
        ep.oneLiner = [brief.spineMovement, brief.turn]
          .filter(Boolean).join(' → ');
      }
    });
    await commit({ seasons });
    log('D124: Arc anchoring complete.');
  }

  // D125: Extract ensemble threading data from the arc and store on the season.
  // This runs after the arc text is committed — no AI call needed.
  const arcLanes = extractCharacterArcLanes(arcDescription, liveShowRef.current.characters);
  const arcPairings = extractEpisodePairings(arcDescription);

  if (arcLanes.length > 0 || arcPairings.length > 0) {
    const updatedSeasons = structuredClone(liveShowRef.current.seasons);
    updatedSeasons[sIdx].characterArcLanes = arcLanes;
    updatedSeasons[sIdx].episodePairings   = arcPairings;
    await commit({ seasons: updatedSeasons });
    log(`D125: Extracted ${arcLanes.length} character arc lanes, ${arcPairings.length} episode pairings.`);
  } else {
    log('D125: No arc lanes or pairings found in arc text — ensemble threading unavailable.');
  }

  if (season.description && (!season.characterPhilosophies || season.characterPhilosophies.length === 0)) {
    const philosophies = extractCharacterPhilosophies(
      season.description,
      liveShow().characters
    );
    if (philosophies.length > 0) {
      const seasons = structuredClone(liveShowRef.current.seasons);
      seasons[sIdx].characterPhilosophies = philosophies;
      await commit({ seasons });
    }
  }
};
