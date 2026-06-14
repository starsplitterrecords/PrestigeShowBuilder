import { WorkspaceView, NodePath } from "../types/models";

interface NavTarget {
  view: WorkspaceView;
  path: NodePath;
}

/**
 * Parse a FID string into a navigation target.
 * FID format: SHOW-S{s}-E{e}-A{a}-Sc{sc}-B{b} (all 1-indexed)
 * Returns null if the FID cannot be parsed.
 */
export function fidToNavTarget(fid: string): NavTarget | null {
  if (!fid) return null;

  // Extract numeric values from each segment
  const s  = fid.match(/-S(\d+)/)?.[1];
  const e  = fid.match(/-E(\d+)/)?.[1];
  const a  = fid.match(/-A(\d+)/)?.[1];
  const sc = fid.match(/-Sc(\d+)/)?.[1];
  const b  = fid.match(/-B(\d+)/)?.[1];

  if (!s) return null;

  // Convert 1-indexed to 0-indexed
  const sIdx  = parseInt(s)  - 1;
  const eIdx  = e  ? parseInt(e)  - 1 : undefined;
  const aIdx  = a  ? parseInt(a)  - 1 : undefined;
  const scIdx = sc ? parseInt(sc) - 1 : undefined;
  const bIdx  = b  ? parseInt(b)  - 1 : undefined;

  // Determine view from depth
  let view: WorkspaceView;
  if (bIdx !== undefined)  view = "beat-detail";
  else if (scIdx !== undefined) view = "scene-detail";
  else if (aIdx  !== undefined) view = "act-detail";
  else if (eIdx  !== undefined) view = "episode-detail";
  else view = "season";

  return { view, path: { seasonIdx: sIdx, episodeIdx: eIdx, actIdx: aIdx, sceneIdx: scIdx, beatIdx: bIdx } };
}
