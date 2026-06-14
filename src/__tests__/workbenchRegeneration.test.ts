import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from '../storage/db';
import {
  deleteUnapprovedVersionsForPage,
  getImageVersionsForPage,
  writeImageVersion,
  deleteImageVersionsForPage
} from '../storage/ProductionStorage';
import { ImageVersion } from '../types/production';
import { placementFromSpeaker } from '../utils/prompts/planScenePages';
import { CharacterPosition } from '../types/models';

describe('deleteUnapprovedVersionsForPage and clearAndRegenerate storage utilities', () => {
  beforeEach(async () => {
    // Clear IndexedDB store
    const db = await openDB();
    const tx = db.transaction('production_image_versions', 'readwrite');
    tx.objectStore('production_image_versions').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  });

  it('deleteUnapprovedVersionsForPage correctly deletes only unapproved draft versions and spares the approved version', async () => {
    const pageUid = 'test-page-123';

    const v1: ImageVersion = {
      uid: 'v-1',
      showId: 'show-123',
      productionPageUid: pageUid,
      assetId: 'asset-1',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now() - 1000,
    };

    const v2: ImageVersion = {
      uid: 'v-2',
      showId: 'show-123',
      productionPageUid: pageUid,
      assetId: 'asset-2',
      variantType: 'base',
      status: 'approved',
      createdAt: Date.now(),
    };

    const v3: ImageVersion = {
      uid: 'v-3',
      showId: 'show-123',
      productionPageUid: pageUid,
      assetId: 'asset-3',
      variantType: 'lettered',
      status: 'draft',
      createdAt: Date.now() + 1000,
    };

    // Store versions
    await writeImageVersion('show-123', v1);
    await writeImageVersion('show-123', v2);
    await writeImageVersion('show-123', v3);

    // Verify written
    const initial = await getImageVersionsForPage(pageUid);
    expect(initial).toHaveLength(3);

    // Run delete unapproved versions
    await deleteUnapprovedVersionsForPage(pageUid);

    // Check remaining versions
    const remaining = await getImageVersionsForPage(pageUid);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].uid).toBe('v-2');
    expect(remaining[0].status).toBe('approved');
  });

  it('deleteImageVersionsForPage correctly deletes all versions including approved ones', async () => {
    const pageUid = 'test-page-456';

    const v1: ImageVersion = {
      uid: 'v-1',
      showId: 'show-123',
      productionPageUid: pageUid,
      assetId: 'asset-1',
      variantType: 'base',
      status: 'draft',
      createdAt: Date.now(),
    };

    const v2: ImageVersion = {
      uid: 'v-2',
      showId: 'show-123',
      productionPageUid: pageUid,
      assetId: 'asset-2',
      variantType: 'base',
      status: 'approved',
      createdAt: Date.now(),
    };

    await writeImageVersion('show-123', v1);
    await writeImageVersion('show-123', v2);

    await deleteImageVersionsForPage(pageUid);

    const remaining = await getImageVersionsForPage(pageUid);
    expect(remaining).toHaveLength(0);
  });
});

describe('placementFromSpeaker — DA-053 Balloon Placement', () => {
  it('anchors the balloon to the speaker zone side and removes facing horizontal swap entirely', () => {
    // Left zone: should get top-left and bottom-left tail
    const leftChar: CharacterPosition = {
      characterHandle: 'Lucia',
      zone: 'middle-left',
      depth: 'foreground',
      facing: 'right',
    };
    const resLeft = placementFromSpeaker(leftChar, []);
    expect(resLeft.position).toBe('top-left');
    expect(resLeft.tailDirection).toBe('bottom-left');

    // Right zone: should get top-right and bottom-right tail, regardless of facing left (no swap!)
    const rightCharFacingLeft: CharacterPosition = {
      characterHandle: 'Arvok',
      zone: 'middle-right',
      depth: 'midground',
      facing: 'left',
    };
    const resRight = placementFromSpeaker(rightCharFacingLeft, []);
    expect(resRight.position).toBe('top-right');
    expect(resRight.tailDirection).toBe('bottom-right'); // Anchored to right!

    // Center zone: should get top-full and bottom-left tail
    const centerChar: CharacterPosition = {
      characterHandle: 'Echo',
      zone: 'bottom-center',
      depth: 'midground',
      facing: 'left',
    };
    const resCenter = placementFromSpeaker(centerChar, []);
    expect(resCenter.position).toBe('top-full');
    expect(resCenter.tailDirection).toBe('bottom-left');
  });

  it('handles collision by placing balloons on opposite sides of a panel', () => {
    // If top-left is occupied, next top-left shifts to top-right
    const leftChar: CharacterPosition = {
      characterHandle: 'Lucia',
      zone: 'top-left',
      depth: 'midground',
      facing: 'right',
    };
    const alreadyPlaced = [{ position: 'top-left' as const }];
    const resCollideLeft = placementFromSpeaker(leftChar, alreadyPlaced);
    expect(resCollideLeft.position).toBe('top-right');
    expect(resCollideLeft.tailDirection).toBe('bottom-right');

    // If top-right is occupied, next top-right shifts to top-left
    const rightChar: CharacterPosition = {
      characterHandle: 'Arvok',
      zone: 'top-right',
      depth: 'midground',
      facing: 'left',
    };
    const alreadyPlacedRight = [{ position: 'top-right' as const }];
    const resCollideRight = placementFromSpeaker(rightChar, alreadyPlacedRight);
    expect(resCollideRight.position).toBe('top-left');
    expect(resCollideRight.tailDirection).toBe('bottom-left');
  });

  it('uses top-full fallback when no speaker position is provided', () => {
    const resFallback = placementFromSpeaker(undefined, []);
    expect(resFallback.position).toBe('top-full');
    expect(resFallback.tailDirection).toBe('bottom-left');
  });
});
