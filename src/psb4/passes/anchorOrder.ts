import { NormalizedEpisode, AnchorScopeEntry } from '../types';

export function computeAnchorOrder(
  episodes: NormalizedEpisode[]
): AnchorScopeEntry[] {
  const n = episodes.length;
  if (n === 0) return [];
  if (n <= 3) {
    // Too few episodes to benefit — run sequentially
    return episodes.map((ep, i) => ({
      episodeId: ep.id,
      prefixLabel: `Issue ${i + 1}: ${ep.title || 'Untitled'}`,
      isAnchor: true,
      storyIndex: i,
      executionIndex: i,
      priorStoryEpisodeId: i > 0 ? episodes[i - 1].id : null,
      nextAnchorEpisodeId: null,
    }));
  }

  // Anchor indices: first, last, midpoint, penultimate
  const midIdx = Math.ceil(n / 2) - 1;  // e.g. n=8 → index 3 (Issue 4)
  const anchorIdxList: number[] = [];
  for (const idx of [0, n - 1, midIdx, n - 2]) {
    if (!anchorIdxList.includes(idx)) anchorIdxList.push(idx);
  }
  const anchorSet = new Set(anchorIdxList);

  // Bridge indices in story order
  const bridgeIdxList = episodes
    .map((_, i) => i)
    .filter(i => !anchorSet.has(i));

  // Execution order: anchors first, then bridges
  const executionOrder = [...anchorIdxList, ...bridgeIdxList];

  // For each bridge: find the surrounding anchors
  const sortedAnchorIdxs = [...anchorIdxList].sort((a, b) => a - b);
  function nextAnchorAfter(storyIdx: number): number | null {
    return sortedAnchorIdxs.find(a => a > storyIdx) ?? null;
  }

  return executionOrder.map((storyIdx, execIdx) => {
    const ep = episodes[storyIdx];
    const isAnc = anchorSet.has(storyIdx);
    const nextAnc = isAnc ? null : nextAnchorAfter(storyIdx);
    return {
      episodeId: ep.id,
      prefixLabel: `Issue ${storyIdx + 1} of ${n}: ${ep.title || 'Untitled'}`,
      isAnchor: isAnc,
      storyIndex: storyIdx,
      executionIndex: execIdx,
      priorStoryEpisodeId: storyIdx > 0 ? episodes[storyIdx - 1].id : null,
      nextAnchorEpisodeId: nextAnc !== null ? episodes[nextAnc].id : null,
    };
  });
}
