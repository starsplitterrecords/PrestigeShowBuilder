import { Episode, Show, Scene, ScriptLine, CinematicBeat } from '../../types/models';
import { resolveLines, resolveCharacter } from '../../domainUtils';

function centerAt(text: string, targetCenter: number): string {
  const padding = Math.max(0, targetCenter - Math.ceil(text.length / 2));
  return ' '.repeat(padding) + text;
}

function wrapAt(text: string, leftMargin: number, rightMargin: number): string {
  const width = rightMargin - leftMargin;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  const padding = ' '.repeat(leftMargin);
  return lines.map(line => padding + line).join('\n');
}

function formatSceneLine(line: ScriptLine, show: Show): string {
  const character = resolveCharacter(show, line.characterHandle);  // D96: suffix matching
  const charName = character ? character.name : line.characterHandle;
  const cue = centerAt(charName.toUpperCase(), 37); // 3.7" at 10 chars/inch
  const parenthetical = line.parenthetical 
    ? centerAt(`(${line.parenthetical})`, 31) 
    : null;
  const dialogue = wrapAt(line.text, 25, 60); // 2.5" left, 6" right = 3.5" wide
  
  return [cue, parenthetical, dialogue].filter(Boolean).join('\n');
}

function formatSlugLine(scene: Scene): string {
  const intExt = scene.isExterior ? 'EXT.' : 'INT.';
  const location = (scene.setting || scene.title).toUpperCase();
  return `${intExt} ${location} — DAY`;
}

function formatActionLine(action: string): string {
  return wrapAt(action, 15, 75); // 1.5" left, 1" right (assuming 8.5" wide page, 85 chars)
}

const numberToWord = (num: number): string => {
  const words = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
  return words[num] || num.toString();
};

export function formatEpisode(episode: Episode, show: Show): string {
  const lines: string[] = [];

  // Title Page
  lines.push('\n'.repeat(20)); // ~1/3 page down
  lines.push(centerAt((show.titleSuggestion || show.name).toUpperCase(), 42));
  lines.push('\n');
  lines.push(centerAt(`"${episode.title.toUpperCase()}"`, 42));
  lines.push('\n'.repeat(2));
  lines.push(centerAt('Written by', 42));
  lines.push('\n');
  lines.push(centerAt('Prestige Show Builder', 42));
  lines.push('\n'.repeat(20));
  lines.push(centerAt('Production Draft', 42));
  lines.push(centerAt(new Date().toLocaleDateString(), 42));
  lines.push('\n'.repeat(5));
  lines.push('               Based on series created by Prestige Show Builder');
  lines.push('\n\f'); // Form feed for new page

  // Body
  for (let aIdx = 0; aIdx < episode.acts.length; aIdx++) {
    const act = episode.acts[aIdx];
    
    // Act Break
    lines.push('\n'.repeat(2));
    if ((act as any).title && (act as any).title.toUpperCase() === 'COLD OPEN') {
      lines.push(centerAt('COLD OPEN', 42));
    } else {
      lines.push(centerAt(`ACT ${numberToWord(act.number)}`, 42));
    }
    lines.push('\n'.repeat(2));

    for (let sIdx = 0; sIdx < act.scenes.length; sIdx++) {
      const scene = act.scenes[sIdx];
      
      lines.push(formatSlugLine(scene));
      lines.push(''); // Blank line after slug

      for (const beat of scene.cinematicBeats) {
        if (beat.description) {
          lines.push(formatActionLine(beat.description));
          lines.push('');
        }
        
        const scriptLines = resolveLines(beat);
        if (scriptLines.length > 0) {
          for (const line of scriptLines) {
            lines.push(formatSceneLine(line, show));
            lines.push('');
          }
        }
      }
    }

    lines.push('\n'.repeat(2));
    if ((act as any).title && (act as any).title.toUpperCase() === 'COLD OPEN') {
      lines.push(centerAt('END OF COLD OPEN', 42));
    } else {
      lines.push(centerAt(`END OF ACT ${numberToWord(act.number)}`, 42));
    }
    lines.push('\n'.repeat(2));
  }

  return lines.join('\n');
}
