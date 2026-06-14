import { describe, it, expect } from 'vitest';
import { envRegisterGuidance, pageRegisterGuidance } from '../vps/registerGuidance';

describe('Register-Aware Visual Direction Guidance', () => {
  it('provides correct guidance for "comedy" register', () => {
    const env = envRegisterGuidance('comedy');
    const page = pageRegisterGuidance('comedy');

    expect(env).toContain('deadpan comedy');
    expect(env).toContain('mundane, over-ordinary');
    expect(page).toContain('deadpan comedy');
    expect(page).toContain('symmetry, frontal stillness');
  });

  it('provides correct guidance for "drama" register', () => {
    const env = envRegisterGuidance('drama');
    const page = pageRegisterGuidance('drama');

    expect(env).toContain('war drama');
    expect(env).toContain('weight, history, and damage');
    expect(page).toContain('war drama');
    expect(page).toContain('exhaustion');
  });

  it('provides correct guidance for "mixed" register', () => {
    const env = envRegisterGuidance('mixed');
    const page = pageRegisterGuidance('mixed');

    expect(env).toContain('mixed');
    expect(page).toContain('mixed');
  });

  it('safely returns empty string when register is undefined or unknown', () => {
    expect(envRegisterGuidance(undefined)).toBe('');
    expect(pageRegisterGuidance(undefined)).toBe('');

    expect(envRegisterGuidance('' as any)).toBe('');
    expect(pageRegisterGuidance('' as any)).toBe('');
  });
});
