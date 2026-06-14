import { NormalizedCharacter, SourceFlag, FlagCode } from '../types';
import { Character } from '../../types/character';

/**
 * Normalizes and builds canonical structures for reconciling character IDs inside the export.
 * Handles exact matching, handle suffixes (e.g., @starsplit.theo -> @ech.theo),
 * and generates appropriate logs/flags.
 */

// Simple helper to extract prefix-free suffix
function getCharacterSuffix(handle: string): string {
  if (!handle) return '';
  const clean = handle.startsWith('@') ? handle.slice(1) : handle;
  const parts = clean.split('.');
  return parts[parts.length - 1].toLowerCase().trim();
}

export class CharacterReconciler {
  private canonicalCharacters: Character[];
  private normalizedCharacters: NormalizedCharacter[];
  private idMap = new Map<string, string>(); // Quick lookup of original -> canonical ID

  constructor(canonicalCharacters: Character[]) {
    this.canonicalCharacters = canonicalCharacters || [];
    this.normalizedCharacters = this.canonicalCharacters.map((char) => ({
      id: char.id,
      name: char.name,
      aliases: [],
      voiceProfile: char.voiceProfile ?? null,
      role: char.role ?? null
    }));
  }

  /**
   * Reconciles a source character ID against show character roster.
   */
  public reconcileId(
    originalId: string,
    episodeId: string | null = null,
    sceneId: string | null = null,
    beatId: string | null = null
  ): { reconciledId: string; flag: SourceFlag | null } {
    if (!originalId) {
      return { reconciledId: '', flag: null };
    }

    const trimmedOriginal = originalId.trim();

    // 1. Direct exact match
    const exactMatch = this.canonicalCharacters.find(
      (c) => c.id.toLowerCase() === trimmedOriginal.toLowerCase()
    );
    if (exactMatch) {
      return { reconciledId: exactMatch.id, flag: null };
    }

    // Checking cache
    if (this.idMap.has(trimmedOriginal)) {
      const reconciled = this.idMap.get(trimmedOriginal)!;
      // Re-fetch NC to record alias if different
      if (reconciled !== trimmedOriginal) {
        this.addAliasToNormalized(reconciled, trimmedOriginal);
      }
      return { reconciledId: reconciled, flag: null };
    }

    // 2. Alias reconciliation by suffix or simplified handle
    const origSuffix = getCharacterSuffix(trimmedOriginal);
    const suffixMatch = this.canonicalCharacters.find((c) => {
      const canonicalSuffix = getCharacterSuffix(c.id);
      return canonicalSuffix && origSuffix === canonicalSuffix;
    });

    if (suffixMatch) {
      this.idMap.set(trimmedOriginal, suffixMatch.id);
      this.addAliasToNormalized(suffixMatch.id, trimmedOriginal);
      
      const flag: SourceFlag = {
        level: 'info',
        code: FlagCode.STALE_CHARACTER_ID_RECONCILED,
        episodeId,
        sceneId,
        beatId,
        message: `Stale character ID "${trimmedOriginal}" was reconciled to canonical handle "${suffixMatch.id}".`
      };
      
      return { reconciledId: suffixMatch.id, flag };
    }

    // 3. Fallback: match by lowercased name
    const cleanOrig = trimmedOriginal.replace(/[@.]/g, '').toLowerCase();
    const nameMatch = this.canonicalCharacters.find((c) => {
      const cleanName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanName && (cleanName === cleanOrig || cleanOrig.includes(cleanName));
    });

    if (nameMatch) {
      this.idMap.set(trimmedOriginal, nameMatch.id);
      this.addAliasToNormalized(nameMatch.id, trimmedOriginal);

      const flag: SourceFlag = {
        level: 'info',
        code: FlagCode.STALE_CHARACTER_ID_RECONCILED,
        episodeId,
        sceneId,
        beatId,
        message: `Resolved character handle "${trimmedOriginal}" from name match to canonical ID "${nameMatch.id}".`
      };

      return { reconciledId: nameMatch.id, flag };
    }

    // 4. Unrecognized character ID
    const flag: SourceFlag = {
      level: 'warn',
      code: FlagCode.UNRECOGNIZED_CHARACTER_ID,
      episodeId,
      sceneId,
      beatId,
      message: `Character ID "${trimmedOriginal}" appears in source but does not match any show character or alias.`
    };

    // Return as-is
    return { reconciledId: trimmedOriginal, flag };
  }

  private addAliasToNormalized(canonicalId: string, aliasId: string) {
    const normChar = this.normalizedCharacters.find((nc) => nc.id === canonicalId);
    if (normChar && canonicalId !== aliasId) {
      if (!normChar.aliases.includes(aliasId)) {
        normChar.aliases.push(aliasId);
      }
    }
  }

  public getNormalizedCharacters(): NormalizedCharacter[] {
    return this.normalizedCharacters;
  }
}
