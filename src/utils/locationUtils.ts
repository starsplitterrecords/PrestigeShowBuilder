import { Scene, Show } from '../types/models';

export interface ResolvedLocation {
  name: string;
  description: string;
  mood?: string;
  interiorExterior?: 'interior' | 'exterior' | 'mixed';
}

export function resolveLocationForBeat(
  scene: Scene,
  show: Show
): ResolvedLocation | null {
  if (!scene.settingAnchorId) return null;
  const anchor = (show.settingAnchors ?? [])
    .find(a => a.id === scene.settingAnchorId);
  if (!anchor) return null;

  // visualDescription and physicalDescription are alternative
  // phrasings on the same authored object. This is NOT a
  // cross-concept fallback.
  const description = anchor.visualDescription?.trim()
    || anchor.physicalDescription?.trim();
  if (!description) return null;

  return {
    name: anchor.shortName || anchor.name,
    description,
    mood: anchor.mood,
    interiorExterior: anchor.interiorExterior,
  };
}
