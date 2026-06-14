import { describe, it, expect } from 'vitest';
import { resolveCanonicalCharacters, resolveSpeakerDisplayLabel, deriveCharactersForBeat } from '../utils/characterUtils';
import { Show } from '../types/show';

describe('Canonical Character Resolution (Requirement 9)', () => {
  const mockShow = {
    id: 'test-show',
    name: 'Test Show',
    showCode: 'TEST',
    characters: [
      {
        id: 'hv9jfbgm9',
        handle: '@brv1.Arvin',
        name: 'Arvin',
        portraitAssetId: 'n80h4vycwro',
        visualAnchorAssetId: 'anchor-arvin',
        role: '',
        physicalDescription: ''
      },
      {
        id: '5snrx2won',
        handle: '@brv1.Milo',
        name: 'Milo',
        portraitAssetId: '84h7jgz0ugk',
        visualAnchorAssetId: '', // missing anchor
        role: '',
        physicalDescription: ''
      },
      {
        id: '8tg8ibh7z',
        handle: '@brv1.Lucia',
        name: 'Lucia',
        portraitAssetId: '', // missing portrait
        visualAnchorAssetId: 'anchor-lucia',
        role: '',
        physicalDescription: ''
      },
      {
        id: 'dljv31xue',
        handle: '@brv1.Cyrus',
        name: 'Cyrus',
        portraitAssetId: '',
        visualAnchorAssetId: '', // missing both
        role: '',
        physicalDescription: ''
      }
    ],
    seasons: [],
    issues: []
  } as unknown as Show;

  it('resolves by exact character.id', () => {
    const result = resolveCanonicalCharacters(mockShow, ['hv9jfbgm9']);
    expect(result.resolvedCharacters).toHaveLength(1);
    expect(result.resolvedCharacters[0].id).toBe('hv9jfbgm9');
    expect(result.unresolvedIdentifiers).toHaveLength(0);
    expect(Object.keys(result.malformedIdentifiersNormalized)).toHaveLength(0);
    expect(result.missingReferenceAssets).toHaveLength(0);
  });

  it('resolves by exact character.handle', () => {
    const result = resolveCanonicalCharacters(mockShow, ['@brv1.Arvin']);
    expect(result.resolvedCharacters).toHaveLength(1);
    expect(result.resolvedCharacters[0].id).toBe('hv9jfbgm9');
    expect(result.unresolvedIdentifiers).toHaveLength(0);
    expect(Object.keys(result.malformedIdentifiersNormalized)).toHaveLength(0);
    expect(result.missingReferenceAssets).toHaveLength(0);
  });

  it('resolves malformed @-prefixed character.id', () => {
    const result = resolveCanonicalCharacters(mockShow, ['@hv9jfbgm9']);
    expect(result.resolvedCharacters).toHaveLength(1);
    expect(result.resolvedCharacters[0].id).toBe('hv9jfbgm9');
    expect(result.unresolvedIdentifiers).toHaveLength(0);
    expect(result.malformedIdentifiersNormalized['@hv9jfbgm9']).toBe('hv9jfbgm9');
  });

  it('resolves by character.name as fallback', () => {
    const result = resolveCanonicalCharacters(mockShow, ['Arvin']);
    expect(result.resolvedCharacters).toHaveLength(1);
    expect(result.resolvedCharacters[0].id).toBe('hv9jfbgm9');
    expect(result.unresolvedIdentifiers).toHaveLength(0);
  });

  it('correctly handles case-insensitivity and whitespace', () => {
    const result = resolveCanonicalCharacters(mockShow, ['  @bRv1.ArViN  ']);
    expect(result.resolvedCharacters).toHaveLength(1);
    expect(result.resolvedCharacters[0].id).toBe('hv9jfbgm9');
  });

  it('correctly reports missing portraits or visual anchors', () => {
    const result = resolveCanonicalCharacters(mockShow, ['hv9jfbgm9', '5snrx2won', '8tg8ibh7z', 'dljv31xue']);
    expect(result.resolvedCharacters).toHaveLength(4);
    
    // Milo misses anchor but has portrait, Lucia misses portrait but has anchor, Cyrus misses both.
    // Therefore only Cyrus misses both reference assets (both are empty/whitespace), which is considered unsafe.
    const missingIds = result.missingReferenceAssets.map(c => c.id);
    expect(missingIds).toContain('dljv31xue'); // Cyrus lacks both, so Cyrus must be marked missing
    expect(missingIds).not.toContain('5snrx2won'); // Milo has portrait, safe
    expect(missingIds).not.toContain('8tg8ibh7z'); // Lucia has anchor, safe
    expect(missingIds).not.toContain('hv9jfbgm9'); // Arvin has both, safe
  });

  it('reports unresolved identifiers', () => {
    const result = resolveCanonicalCharacters(mockShow, ['hv9jfbgm9', 'unknown_character_id']);
    expect(result.resolvedCharacters).toHaveLength(1);
    expect(result.resolvedCharacters[0].id).toBe('hv9jfbgm9');
    expect(result.unresolvedIdentifiers).toContain('unknown_character_id');
  });
});

describe('Speaker Display Label Resolution', () => {
  const mockShow = {
    characters: [
      { id: '5snrx2won', handle: '@brv1.Milo', name: 'Milo' },
      { id: 'hv9jfbgm9', handle: '@brv1.Arvin', name: 'Arvin' }
    ]
  } as unknown as Show;

  it('renders @5snrx2won as MILO', () => {
    const label = resolveSpeakerDisplayLabel({
      speakerKey: '@5snrx2won',
      characters: mockShow.characters
    });
    expect(label).toBe('MILO');
  });

  it('renders @hv9jfbgm9 as ARVIN', () => {
    const label = resolveSpeakerDisplayLabel({
      speakerKey: '@hv9jfbgm9',
      characters: mockShow.characters
    });
    expect(label).toBe('ARVIN');
  });

  it('renders characterId "5snrx2won" as MILO', () => {
    const label = resolveSpeakerDisplayLabel({
      characterId: '5snrx2won',
      characters: mockShow.characters
    });
    expect(label).toBe('MILO');
  });

  it('renders @control as CONTROL, not a missing portrait character', () => {
    const label = resolveSpeakerDisplayLabel({
      speakerKey: '@control',
      characters: mockShow.characters
    });
    expect(label).toBe('CONTROL');
  });

  it('renders unknown opaque IDs as UNKNOWN', () => {
    const label = resolveSpeakerDisplayLabel({
      speakerKey: '@abc123xyz789',
      characters: mockShow.characters
    });
    expect(label).toBe('UNKNOWN');
  });
});

describe('deriveCharactersForBeat', () => {
  const testShow = {
    characters: [
      { id: 'arvok-id', handle: '@ARVOK', name: 'Arvok' },
      { id: 'cyrus-id', handle: '@CYRUS', name: 'Cyrus' },
      { id: 'lucia-id', handle: '@LUCIA', name: 'Lucia' }
    ]
  } as unknown as Show;

  it('detects characters from description and visual Note text using matches', () => {
    const pb = {
      description: 'Arvok walks into the workshop where Cyrus is waiting.',
      visualNote: 'Wide shot of Cyrus looking at Arvok',
      characterIds: []
    } as any;

    const result = deriveCharactersForBeat(pb, testShow);
    expect(result).toContain('arvok-id');
    expect(result).toContain('cyrus-id');
    expect(result).not.toContain('lucia-id');
  });

  it('detects characters from dialogue speaker ID and speakerName/handle', () => {
    const pb = {
      description: 'A silent moment.',
      script: {
        lines: [
          { characterId: 'lucia-id', text: 'Hello there.' }
        ]
      },
      characterIds: []
    } as any;

    const result = deriveCharactersForBeat(pb, testShow);
    expect(result).toContain('lucia-id');
  });

  it('detects characters from panel plans action and positions', () => {
    const pb = {
      panelPlans: [
        {
          action: 'A closeup of Cyrus smiling.',
          characterPositions: [
            { characterHandle: '@ARVOK' }
          ]
        }
      ],
      characterIds: []
    } as any;

    const result = deriveCharactersForBeat(pb, testShow);
    expect(result).toContain('cyrus-id');
    expect(result).toContain('arvok-id');
  });

  it('avoids false positive substring matches', () => {
    const pb = {
      description: 'He is always ready to work in the yard.', // "always" contains "al" - if Al existed as a character, word boundary checks prevent matching
      characterIds: []
    } as any;

    const testShowWithAl = {
      characters: [
        { id: 'al-id', handle: '@AL', name: 'Al' }
      ]
    } as unknown as Show;

    const result = deriveCharactersForBeat(pb, testShowWithAl);
    expect(result).not.toContain('al-id');
  });
});
