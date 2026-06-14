import { Parser, registerParser, cleanAndParseJSON } from './index';
import { ArtifactType, SceneScriptPayload, WrittenScene } from '../../types';

export function isCharacterLine(line: string): { isChar: boolean; name: string; paren?: string } {
  const trimmed = line.trim();
  if (!trimmed) return { isChar: false, name: '' };
  if (/^(INT\.|EXT\.|INT\s|EXT\s|INT\/EXT|SCENE)/i.test(trimmed)) return { isChar: false, name: '' };
  
  // Strip parenthetical
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  const cleanLine = trimmed.replace(/\(([^)]+)\)/g, '').trim();
  
  if (!cleanLine) return { isChar: false, name: '' };
  
  const isHandle = cleanLine.startsWith('@') && cleanLine.length > 1 && !/\s/.test(cleanLine);
  if (isHandle) {
    return { isChar: true, name: cleanLine, paren: parenMatch ? parenMatch[1] : undefined };
  }
  
  // Check uppercase, e.g. GUNNAR or CARRIE
  const hasLowercase = /[a-z]/.test(cleanLine);
  const hasUppercase = /[A-Z]/.test(cleanLine);
  if (hasUppercase && !hasLowercase && cleanLine.length < 40) {
    return { isChar: true, name: cleanLine, paren: parenMatch ? parenMatch[1] : undefined };
  }
  
  return { isChar: false, name: '' };
}

export function mapCharacterNameToHandle(name: string, showCharacters?: any[]): { handle?: string; rawName: string } {
  const cleanName = name.replace(/^@/, '').trim();
  const lowerName = cleanName.toLowerCase();
  
  if (showCharacters && Array.isArray(showCharacters)) {
    for (const char of showCharacters) {
      const charId = char.id || char.handle || '';
      const charName = char.name || '';
      
      if (charId.toLowerCase().replace(/^@/, '') === lowerName) {
        return { handle: charId.startsWith('@') ? charId : `@${charId}`, rawName: charName || cleanName };
      }
      if (charName.toLowerCase() === lowerName) {
        return { handle: charId.startsWith('@') ? charId : `@${charId}`, rawName: charName || cleanName };
      }
    }
  }
  
  if (name.startsWith('@') && name.length > 1) {
    return { handle: name, rawName: cleanName };
  }
  
  return { handle: undefined, rawName: cleanName };
}

export function parseScreenplayToScriptUnits(screenplay: string, showCharacters?: any[]): WrittenScene['script'] {
  if (!screenplay) return [];
  
  const lines = screenplay.split(/\r?\n/);
  const units: WrittenScene['script'] = [];
  
  let currentCharacterHandle: string | undefined = undefined;
  let currentCharacterName: string | undefined = undefined;
  let isSpeakerActive = false;
  let currentParen: string | null = null;
  let accumulatedDialogue: string[] = [];
  
  const flushDialogue = () => {
    if (isSpeakerActive && accumulatedDialogue.length > 0) {
      units.push({
        kind: 'line',
        characterHandle: currentCharacterHandle,
        characterName: currentCharacterName,
        parenthetical: currentParen || undefined,
        text: accumulatedDialogue.join(' ').trim(),
        coversBeat: 1
      });
    }
    currentCharacterHandle = undefined;
    currentCharacterName = undefined;
    isSpeakerActive = false;
    currentParen = null;
    accumulatedDialogue = [];
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushDialogue();
      continue;
    }
    
    // Check if it's a scene heading, usually starting with INT. or EXT.
    if (/^(INT\.|EXT\.|INT\s|EXT\s|INT\/EXT|SCENE)/i.test(line)) {
      flushDialogue();
      units.push({
        kind: 'action',
        text: line,
        coversBeat: 1
      });
      continue;
    }
    
    // Check if this line is a character line
    const charCheck = isCharacterLine(line);
    if (charCheck.isChar) {
      flushDialogue();
      const mapped = mapCharacterNameToHandle(charCheck.name, showCharacters);
      currentCharacterHandle = mapped.handle;
      currentCharacterName = mapped.rawName;
      isSpeakerActive = true;
      if (charCheck.paren) {
        currentParen = charCheck.paren;
      }
      continue;
    }
    
    // If we are in character state and line looks like a parenthetical: (dryly)
    if (isSpeakerActive && line.startsWith('(') && line.endsWith(')')) {
      currentParen = line.substring(1, line.length - 1).trim();
      continue;
    }
    
    // Check if it's a caption
    if (line.match(/^\[?CAPTION:/i)) {
      flushDialogue();
      const capText = line.replace(/^\[?CAPTION:\s*/i, '').replace(/\]$/, '').trim();
      units.push({
        kind: 'caption',
        text: capText,
        coversBeat: 1
      });
      continue;
    }
    
    // If we have a speaker active, accumulate dialogue
    if (isSpeakerActive) {
      accumulatedDialogue.push(line);
    } else {
      // It's an action block
      flushDialogue();
      units.push({
        kind: 'action',
        text: line,
        coversBeat: 1
      });
    }
  }
  
  flushDialogue();
  
  return units;
}

export function parseSingleWrittenScene(raw: string | any, defaultActNumber = 1, defaultSceneNumber = 1, showCharacters?: any[]): WrittenScene {
  let d: any;
  if (typeof raw === 'string') {
    const parsed = cleanAndParseJSON<any>(raw);
    if (parsed.ok === false) {
      throw new Error((parsed as any).error || 'Failed to parse JSON');
    }
    d = parsed.payload;
  } else {
    d = raw;
  }

  if (!d || typeof d !== 'object') {
    throw new Error('Not an object');
  }

  const actNumber = d.actNumber !== undefined ? Number(d.actNumber) : defaultActNumber;
  const sceneNumber = d.sceneNumber !== undefined ? Number(d.sceneNumber) : defaultSceneNumber;
  const title = typeof d.title === 'string' ? d.title.trim() : '';
  const setting = typeof d.setting === 'string' ? d.setting.trim() : '';
  const screenplay = typeof d.screenplay === 'string' ? d.screenplay.trim() : '';

  if (!actNumber || Number.isNaN(actNumber)) {
    throw new Error('Scene script validation failed: actNumber is required and must be a valid number.');
  }
  if (!sceneNumber || Number.isNaN(sceneNumber)) {
    throw new Error('Scene script validation failed: sceneNumber is required and must be a valid number.');
  }
  if (!title) {
    throw new Error('Scene script validation failed: title is required and cannot be empty.');
  }
  if (!setting) {
    throw new Error('Scene script validation failed: setting is required and cannot be empty.');
  }

  const rawScript = Array.isArray(d.script) ? d.script : [];
  let script: NonNullable<WrittenScene['script']> = [];

  for (const rawUnit of rawScript) {
    if (!rawUnit || typeof rawUnit !== 'object') continue;

    const text = typeof rawUnit.text === 'string' ? rawUnit.text.trim() : '';
    if (!text) continue; // Drop empty text units

    let kind: 'line' | 'caption' | 'action' = 'action';
    if (rawUnit.kind === 'line') kind = 'line';
    else if (rawUnit.kind === 'caption') kind = 'caption';

    let characterHandle = typeof rawUnit.characterHandle === 'string' ? rawUnit.characterHandle.trim() : undefined;
    if (kind === 'line' && !characterHandle) {
      kind = 'action'; // Coerce line without handle to action
    }

    const parenthetical = typeof rawUnit.parenthetical === 'string' ? rawUnit.parenthetical.trim() : undefined;

    let coversBeat = Number(rawUnit.coversBeat);
    if (!Number.isInteger(coversBeat) || coversBeat < 1) {
      coversBeat = 1;
    }

    script.push({
      kind,
      text,
      characterHandle: kind === 'line' ? characterHandle : undefined,
      parenthetical: kind === 'line' ? parenthetical : undefined,
      coversBeat,
    });
  }

  if (!screenplay && script.length === 0) {
    throw new Error('Scene script validation failed: screenplay is required and cannot be empty.');
  }

  // Fallback if script is empty and screenplay has text
  if (script.length === 0 && screenplay) {
    script = parseScreenplayToScriptUnits(screenplay, showCharacters) || [];
  }

  // If screenplay is empty, but we have some script, reconstruct it as fallback
  let validatedScreenplay = screenplay;
  if (!validatedScreenplay && script.length > 0) {
    validatedScreenplay = script.map(unit => {
      if (unit.kind === 'line') {
        return `${unit.characterHandle ?? 'CHARACTER'}${unit.parenthetical ? ` (${unit.parenthetical})` : ''}\n${unit.text}`;
      } else if (unit.kind === 'caption') {
        return `[CAPTION: ${unit.text}]`;
      } else {
        return unit.text;
      }
    }).join('\n\n');
  }

  return {
    actNumber,
    sceneNumber,
    title,
    setting,
    screenplay: validatedScreenplay,
    script,
  };
}

const parser: Parser<SceneScriptPayload> = {
  id: 'scene_script',
  artifactType: ArtifactType.SCENE_SCRIPT,
  payloadVersion: 1,
  parse(raw) {
    const res = cleanAndParseJSON<any>(raw);
    if (res.ok === false) return { ok: false, error: (res as any).error };
    const d = res.payload;
    if (!d || typeof d !== 'object') return { ok: false, error: 'Not an object' };

    const scenes: WrittenScene[] = [];

    if (Array.isArray(d.scenes)) {
      for (const rawScene of d.scenes) {
        try {
          scenes.push(parseSingleWrittenScene(rawScene));
        } catch (err: any) {
          return {
            ok: false,
            error: `Failed to parse scene in array: ${err.message}`
          };
        }
      }
    } else {
      // Maybe it is a single-scene structure directly
      try {
        scenes.push(parseSingleWrittenScene(d));
      } catch (err: any) {
        return {
          ok: false,
          error: `Expected {scenes: [...]} payload or a single WrittenScene payload: ${err.message}`
        };
      }
    }

    return {
      ok: true,
      payload: { scenes },
    };
  }
};

registerParser(parser);
export default parser;
