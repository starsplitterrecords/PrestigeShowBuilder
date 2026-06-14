/**
 * NARRATIVE OUTPUT TEMPLATES
 * Technical: Dictating the exact format for LLM outputs to ensure professional standard consistency.
 */
export const AI_TEMPLATES = {
  PREMISE: `
[FORMAT: Standard Buyer Pitch]

Logline (1–2 sentences): 
- [Protagonist] [must do ongoing job/mission] to [goal], but [core obstacle] keeps forcing [weekly dilemma].
- Include the repeatable conflict (“every week…” / “they must…”).

Series Overview: 
- World rules (what’s normal here).
- Why this character is stuck doing this job/mission/role.
- The “engine” (how stories reset and replenish).

Core Cast Dynamics (3–6 bullets): 
- Protagonist + 2–5 key relationships (ally, rival, authority figure, wildcard).
- Each bullet says what they want and how they clash.

Episode Model: 
- A-story type (main case/problem).
- B-story type (personal/relationship/secondary mission).
- Typical ending flavor (twist, win-with-cost, moral gray, tag joke).

Season Shape: 
- The long arc and what changes by finale.
- What stays consistent (so it can run multiple seasons).

Tone + Audience + Comps: 
- Tone descriptors.
- Target audience.
- 2–3 comps (“X meets Y with Z”).
`,

  CHARACTER: `
[FORMAT: Production Narrative Block]

Lead Snapshot:
- Name / Ensemble Lane: Anchor / Catalyst / Chaos / Heart / Brain
- Logline (1 sentence):
- Episode Engine: (job/obligation/flaw/secret that forces weekly stories)
- Core Contradiction: (e.g., “control freak who hates being seen”)
- Season Pressure: (one external squeeze + one internal squeeze)

Casting Profile (Specific, Castable):
- Age range / Height range / Build:
- Face “read” (20 feet): (pick 2) Authority / Warmth / Menace / Fragility / Mischief / Competence
- Defining features (2–4):
- Hair: cut + texture + color + upkeep rule.
- Grooming discipline: (what it signals).
- Distinctive marks: Continuity plan.
- Casting avoid list (3 energy mismatches):

Wardrobe System (reads on camera):
- Palette (3–5 colors):
- Silhouette rule: (structured vs relaxed; long lines vs cropped).
- Baseline look (daily): head-to-toe specifics.
- Alt look A (wins): concrete upgrade move.
- Alt look B (loses): concrete degradation move.
- Footwear + Accessories (max 3) + Signature Prop.

Movement + Presence (Directable):
- Posture baseline / Walk speed / weight transfer.
- Hands when thinking / Tell when lying / Tell when threatened.
- On-camera business (2–3 repeatable actions).

Voice + Dialogue Controls:
- Voice type / Pace / Pitch behavior / Accent.
- Verbal habit (1–2): (interrupts, precision verbs, pauses).
- Silence style.

Ensemble Chemistry Targets:
- Rival axis (who/what triggers conflict).
- Ally axis (stabilizer).
- Soft-spot axis (bypass defenses).
- Group behavior under pressure.

Arc Capacity:
- Season Want vs. Season Need.
- Breaking Point + Finale Choice.

Production Notes:
- Continuity risks / Skill needs.
- Department handoff (Hair/Makeup rule).
`,

  SEASON_ARC: `
[FORMAT: Ensemble-Friendly Season Narrative Arc]

0) Season Thesis: Theme + Core question + Promise of season.
1) Engine + Format Lock: Episode engine + A/B Story patterns + Reset rule.
2) Season Spine: External objective + Primary force + Season clock + Escalation ladder (3 rungs).
3) Character Arc Lanes (for 3–6 leads): Want/Need/Lie/Pressure/Breaking point/Final choice.
4) Midpoints and Turns: 
   - Ep 1 (Inciting disturbance)
   - Ep 2 (Win with cost)
   - Ep 3 (First reversal)
   - Ep 4 (Midseason reframe)
   - Ep 5 (Lowest point)
   - Ep 6 (Regroup)
   - Ep 7 (Climax / Collision)
   - Ep 8 (Resolution / New normal)
5) Ensemble Relationship Map: Core triangle + Alliance shifts + Payoff scene.
6) Episode Beat Template: Cold open, Commitment, Complication, Midpoint twist, Confrontation, Outcome, Tag.
7) Season Escalation: Clue trail + Resource track + Heat level curve.
8) Finale Deliverables: External climax + Internal climax + Cost paid + Door left open.
9) Season Outline Grid: Ep # / Title / A-Story / B-Story / Spine movement / Turn / End state.
10) Philosophical Faction Map: For each non-protagonist character in the ensemble,
    list: handle | faction name | one-sentence philosophy they embody.
    The philosophy must be the specific belief that makes them dangerous at extremes,
    not a general description of their role.
    Example: @show.atlas | Vanguard | "No world is expendable — entropy must be
    refused through endurance, even if that endurance petrifies the protector."
`
};
