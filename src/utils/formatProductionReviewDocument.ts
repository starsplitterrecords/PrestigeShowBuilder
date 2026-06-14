import { ProductionReviewDocument } from './exportProductionReviewDocument';

export function formatProductionReviewDocument(doc: ProductionReviewDocument): string {
  const lines: string[] = [];

  // Header
  lines.push("================================================================================");
  lines.push("PRODUCTION REVIEW DOCUMENT");
  lines.push(`Show: ${doc.showTitle.toUpperCase()}`);
  lines.push(`Identifier: ${doc.identifier}`);
  lines.push(`Export Date: ${doc.exportDate}`);
  lines.push("================================================================================");
  lines.push("");
  lines.push("NOTE: This is a working production review packet assembled from the current");
  lines.push("story/comic planning state. It intentionally preserves source-level detail and");
  lines.push("unresolved roughness where present so issues can be reviewed in context.");
  lines.push("");

  for (const episode of doc.episodes) {
    lines.push("================================================================================");
    lines.push(`EPISODE ${episode.number}: ${episode.title.toUpperCase()}`);
    if (episode.oneLineSummary) {
      lines.push(`Summary: ${episode.oneLineSummary}`);
    }
    lines.push("================================================================================");
    lines.push("");

    for (const act of episode.acts) {
      lines.push("--------------------------------------------------------------------------------");
      lines.push(`ACT ${act.number}${act.title ? ` — ${act.title.toUpperCase()}` : ""}`);
      if (act.summary) {
        lines.push(`Summary: ${act.summary}`);
      }
      lines.push("--------------------------------------------------------------------------------");
      lines.push("");

      for (const scene of act.scenes) {
        lines.push(`SCENE: ${scene.title.toUpperCase()}`);
        if (scene.setting) lines.push(`Setting: ${scene.setting}`);
        const anchorName = scene.settingAnchorName || "(none — using freetext)";
        lines.push(`Setting Anchor: ${anchorName}`);
        if (scene.dramaticWant) lines.push(`Dramatic Want: ${scene.dramaticWant}`);
        if (scene.summary) lines.push(`Scene Summary: ${scene.summary}`);
        lines.push("");

        for (const beat of scene.beats) {
          const lockedPrefix = beat.locked ? " [LOCKED]" : "";
          lines.push(`  BEAT ${beat.number} [${beat.fid}] (${beat.type})${lockedPrefix}`);
          
          lines.push("  Description:");
          lines.push(`  ${beat.description || "[EMPTY]"}`);
          lines.push("");

          if (beat.subtext) {
            lines.push("  Subtext:");
            lines.push(`  ${beat.subtext}`);
            lines.push("");
          }

          if (beat.visualDescription) {
            lines.push("  Visual Description:");
            lines.push(`  ${beat.visualDescription}`);
            lines.push("");
          }

          if (beat.direction) {
            lines.push("  Direction:");
            lines.push(`  ${beat.direction}`);
            lines.push("");
          }

          if (beat.continuityAnchor) {
            lines.push("  Continuity Anchor:");
            lines.push(`  ${beat.continuityAnchor}`);
            lines.push("");
          }

          if (beat.groundingEnsemble) {
            lines.push("  Grounding Ensemble:");
            lines.push(`  ${beat.groundingEnsemble}`);
            lines.push("");
          }

          if (beat.characterNames.length > 0) {
            lines.push(`  Characters: ${beat.characterNames.join(', ')}`);
          }

          lines.push(`  Versions: script v${beat.versions.script} / visual v${beat.versions.visual} / page v${beat.versions.page}`);
          lines.push("");

          if (beat.panelPlans && beat.panelPlans.length > 0) {
            const planSource = beat.comicState.panelPlanSource === 'ai-plan' ? 'AI' :
                               beat.comicState.panelPlanSource === 'heuristic-plan' ? 'HEURISTIC' :
                               beat.comicState.panelPlanSource === 'none' ? 'MANUAL' : 
                               beat.comicState.panelPlanSource.toUpperCase();

            lines.push(`  Panel Plan (${beat.panelPlans.length} panels, source: ${planSource}):`);
            beat.panelPlans.forEach((plan, pIdx) => {
              lines.push(`    Panel ${pIdx + 1} [${plan.shotType}]`);
              lines.push(`      Action: ${plan.action}`);
              if (plan.subtext) lines.push(`      Subtext: ${plan.subtext}`);
              if (plan.direction) lines.push(`      Direction: ${plan.direction}`);
              lines.push(`      Dialogue lines used: [${(plan.dialogueIndices || []).join(', ')}]`);
              lines.push(`      Captions used: [${(plan.captionIndices || []).join(', ')}]`);
            });
            lines.push("");
          }

          if (beat.dialogue.length > 0) {
            lines.push("  Dialogue:");
            for (const line of beat.dialogue) {
              const prefix = line.kind === 'caption' ? "[CAPTION] " : "";
              const char = line.character.toUpperCase();
              const paren = line.parenthetical ? ` (${line.parenthetical})` : "";
              lines.push(`  - ${prefix}${char}${paren}: ${line.text}`);
            }
            lines.push("");
          }

          lines.push("  Comic State:");
          const displaySource = beat.comicState.panelPlanSource === 'ai-plan' ? 'AI' :
                                beat.comicState.panelPlanSource === 'heuristic-plan' ? 'HEURISTIC' :
                                beat.comicState.panelPlanSource === 'none' ? 'MANUAL' : 
                                beat.comicState.panelPlanSource.toUpperCase();
          lines.push(`  - Panel Plan Source: ${displaySource}`);
          lines.push(`  - Panel Plan Freshness: ${beat.comicState.panelPlanFreshness}`);
          lines.push(`  - Panel Count: ${beat.comicState.panelCount}`);
          lines.push(`  - Beat Page State: ${beat.comicState.beatPageState}`);
          lines.push(`  - Lettering State: ${beat.comicState.letteringState}`);
          lines.push("");
          lines.push("  ..............................................................................");
          lines.push("");
        }
      }
    }
  }

  return lines.join('\n');
}
