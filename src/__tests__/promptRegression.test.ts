import { describe, it, expect } from 'vitest';
import { renderTextItem, buildCompositePrompt } from '../ai/imageGeneration/finalPagePromptPreview';
import { validateFinalPage, FinalPageBeat } from '../ai/imageGeneration/finalPageContract';
import { sanitizeNegativePromptForFinalComicPage, assembleComicStyleHeader, DEFAULT_LETTERING_STYLE } from '../ai/imageGeneration/comicStyleHeader';

describe('Prompt Regression Tests', () => {

  it('should not contain the word chain in any casing for joined balloons', () => {
    const item = {
      kind: 'balloon' as const,
      text: 'Hello continued text',
      speakerName: 'Sven',
      position: 'right',
      chained: true,
    };
    const lines = renderTextItem(item);
    const textStr = lines.join('\n');
    expect(textStr.toLowerCase()).not.toContain('chain');
    expect(textStr).toContain('TAILLESS JOINED SPEECH BALLOON segment');
  });

  it('should contain character portrait authority in the CHARACTERS block', () => {
    const mockContract: FinalPageBeat = {
      pageBeatUid: 'pb-123',
      address: 'I1A1S1P1',
      issueUid: 'iss-123',
      sceneUid: 'sc-123',
      panelCount: 1,
      layoutName: 'SPLASH',
      silentPage: false,
      characters: [{ id: 'sven-id', name: 'Sven', portraitAssetId: 'port-sven' }],
      panels: [{
        index: 0,
        shotType: 'WIDE SHOT',
        action: 'Sven stands in the forest.',
        characterPositions: [{ name: 'Sven', anchor: '', zone: 'center', depth: 'midground' }],
        text: [{ kind: 'balloon', text: 'Hello!', speakerName: 'Sven', position: 'center', chained: false }]
      }]
    };

    const prompt = buildCompositePrompt(mockContract);

    expect(prompt).toContain('Whenever a named character appears, the attached reference image for that character is the single source of truth for their appearance.');
    expect(prompt).toContain('Match the attached portrait exactly wherever that character appears');
    expect(prompt).toContain('Do not add characters to panels where they are not staged');
    expect(prompt).not.toContain('identical appearance in every panel —');
    expect(prompt).not.toContain('must appear exactly as shown in all panels');
    expect(prompt).not.toContain('declared position');
    const layoutMatches = (prompt.match(/full-page splash/gi) || []).length;
    expect(layoutMatches).toBe(1);
  });

  it('should enforce strict panel-by-panel speaker validation', () => {
    const invalidContract: FinalPageBeat = {
      pageBeatUid: 'pb-123',
      address: 'I1A1S1P1',
      issueUid: 'iss-123',
      sceneUid: 'sc-123',
      panelCount: 1,
      layoutName: 'SPLASH',
      silentPage: false,
      characters: [{ id: 'sven-id', name: 'Sven', portraitAssetId: 'port-sven' }],
      panels: [{
        index: 0,
        shotType: 'WIDE SHOT',
        action: 'A mysterious voice travels through the trees.',
        characterPositions: [],
        text: [{ kind: 'balloon', text: 'Wait for me!', speakerName: 'Sven', position: 'center', chained: false }]
      }]
    };

    const res = validateFinalPage(invalidContract, [], { characterRefs: 1, settingRefs: 1, lockedRefs: 0, priorPages: 0 });
    expect(res.ok).toBe(false);
    expect(res.errors).toContain('Panel 1: speech item for "Sven" exists, but that character is not staged in this panel.');

    const validContract = {
      ...invalidContract,
      panels: [{ ...invalidContract.panels[0], characterPositions: [{ name: 'Sven', anchor: '', zone: 'center', depth: 'midground' }] }]
    };
    const resValid = validateFinalPage(validContract, [], { characterRefs: 1, settingRefs: 1, lockedRefs: 0, priorPages: 0 });
    expect(resValid.errors).not.toContain('Panel 1: speech item for "Sven" exists, but that character is not staged in this panel.');
  });

  it('should sanitize negative prompts correctly on non-silent pages but preserve on silent pages', () => {
    const negativeWithText = 'blurry, poor lighting, extra fingers, text, watermark, logo, letters';
    const nonSilentSanitized = sanitizeNegativePromptForFinalComicPage(negativeWithText, false);
    expect(nonSilentSanitized).toContain('blurry');
    expect(nonSilentSanitized).toContain('poor lighting');
    expect(nonSilentSanitized).not.toContain('text');
    expect(nonSilentSanitized).not.toContain('logo');
    expect(nonSilentSanitized).not.toContain('letters');
    const silentSanitized = sanitizeNegativePromptForFinalComicPage(negativeWithText, true);
    expect(silentSanitized).toBe(negativeWithText);
  });

  // DA-114: Style header now emits STYLE only. LETTERING moved to composite prompt.
  it('should build a style-only header without LETTERING block (DA-114)', () => {
    expect(DEFAULT_LETTERING_STYLE.toLowerCase()).not.toContain('chain');

    const showMock = {
      comicStyle: { artistStyle: 'classic watercolor comic book style', negativePrompt: 'cgi, text, logo, blur' }
    } as any;

    const nonSilentHeader = assembleComicStyleHeader(showMock, false);
    expect(nonSilentHeader).toContain('classic watercolor comic book style');
    expect(nonSilentHeader).not.toContain('Professional comic-book lettering conventions');
    expect(nonSilentHeader).not.toContain('EXCLUDE: cgi, text, logo, blur');
    expect(nonSilentHeader).toContain('EXCLUDE: cgi, blur.');

    const silentHeader = assembleComicStyleHeader(showMock, true);
    expect(silentHeader).toContain('text, logo');
  });

  // DA-114: LETTERING appears exactly once, in the composite prompt.
  it('should include LETTERING exactly once in composite prompt, not in style header', () => {
    const mockContract: FinalPageBeat = {
      pageBeatUid: 'pb-123',
      address: 'I1A1S1P1',
      issueUid: 'iss-123',
      sceneUid: 'sc-123',
      panelCount: 2,
      layoutName: 'EQUAL_CONFRONTATION',
      silentPage: false,
      characters: [],
      panels: [
        { index: 0, shotType: 'MEDIUM SHOT', action: 'A.', characterPositions: [], text: [] },
        { index: 1, shotType: 'CLOSE-UP', action: 'B.', characterPositions: [], text: [] },
      ]
    };

    const composite = buildCompositePrompt(mockContract);
    const styleHeader = assembleComicStyleHeader({ comicStyle: {} } as any, false);

    expect((composite.match(/LETTERING/g) || []).length).toBe(1);
    expect(styleHeader).not.toContain('LETTERING');
    expect(composite).not.toContain('EQUAL_CONFRONTATION');
    expect(composite).toContain('two equal panels');
    expect(composite).not.toContain('declared position');
    expect(composite).not.toContain('ONE PASS');
    expect(composite).not.toContain('FOCAL PANEL');
  });
});
