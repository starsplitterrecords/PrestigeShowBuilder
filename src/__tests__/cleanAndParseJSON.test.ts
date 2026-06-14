import { describe, it, expect } from 'vitest';
import { cleanAndParseJSON } from '../psb4/passes/parsers/index';

describe('cleanAndParseJSON', () => {
  it('parses plain JSON object', () => {
    const r = cleanAndParseJSON('{"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toEqual({ a: 1 });
  });

  it('strips ```json fence', () => {
    const r = cleanAndParseJSON('```json\n{"a":1}\n```');
    expect(r.ok).toBe(true);
  });

  it('uses ```json fence when plain ``` appears before it', () => {
    const raw = '```\nsome prior block\n```\n```json\n{"sections":[{"label":"Ep1"}]}\n```';
    const r = cleanAndParseJSON(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.payload as any).sections).toHaveLength(1);
  });

  it('stops at first complete JSON object (no trailing junk)', () => {
    const raw = '```json\n{"a":1},{"b":2}\n```';
    const r = cleanAndParseJSON(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toEqual({ a: 1 });
  });

  it('strips trailing commas', () => {
    const r = cleanAndParseJSON('{"a":1,}');
    expect(r.ok).toBe(true);
  });

  it('replaces undefined with null', () => {
    const r = cleanAndParseJSON('{"a":undefined}');
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.payload as any).a).toBeNull();
  });

  it('returns ok:false for unrecoverable input', () => {
    const r = cleanAndParseJSON('not json at all');
    expect(r.ok).toBe(false);
  });
});
