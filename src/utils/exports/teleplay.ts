import { Show } from "../../types/models";
import { formatEpisode } from "../../lib/teleplayer/formatter";
export type ExportTarget =
  | { kind: "issue-pdf"; issueId?: string; label: string }
  | { kind: "teleplay-show"; label: string }
  | { kind: "teleplay-episode"; sIdx: number; eIdx: number; label: string }
  | { kind: "teleplay-act"; sIdx: number; eIdx: number; aIdx: number; label: string }
  | { kind: "teleplay-scene"; sIdx: number; eIdx: number; aIdx: number; scIdx: number; label: string };

export async function generateTeleplay(
  show: Show,
  target: ExportTarget
): Promise<string> {
  const parts: string[] = [];

  switch (target.kind) {
    case "teleplay-show": {
      for (const season of show.seasons) {
        for (const episode of season.episodes) {
          parts.push(formatEpisode(episode, show));
          parts.push("\n\f");
        }
      }
      break;
    }
    case "teleplay-episode": {
      const episode = show.seasons[target.sIdx]?.episodes[target.eIdx];
      if (episode) {
        parts.push(formatEpisode(episode, show));
      }
      break;
    }
    case "teleplay-act": {
      const episode = show.seasons[target.sIdx]?.episodes[target.eIdx];
      const act = episode?.acts[target.aIdx];
      if (episode && act) {
        // Create a temporary mock episode containing only this act
        const mockEpisode = { ...episode, acts: [act] };
        parts.push(formatEpisode(mockEpisode, show));
      }
      break;
    }
    case "teleplay-scene": {
      const episode = show.seasons[target.sIdx]?.episodes[target.eIdx];
      const act = episode?.acts[target.aIdx];
      const scene = act?.scenes[target.scIdx];
      if (episode && act && scene) {
        // Create a temporary mock act containing only this scene
        const mockAct = { ...act, scenes: [scene] };
        const mockEpisode = { ...episode, acts: [mockAct] };
        parts.push(formatEpisode(mockEpisode, show));
      }
      break;
    }
  }

  return parts.join("\n");
}
