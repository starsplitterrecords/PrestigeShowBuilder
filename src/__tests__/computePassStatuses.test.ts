import { describe, it, expect } from 'vitest';
import { computePassStatuses } from '../psb4/ui/utils/passStatus';
import type { Psb4Run, Psb4Artifact } from '../psb4/types';
import { ArtifactType } from '../psb4/types';

const baseRun = (): Psb4Run => ({
  id: 'run1', showId: 'show1', status: 'active',
  currentPhase: 'rebuild', currentPass: '0.9S',
  phaseProgress: { reduction: 'complete',
    arc_lock: 'complete', rebuild: 'running',
    enrichment: 'pending' },
  scopeEpisodeIds: ['ep1'],
  createdAt: 0, updatedAt: 0,
} as unknown as Psb4Run);

const makeArtifact = (
  type: ArtifactType, passId: string,
  episodeId = 'ep1'
): Psb4Artifact => ({
  id: `${passId}-${type}`,
  runId: 'run1', showId: 'show1',
  artifactType: type,
  createdByPass: passId,
  episodeId,
  payload: {},
  authorEdited: false,
  createdAt: 0,
} as unknown as Psb4Artifact);

describe('computePassStatuses', () => {
  it('marks pass complete when its own artifact exists', () => {
    const arts = [makeArtifact(ArtifactType.SCENE_STRUCTURE, '0.9S')];
    const s = computePassStatuses(baseRun(), arts, [], ['ep1'], null);
    expect(s['0.9S']).toBe('complete');
  });

  it('does not mark 0.9G complete from 0.9S artifact', () => {
    // Both output SCENE_STRUCTURE; 0.9G should be pending
    const arts = [makeArtifact(ArtifactType.SCENE_STRUCTURE, '0.9S')];
    const s = computePassStatuses(baseRun(), arts, [], ['ep1'], null);
    expect(s['0.9G']).not.toBe('complete');
  });

  it('marks author-edited when artifact.authorEdited is true', () => {
    const arts = [{ ...makeArtifact(ArtifactType.SCENE_STRUCTURE, '0.9S'),
      authorEdited: true }];
    const s = computePassStatuses(baseRun(), arts, [], ['ep1'], null);
    expect(s['0.9S']).toBe('author-edited');
  });

  it('marks blocked when required artifact missing', () => {
    const s = computePassStatuses(baseRun(), [], [], ['ep1'], null);
    // 0.9S requires CLEAN_SPINE which does not exist in arts
    expect(s['0.9S']).toBe('blocked');
  });

  it('marks running for runningPassId', () => {
    const s = computePassStatuses(
      baseRun(), [], [], ['ep1'], '0.9S'
    );
    expect(s['0.9S']).toBe('running');
  });
});
