import { CinematicBeat } from '../types/models';
import { hasDialogueContent } from './scriptUtils';

/**
 * updateBeatWithStaleness — D212
 * Centralized logic for dependency-aware beat updates.
 * Marks downstream artifacts stale when upstream fields change.
 */
export function updateBeatWithStaleness(target: CinematicBeat, updates: Partial<CinematicBeat>) {
  const narrativeFields: (keyof CinematicBeat)[] = ['description'];
  const visualFields: (keyof CinematicBeat)[] = ['visualDescription', 'direction', 'continuityAnchor', 'beatType'];
  const scriptFields: (keyof CinematicBeat)[] = ['script', 'lines'];
  const layoutFields: (keyof CinematicBeat)[] = ['panelPlans'];

  let narrativeChanged = false;
  let visualChanged = false;
  let scriptChanged = false;
  let layoutChanged = false;

  for (const key of Object.keys(updates) as (keyof CinematicBeat)[]) {
    const newVal = updates[key];
    const oldVal = (target as any)[key];
    const isDifferent = (typeof newVal === 'string') ? newVal !== oldVal : true;

    if (isDifferent) {
      if (narrativeFields.includes(key)) narrativeChanged = true;
      if (visualFields.includes(key)) visualChanged = true;
      if (scriptFields.includes(key)) scriptChanged = true;
      if (layoutFields.includes(key)) layoutChanged = true;
    }
  }

  // Assign updates
  Object.assign(target, updates);

  if (target.locked) return;

  // Cascading staleness logic per D318 with reasons
  if (narrativeChanged) {
    target.visualsStale = true;
    target.visualsStaleReason = "Narrative beat changed";
    
    // D322: TABLEAU + no dialogue has no script dependency on narrative.
    if (!(target.beatType === 'TABLEAU' && !hasDialogueContent(target))) {
      target.scriptStale = true;
      target.scriptStaleReason = "Narrative beat changed";
    }

    target.panelPlanStale = true;
    target.panelPlanStaleReason = "Narrative beat changed";
    target.beatPageStale = true;
    target.beatPageStaleReason = "Narrative beat changed";
    target.letteringStale = true;
    target.letteringStaleReason = "Narrative beat changed";
  } else if (visualChanged) {
    target.visualVersion = (target.visualVersion || 0) + 1;
    target.visualsStale = false; // Freshly set

    // D322: TABLEAU + no dialogue has no script dependency on visuals.
    if (!(target.beatType === 'TABLEAU' && !hasDialogueContent(target))) {
      target.scriptStale = true;
      target.scriptStaleReason = "Visuals changed";
    }

    target.panelPlanStale = true;
    target.panelPlanStaleReason = "Visuals changed";
    target.beatPageStale = true;
    target.beatPageStaleReason = "Visuals changed";
    target.letteringStale = true;
    target.letteringStaleReason = "Visuals changed";
  } else if (scriptChanged) {
    target.scriptVersion = (target.scriptVersion || 0) + 1;
    target.scriptStale = false; // Freshly set
    target.panelPlanStale = true;
    target.panelPlanStaleReason = "Script changed";
    target.beatPageStale = true;
    target.beatPageStaleReason = "Script changed";
    target.letteringStale = true;
    target.letteringStaleReason = "Script changed";
  } else if (layoutChanged) {
    target.layoutVersion = (target.layoutVersion || 0) + 1;
    target.panelPlanStale = false; // Freshly set
    target.beatPageStale = true;
    target.beatPageStaleReason = "Panel plan changed";
    target.letteringStale = true;
    target.letteringStaleReason = "Panel plan changed";
  }
}
