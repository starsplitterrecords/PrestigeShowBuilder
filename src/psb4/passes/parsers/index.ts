import { ArtifactType } from '../../types';

export type ParseResult<T> =
  | { ok: true; payload: T }
  | { ok: false; error: string };

export type Parser<T> = {
  id: string;
  artifactType: ArtifactType;
  payloadVersion: number;
  parse: (raw: string) => ParseResult<T>;
};

const parsers: Record<string, Parser<any>> = {};

export function registerParser<T>(parser: Parser<T>) {
  parsers[parser.id] = parser;
}

export function getParser(id: string): Parser<any> | null {
  return parsers[id] ?? null;
}

export function repairAndCleanJSONString(str: string): string {
  let clean = str.trim();
  
  // Normalize smart quotes
  clean = clean
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if ((c === '}' && top === '{') || (c === ']' && top === '[')) {
          stack.pop();
        } else {
          stack.pop();
        }
      }
    }
  }

  // Repair unclosed string
  if (inString) {
    clean += '"';
  }

  // Complete trailing colon value
  const strippedEnd = clean.trim();
  if (strippedEnd.endsWith(':')) {
    clean = clean + ' ""';
  }

  // Close open brackets/braces
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === '{') {
      clean += '}';
    } else if (top === '[') {
      clean += ']';
    }
  }

  // Strip JS-only tokens
  clean = clean
    .replace(/:\s*undefined\b/g, ': null')
    .replace(/:\s*NaN\b/g, ': null')
    .replace(/:\s*Infinity\b/g, ': null');

  // Strip trailing commas before closing symbols
  clean = clean.replace(/,\s*([}\]])/g, '$1');

  return clean;
}

/**
 * Defensive utility to extract and clean JSON strings from LLM outputs.
 */
export function cleanAndParseJSON<T>(raw: string): ParseResult<T> {
  try {
    let clean = raw.trim();

    // 1. Prefer ```json fence specifically — skips any plain ``` blocks
    //    that appear earlier in the response (e.g. from conversation history).
    const jsonFenceIdx = clean.indexOf('```json');
    if (jsonFenceIdx !== -1) {
      const afterOpening = clean.indexOf('\n', jsonFenceIdx);
      if (afterOpening !== -1) {
        const closingFence = clean.indexOf('```', afterOpening + 1);
        if (closingFence !== -1) {
          clean = clean.substring(afterOpening + 1, closingFence).trim();
        } else {
          // Truncated closing fence - just strip the opening fence!
          clean = clean.substring(afterOpening + 1).trim();
        }
      } else {
        clean = clean.substring(jsonFenceIdx + 7).trim();
      }
    } else {
      // Fallback: generic fence
      const fenceMatch = /```\s*([\s\S]*?)\s*```/i.exec(clean);
      if (fenceMatch) {
        clean = fenceMatch[1].trim();
      }
    }

    // Try Tier 1: direct parse on the cleaned fence-stripped text
    const directClean = clean
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/:\s*undefined\b/g, ': null')
      .replace(/:\s*NaN\b/g, ': null')
      .replace(/:\s*Infinity\b/g, ': null')
      .replace(/,\s*([}\]])/g, '$1');

    try {
      const parsed = JSON.parse(directClean);
      return { ok: true, payload: parsed };
    } catch (_) {
      // Fall through to balanced braces extraction
    }

    // 2. Extract the first complete top-level JSON object or array
    //    using balanced braces. lastIndexOf('}') is wrong when }
    //    appears inside string values or trailing metadata.
    let extracted = clean;
    const firstOpen = clean.search(/[{[]/);
    if (firstOpen !== -1) {
      const opener = clean[firstOpen];
      const closer = opener === '{' ? '}' : ']';
      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;
      for (let i = firstOpen; i < clean.length; i++) {
        const c = clean[i];
        if (escape) { escape = false; continue; }
        if (c === '\\' && inString) { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === opener || (opener === '{' && c === '[') || (opener === '[' && c === '{')) depth++;
        else if (c === closer || (closer === '}' && c === ']') || (closer === ']' && c === '}')) {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end !== -1) {
        extracted = clean.substring(firstOpen, end + 1);
      } else {
        extracted = clean.substring(firstOpen);
      }
    }

    // Try Tier 2: balanced-braces JSON parse
    const processedExtracted = extracted
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/:\s*undefined\b/g, ': null')
      .replace(/:\s*NaN\b/g, ': null')
      .replace(/:\s*Infinity\b/g, ': null')
      .replace(/,\s*([}\]])/g, '$1');

    try {
      const parsed = JSON.parse(processedExtracted);
      return { ok: true, payload: parsed };
    } catch (_) {
      // Fall through to repair
    }

    // Try Tier 3: self-closed repaired JSON parse
    const repaired = repairAndCleanJSONString(extracted);
    const parsedRepaired = JSON.parse(repaired);
    return { ok: true, payload: parsedRepaired };

  } catch (err) {
    return {
      ok: false,
      error: `JSON parsing failed: ${err instanceof Error ? err.message : String(err)}. Raw substring was: ${raw.slice(0, 500)}...`
    };
  }
}
