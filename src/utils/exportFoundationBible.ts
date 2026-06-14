import { Show } from '../types/models';

export interface FoundationBibleDocument {
  showTitle: string;
  premise: string;
  themes: string;
  register?: string;
  writingRules?: {
    dialogueRules: string[];
    blockingRules: string[];
    structureRules: string[];
    craftNotes: string[];
  };
  richInput?: string;
  structureConfig?: {
    episodesPerSeason?: number;
    actsPerEpisode?: number;
    scenesPerAct?: number;
    beatsPerScene?: number;
  };
  styleConfig: {
    positivePrompt: string;
    negativePrompt: string;
    compositionPrompt?: string;
  };
  comicStyle?: {
    artistStyle: string;
    colorPalette: string;
    lineWeight: string;
    negativePrompt?: string;
    compositionPrompt?: string;
  };
  expandedBible?: string;
  narrativeMechanism?: string;
  characters: {
    id: string;
    fid?: string;
    name: string;
    handle: string;
    role: string;
    physicalDescription: string;
    summary?: string;
    visualAnchor?: string;
    identifyingFeature?: string;
    voiceProfile?: string;
    voiceRule?: string;
    castingNotes?: string;
    evolution?: string;
    isMinor?: boolean;
    isProtagonist?: boolean;
    memoryBleedPalette?: string;
    voiceConstraints?: string;
    portraitAssetId?: string;
    visualAnchorAssetId?: string;
    captionColor?: string;
    voiceCard?: string;
  }[];
  settings: {
    name: string;
    physicalDescription: string;
    mood?: string;
  }[];
}

export function buildFoundationBible(show: Show): FoundationBibleDocument {
  return {
    showTitle: show.titleSuggestion || show.name,
    premise: show.premise,
    themes: show.themes,
    register: show.register,
    writingRules: show.writingRules,
    richInput: show.richInput,
    structureConfig: show.structureConfig,
    styleConfig: show.styleConfig,
    comicStyle: show.comicStyle,
    expandedBible: show.expandedBible,
    narrativeMechanism: show.narrativeMechanism,
    characters: show.characters.map(c => ({
      id: c.id,
      fid: c.fid,
      name: c.name,
      handle: c.handle,
      role: c.role,
      physicalDescription: c.physicalDescription,
      summary: c.summary,
      visualAnchor: c.visualAnchor,
      identifyingFeature: c.identifyingFeature,
      voiceProfile: c.voiceProfile,
      voiceRule: c.voiceRule,
      castingNotes: c.castingNotes,
      evolution: c.evolution,
      isMinor: c.isMinor,
      isProtagonist: c.isProtagonist,
      memoryBleedPalette: c.memoryBleedPalette,
      voiceConstraints: c.voiceConstraints,
      portraitAssetId: c.portraitAssetId,
      visualAnchorAssetId: c.visualAnchorAssetId,
      captionColor: c.captionColor,
      voiceCard: c.voiceCard
    })),
    settings: (show.settingAnchors || []).map(s => ({
      name: s.name,
      physicalDescription: s.physicalDescription,
      mood: s.mood
    }))
  };
}

export function formatFoundationBible(doc: FoundationBibleDocument): string {
  const lines: string[] = [];

  lines.push("================================================================================");
  lines.push("FOUNDATION BIBLE");
  lines.push(`Show: ${doc.showTitle.toUpperCase()}`);
  lines.push("================================================================================");
  lines.push("");

  lines.push("PREMISE");
  lines.push(doc.premise || "TBD");
  lines.push("");

  lines.push("THEMES");
  lines.push(doc.themes || "TBD");
  lines.push("");

  if (doc.register) {
    lines.push("SHOW REGISTER");
    lines.push(doc.register);
    lines.push("");
  }

  if (doc.writingRules) {
    lines.push("WRITING RULES — DIALOGUE");
    (doc.writingRules.dialogueRules || []).forEach(r => lines.push(`- ${r}`));
    lines.push("");
    lines.push("WRITING RULES — BLOCKING");
    (doc.writingRules.blockingRules || []).forEach(r => lines.push(`- ${r}`));
    lines.push("");
    lines.push("WRITING RULES — STRUCTURE");
    (doc.writingRules.structureRules || []).forEach(r => lines.push(`- ${r}`));
    lines.push("");
    lines.push("WRITING RULES — CRAFT NOTES");
    (doc.writingRules.craftNotes || []).forEach(r => lines.push(`- ${r}`));
    lines.push("");
  }

  if (doc.richInput) {
    lines.push("RICH INPUT");
    lines.push(doc.richInput);
    lines.push("");
  }

  if (doc.structureConfig) {
    lines.push("STRUCTURE CONFIG");
    lines.push(`Episodes per Season: ${doc.structureConfig.episodesPerSeason ?? 1}`);
    lines.push(`Acts per Episode: ${doc.structureConfig.actsPerEpisode ?? 1}`);
    lines.push(`Scenes per Act: ${doc.structureConfig.scenesPerAct ?? 1}`);
    lines.push(`Beats per Scene: ${doc.structureConfig.beatsPerScene ?? 1}`);
    lines.push("");
  }

  if (doc.comicStyle) {
    lines.push("COMIC STYLE");
    lines.push(`Artist Style: ${doc.comicStyle.artistStyle}`);
    lines.push(`Color Palette: ${doc.comicStyle.colorPalette}`);
    lines.push(`Line Weight: ${doc.comicStyle.lineWeight}`);
    if (doc.comicStyle.compositionPrompt) lines.push(`Composition: ${doc.comicStyle.compositionPrompt}`);
    if (doc.comicStyle.negativePrompt) lines.push(`Negative Prompt: ${doc.comicStyle.negativePrompt}`);
    lines.push("");
  }

  if (doc.narrativeMechanism) {
    lines.push("NARRATIVE MECHANISM");
    lines.push(doc.narrativeMechanism);
    lines.push("");
  }

  if (doc.expandedBible) {
    lines.push("EXPANDED BIBLE");
    lines.push(doc.expandedBible);
    lines.push("");
  }

  lines.push("--------------------------------------------------------------------------------");
  lines.push("ENSEMBLE CAST");
  lines.push("--------------------------------------------------------------------------------");
  lines.push("");

  for (const char of doc.characters) {
    const header = `${char.name.toUpperCase()} [${char.handle}]${char.isProtagonist ? ' — Protagonist' : ''}`;
    lines.push(header);
    lines.push(`Role: ${char.role}`);
    if (char.summary) lines.push(`Summary: ${char.summary}`);
    if (char.physicalDescription) lines.push(`Physical Description: ${char.physicalDescription}`);
    if (char.identifyingFeature) lines.push(`Identifying Feature: ${char.identifyingFeature}`);
    if (char.visualAnchor) lines.push(`Visual Anchor: ${char.visualAnchor}`);
    if (char.voiceProfile) lines.push(`Voice Profile: ${char.voiceProfile}`);
    if (char.voiceRule) lines.push(`Voice Rule: ${char.voiceRule}`);
    if (char.voiceConstraints) lines.push(`Voice Constraints: ${char.voiceConstraints}`);
    if (char.voiceCard) lines.push(`Voice Card: ${char.voiceCard}`);
    if (char.captionColor) lines.push(`Caption Color: ${char.captionColor}`);
    if (char.memoryBleedPalette) lines.push(`Memory Bleed Palette: ${char.memoryBleedPalette}`);
    if (char.castingNotes) lines.push(`Casting Notes: ${char.castingNotes}`);
    if (char.evolution) lines.push(`Evolution: ${char.evolution}`);
    if (char.isMinor !== undefined) lines.push(`isMinor: ${char.isMinor}`);
    if (char.portraitAssetId) lines.push(`Portrait Asset: ${char.portraitAssetId} (embedded in PDF version)`);
    if (char.visualAnchorAssetId) lines.push(`Visual Anchor Asset: ${char.visualAnchorAssetId}`);
    lines.push("");
  }

  lines.push("--------------------------------------------------------------------------------");
  lines.push("SETTING ANCHORS");
  lines.push("--------------------------------------------------------------------------------");
  lines.push("");

  for (const setting of doc.settings) {
    lines.push(setting.name.toUpperCase());
    if (setting.mood) lines.push(`Mood: ${setting.mood}`);
    lines.push(`Description: ${setting.physicalDescription}`);
    lines.push("");
  }

  return lines.join('\n');
}
