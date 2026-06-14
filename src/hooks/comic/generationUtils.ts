import { AssetStorage } from '../../storage';
import { CinematicBeat, Show, Scene, LockedReference } from '../../types/models';
import { resolveCharacter } from '../../domainUtils';

export async function loadPortraits(
  beat: CinematicBeat,
  show: Show,
  dispatch: any
): Promise<{ name: string; dataUri: string; isCharacter: boolean; assetId: string }[]> {
  const result: { name: string; dataUri: string; isCharacter: boolean; assetId: string }[] = [];
  const loaded = new Set<string>(); // track by character.id to avoid duplicates

  // Build the list of refs to try: characterIds first, then line handles as fallback
  const cidRefs = beat.characterIds ?? [];
  const lineRefs = (() => {
    const lines = beat.script?.lines ?? beat.lines ?? [];
    return [...new Set(lines.map(l => l.characterHandle))];
  })();

  // Try characterIds first, then supplement with line handles
  // (line handles always resolve via D94 suffix matching)
  const allRefs = [...cidRefs, ...lineRefs];

  for (const ref of allRefs) {
    const char = resolveCharacter(show, ref);  // D94+D97: full resolution
    if (!char || loaded.has(char.id)) continue;
    const aid = char.portraitAssetId ?? char.visualAnchorAssetId;
    if (aid) {
      const dataUri = await AssetStorage.getDataUri(aid);
      if (dataUri) {
        result.push({ name: char.name, dataUri, isCharacter: true, assetId: aid });
        loaded.add(char.id);
      }
    }
  }

  // D97: log characters that resolved but have no portrait asset
  const allRefs2 = [...new Set([...(beat.characterIds ?? []), ...lineRefs])];
  const noPortrait = allRefs2
    .map(ref => resolveCharacter(show, ref))
    .filter((c): c is NonNullable<typeof c> => !!c && !loaded.has(c.id) && !c.portraitAssetId && !c.visualAnchorAssetId)
    .map(c => c.name);
  if (noPortrait.length > 0)
    dispatch({ type: 'PIPELINE_LOG', log: `\u26a0 No portraits for: ${[...new Set(noPortrait)].join(', ')}` });

  return result;
}

/** Internal: load data URIs for a filtered reference list. */
async function loadRefEntries(
  refs: LockedReference[],
  show: Show
): Promise<{ label: string; description?: string; dataUri: string; isCharacter: boolean; assetId: string }[]> {
  const result = [];
  for (const ref of refs) {
    const dataUri = await AssetStorage.getDataUri(ref.assetId);
    if (!dataUri) continue;
    // Resolve character name if linked
    const char = ref.linkedCharacterId
      ? show.characters?.find(c => c.id === ref.linkedCharacterId)
      : null;
    result.push({
      label:       char ? char.name : ref.label,
      description: ref.description,
      dataUri,
      isCharacter: !!ref.linkedCharacterId,
      assetId: ref.assetId,
    });
  }
  return result;
}

/**
 * Load references strictly for a single beat or a set of beats (for a page).
 * - Character-linked: only if character is in beat.characterIds
 * - Unlinked/Global: excluded by default
 * - Scene-setting: excluded by default unless beat is ESTABLISHING/TABLEAU or explicit option
 */
export async function loadBeatLockedReferences(
  show: Show,
  scene: Scene,
  beatOrBeats: CinematicBeat | CinematicBeat[],
  options: { includeGlobal?: boolean } = {}
): Promise<{ label: string; description?: string; dataUri: string; isCharacter: boolean; assetId: string }[]> {
  const beats = Array.isArray(beatOrBeats) ? beatOrBeats : [beatOrBeats];
  const includeGlobal = options.includeGlobal ?? false;

  const beatCharacterIds = new Set<string>();
  beats.forEach(b => (b.characterIds ?? []).forEach(cid => beatCharacterIds.add(cid)));

  const active = (show.lockedReferences ?? []).filter(r => {
    if (!r.active) return false;
    
    // Character-linked: only if character is in beat
    if (r.linkedCharacterId) {
      return beatCharacterIds.has(r.linkedCharacterId);
    }
    
    // Setting-linked: attach whenever the scene matches
    if (r.linkedSettingId) {
      return scene.settingAnchorId === r.linkedSettingId;
    }
    
    // Global/Unlinked: only if explicit
    return includeGlobal;
  });
  
  return loadRefEntries(active, show);
}
