import { CinematicBeat, Scene, Show, ReadinessIssue } from '../types/models';
import { AssetStorage } from '../storage';
import { compareHandles } from './handleUtils';
import { resolveLocationForBeat, resolveLines, hasDialogueContent, resolveCharacter } from '../domainUtils';

export interface ReadinessResult {
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

/**
 * Pre-flight check that blocks or warns before burning tokens on image generation.
 */
export async function checkBeatReadiness(
  beat: CinematicBeat,
  scene: Scene,
  show: Show
): Promise<ReadinessResult> {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  // 1) Characters
  const charIds = beat.characterIds ?? [];
  if (charIds.length > 0) {
    let anyResolved = false;
    for (const cid of charIds) {
      const char = resolveCharacter(show, cid);
      
      if (!char) {
        warnings.push({
          kind: 'character-unresolved',
          message: `Character "${cid}" not found in roster.`,
          characterId: cid,
        });
        continue;
      }
      
      anyResolved = true;
      
      // Track exact-id vs handle-only match (post-D320 fallback)
      const exactMatch = char.id === cid;
      if (!exactMatch) {
        warnings.push({
          kind: 'handle-mismatch',
          message: `"${cid}" resolves to ${char.name} via loose/handle match, not exact ID. Consider running cleanup.`,
          characterId: cid,
        });
      }
      
      // Portrait presence
      const pid = char.portraitAssetId ?? char.visualAnchorAssetId;
      if (!pid) {
        warnings.push({
          kind: 'missing-portrait',
          message: `No portrait or visual anchor for ${char.name}.`,
          characterId: char.id,
        });
      } else {
        // Portrait blob loadable
        try {
          const blob = await AssetStorage.getBlob(pid);
          if (!blob) {
            warnings.push({
              kind: 'portrait-blob-missing',
              message: `Portrait asset for ${char.name} is missing from local storage.`,
              characterId: char.id,
            });
          }
        } catch (err) {
          warnings.push({
            kind: 'portrait-load-failed',
            message: `Failed to verify portrait for ${char.name}.`,
            characterId: char.id,
          });
        }
      }
    }
    
    if (!anyResolved) {
      blockers.push({
        kind: 'no-characters-resolve',
        message: "None of this beat's listed characters resolve in the show roster.",
      });
    }
  }

  // 2) Setting
  const location = resolveLocationForBeat(scene, show);
  if (!location) {
    if (!scene.setting?.trim()) {
      blockers.push({
        kind: 'no-setting',
        message: 'Scene has no setting text and no resolvable setting anchor.',
      });
    } else if (!scene.settingAnchorId) {
      warnings.push({
        kind: 'setting-anchor-unlinked',
        message: 'Scene uses free-text setting; no setting anchor linked for visual continuity.',
      });
    }
  }

  // 3) Visual description
  if (!beat.visualDescription?.trim()) {
    blockers.push({
      kind: 'no-visual-description',
      message: 'Beat has no visualDescription (Visuals step may have been skipped).',
    });
  }

  // 4) Panel plan vs script content
  const hasContent = hasDialogueContent(beat);
  const panelCount = beat.panelPlans?.length ?? 0;
  const isTableau = beat.beatType === 'TABLEAU';

  if (hasContent && panelCount === 0 && !isTableau) {
    blockers.push({
      kind: 'empty-panel-plan-with-script',
      message: 'Beat has script content but no panel plan has been generated.',
    });
  }
  
  if (beat.panelCountOverride !== undefined && beat.panelCountOverride !== panelCount && panelCount > 0) {
    warnings.push({
      kind: 'panel-count-mismatch',
      message: `Preferred panel count (${beat.panelCountOverride}) differs from actual panel plan count (${panelCount}).`,
    });
  }

  return { blockers, warnings };
}
