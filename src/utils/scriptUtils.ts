import { CinematicBeat, ScriptLine, CaptionEntry, Show } from '../types/models';
import { ACTION_WORDS, SIGNIFICANT_ACTION_MIN_DESC_LENGTH, SIGNIFICANT_ACTION_WORD_THRESHOLD } from '../constants/generation.constants';
import { resolveSpeakerDisplayLabel, getSpeakerClassification } from './characterUtils';

/**
 * hasSignificantAction
 * True when beat.description contains significant physical action
 * beyond conversational stage directions.
 */
export function hasSignificantAction(beat: CinematicBeat): boolean {
  const desc = (beat.description || '').toLowerCase();
  if (desc.length < SIGNIFICANT_ACTION_MIN_DESC_LENGTH) return false;
  const actionCount = ACTION_WORDS.filter(w => desc.includes(w)).length;
  return actionCount >= SIGNIFICANT_ACTION_WORD_THRESHOLD;
}

/**
 * resolveEntries — D96
 * Returns the ordered mixed sequence of ScriptLines and CaptionEntries
 * for a beat. Handles migration from legacy lines[] to entries[].
 */
export function resolveEntries(beat: any, show?: Show | null | undefined): (ScriptLine | CaptionEntry)[] {
  if (!beat) return [];
  // New path: entries[] exists
  let raw: any[] = [];
  if (beat.script?.entries && Array.isArray(beat.script.entries) && beat.script.entries.length > 0) {
    raw = beat.script.entries;
  } else {
    // Migration path: promote lines[] to entries[] shape
    // (ScriptLine has no kind field; CaptionEntry has kind: "caption")
    const lines = (beat.script && Array.isArray(beat.script.lines)) 
      ? beat.script.lines 
      : (Array.isArray(beat.lines) ? beat.lines : []);
    raw = lines;
  }

  return raw.map(entry => {
    if (!entry) return entry;
    if (entry.kind === 'caption') return entry;

    const speakerKey = entry.characterHandle || entry.characterId || entry.speakerName || '';
    const finalHandle = entry.characterHandle || speakerKey;
    const finalId = entry.characterId || null;

    const speakerDisplayLabel = resolveSpeakerDisplayLabel({
      speakerKey: finalHandle,
      characterId: finalId,
      characterHandle: finalHandle,
      speakerName: entry.speakerName,
      characters: show?.characters
    });

    const speakerClassification = getSpeakerClassification(finalHandle, show);
    const canonicalSpeakerKey = finalId ? `@${finalId}` : finalHandle;

    return {
      ...entry,
      canonicalSpeakerKey,
      speakerDisplayLabel,
      displayName: speakerDisplayLabel,
      speakerClassification
    };
  });
}

/**
 * resolveLines — updated D96
 * Returns only ScriptLine entries (filters out CaptionEntry).
 * All existing callers continue to work unchanged.
 */
export function resolveLines(beat: any, show?: Show | null | undefined): ScriptLine[] {
  if (!beat) return [];
  let raw: any[] = [];
  if (beat.script?.lines && Array.isArray(beat.script.lines)) {
    raw = beat.script.lines;
  } else if (Array.isArray(beat.lines) && beat.lines.length > 0) {
    raw = beat.lines;
  } else {
    const entries = beat.script?.entries || [];
    raw = entries.filter((e: any) => e && e.kind !== 'caption');
  }

  return raw.map(line => {
    if (!line) return line;
    const speakerKey = line.characterHandle || line.characterId || line.speakerName || '';
    const finalHandle = line.characterHandle || speakerKey;
    const finalId = line.characterId || null;

    const speakerDisplayLabel = resolveSpeakerDisplayLabel({
      speakerKey: finalHandle,
      characterId: finalId,
      characterHandle: finalHandle,
      speakerName: line.speakerName,
      characters: show?.characters
    });

    const speakerClassification = getSpeakerClassification(finalHandle, show);
    const canonicalSpeakerKey = finalId ? `@${finalId}` : finalHandle;

    return {
      ...line,
      canonicalSpeakerKey,
      speakerDisplayLabel,
      displayName: speakerDisplayLabel,
      speakerClassification
    };
  });
}

/**
 * hasDialogueContent — D322
 * True if the beat has any dialogue entries or legacy lines.
 */
export function hasDialogueContent(beat: CinematicBeat): boolean {
  return resolveEntries(beat).length > 0;
}

export function isCaption(entry: ScriptLine | CaptionEntry): entry is CaptionEntry {
  return (entry as any).kind === "caption";
}
