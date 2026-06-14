import { describe, it, expect } from 'vitest';
import { buildVoiceContext } from '../psb4/passes/buildVoiceContext';

describe('buildVoiceContext', () => {
  const mockShowFull = {
    characters: [
      {
        handle: '@vps.arvok',
        name: 'Arvok',
        role: 'Chief Science Officer',
        voiceProfile: 'Clinical, hyper-logical, clipped, precise sentences.',
        voiceConstraints: 'Avoid using contractions. Keep statements brief and authoritative.',
      },
      {
        handle: '@vps.lucia',
        name: 'Lucia',
        role: 'Rebel Pilot',
        voiceProfile: 'Passionate, energetic, informal.',
        voiceConstraints: 'Uses slang, enthusiastic punctuation.',
      },
      {
        handle: '@vps.silent',
        name: 'Silent Bob',
        role: 'Mechanic',
      }
    ]
  };

  const mockSourceShow = {
    characters: [
      {
        id: '@vps.arvok',
        name: 'Arvok',
        role: 'Chief Science Officer',
        voiceProfile: 'Clinical, hyper-logical, clipped, precise sentences.',
      },
      {
        id: '@vps.lucia',
        name: 'Lucia',
        role: 'Rebel Pilot',
        voiceProfile: 'Passionate, energetic, informal.',
      }
    ]
  };

  it('formats full character profiles into a legible, structured prompt block', () => {
    const result = buildVoiceContext(mockShowFull);
    expect(result).toContain('=== CHARACTER VOICES ===');
    expect(result).toContain('@vps.arvok — Arvok (Chief Science Officer)');
    expect(result).toContain('Voice: Clinical, hyper-logical');
    expect(result).toContain('Constraints: Avoid using contractions.');
    expect(result).toContain('@vps.lucia — Lucia (Rebel Pilot)');
    expect(result).not.toContain('Silent Bob — Silent Bob (Mechanic)'); // Should have empty body since no voice info is supplied
  });

  it('works with the NormalizedSource.show structure (using id instead of handle, omitting constraints)', () => {
    const result = buildVoiceContext(mockSourceShow);
    expect(result).toContain('=== CHARACTER VOICES ===');
    expect(result).toContain('@vps.arvok — Arvok (Chief Science Officer)');
    expect(result).toContain('Voice: Clinical, hyper-logical');
    expect(result).toContain('@vps.lucia — Lucia (Rebel Pilot)');
  });

  it('applies the optional handles filter correctly', () => {
    // Exact handle case insensitive, with or without leading @
    const result1 = buildVoiceContext(mockShowFull, ['@vps.arvok']);
    expect(result1).toContain('Arvok');
    expect(result1).not.toContain('Lucia');

    const result2 = buildVoiceContext(mockShowFull, ['vps.lucia']);
    expect(result2).toContain('Lucia');
    expect(result2).not.toContain('Arvok');
  });

  it('degrades gracefully to empty string when no characters are matched or provided', () => {
    expect(buildVoiceContext({ characters: [] })).toBe('');
    expect(buildVoiceContext({ characters: undefined as any })).toBe('');
    expect(buildVoiceContext(mockShowFull, ['@vps.nonexistent'])).toBe('');
  });
});
