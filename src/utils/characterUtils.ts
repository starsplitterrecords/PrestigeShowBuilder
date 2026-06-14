import { Character, Show } from '../types/models';
import type { PageBeat } from '../types/production';
import type { ScriptLine } from '../types/beat';

export interface RefResolverResult {
  resolvedCharacters: Character[];
  unresolvedIdentifiers: string[];
  malformedIdentifiersNormalized: { [original: string]: string } & string[];
  missingReferenceAssets: Character[];
}

export function isPanelDirection(ref: string): boolean {
  if (!ref) return false;
  const norm = ref.trim().toUpperCase();
  if (norm.startsWith('(') || norm.endsWith(')')) return true;
  const directionKeywords = [
    'PAN', 'ZOOM', 'CUT', 'CLOSE', 'WIDE', 'MEDIUM', 'FADE', 'INT.', 'EXT.', 'TRACKING',
    'DOLLY', 'TILT', 'TRANSITION', 'ESTABLISHING', 'OVER THE SHOULDER', 'HIGH ANGLE',
    'LOW ANGLE', 'OTS', 'POV', 'INSERT', 'CLOSE-UP', 'ECU', 'MCU', 'MS', 'WS', 'BACKGROUND',
    'FOREGROUND', 'SFX', 'VFX', 'ANGLE ON', 'REVERSE ANGLE', 'SCENE', 'ACT', 'BEAT'
  ];
  return directionKeywords.some(keyword => norm.startsWith(keyword) || norm === keyword);
}

export function resolveCanonicalCharacters(show: Show | null | undefined, identifiers: string[]): RefResolverResult {
  const result: RefResolverResult = {
    resolvedCharacters: [],
    unresolvedIdentifiers: [],
    malformedIdentifiersNormalized: [] as any,
    missingReferenceAssets: []
  };

  if (!show || !show.characters) {
    result.unresolvedIdentifiers = [...identifiers];
    return result;
  }

  const seenIds = new Set<string>();

  for (const ref of identifiers) {
    if (!ref || !ref.trim()) continue;

    const trimmed = ref.trim();

    // Do not treat panel directions as character identifiers.
    if (isPanelDirection(trimmed)) {
      continue;
    }

    let resolvedChar: Character | undefined = undefined;
    let isMalformedNormalized = false;
    let normalizedVal = trimmed;

    // 1. Exact character.id matching
    resolvedChar = show.characters.find(c => c && c.id === trimmed);

    // 2. Malformed @ + character.id matching
    if (!resolvedChar && trimmed.startsWith('@')) {
      const stripped = trimmed.slice(1);
      const matchedById = show.characters.find(c => c && c.id === stripped);
      if (matchedById) {
        resolvedChar = matchedById;
        isMalformedNormalized = true;
        normalizedVal = stripped;
      }
    }

    // 3. Exact character.handle matching
    if (!resolvedChar) {
      resolvedChar = show.characters.find(c => c && c.handle && c.handle.toLowerCase() === trimmed.toLowerCase());
    }
    // Also support handle matching without leading @ if trimmed starts with @ but isn't exact ID
    if (!resolvedChar && trimmed.startsWith('@')) {
      const stripped = trimmed.slice(1);
      const lowerStripped = stripped.toLowerCase();
      resolvedChar = show.characters.find(c => c && c.handle && (
        c.handle.toLowerCase() === lowerStripped || 
        c.handle.replace(/^@/, '').toLowerCase() === lowerStripped
      ));
    }

    // 4. character.name only as an unambiguous fallback
    if (!resolvedChar) {
      const stripped = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
      const lowerStripped = stripped.toLowerCase();
      // Look for exact case-insensitive name match
      let nameMatches = show.characters.filter(c => c && c.name && c.name.toLowerCase() === lowerStripped);
      if (nameMatches.length === 1) {
        resolvedChar = nameMatches[0];
      } else if (nameMatches.length === 0) {
        // Partial case-insensitive name match in case exact name didn't match
        nameMatches = show.characters.filter(c => c && c.name && c.name.toLowerCase().includes(lowerStripped));
        if (nameMatches.length === 1) {
          resolvedChar = nameMatches[0];
        }
      }
    }

    if (resolvedChar) {
      if (!seenIds.has(resolvedChar.id)) {
        seenIds.add(resolvedChar.id);
        result.resolvedCharacters.push(resolvedChar);
      }
      if (isMalformedNormalized) {
        result.malformedIdentifiersNormalized[trimmed] = normalizedVal;
        result.malformedIdentifiersNormalized.push(normalizedVal);
      }
    } else {
      result.unresolvedIdentifiers.push(trimmed);
    }
  }

  // Check for missingReferenceAssets from all uniquely resolved characters
  for (const char of result.resolvedCharacters) {
    const hasPortrait = !!(char.portraitAssetId && char.portraitAssetId.trim());
    const hasVisualAnchor = !!(char.visualAnchorAssetId && char.visualAnchorAssetId.trim());
    if (!hasPortrait && !hasVisualAnchor) {
      result.missingReferenceAssets.push(char);
    }
  }

  return result;
}

/**
 * RESOLVE CHARACTER
 */
export const resolveCharacter = (show: Show, ref: string): Character | undefined => {
  if (!ref || !show || !show.characters) return undefined;

  // Fast path: exact matches
  const exact = show.characters.find(c => {
    if (!c) return false;
    if (c.id === ref || c.handle === ref) return true;
    
    const lRef = ref.toLowerCase();
    const lName = (c.name || '').toLowerCase();
    const lHandle = (c.handle || '').toLowerCase();
    
    return lName === lRef || lHandle === lRef;
  });
  if (exact) return exact;

  // Clean suffix fallback: @vik.bjorn resolves from "@something.bjorn", "bjorn", "@bjorn", "BJORN", "vik.bjorn"
  const cleanRef = ref.replace(/^@/, '').toLowerCase();
  const refSuffix = cleanRef.includes('.') ? cleanRef.split('.').pop() : cleanRef;

  if (refSuffix) {
    const bySuffix = show.characters.find(c => {
      if (!c || !c.handle) return false;
      const cleanHandle = c.handle.replace(/^@/, '').toLowerCase();
      const cSuffix = cleanHandle.includes('.') ? cleanHandle.split('.').pop() : cleanHandle;
      return cSuffix === refSuffix;
    });
    if (bySuffix) return bySuffix;
  }

  // Partial name substring fallback: e.g. ref "Bjorn" matches "Bjorn Ironside" or vice versa
  const cleanRefName = ref.toLowerCase().trim();
  const byNamePartial = show.characters.find(c => {
    if (!c || !c.name) return false;
    const lName = c.name.toLowerCase().trim();
    return lName.includes(cleanRefName) || cleanRefName.includes(lName);
  });
  if (byNamePartial) return byNamePartial;

  return undefined;
};

export function getSpeakerClassification(
  handleOrIdOrSpeaker: string | null | undefined,
  show: Show | null | undefined,
  scriptLine?: any
): 'resolvedCharacter' | 'unresolvedSpeaker' | 'nonCharacterVoice' | 'unknown' {
  if (!handleOrIdOrSpeaker) return 'unknown';

  const trimmed = handleOrIdOrSpeaker.trim();
  if (!trimmed) return 'unknown';

  // If scriptLine has speakerClassification, use it:
  if (scriptLine && scriptLine.speakerClassification) {
    return scriptLine.speakerClassification;
  }

  // Check manual show override first
  if (show && show.unresolvedSpeakerSettings) {
    const override = show.unresolvedSpeakerSettings[trimmed] || show.unresolvedSpeakerSettings[trimmed.toLowerCase()];
    if (override) {
      return override;
    }
  }

  // Try to resolve canonical
  let valToResolve = trimmed;
  if (show && show.unresolvedSpeakerMapping) {
    const mapped = show.unresolvedSpeakerMapping[trimmed] || show.unresolvedSpeakerMapping[trimmed.toLowerCase()];
    if (mapped) valToResolve = mapped;
  }

  const canonicalRes = resolveCanonicalCharacters(show, [valToResolve]);
  if (canonicalRes.resolvedCharacters.length > 0) {
    return 'resolvedCharacter';
  }

  // Non-character voices heuristic or exact list
  const nonCharKeywords = ['control', 'dispatch', 'mech', 'radio', 'computer', 'system', 'voice', 'announcer', 'narrator'];
  const lowerBase = trimmed.toLowerCase().replace(/^@/, '');
  if (nonCharKeywords.some(keyword => lowerBase === keyword || lowerBase.includes(keyword))) {
    return 'nonCharacterVoice';
  }

  return 'unresolvedSpeaker';
}


export function getSpeakerDisplayLabel(
  handleOrIdOrSpeaker: string | null | undefined,
  show: Show | null | undefined,
  scriptLine?: any
): string {
  if (!handleOrIdOrSpeaker) return 'UNKNOWN';

  const trimmed = handleOrIdOrSpeaker.trim();
  if (!trimmed) return 'UNKNOWN';

  return resolveSpeakerDisplayLabel({
    speakerKey: trimmed,
    characterId: scriptLine?.characterId,
    characterHandle: scriptLine?.characterHandle || trimmed,
    speakerName: scriptLine?.speakerName,
    characters: show?.characters
  });
}

export function resolveSpeakerDisplayLabel({
  speakerKey,
  characterId,
  characterHandle,
  speakerName,
  characters,
  aliases
}: {
  speakerKey?: string;
  characterId?: string | null;
  characterHandle?: string;
  speakerName?: string;
  characters?: any[];
  aliases?: { [key: string]: string };
}): string {
  // 1. Normalize malformed @characterId to characterId, then resolve.
  let cleanId = characterId ? characterId.trim() : "";
  if (cleanId.startsWith('@')) {
    cleanId = cleanId.slice(1);
  }

  // Match characterId to roster character name
  if (cleanId && characters) {
    const char = characters.find(c => c && c.id === cleanId);
    if (char && (char.name || char.handle)) {
      return (char.name || char.handle).toUpperCase();
    }
  }

  // 2. Match speakerKey / characterHandle to roster character
  const keysToMatch = [];
  if (speakerKey) keysToMatch.push(speakerKey.trim());
  if (characterHandle) keysToMatch.push(characterHandle.trim());

  if (characters) {
    for (const key of keysToMatch) {
      if (!key) continue;
      let keyNoAt = key.startsWith('@') ? key.slice(1) : key;

      const char = characters.find(c => {
        if (!c) return false;
        if (c.id === keyNoAt) return true;
        if (c.handle) {
          const hNoAt = c.handle.startsWith('@') ? c.handle.startsWith('@') ? c.handle.slice(1) : c.handle : c.handle;
          if (hNoAt.toLowerCase() === keyNoAt.toLowerCase()) return true;
        }
        if (c.name) {
          if (c.name.toLowerCase() === keyNoAt.toLowerCase()) return true;
        }
        return false;
      });

      if (char && (char.name || char.handle)) {
        return (char.name || char.handle).toUpperCase();
      }
    }
  }

  // 4. Use explicit speakerName if present
  if (speakerName && speakerName.trim()) {
    return speakerName.trim().toUpperCase();
  }

  // 5. Use alias map for non-character voices such as CONTROL, MECH, NARRATOR, RADIO
  const mergedAliases: { [key: string]: string } = {
    'control': 'CONTROL',
    'mech': 'MECH',
    'narrator': 'NARRATOR',
    'radio': 'RADIO',
    'dispatch': 'DISPATCH',
    'computer': 'COMPUTER',
    'system': 'SYSTEM',
    'voice': 'VOICE',
    'announcer': 'ANNOUNCER',
    ...(aliases || {})
  };

  const lookupKeys = [];
  if (speakerKey) lookupKeys.push(speakerKey.trim().toLowerCase());
  if (characterHandle) lookupKeys.push(characterHandle.trim().toLowerCase());
  if (characterId) lookupKeys.push(characterId.trim().toLowerCase());

  for (const k of lookupKeys) {
    let kNoAt = k.startsWith('@') ? k.slice(1) : k;
    if (mergedAliases[k]) {
      return mergedAliases[k].toUpperCase();
    }
    if (mergedAliases[kNoAt]) {
      return mergedAliases[kNoAt].toUpperCase();
    }
  }

  // 6. Fall back to readable prettified label
  const rawToken = speakerKey || characterHandle || characterId;
  if (rawToken && rawToken.trim()) {
    const trimmedToken = rawToken.trim();
    const isOpaque = /^[a-z0-9]{8,15}$/i.test(trimmedToken) || (trimmedToken.startsWith('@') && /^[a-z0-9]{8,15}$/i.test(trimmedToken.slice(1)));
    if (isOpaque) {
      console.warn(`Diagnostic: Unknown opaque speaker token: ${trimmedToken}`);
      return 'UNKNOWN';
    }

    let base = trimmedToken.startsWith('@') ? trimmedToken.slice(1) : trimmedToken;
    if (base.includes('.')) {
      base = base.split('.').pop() || base;
    }
    const prettified = base
      .replace(/_/g, ' ')
      .replace(/[-\.]/g, ' ')
      .trim()
      .toUpperCase();
    
    if (prettified) {
      return prettified;
    }
  }

  // 7. Use UNKNOWN only for truly opaque unresolved tokens
  return 'UNKNOWN';
}

/**
 * FAST character derivation based on pageBeat contents (narrative text, visual notes, directions, script dialogue, and panel plans).
 */
export function deriveCharactersForBeat(pageBeat: PageBeat, show: Show): string[] {
  const characters = show.characters ?? [];
  if (characters.length === 0) return [];

  // Assemble the text content to search
  const textParts: string[] = [];
  
  if (pageBeat.description) textParts.push(pageBeat.description);
  if (pageBeat.visualNote) textParts.push(pageBeat.visualNote);
  if (pageBeat.direction) textParts.push(pageBeat.direction);
  if (pageBeat.subtext) textParts.push(pageBeat.subtext);

  // Directly track IDs, handles and names we find in the script or panel metadata
  const foundIds = new Set<string>();
  const foundHandlesOrNames = new Set<string>();

  // Extract from script
  if (pageBeat.script) {
    const lines = pageBeat.script.lines ?? [];
    const entries = pageBeat.script.entries ?? [];
    const allScriptLines = [...lines, ...entries].filter(e => e && 'text' in e) as ScriptLine[];

    for (const line of allScriptLines) {
      if (line.characterId) {
        foundIds.add(line.characterId);
      }
      if (line.characterHandle) {
        foundHandlesOrNames.add(line.characterHandle.toLowerCase());
      }
      if (line.displayName) {
        foundHandlesOrNames.add(line.displayName.toLowerCase());
      }
      if (line.speakerName) {
        foundHandlesOrNames.add(line.speakerName.toLowerCase());
      }
      if (line.speakerDisplayLabel) {
        foundHandlesOrNames.add(line.speakerDisplayLabel.toLowerCase());
      }
      if (line.text) {
        textParts.push(line.text);
      }
    }

    // Capture other entries like captions if they have characters
    for (const entry of entries) {
      if (entry && 'characterHandle' in entry && entry.characterHandle) {
        foundHandlesOrNames.add((entry as any).characterHandle.toLowerCase());
      }
    }
  }

  // Extract from panel plans
  if (pageBeat.panelPlans) {
    for (const panel of pageBeat.panelPlans) {
      if (panel.action) textParts.push(panel.action);
      if (panel.direction) textParts.push(panel.direction);
      if (panel.subtext) textParts.push(panel.subtext);
      if (panel.foreground) textParts.push(panel.foreground);
      if (panel.midground) textParts.push(panel.midground);
      if (panel.background) textParts.push(panel.background);
      if (panel.relationalStaging) textParts.push(panel.relationalStaging);

      if (panel.characterPositions) {
        for (const pos of panel.characterPositions) {
          if (pos.characterHandle) {
            foundHandlesOrNames.add(pos.characterHandle.toLowerCase());
          }
        }
      }
    }
  }

  const combinedText = textParts.join(' \n ').toLowerCase();

  const derivedIds: string[] = [];

  for (const char of characters) {
    // 1. Check if ID was directly found in metadata
    if (foundIds.has(char.id)) {
      derivedIds.push(char.id);
      continue;
    }

    // 2. Check if handle or name matches any found in metadata
    const charHandleLower = char.handle ? char.handle.toLowerCase() : '';
    const charHandleWithoutAt = charHandleLower.startsWith('@') ? charHandleLower.slice(1) : charHandleLower;
    const charNameLower = char.name ? char.name.toLowerCase() : '';

    let matched = false;

    if (charHandleLower && (foundHandlesOrNames.has(charHandleLower) || foundHandlesOrNames.has(charHandleWithoutAt))) {
      matched = true;
    } else if (charNameLower && foundHandlesOrNames.has(charNameLower)) {
      matched = true;
    }

    if (matched) {
      derivedIds.push(char.id);
      continue;
    }

    // 3. Regex scan over the combined text block (description, visualNote, script lines)
    if (charHandleLower) {
      if (combinedText.includes(charHandleLower)) {
        derivedIds.push(char.id);
        continue;
      }
      if (charHandleWithoutAt && combinedText.includes(charHandleWithoutAt)) {
        const escaped = charHandleWithoutAt.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(combinedText)) {
          derivedIds.push(char.id);
          continue;
        }
      }
    }

    if (charNameLower) {
      const escaped = charNameLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(combinedText)) {
        derivedIds.push(char.id);
        continue;
      }
    }
  }

  return derivedIds;
}

export function resolveScriptLineCharacter(
  show: Show | null | undefined,
  line: { characterId?: string | null; characterHandle?: string; speakerName?: string } | null | undefined
): Character | undefined {
  const characters = show?.characters;
  if (!characters || !line) return undefined;

  const eq = (a?: string, b?: string) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();
  const noAt = (s?: string) => (s && s.startsWith('@') ? s.slice(1) : s || '');

  // 1. characterId (normalize a malformed @id)
  const cleanId = noAt((line.characterId || '').trim());
  if (cleanId) {
    const byId = characters.find(c => c && c.id === cleanId);
    if (byId) return byId;
  }

  // 2. characterHandle / speakerName against id, handle, or name
  const keys = [line.characterHandle, line.speakerName]
    .map(k => noAt((k || '').trim()))
    .filter(Boolean);
  for (const key of keys) {
    const match = characters.find(c => {
      if (!c) return false;
      if (c.id === key) return true;
      if (c.handle && eq(noAt(c.handle), key)) return true;
      if (c.name && eq(c.name, key)) return true;
      return false;
    });
    if (match) return match;
  }

  return undefined;
}

