import { NormalizedSource, NormalizedEpisode, SourceFlag, FlagCode } from '../types';
import { getRun, getSourceByRun, writeSource } from '../storage';
import { generateUlid, captureAssembly, captureSynthesis } from '../console';
import { ShowStorage } from '../../storage/ShowStorage';
import { computeExportHash } from './hash';
import { detectBandAndFormat } from './detect';
import { CharacterReconciler } from './reconcile_characters';
import { extractStructured } from './extract_structured';
import { segmentProse } from './segment_prose';
import { Psb4InvariantError } from '../errors';

/**
 * Main public entry point of D512 Teleplay Export Reader.
 * Consumes a raw PSB3 export payload (string or object), and normalizes it.
 * Runs 5 deterministic parsing steps and traces progress via the console.
 */
export async function readSource(
  runId: string,
  exportPayload: any
): Promise<NormalizedSource> {
  const startedAt = Date.now();

  // 1. Load run
  const run = await getRun(runId);
  if (!run) {
    throw new Psb4InvariantError(
      'RUN_NOT_FOUND',
      `Cannot read source: run with ID "${runId}" does not exist.`
    );
  }

  // 2. Compute deterministic hash of the incoming export script
  const incomingHash = computeExportHash(exportPayload);

  // 3. Immutability & Idempotency Check
  if (run.sourceTeleplayHash && run.sourceTeleplayHash !== incomingHash) {
    throw new Psb4InvariantError(
      'HASH_MISMATCH',
      `Run source hash is immutable. The incoming export hash (${incomingHash}) does not match the run's stored hash (${run.sourceTeleplayHash}).`
    );
  }

  // If a psb4_source already exists for this run and hashes match, return it (fully idempotent)
  const existingSource = await getSourceByRun(runId);
  if (existingSource && existingSource.exportSourceHash === incomingHash) {
    return existingSource;
  }

  // 4. Fetch the Show Database Record for Snapshotted Context
  const show = await ShowStorage.getById(run.showId);
  const showCharacters = show?.characters || [];
  const canonicalCharIds = showCharacters.map(c => c.id);

  const allFlags: SourceFlag[] = [];

  // Stage 4.1: Detect Format and Band
  const { exportFormat, detectedBand } = detectBandAndFormat(exportPayload, canonicalCharIds);
  
  await captureAssembly({
    runId,
    phase: 'reduction',
    pass: 'read.detect',
    step: 'format',
    inputs: {
      fragments: [
        { 
          name: 'raw_export_payload', 
          content: typeof exportPayload === 'string' ? exportPayload : JSON.stringify(exportPayload, null, 2) 
        }
      ]
    },
    output: `Detected format: "${exportFormat}", Band: "${detectedBand}".`
  });

  // Stage 4.2: Pull Show Data & Snapshot
  const showSnapshotData = {
    id: show?.id || run.showId,
    title: show?.name || 'Untitled Show',
    register: (show as any)?.register || null,
    charactersCount: showCharacters.length
  };

  await captureAssembly({
    runId,
    phase: 'reduction',
    pass: 'read.show',
    step: 'snapshot',
    inputs: {
      fragments: [
        {
          name: 'show_database_state',
          content: JSON.stringify(showSnapshotData, null, 2)
        }
      ]
    },
    output: `Pulled show roster containing ${showCharacters.length} active characters.`
  });

  // Prepare Character Reconciler
  const reconciler = new CharacterReconciler(showCharacters);

  // Stage 4.3 & 4.4: Extraction of Elements (Structured or Prose)
  let episodes: NormalizedEpisode[] = [];

  if (detectedBand === 'A' || detectedBand === 'B') {
    // 4.3 Extract Structured
    const { episodes: extracted, flags: extractedFlags } = extractStructured(exportPayload, reconciler);
    episodes = extracted;
    allFlags.push(...extractedFlags);

    // Assembly trace per episode
    for (const ep of episodes) {
      await captureAssembly({
        runId,
        phase: 'reduction',
        pass: 'read.extract',
        step: `episode_${ep.index}`,
        inputs: {
          fragments: [
            {
              name: `extracted_episode_structure_ep_${ep.index}`,
              content: JSON.stringify(ep, null, 2)
            }
          ]
        },
        output: `Extracted structured episode index ${ep.index} ("${ep.title}") featuring ${ep.scenes.length} scene(s).`
      });
    }
  } else {
    // 4.4 Prose Segmenter
    const { episodes: segmented, flags: segmentedFlags } = segmentProse(exportPayload, reconciler, detectedBand);
    episodes = segmented;
    allFlags.push(...segmentedFlags);

    // Assembly trace per episode
    for (const ep of episodes) {
      await captureAssembly({
        runId,
        phase: 'reduction',
        pass: 'read.segment',
        step: `episode_${ep.index}`,
        inputs: {
          fragments: [
            {
              name: `segmented_prose_ep_${ep.index}`,
              content: ep.rawProse || ''
            }
          ]
        },
        output: `Segmented prose of episode index ${ep.index} ("${ep.title}") into ${ep.scenes.length} heading-bounded scene(s).`
      });
    }
  }

  // Stage 4.5: Compute final telemetry flags and write the NormalizedSource record
  
  // Flag: Empty show characters roster
  if (showCharacters.length === 0) {
    allFlags.push({
      level: 'error',
      code: FlagCode.NO_CHARACTERS_IN_SHOW,
      episodeId: null,
      sceneId: null,
      beatId: null,
      message: 'Show record holds no characters. Character name/ID reconciliation is unavailable.'
    });
  }

  // Flag: Missing season arc summary context
  const arcSummary = exportPayload?.season?.arcSummary || exportPayload?.season?.summary || null;
  const briefGrid = exportPayload?.season?.briefGrid || null;
  if (!arcSummary && !briefGrid) {
    allFlags.push({
      level: 'warn',
      code: FlagCode.MISSING_SEASON_ARC,
      episodeId: null,
      sceneId: null,
      beatId: null,
      message: 'The export mentions no season-level arc summary or brief grid. Wave 2 reductions will execute without an upstream anchor.'
    });
  }

  const normalizedSource: NormalizedSource = {
    id: generateUlid(),
    runId,
    showId: run.showId,
    capturedAt: startedAt,
    exportSourceHash: incomingHash,
    exportFormat,
    detectedBand,
    show: {
      id: show?.id || run.showId,
      title: show?.name || 'Untitled Show',
      register: (show as any)?.register || null,
      characters: reconciler.getNormalizedCharacters(),
      gnPacket: show?.gnPacket || undefined
    },
    season: {
      title: exportPayload?.season?.title || null,
      arcSummary,
      structureConfig: exportPayload?.season?.structureConfig || null,
      briefGrid
    },
    episodes,
    flags: allFlags,
    schemaVersion: 1
  };

  // Persist the normalized source record
  await writeSource(normalizedSource);

  // Write finalized synthesis console logging
  await captureSynthesis<NormalizedSource>({
    runId,
    phase: 'reduction',
    pass: 'read.finalize',
    step: 'write_source',
    input: {
      incomingHash,
      detectedBand,
      episodesCount: episodes.length,
      flagsTriggered: allFlags.length
    },
    synthesized: normalizedSource,
    parserName: 'TeleplayReaderPipeline'
  });

  return normalizedSource;
}
