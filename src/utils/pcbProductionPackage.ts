import type {
  BeatPanelPlan,
  CaptionEntry,
  Character,
  CharacterPosition,
  CinematicBeat,
  ScriptLine,
  Show,
} from '../types/models';
import { AssetStorage } from '../storage';

export const PCB_PRODUCTION_PACKAGE_FORMAT = 'pcb-production-package' as const;
export const PCB_PRODUCTION_PACKAGE_VERSION = 1 as const;

export type PcbPackageReferenceType = 'character' | 'setting' | 'artStyle';
export type PcbPackageStageLocation = 'left' | 'right' | 'center' | 'background';

export interface PcbProductionPackageReference {
  sourceId: string;
  name: string;
  type: PcbPackageReferenceType;
  imageDataUrl: string | null;
}

export interface PcbProductionPackageDialogueLine {
  order: number;
  kind: 'speech' | 'caption';
  speakerSourceId: string | null;
  speech: string;
}

export interface PcbProductionPackageCharacterPlacement {
  characterSourceId: string;
  stageLocation: PcbPackageStageLocation;
}

export interface PcbProductionPackagePanel {
  panelNumber: number;
  visualDescription: string;
  characters: PcbProductionPackageCharacterPlacement[];
  dialogue: PcbProductionPackageDialogueLine[];
}

export interface PcbProductionPackageComicAsset {
  sourceId: string;
  order: number;
  title: string;
  sceneHeading: string;
  settingSourceId: string | null;
  source: {
    seasonNumber: number;
    episodeNumber: number;
    actNumber: number;
    sceneNumber: number;
    beatNumber: number;
    seasonId: string;
    episodeId: string;
    actId: string;
    sceneId: string;
    beatId: string;
  };
  panels: PcbProductionPackagePanel[];
}

export interface PcbProductionPackageWarning {
  code: string;
  message: string;
  sourceId?: string;
}

export interface PcbProductionPackageV1 {
  format: typeof PCB_PRODUCTION_PACKAGE_FORMAT;
  version: typeof PCB_PRODUCTION_PACKAGE_VERSION;
  source: {
    application: 'PrestigeShowBuilder';
    showId: string;
    showCode: string;
    exportedAt: string;
  };
  series: {
    title: string;
    orientation: 'vertical';
  };
  references: PcbProductionPackageReference[];
  comicAssets: PcbProductionPackageComicAsset[];
  warnings: PcbProductionPackageWarning[];
}

type ScriptEntry = ScriptLine | CaptionEntry;

function characterByHandle(show: Show): Map<string, Character> {
  const map = new Map<string, Character>();
  for (const character of show.characters) {
    if (character.handle) map.set(character.handle, character);
  }
  return map;
}

function stageLocation(position: CharacterPosition): PcbPackageStageLocation {
  if (position.depth === 'background') return 'background';
  if (position.zone.endsWith('-left')) return 'left';
  if (position.zone.endsWith('-right')) return 'right';
  return 'center';
}

function fallbackStageLocation(index: number): PcbPackageStageLocation {
  const locations: PcbPackageStageLocation[] = ['left', 'right', 'center', 'background'];
  return locations[Math.min(index, locations.length - 1)];
}

function scriptEntries(beat: CinematicBeat): ScriptEntry[] {
  if (beat.script?.entries?.length) return beat.script.entries;
  return beat.script?.lines ?? beat.lines ?? [];
}

function describeCharacterDirection(
  positions: CharacterPosition[] | undefined,
  characters: Map<string, Character>,
): string[] {
  if (!positions?.length) return [];
  return positions.flatMap((position) => {
    const character = characters.get(position.characterHandle);
    const name = character?.name ?? position.characterHandle;
    const details = [
      position.facing ? `facing ${position.facing}` : '',
      position.bodyLanguage?.trim() ? `body language: ${position.bodyLanguage.trim()}` : '',
      position.facialExpression?.trim() ? `expression: ${position.facialExpression.trim()}` : '',
      position.inResponseTo?.trim() ? `responding to ${position.inResponseTo.trim()}` : '',
    ].filter(Boolean);
    return details.length ? [`${name}: ${details.join('; ')}.`] : [];
  });
}

function panelVisualDescription(
  beat: CinematicBeat,
  plan: BeatPanelPlan,
  characters: Map<string, Character>,
): string {
  const parts = [
    plan.shotType?.trim(),
    plan.action?.trim(),
    plan.direction?.trim(),
    plan.foreground?.trim() ? `Foreground: ${plan.foreground.trim()}.` : '',
    plan.midground?.trim() ? `Midground: ${plan.midground.trim()}.` : '',
    plan.background?.trim() ? `Background: ${plan.background.trim()}.` : '',
    plan.relationalStaging?.trim() ? `Staging: ${plan.relationalStaging.trim()}.` : '',
    ...describeCharacterDirection(plan.characterPositions, characters),
    beat.visualDirection?.lighting?.trim() ? `Lighting: ${beat.visualDirection.lighting.trim()}.` : '',
    beat.visualDirection?.mood?.trim() ? `Mood: ${beat.visualDirection.mood.trim()}.` : '',
    beat.visualDirection?.emotionalRegister?.trim()
      ? `Emotional register: ${beat.visualDirection.emotionalRegister.trim()}.`
      : '',
  ].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function fallbackVisualDescription(beat: CinematicBeat): string {
  return (beat.visualDescription || beat.description || beat.direction || 'Comic panel.').trim();
}

function resolveSpeechLine(
  entry: ScriptEntry | undefined,
  order: number,
  characters: Map<string, Character>,
  warnings: PcbProductionPackageWarning[],
  sourceId: string,
): PcbProductionPackageDialogueLine | null {
  if (!entry || !('text' in entry) || !entry.text?.trim()) return null;
  if (entry.kind === 'caption') {
    return { order, kind: 'caption', speakerSourceId: null, speech: entry.text.trim() };
  }

  const character = characters.get(entry.characterHandle);
  if (!character) {
    warnings.push({
      code: 'UNRESOLVED_SPEAKER',
      sourceId,
      message: `Could not resolve dialogue speaker ${entry.characterHandle || '(blank handle)'}. Imported as narration.`,
    });
    return { order, kind: 'caption', speakerSourceId: null, speech: entry.text.trim() };
  }

  return { order, kind: 'speech', speakerSourceId: character.id, speech: entry.text.trim() };
}

function dialogueForPlan(
  beat: CinematicBeat,
  plan: BeatPanelPlan,
  characters: Map<string, Character>,
  warnings: PcbProductionPackageWarning[],
): PcbProductionPackageDialogueLine[] {
  const entries = scriptEntries(beat);
  const orderedIndices = [
    ...plan.dialogueIndices.map((index) => ({ index, kind: 'dialogue' as const })),
    ...plan.captionIndices.map((index) => ({ index, kind: 'caption' as const })),
  ].sort((a, b) => a.index - b.index);

  const seen = new Set<number>();
  const lines: PcbProductionPackageDialogueLine[] = [];
  for (const item of orderedIndices) {
    if (seen.has(item.index)) continue;
    seen.add(item.index);
    const entry = entries[item.index];
    const resolved = resolveSpeechLine(entry, lines.length + 1, characters, warnings, beat.id);
    if (!resolved) continue;
    if (item.kind === 'caption') resolved.kind = 'caption', resolved.speakerSourceId = null;
    lines.push(resolved);
  }
  return lines;
}

function fallbackDialogue(
  beat: CinematicBeat,
  characters: Map<string, Character>,
  warnings: PcbProductionPackageWarning[],
): PcbProductionPackageDialogueLine[] {
  return scriptEntries(beat)
    .map((entry, index) => resolveSpeechLine(entry, index + 1, characters, warnings, beat.id))
    .filter((line): line is PcbProductionPackageDialogueLine => Boolean(line));
}

function placementsForPlan(
  plan: BeatPanelPlan,
  dialogue: PcbProductionPackageDialogueLine[],
  characters: Map<string, Character>,
  warnings: PcbProductionPackageWarning[],
  sourceId: string,
): PcbProductionPackageCharacterPlacement[] {
  const placements: PcbProductionPackageCharacterPlacement[] = [];
  const seen = new Set<string>();

  for (const position of plan.characterPositions ?? []) {
    const character = characters.get(position.characterHandle);
    if (!character) {
      warnings.push({
        code: 'UNRESOLVED_CHARACTER_POSITION',
        sourceId,
        message: `Could not resolve staged character ${position.characterHandle}.`,
      });
      continue;
    }
    if (seen.has(character.id)) continue;
    seen.add(character.id);
    placements.push({ characterSourceId: character.id, stageLocation: stageLocation(position) });
  }

  const visibleSpeechCharacters = dialogue
    .filter((line) => line.kind === 'speech' && line.speakerSourceId)
    .map((line) => line.speakerSourceId as string);
  for (const characterId of visibleSpeechCharacters) {
    if (seen.has(characterId)) continue;
    seen.add(characterId);
    placements.push({ characterSourceId: characterId, stageLocation: fallbackStageLocation(placements.length) });
  }

  return placements;
}

function fallbackPlacements(
  beat: CinematicBeat,
  dialogue: PcbProductionPackageDialogueLine[],
): PcbProductionPackageCharacterPlacement[] {
  const ids = [
    ...beat.characterIds,
    ...dialogue.flatMap((line) => (line.speakerSourceId ? [line.speakerSourceId] : [])),
  ];
  return [...new Set(ids)].map((characterSourceId, index) => ({
    characterSourceId,
    stageLocation: fallbackStageLocation(index),
  }));
}

async function referenceImage(assetId: string | undefined, warnings: PcbProductionPackageWarning[], sourceId: string): Promise<string | null> {
  if (!assetId) return null;
  const imageDataUrl = await AssetStorage.getDataUri(assetId);
  if (!imageDataUrl) {
    warnings.push({
      code: 'MISSING_REFERENCE_IMAGE',
      sourceId,
      message: `Reference asset ${assetId} could not be read and was omitted from the export.`,
    });
  }
  return imageDataUrl;
}

function safeFileStem(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'show';
}

export async function buildPcbProductionPackage(show: Show): Promise<PcbProductionPackageV1> {
  const warnings: PcbProductionPackageWarning[] = [];
  const characters = characterByHandle(show);
  const references: PcbProductionPackageReference[] = [];

  for (const character of show.characters) {
    references.push({
      sourceId: character.id,
      name: character.name,
      type: 'character',
      imageDataUrl: await referenceImage(character.portraitAssetId || character.visualAnchorAssetId, warnings, character.id),
    });
  }

  for (const setting of show.settingAnchors ?? []) {
    references.push({
      sourceId: setting.id,
      name: setting.name,
      type: 'setting',
      imageDataUrl: await referenceImage(setting.assetId, warnings, setting.id),
    });
  }

  const artStyleName = show.comicStyle?.artistStyle?.trim()
    || show.styleConfig?.positivePrompt?.trim()
    || 'Prestige Comic Style';
  references.push({
    sourceId: 'psb-art-style',
    name: artStyleName,
    type: 'artStyle',
    imageDataUrl: null,
  });

  const comicAssets: PcbProductionPackageComicAsset[] = [];
  let order = 0;

  for (const season of [...show.seasons].sort((a, b) => a.number - b.number)) {
    for (const episode of [...season.episodes].sort((a, b) => a.number - b.number)) {
      for (const act of [...episode.acts].sort((a, b) => a.number - b.number)) {
        for (const scene of [...act.scenes].sort((a, b) => a.number - b.number)) {
          const settingSourceId = scene.settingAnchorId
            && (show.settingAnchors ?? []).some((setting) => setting.id === scene.settingAnchorId)
              ? scene.settingAnchorId
              : null;
          if (scene.settingAnchorId && !settingSourceId) {
            warnings.push({
              code: 'MISSING_SETTING_REFERENCE',
              sourceId: scene.id,
              message: `Scene references missing setting anchor ${scene.settingAnchorId}.`,
            });
          }

          for (let beatIndex = 0; beatIndex < scene.cinematicBeats.length; beatIndex += 1) {
            const beat = scene.cinematicBeats[beatIndex];
            order += 1;
            const plans = beat.panelPlans?.length ? beat.panelPlans : null;
            if (!plans) {
              warnings.push({
                code: 'NO_PANEL_PLAN',
                sourceId: beat.id,
                message: 'Beat has no panel plan. Exported as one deterministic fallback panel.',
              });
            }

            const panels: PcbProductionPackagePanel[] = plans
              ? plans.map((plan, panelIndex) => {
                  const dialogue = dialogueForPlan(beat, plan, characters, warnings);
                  return {
                    panelNumber: panelIndex + 1,
                    visualDescription: panelVisualDescription(beat, plan, characters) || fallbackVisualDescription(beat),
                    characters: placementsForPlan(plan, dialogue, characters, warnings, beat.id),
                    dialogue,
                  };
                })
              : (() => {
                  const dialogue = fallbackDialogue(beat, characters, warnings);
                  return [{
                    panelNumber: 1,
                    visualDescription: fallbackVisualDescription(beat),
                    characters: fallbackPlacements(beat, dialogue),
                    dialogue,
                  }];
                })();

            const sceneLabel = scene.title?.trim() || scene.setting?.trim() || `Scene ${scene.number}`;
            const beatLabel = beat.description?.trim().replace(/\s+/g, ' ').slice(0, 72) || `Beat ${beatIndex + 1}`;
            comicAssets.push({
              sourceId: beat.id,
              order,
              title: `E${String(episode.number).padStart(2, '0')} S${String(scene.number).padStart(2, '0')} B${String(beatIndex + 1).padStart(2, '0')} — ${beatLabel}`,
              sceneHeading: scene.setting?.trim() || sceneLabel,
              settingSourceId,
              source: {
                seasonNumber: season.number,
                episodeNumber: episode.number,
                actNumber: act.number,
                sceneNumber: scene.number,
                beatNumber: beatIndex + 1,
                seasonId: season.id,
                episodeId: episode.id,
                actId: act.id,
                sceneId: scene.id,
                beatId: beat.id,
              },
              panels,
            });
          }
        }
      }
    }
  }

  return {
    format: PCB_PRODUCTION_PACKAGE_FORMAT,
    version: PCB_PRODUCTION_PACKAGE_VERSION,
    source: {
      application: 'PrestigeShowBuilder',
      showId: show.id,
      showCode: show.showCode,
      exportedAt: new Date().toISOString(),
    },
    series: {
      title: show.titleSuggestion || show.name,
      orientation: 'vertical',
    },
    references,
    comicAssets,
    warnings,
  };
}

export async function downloadPcbProductionPackage(show: Show): Promise<PcbProductionPackageV1> {
  const pkg = await buildPcbProductionPackage(show);
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileStem(pkg.series.title)}-pcb-production-package-v1.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return pkg;
}
