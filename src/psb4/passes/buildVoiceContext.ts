export function buildVoiceContext(
  show: {
    characters?: Array<{
      id?: string;
      handle?: string;
      name?: string;
      role?: string | null;
      voiceProfile?: string | null;
      voiceConstraints?: string | null;
    }>;
  },
  handles?: string[]
): string {
  const norm = (h: string) => h.replace(/^@/, '').toLowerCase();
  const want = handles ? new Set(handles.map(norm)) : null;
  const cast = (show.characters ?? []).filter(c => {
    const hand = c.handle ?? c.id ?? '';
    return !want || want.has(norm(hand));
  });
  if (!cast.length) return '';

  const blocks = cast.map(c => {
    const hand = c.handle ?? c.id ?? '';
    const lines = [`${hand} — ${c.name ?? ''}${c.role ? ` (${c.role})` : ''}`];
    if (c.voiceProfile) lines.push(`  Voice: ${c.voiceProfile}`);
    if (c.voiceConstraints) lines.push(`  Constraints: ${c.voiceConstraints}`);
    return lines.join('\n');
  });

  return `=== CHARACTER VOICES ===\n` +
    `Write each character strictly in their established voice below. ` +
    `These voices are distinct on purpose — a reader should be able to tell ` +
    `who is speaking from the words alone, without the name.\n\n` +
    blocks.join('\n\n');
}
