import { PageBeat } from '../types/production';
import { scriptFingerprint } from './contentHash';

export interface IndexValidation {
  ok: boolean;
  fingerprintMatches: boolean;  // does the script match when applied?
  outOfRange: number[];         // indices beyond entries.length
  wrongKind: number[];          // dialogue index pointing at a caption etc.
}

export function validatePanelIndices(pb: PageBeat): IndexValidation {
  const entries = pb.script?.entries ?? [];
  const n = entries.length;
  const outOfRange: number[] = [];
  const wrongKind: number[] = [];
  for (const pl of pb.panelPlans ?? []) {
    for (const i of pl.dialogueIndices ?? []) {
      if (i < 0 || i >= n) outOfRange.push(i);
      else if ((entries[i] as any).kind === 'caption') wrongKind.push(i);
    }
    for (const i of pl.captionIndices ?? []) {
      if (i < 0 || i >= n) outOfRange.push(i);
      else if ((entries[i] as any).kind !== 'caption') wrongKind.push(i);
    }
  }
  const fingerprintMatches = !pb.scriptFingerprint
    || pb.scriptFingerprint === scriptFingerprint(pb);
  return {
    ok: outOfRange.length === 0 && wrongKind.length === 0
      && fingerprintMatches,
    fingerprintMatches, outOfRange, wrongKind,
  };
}
