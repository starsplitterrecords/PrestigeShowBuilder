export type LockedReferenceType =
  | 'environment'
  | 'prop'
  | 'minor-character'
  | 'costume'
  | 'palette'
  | 'other';

export interface LockedReference {
  id: string;
  label: string;
  type: LockedReferenceType;
  assetId: string;
  description?: string;
  active: boolean;
  // Entity link -- connects this reference to a show entity by ID.
  // For environment/prop/costume/palette: set linkedSettingId to a
  //   settingAnchor.id -- reference only injects when scene matches.
  // For minor-character: set linkedCharacterId to a character.id --
  //   reference injects with CHARACTER REFERENCE instruction and
  //   only when the beat has that characterId.
  linkedSettingId?:    string;  // settingAnchors[].id
  linkedCharacterId?:  string;  // characters[].id
}

export interface SettingAnchor {
  id: string;
  name: string;               // canonical name e.g. "Sector 4 Salt-Chamber Pump Room"
  shortName?: string;         // abbreviated for UI labels e.g. "Pump Room 4"
  physicalDescription: string; // prose — what it looks like, what it contains
  visualDescription?: string;  // image-generation-ready one-liner
  mood?: string;               // e.g. "industrial, cold, claustrophobic"
  interiorExterior: 'interior' | 'exterior' | 'mixed';
  assetId?: string;            // reference image, if uploaded
}
