import { describe, it, expect } from 'vitest';
import { parseScreenplayToScriptUnits } from '../psb4/passes/parsers/scene_script';

describe('parseScreenplayToScriptUnits', () => {
  it('parses a simple action/dialogue/action scene into ordered units', () => {
    const screenplay = `
INT. KITCHEN - DAY
Carrie watches the coffee machine drip.

GUNNAR
How does it know to stop?

He sighs and waits.
    `.trim();

    const units = parseScreenplayToScriptUnits(screenplay, [
      { id: 'gunnar', name: 'Gunnar', handle: '@gunnar' }
    ])!;

    expect(units.length).toBe(4);
    expect(units[0]).toEqual({
      kind: 'action',
      text: 'INT. KITCHEN - DAY',
      coversBeat: 1,
    });
    expect(units[1]).toEqual({
      kind: 'action',
      text: 'Carrie watches the coffee machine drip.',
      coversBeat: 1,
    });
    expect(units[2]).toEqual({
      kind: 'line',
      characterHandle: '@gunnar',
      characterName: 'Gunnar',
      text: 'How does it know to stop?',
      coversBeat: 1,
    });
    expect(units[3]).toEqual({
      kind: 'action',
      text: 'He sighs and waits.',
      coversBeat: 1,
    });
  });

  it('preserves exact dialogue text', () => {
    const screenplay = `
GUNNAR
(dryly)
A different kind of warrior's trial.
    `.trim();

    const units = parseScreenplayToScriptUnits(screenplay, [
      { id: 'gunnar', name: 'Gunnar', handle: '@gunnar' }
    ])!;

    expect(units.length).toBe(1);
    expect(units[0]).toEqual({
      kind: 'line',
      characterHandle: '@gunnar',
      characterName: 'Gunnar',
      parenthetical: 'dryly',
      text: "A different kind of warrior's trial.",
      coversBeat: 1,
    });
  });

  it('preserves characterName and leaves characterHandle undefined for unknown characters', () => {
    const screenplay = `
UNKNOWN_CHAR
What is this?
    `.trim();

    const units = parseScreenplayToScriptUnits(screenplay, [])!;

    expect(units.length).toBe(1);
    expect(units[0]).toEqual({
      kind: 'line',
      characterHandle: undefined,
      characterName: 'UNKNOWN_CHAR',
      text: 'What is this?',
      coversBeat: 1,
    });
  });

  it('does not produce empty units and does not throw on imperfect screenplay formatting', () => {
    const screenplay = '\n\n\n  \n\n';
    expect(() => parseScreenplayToScriptUnits(screenplay)).not.toThrow();
    const units = parseScreenplayToScriptUnits(screenplay)!;
    expect(units.length).toBe(0);
  });
});
