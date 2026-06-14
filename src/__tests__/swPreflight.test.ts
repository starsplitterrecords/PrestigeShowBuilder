import { describe, it, expect, vi } from 'vitest';
import { resolveProductionCharacterRefs } from '../hooks/production/productionCharacterRefs';
import { Show } from '../types/show';
import { PageBeat } from '../types/production';

// Mock AssetStorage
vi.mock('../storage/AssetStorage', () => ({
  AssetStorage: {
    getDataUri: vi.fn(async (id: string) => {
      if (id === 'missing-binary') {
        return '';
      }
      if (id === 'n80h4vycwro' || id === 'anchor-arvin' || id === '84h7jgz0ugk' || id === 'anchor-lucia') {
        return 'data:image/png;base64,ValidDataUri';
      }
      return '';
    })
  }
}));

describe('SW Character Reference Hard Blocking & Preflight', () => {
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
      },
      {
        id: '5snrx2won',
        handle: '@brv1.Milo',
        name: 'Milo',
        portraitAssetId: '84h7jgz0ugk',
        visualAnchorAssetId: '',
      },
      {
        id: '8tg8ibh7z',
        handle: '@brv1.Lucia',
        name: 'Lucia',
        portraitAssetId: '',
        visualAnchorAssetId: 'anchor-lucia',
      },
      {
        id: 'dljv31xue',
        handle: '@brv1.Cyrus',
        name: 'Cyrus',
        portraitAssetId: '',
        visualAnchorAssetId: '', // lacks usable assets
      }
    ],
  } as unknown as Show;

  it('selected @hv9jfbgm9 normalizes and attaches Arvin portrait', async () => {
    const beat = {
      uid: 'pb-arvin',
      characterIds: ['@hv9jfbgm9'],
    } as unknown as PageBeat;

    const result = await resolveProductionCharacterRefs({
      pageBeat: beat,
      show: mockShow,
    });
    expect(result.missing).toHaveLength(0);
    expect(result.loadedRefs).toHaveLength(1);
    expect(result.loadedRefs[0].assetId).toBe('n80h4vycwro'); // prioritizes portraitAssetId
  });

  it('selected character ID with missing portrait/anchor goes into missing', async () => {
    const beat = {
      uid: 'pb-cyrus',
      characterIds: ['dljv31xue'], // cyrus lacks all assets
    } as unknown as PageBeat;

    const result = await resolveProductionCharacterRefs({
      pageBeat: beat,
      show: mockShow,
    });
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].characterId).toBe('dljv31xue');
    expect(result.loadedRefs).toHaveLength(0);
  });

  it('selected character ID with missing asset binary ends up in missing', async () => {
    const brokenShow = {
      ...mockShow,
      characters: [
        {
          id: 'broken-arvin',
          handle: '@brv1.Arvin',
          name: 'Arvin',
          portraitAssetId: 'missing-binary', // will return empty from mock
          visualAnchorAssetId: '',
        }
      ]
    } as unknown as Show;

    const beat = {
      uid: 'pb-broken',
      characterIds: ['broken-arvin'],
    } as unknown as PageBeat;

    const result = await resolveProductionCharacterRefs({
      pageBeat: beat,
      show: brokenShow,
    });
    expect(result.missing).toHaveLength(1);
    expect(result.loadedRefs).toHaveLength(0);
  });

  it('selected characters + zero resolved works correctly', async () => {
    const beat = {
      uid: 'pb-unresolved',
      characterIds: ['non-existent-character-id'],
    } as unknown as PageBeat;

    const result = await resolveProductionCharacterRefs({
      pageBeat: beat,
      show: mockShow,
    });
    expect(result.required).toHaveLength(1);
    expect(result.required[0].characterId).toBe('non-existent-character-id');
    expect(result.missing).toHaveLength(1);
    expect(result.loadedRefs).toHaveLength(0);
  });
});
