import { PageBeat } from '../types/production';

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Narrative inputs that visual planning depends on.
export function pageContentHash(pb: PageBeat): string {
  const entries = pb.script?.entries ?? [];
  return djb2(JSON.stringify({
    d: pb.description, s: pb.subtext, v: pb.visualNote,
    dir: pb.direction, bt: pb.beatType,
    chars: [...(pb.characterIds ?? [])].sort(),
    script: entries.map((e: any) =>
      e.kind === 'caption' ? ['c', e.text] : ['l', e.characterHandle, e.text]),
  }));
}

// Just the dialogue shape — what dialogueIndices point into.
export function scriptFingerprint(pb: PageBeat): string {
  const entries = pb.script?.entries ?? [];
  return djb2(JSON.stringify(entries.map((e: any) =>
    e.kind === 'caption' ? 'c' : 'l')) + ':' + entries.length);
}
