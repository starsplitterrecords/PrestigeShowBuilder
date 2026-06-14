import { SceneScriptPayload, SegmentationPlanPayload,
  SceneStructurePayload, SceneStructureBeat, SceneScriptEntry, WrittenScene } from '../types';
import { parseScreenplayToScriptUnits } from './parsers/scene_script';
import { resolveCharacter } from '../../utils/characterUtils';

export function assembleSceneStructure(
  plan: SegmentationPlanPayload,
  written: SceneScriptPayload,
  structure?: SceneStructurePayload,
  options?: { allowOverlap?: boolean; showCharacters?: any[] }
): SceneStructurePayload {
  const sceneOf = (a: number, s: number) =>
    written.scenes.find(w => w.actNumber === a && w.sceneNumber === s);

  const origSceneOf = (a: number, s: number) => {
    if (!structure?.acts) return undefined;
    const act = structure.acts.find(ac => ac.actNumber === a);
    return act?.scenes?.find(sc => sc.sceneNumber === s);
  };

  const origActOf = (a: number) => {
    if (!structure?.acts) return undefined;
    return structure.acts.find(ac => ac.actNumber === a);
  };

  // Group plan scenes by act for the act/scene hierarchy.
  const actsMap = new Map<number, any>();

  for (const ps of plan.scenes) {
    const w = sceneOf(ps.actNumber, ps.sceneNumber);
    if (!w) {
      throw new Error(`0.9G cannot segment: Scene Act ${ps.actNumber} Scene ${ps.sceneNumber} not found in the written screenplay.`);
    }
    const unitsRaw = Array.isArray(w.script) && w.script.length > 0
      ? w.script
      : parseScreenplayToScriptUnits(w.screenplay || '');
    const units: NonNullable<WrittenScene['script']> = unitsRaw || [];

    // Coverage validation tracker
    const coverage = new Map<number, number>();

    // Validate pageBeats list
    if (units.length > 0) {
      if (!ps.pageBeats || ps.pageBeats.length === 0) {
        throw new Error(
          `0.9G cannot segment A${ps.actNumber}S${ps.sceneNumber}: No pageBeats returned, but the source scene has ${units.length} units.`
        );
      }
    }

    for (const pb of ps.pageBeats || []) {
      // no pageBeat may be empty
      if (units.length > 0 && (!pb.unitIndices || pb.unitIndices.length === 0)) {
        throw new Error(
          `0.9G cannot segment A${ps.actNumber}S${ps.sceneNumber}: pageBeat has no unit indices assigned, but the source scene has ${units.length} units.`
        );
      }

      for (const idx of pb.unitIndices || []) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= units.length) {
          throw new Error(
            `0.9G invalid output for A${ps.actNumber}S${ps.sceneNumber}: pageBeat ${ps.pageBeats.indexOf(pb) + 1} references out-of-range unit index ${idx}.`
          );
        }
        coverage.set(idx, (coverage.get(idx) || 0) + 1);
      }
    }

    // Gaps (uncovered units) check
    if (units.length > 0) {
      const missing: number[] = [];
      for (let i = 0; i < units.length; i++) {
        if (!coverage.has(i)) {
          missing.push(i);
        }
      }
      if (missing.length > 0) {
        throw new Error(
          `0.9G validation failed for A${ps.actNumber}S${ps.sceneNumber}: Missing unit coverage. The following unit indices are not covered by any pageBeat: ${missing.join(', ')}.`
        );
      }

      // Duplicates (overlaps) check
      if (!options?.allowOverlap) {
        const duplicated: number[] = [];
        for (let i = 0; i < units.length; i++) {
          if ((coverage.get(i) || 0) > 1) {
            duplicated.push(i);
          }
        }
        if (duplicated.length > 0) {
          throw new Error(
            `0.9G validation failed for A${ps.actNumber}S${ps.sceneNumber}: Duplicate unit coverage. The following unit indices are repeated across multiple pageBeats: ${duplicated.join(', ')}.`
          );
        }
      }
    }

    const beats: SceneStructureBeat[] = ps.pageBeats.map(pb => {
      const picked = pb.unitIndices
        .map(i => units[i]).filter(Boolean);

      // Map unitIndices exactly to full scripts, including lines and captions, but filtering out actions
      const script: SceneScriptEntry[] = pb.unitIndices.map(idx => {
        const u = units[idx];
        if (!u || u.kind === 'action') return null;

        const entry: SceneScriptEntry = {
          kind: u.kind as any,
          text: u.text
        };

        if (u.kind === 'line') {
          const speakerName = u.characterName || u.characterHandle?.replace(/^@/, '') || 'Speaker';
          const resolvedChar = resolveCharacter({ characters: options?.showCharacters } as any, u.characterHandle || u.characterName || '');

          entry.speakerName = speakerName;
          entry.characterName = speakerName;

          if (resolvedChar) {
            entry.characterHandle = resolvedChar.handle || u.characterHandle || `@${resolvedChar.id}`;
            entry.characterId = resolvedChar.id;
          } else {
            entry.characterHandle = u.characterHandle;
            entry.characterId = (u as any).characterId;
          }

          if (u.parenthetical) {
            entry.parenthetical = u.parenthetical;
          }
        } else if (u.kind === 'caption') {
          entry.captionStyle = 'grey';
        }

        return entry;
      }).filter(Boolean) as SceneScriptEntry[];

      // No pageBeat may have empty script array if it has unitIndices with lines/captions
      const hasDialogueInUnits = pb.unitIndices && pb.unitIndices.some(idx => {
        const u = units[idx];
        return u && (u.kind === 'line' || u.kind === 'caption');
      });
      if (pb.unitIndices && pb.unitIndices.length > 0 && hasDialogueInUnits && script.length === 0) {
        throw new Error(
          `0.9G cannot segment A${ps.actNumber}S${ps.sceneNumber}: pageBeat has no script entries assigned despite unit indices.`
        );
      }

      const actions = picked.filter(u => u.kind === 'action');
      const actionProse = actions.map(a => a.text).join(' ');
      const visualNote = [pb.visualNote, actionProse].filter(Boolean).join(' ');

      // Character IDs and handles from resolved characters or fallbacks
      const characterIds = Array.from(new Set(
        pb.unitIndices.map(idx => {
          const u = units[idx];
          if (u && u.kind === 'line') {
            const resolvedChar = resolveCharacter({ characters: options?.showCharacters } as any, u.characterHandle || u.characterName || '');
            return resolvedChar ? resolvedChar.id : (u as any).characterId;
          }
          return null;
        }).filter(Boolean) as string[]
      ));

      const characterHandles = Array.from(new Set(
        pb.unitIndices.map(idx => {
          const u = units[idx];
          if (u && u.kind === 'line') {
            const resolvedChar = resolveCharacter({ characters: options?.showCharacters } as any, u.characterHandle || u.characterName || '');
            return resolvedChar ? (resolvedChar.handle || `@${resolvedChar.id}`) : u.characterHandle;
          }
          return null;
        }).filter(Boolean) as string[]
      ));

      const sourceBeatNumbers = Array.from(new Set(
        picked.map(u => u.coversBeat).filter(Boolean)));

      return {
        unitIndices: pb.unitIndices,
        description: pb.description || actionProse || '',
        beatType: pb.beatType || (script.some(s => s.kind === 'line') ? 'DIALOGUE' : 'TABLEAU'),
        characterHandles,
        characterIds,
        subtext: '', visualNote, direction: pb.direction || '',
        source: 'preserved' as const,
        sourceBeatNumbers: sourceBeatNumbers.length ? sourceBeatNumbers : [1],
        script,
      } as any;
    });

    if (!actsMap.has(ps.actNumber)) {
      const origAct = origActOf(ps.actNumber);
      actsMap.set(ps.actNumber, {
        actNumber: ps.actNumber,
        title: origAct?.title || '',
        scenes: []
      });
    }

    const origScene = origSceneOf(ps.actNumber, ps.sceneNumber);

    actsMap.get(ps.actNumber).scenes.push({
      sceneNumber: ps.sceneNumber,
      title: w.title || origScene?.title || '',
      setting: w.setting || origScene?.setting || '',
      dramaticWant: origScene?.dramaticWant || '',
      function: origScene?.function || '',
      beats,
      pageBeats: beats, // Canonical duplicate field to support both behaviors perfectly
    });
  }

  return { acts: Array.from(actsMap.values())
    .sort((a,b) => a.actNumber - b.actNumber) };
}
