import { PageBeat } from '../../types/production';
import { Show } from '../../types/show';
import { AssetStorage } from '../../storage';
import { resolveCharacter, resolveCanonicalCharacters, getSpeakerClassification, isPanelDirection } from '../../domainUtils';

export interface RequiredCharacterRef {
  characterId: string;
  characterHandle?: string;
  characterName: string;
  assetId: string | null;
  dataUri: string | null;
  source: 'pageBeat.characterIds' | 'script.line.characterHandle' | 'panel.characterPositions';
}

export interface ProductionUnresolvedSpeaker {
  identifier: string;
  speakerName: string;
  source: 'pageBeat.characterIds' | 'script.line.characterHandle' | 'panel.characterPositions';
  textExcerpt?: string;
  classification: 'unresolvedSpeaker' | 'nonCharacterVoice' | 'unknown';
}

export interface ProductionCharacterRefResolution {
  required: RequiredCharacterRef[];
  loadedRefs: {
    dataUri: string;
    label: string;
    isCharacter: true;
    assetId: string;
    characterId: string;
    characterName: string;
  }[];
  missing: RequiredCharacterRef[];
  unresolvedSpeakers?: ProductionUnresolvedSpeaker[];
  normalizedIdentifiers?: { original: string; normalized: string; charName: string }[];
}

export async function resolveProductionCharacterRefs(args: {
  pageBeat: PageBeat;
  show: Show;
  dispatch?: (a: any) => void;
}): Promise<ProductionCharacterRefResolution> {
  const { pageBeat, show, dispatch } = args;
  const resolvedMap = new Map<string, RequiredCharacterRef>();
  const unresolvedSpeakers: ProductionUnresolvedSpeaker[] = [];
  const seenUnresolved = new Set<string>();
  const normalizedIdentifiers: { original: string; normalized: string; charName: string }[] = [];
  const seenNormalized = new Set<string>();

  // Helper to add or check character resolve status
  const addCharacterRef = (ref: string, source: RequiredCharacterRef['source'], textExcerpt?: string) => {
    if (!ref || !ref.trim()) return;
    const trimmed = ref.trim();

    if (isPanelDirection(trimmed)) {
      return;
    }

    // Check if it's malformed @ + id:
    if (trimmed.startsWith('@')) {
      const idPart = trimmed.slice(1);
      const matchedById = show && show.characters && show.characters.find(c => c && c.id === idPart);
      if (matchedById) {
        if (!seenNormalized.has(trimmed)) {
          seenNormalized.add(trimmed);
          normalizedIdentifiers.push({
            original: trimmed,
            normalized: idPart,
            charName: matchedById.name || matchedById.handle || matchedById.id
          });
        }
      }
    }

    // Check manual override mappings in show first
    let actualRef = trimmed;
    const lowerRef = trimmed.toLowerCase();
    
    if (show && show.unresolvedSpeakerMapping) {
      const mappedId = show.unresolvedSpeakerMapping[trimmed] || show.unresolvedSpeakerMapping[lowerRef];
      if (mappedId) {
        actualRef = mappedId;
      }
    }

    // If marked as non-character voice, we skip from required checking (but can track if needed)
    if (show && show.unresolvedSpeakerSettings) {
      const setting = show.unresolvedSpeakerSettings[trimmed] || show.unresolvedSpeakerSettings[lowerRef];
      if (setting === 'nonCharacterVoice') {
        if (!seenUnresolved.has(trimmed)) {
          seenUnresolved.add(trimmed);
          unresolvedSpeakers.push({
            identifier: trimmed,
            speakerName: trimmed,
            source,
            textExcerpt,
            classification: 'nonCharacterVoice'
          });
        }
        return;
      }
    }

    const clas = getSpeakerClassification(trimmed, show);

    // Resolve canonical character
    const res = resolveCanonicalCharacters(show, [actualRef]);
    if (res.resolvedCharacters.length > 0) {
      const char = res.resolvedCharacters[0];
      if (!resolvedMap.has(char.id)) {
        resolvedMap.set(char.id, {
          characterId: char.id,
          characterHandle: char.handle || trimmed,
          characterName: char.name || char.handle || trimmed,
          assetId: char.portraitAssetId ?? char.visualAnchorAssetId ?? null,
          dataUri: null,
          source
        });
      }
    } else {
      // It is unresolved
      if (source === 'pageBeat.characterIds') {
        // If explicitly requested as a selected character in the page beat, keep it required (so none resolve = block)
        if (!resolvedMap.has(trimmed)) {
          resolvedMap.set(trimmed, {
            characterId: trimmed,
            characterHandle: trimmed,
            characterName: trimmed,
            assetId: null,
            dataUri: null,
            source
          });
        }
      } else {
        // Dialogue lines, panel plans, etc. are not portrait-required by default
        if (!seenUnresolved.has(trimmed)) {
          seenUnresolved.add(trimmed);
          unresolvedSpeakers.push({
            identifier: trimmed,
            speakerName: trimmed,
            source,
            textExcerpt,
            classification: clas === 'nonCharacterVoice' ? 'nonCharacterVoice' : 'unresolvedSpeaker'
          });
        }
      }
    }
  };

  // 1. Gather from pageBeat.characterIds
  if (pageBeat.characterIds) {
    for (const ref of pageBeat.characterIds) {
      if (ref) addCharacterRef(ref, 'pageBeat.characterIds');
    }
  }

  // 2. Gather from pageBeat.script line / entries characterHandle values
  if (pageBeat.script) {
    const lines = pageBeat.script.lines ?? [];
    for (const line of lines) {
      if (line.characterHandle) {
        addCharacterRef(line.characterHandle, 'script.line.characterHandle', line.text);
      }
    }
    const entries = pageBeat.script.entries ?? [];
    for (const entry of entries) {
      if (entry && 'characterHandle' in entry && entry.characterHandle) {
        addCharacterRef(entry.characterHandle, 'script.line.characterHandle', entry.text);
      }
    }
  }

  // 3. Gather from pageBeat.panelPlans characterPositions
  if (pageBeat.panelPlans) {
    for (const panel of pageBeat.panelPlans) {
      if (panel.characterPositions) {
        for (const pos of panel.characterPositions) {
          if (pos.characterHandle) {
            addCharacterRef(pos.characterHandle, 'panel.characterPositions');
          }
        }
      }
      // D117 & standard balloon speaker handles if present
      if ((panel as any).balloons) {
        for (const bal of (panel as any).balloons) {
          const bRef = bal.speakerHandle || bal.characterHandle;
          if (bRef) {
            addCharacterRef(bRef, 'panel.characterPositions');
          }
        }
      }
    }
  }

  const required = Array.from(resolvedMap.values());
  const loadedRefs: ProductionCharacterRefResolution['loadedRefs'] = [];
  const missing: RequiredCharacterRef[] = [];

  for (const req of required) {
    if (!req.assetId) {
      missing.push(req);
      if (dispatch) {
        dispatch({
          type: 'PIPELINE_LOG',
          log: `⚠️ No portrait/visual anchor asset defined for character: ${req.characterName}`
        });
      }
      continue;
    }

    try {
      const dataUri = await AssetStorage.getDataUri(req.assetId);
      if (!dataUri || !dataUri.trim() || !dataUri.startsWith('data:')) {
        missing.push(req);
        if (dispatch) {
          dispatch({
            type: 'PIPELINE_LOG',
            log: `⚠️ Failed to load portrait data URI for ${req.characterName} (Asset ID: ${req.assetId})`
          });
        }
      } else {
        req.dataUri = dataUri;
        loadedRefs.push({
          dataUri,
          label: req.characterName,
          isCharacter: true,
          assetId: req.assetId,
          characterId: req.characterId,
          characterName: req.characterName
        });
      }
    } catch (err: any) {
      missing.push(req);
      if (dispatch) {
        dispatch({
          type: 'PIPELINE_LOG',
          log: `⚠️ Error loading portrait for ${req.characterName} (Asset ID: ${req.assetId}): ${err.message || err}`
        });
      }
    }
  }

  return {
    required,
    loadedRefs,
    missing,
    unresolvedSpeakers,
    normalizedIdentifiers
  };
}
