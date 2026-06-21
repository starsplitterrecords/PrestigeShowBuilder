import { describe, it, expect } from 'vitest';
import { renderTextItem, buildCompositePrompt } from '../ai/imageGeneration/finalPagePromptPreview';
import { validateFinalPage, FinalPageBeat } from '../ai/imageGeneration/finalPageContract';
import { sanitizeNegativePromptForFinalComicPage, assembleComicStyleHeader, DEFAULT_LETTERING_STYLE } from '../ai/imageGeneration/comicStyleHeader';

describe('Prompt Regression Tests', () => {

  // Rule 1: No model-facing "chain" word exists in the lettering/joined balloon strings
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

  // Rule 2 & 3: Character references do not say a character appears in all panels universally,
  // and consistency rules constraint appearances to "where they appear"
  it('should contain staged-specific instructions for character portraits and consistency rules', () => {
    const mockContract: FinalPageBeat = {
      pageBeatUid: 'pb-123',
      address: 'I1A1S1P1',
      issueUid: 'iss-123',
      sceneUid: 'sc-123',
      panelCount: 1,
      layoutName: 'SPLASH',
      silentPage: false,
      characters: [
        { id: 'sven-id', name: 'Sven', portraitAssetId: 'port-sven' }
      ],
      panels: [
        {
          index: 0,
          shotType: 'WIDE SHOT',
          action: 'Sven stands in the forest.',
          characterPositions: [
            { name: 'Sven', anchor: '', zone: 'center', depth: 'midground' }
          ],
          text: [
            {
              kind: 'balloon',
              text: 'Hello!',
              speakerName: 'Sven',
              position: 'center',
              chained: false
            }
          ]
        }
      ]
    };

    const prompt = buildCompositePrompt(mockContract);

    // Assert absolute portrait authority wording
    expect(prompt).toContain('Whenever a named character appears, the attached reference image for that character is the single source of truth for their appearance.');
    expect(prompt).toContain('Match the attached portrait exactly wherever that character appears');
    expect(prompt).toContain('Do not add characters to panels where they are not staged');

    // Assert consistency rule says "where they appear"
    expect(prompt).toContain('identical appearance in every panel where they appear');
    expect(prompt).not.toContain('identical appearance in every panel —');
    expect(prompt).not.toContain('must appear exactly as shown in all panels');
  });

  // Rule 4: Speaker must be staged in the exact panel where they speak
  it('should enforce strict panel-by-panel speaker validation', () => {
    const invalidContract: FinalPageBeat = {
      pageBeatUid: 'pb-123',
      address: 'I1A1S1P1',
      issueUid: 'iss-123',
      sceneUid: 'sc-123',
      panelCount: 1,
      layoutName: 'SPLASH',
      silentPage: false,
      characters: [
        { id: 'sven-id', name: 'Sven', portraitAssetId: 'port-sven' }
      ],
      panels: [
        {
          index: 0,
          shotType: 'WIDE SHOT',
          action: 'A mysterious voice travels through the trees.',
          characterPositions: [], // empty! Sven is not staged in this panel
          text: [
            {
              kind: 'balloon',
              text: 'Wait for me!',
              speakerName: 'Sven',
              position: 'center',
              chained: false
            }
          ]
        }
      ]
    };

    const res = validateFinalPage(invalidContract, [], {
      characterRefs: 1,
      settingRefs: 1,
      lockedRefs: 0,
      priorPages: 0
    });

    expect(res.ok).toBe(false);
    expect(res.errors).toContain(
      'Panel 1: speech item for "Sven" exists, but that character is not staged in this panel.'
    );

    // If Sven is added to characterPositions, it must pass
    const validContract = {
      ...invalidContract,
      panels: [
        {
          ...invalidContract.panels[0],
          characterPositions: [
            { name: 'Sven', anchor: '', zone: 'center', depth: 'midground' }
          ]
        }
      ]
    };

    const resValid = validateFinalPage(validContract, [], {
      characterRefs: 1,
      settingRefs: 1,
      lockedRefs: 0,
      priorPages: 0
    });

    expect(resValid.errors).not.toContain(
      'Panel 1: speech item for "Sven" exists, but that character is not staged in this panel.'
    );
  });

  // Rule 6 & 7: Negative prompt sanitization for silent vs. non-silent pages
  it('should sanitize negative prompts correct on non-silent pages but preserve on silent pages', () => {
    const negativeWithText = 'blurry, poor lighting, extra fingers, text, watermark, logo, letters';
    
    // Non-silent page: text-forbidding keywords should be stripped to allow letters to render
    const nonSilentSanitized = sanitizeNegativePromptForFinalComicPage(negativeWithText, false);
    expect(nonSilentSanitized).toContain('blurry');
    expect(nonSilentSanitized).toContain('poor lighting');
    expect(nonSilentSanitized).not.toContain('text');
    expect(nonSilentSanitized).not.toContain('logo');
    expect(nonSilentSanitized).not.toContain('letters');

    // Silent page: text-forbidding keywords must be preserved to prevent accidental lettering
    const silentSanitized = sanitizeNegativePromptForFinalComicPage(negativeWithText, true);
    expect(silentSanitized).toBe(negativeWithText);
  });

  // Rule 8: Preview path and live path use the same style header and default lettering style
  it('should build a consistent style header and avoid chain word in default styling', () => {
    expect(DEFAULT_LETTERING_STYLE.toLowerCase()).not.toContain('chain');
    
    const showMock = {
      comicStyle: {
        artistStyle: 'classic watercolor comic book style',
        negativePrompt: 'cgi, text, logo, blur'
      }
    } as any;

    const nonSilentHeader = assembleComicStyleHeader(showMock, false);
    expect(nonSilentHeader).toContain('classic watercolor comic book style');
    expect(nonSilentHeader).toContain('Professional comic-book lettering conventions');
    expect(nonSilentHeader).not.toContain('EXCLUDE: cgi, text, logo, blur');
    expect(nonSilentHeader).toContain('EXCLUDE: cgi, blur.');

    const silentHeader = assembleComicStyleHeader(showMock, true);
    expect(silentHeader).toContain('text, logo'); // preserved for silent pages
  });
});
