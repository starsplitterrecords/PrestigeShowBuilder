import { describe, it, expect } from 'vitest';
import parser from '../psb4/passes/parsers/scene_script';

describe('scene_script parser', () => {
  it('correctly parses valid scenes and formats screenplay description', () => {
    const rawJson = JSON.stringify({
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 2,
          title: "The Encounter",
          setting: "Dusk in the clearing",
          screenplay: "INT. CLEARING - DUSK\n\nLucia stands alone.",
          script: [
            { kind: 'action', text: 'Lucia sighs loudly.', coversBeat: 2 },
            { kind: 'line', characterHandle: '@vps.lucia', text: 'Hello there!', parenthetical: 'nervously', coversBeat: 2 },
            { kind: 'caption', text: 'She looks around.', coversBeat: 3 }
          ]
        }
      ]
    });

    const result = parser.parse(`\`\`\`json\n${rawJson}\n\`\`\``);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const payload = result.payload;
    expect(payload.scenes).toHaveLength(1);
    const scene = payload.scenes[0];
    expect(scene.actNumber).toBe(1);
    expect(scene.sceneNumber).toBe(2);
    expect(scene.title).toBe("The Encounter");
    expect(scene.setting).toBe("Dusk in the clearing");
    expect(scene.screenplay).toBe("INT. CLEARING - DUSK\n\nLucia stands alone.");
    expect(scene.script).toHaveLength(3);
    const script = scene.script!;

    expect(script[0]).toEqual({
      kind: 'action',
      text: 'Lucia sighs loudly.',
      coversBeat: 2
    });

    expect(script[1]).toEqual({
      kind: 'line',
      characterHandle: '@vps.lucia',
      parenthetical: 'nervously',
      text: 'Hello there!',
      coversBeat: 2
    });
  });

  it('drops malformed units and handles missing screenplay gracefully', () => {
    const rawJson = JSON.stringify({
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 1,
          title: "Intro",
          setting: "Space station",
          script: [
            { kind: 'line', text: 'This has no handle and should become action', coversBeat: 4 },
            { kind: 'caption', text: '', coversBeat: 2 }, // empty text should be dropped
            { kind: 'line', characterHandle: '@lucia', text: 'A good line', coversBeat: -1 }, // coversBeat < 1 -> defaults to 1
            { kind: 'action', text: 'Action text', coversBeat: 'invalid' as any } // coversBeat non-integer -> defaults to 1
          ]
        }
      ]
    });

    const result = parser.parse(rawJson);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const payload = result.payload;
    const scene = payload.scenes[0];
    expect(scene.script).toHaveLength(3);
    const script = scene.script!;

    // 1. Line without handle coerced to action
    expect(script[0]).toEqual({
      kind: 'action',
      text: 'This has no handle and should become action',
      coversBeat: 4
    });

    // 2. Headless/empty line dropped (not in script)
    // 3. coversBeat negative became 1
    expect(script[1]).toEqual({
      kind: 'line',
      characterHandle: '@lucia',
      text: 'A good line',
      coversBeat: 1
    });

    // 4. coversBeat non-integer became 1
    expect(script[2]).toEqual({
      kind: 'action',
      text: 'Action text',
      coversBeat: 1
    });

    // Reconstruct screenplay fallback when screenplay is omitted
    expect(scene.screenplay).toContain('This has no handle and should become action');
    expect(scene.screenplay).toContain('@lucia');
    expect(scene.screenplay).toContain('A good line');
  });

  it('fails with a clear message if raw string is not JSON or is invalid', () => {
    const result = parser.parse('This is not a JSON object');
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toContain('JSON parsing failed');
    }
  });
});
