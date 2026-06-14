import { describe, it, expect } from 'vitest';
import { assembleSceneStructure } from '../psb4/passes/assembleSceneStructure';
import { SceneScriptPayload, SegmentationPlanPayload } from '../psb4/types';

describe('assembleSceneStructure', () => {
  it('successfully segments a normal scene and preserves script values', () => {
    const written: SceneScriptPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 1,
          title: 'A Great Beginning',
          setting: 'Cave',
          screenplay: 'INT. CAVE - NIGHT\nGunnar is cold.',
          script: [
            { kind: 'action', text: 'INT. CAVE - NIGHT', coversBeat: 1 },
            { kind: 'line', characterHandle: '@gunnar', characterName: 'Gunnar', text: 'Brrr.', coversBeat: 1 },
            { kind: 'action', text: 'Gunnar shivers.', coversBeat: 2 }
          ]
        }
      ]
    };

    const plan: SegmentationPlanPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 1,
          pageBeats: [
            { unitIndices: [0, 1], beatType: 'DIALOGUE', description: 'Gunnar complains.' },
            { unitIndices: [2], beatType: 'TABLEAU', description: 'Gunnar shivers.' }
          ]
        }
      ]
    };

    const structure = assembleSceneStructure(plan, written);
    expect(structure.acts.length).toBe(1);
    expect(structure.acts[0].scenes.length).toBe(1);
    const beats = structure.acts[0].scenes[0].beats;
    expect(beats.length).toBe(2);

    expect(beats[0]).toEqual({
      description: 'Gunnar complains.',
      beatType: 'DIALOGUE',
      characterHandles: ['@gunnar'],
      characterIds: [],
      subtext: '',
      visualNote: 'INT. CAVE - NIGHT',
      direction: '',
      source: 'preserved',
      sourceBeatNumbers: [1],
      unitIndices: [0, 1],
      script: [
        { kind: 'line', characterHandle: '@gunnar', characterId: undefined, characterName: 'Gunnar', speakerName: 'Gunnar', text: 'Brrr.' }
      ]
    });

    expect(beats[1]).toEqual({
      description: 'Gunnar shivers.',
      beatType: 'TABLEAU',
      characterHandles: [],
      characterIds: [],
      subtext: '',
      visualNote: 'Gunnar shivers.',
      direction: '',
      source: 'preserved',
      sourceBeatNumbers: [2],
      unitIndices: [2],
      script: []
    });
  });

  it('fails if unit index is out of range', () => {
    const written: SceneScriptPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 2,
          title: 'Scene 2',
          setting: 'Forest',
          screenplay: 'Gunnar runs.',
          script: [{ kind: 'action', text: 'Gunnar runs.', coversBeat: 1 }]
        }
      ]
    };

    const plan: SegmentationPlanPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 2,
          pageBeats: [
            { unitIndices: [0], beatType: 'TABLEAU', description: 'Action' },
            { unitIndices: [5], beatType: 'TABLEAU', description: 'Out of bounds' }
          ]
        }
      ]
    };

    expect(() => assembleSceneStructure(plan, written)).toThrow(/references out-of-range/);
  });

  it('fails if units are missing (gaps list is not fully covered)', () => {
    const written: SceneScriptPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 3,
          title: 'Scene 3',
          setting: 'Forest',
          screenplay: 'Action 1. Action 2.',
          script: [
            { kind: 'action', text: 'Action 1.', coversBeat: 1 },
            { kind: 'action', text: 'Action 2.', coversBeat: 2 }
          ]
        }
      ]
    };

    const plan: SegmentationPlanPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 3,
          pageBeats: [
            { unitIndices: [0], beatType: 'TABLEAU', description: 'First step only' }
          ]
        }
      ]
    };

    expect(() => assembleSceneStructure(plan, written)).toThrow(/Missing unit coverage/);
  });

  it('fails if pageBeats contains duplicate/overlapping units by default', () => {
    const written: SceneScriptPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 4,
          title: 'Scene 4',
          setting: 'Forest',
          screenplay: 'Action 1.',
          script: [
            { kind: 'action', text: 'Action 1.', coversBeat: 1 },
          ]
        }
      ]
    };

    const plan: SegmentationPlanPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 4,
          pageBeats: [
            { unitIndices: [0], beatType: 'TABLEAU', description: 'Duplicated 1' },
            { unitIndices: [0], beatType: 'TABLEAU', description: 'Duplicated 2' }
          ]
        }
      ]
    };

    expect(() => assembleSceneStructure(plan, written)).toThrow(/Duplicate unit coverage/);
  });

  it('allows duplicate/overlapping units if options.allowOverlap is true', () => {
    const written: SceneScriptPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 5,
          title: 'Scene 5',
          setting: 'Forest',
          screenplay: 'Action 1.',
          script: [
            { kind: 'action', text: 'Action 1.', coversBeat: 1 },
          ]
        }
      ]
    };

    const plan: SegmentationPlanPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 5,
          pageBeats: [
            { unitIndices: [0], beatType: 'TABLEAU', description: 'Duplicated 1' },
            { unitIndices: [0], beatType: 'TABLEAU', description: 'Duplicated 2' }
          ]
        }
      ]
    };

    expect(() => assembleSceneStructure(plan, written, undefined, { allowOverlap: true })).not.toThrow();
  });

  it('fails if pageBeats is empty but source scene has units', () => {
    const written: SceneScriptPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 6,
          title: 'Scene 6',
          setting: 'Forest',
          screenplay: 'Action 1.',
          script: [
            { kind: 'action', text: 'Action 1.', coversBeat: 1 },
          ]
        }
      ]
    };

    const plan: SegmentationPlanPayload = {
      scenes: [
        {
          actNumber: 1,
          sceneNumber: 6,
          pageBeats: []
        }
      ]
    };

    expect(() => assembleSceneStructure(plan, written)).toThrow(/No pageBeats returned/);
  });
});
