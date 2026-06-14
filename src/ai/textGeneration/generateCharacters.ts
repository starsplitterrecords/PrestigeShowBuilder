import { Show, Character, CinematicBeat, LockedReferenceType } from "../../types/models";
import { GoogleGenAI } from "@google/genai";
import { getDynamicSystemInstruction } from "../../aiConstants";
import { resolveCharacter, getApiKey } from "../../domainUtils";
import { withRetry } from "../geminiClient";
import { schemas } from "../../utils/prompts/prompts";
import { getProjectDNA } from "./context";
import { CHARACTER_SUMMARY_TASK, PORTRAIT_ANALYSIS_FIELDS, MINE_CHARACTER_TASK1, MINE_CHARACTER_TASK2 } from "../../constants/prompts/textGenPrompts";

import { resolveTextModel, GenerationMode } from "../../utils/generationMode";

export const generateCharacterSummary = async (
  show: Show,
  char: Partial<Character>,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<{ summary: string; visualAnchor: string }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);

    const prompt = `
BUILD FULL CHARACTER PROFILE: ${char.name} (${char.handle})

KNOWN FROM SOURCE:
Role: ${char.role}
Physical: ${char.physicalDescription || 'Not described in source'}
Casting: ${char.castingNotes || 'Not specified'}
Voice: ${char.voiceProfile || 'Not specified'}
Arc: ${char.evolution || 'Not specified'}

${CHARACTER_SUMMARY_TASK}
`;
    const fullPrompt = `${getProjectDNA(show)}\n\n${prompt}`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json',
        responseSchema: schemas.characterSummary,
      },
    });

    const text = response.text;
    if (!text) throw new Error(`Empty response from AI for ${char.name}`);

    if (onLog) {
      onLog({ prompt: fullPrompt, response: text, model: modelId });
    }

    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || '',
      visualAnchor: parsed.visualAnchor || '',
    };
  });
};

export interface FullCharacterProfile {
  summary: string;           // full production narrative
  physicalDescription: string;  // casting DNA prose
  visualAnchor: string;      // image-generation compact descriptor
  castingNotes: string;      // real-world casting vision
  evolution: string;         // arc across the season/series
}

export const generateFullCharacterProfile = async (
  show: Show,
  seed: {
    name: string;
    handle: string;
    role: string;
    brief?: string;  // optional: a sentence or two from the author
    isMinor?: boolean;
  },
  mode: GenerationMode = "paid",
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<FullCharacterProfile> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);

    // Build ensemble context so the new character fits the existing cast
    const existingCast = show.characters
      .filter(c => c.id !== undefined)
      .map(c => `${c.name} (${c.handle}) — ${c.role}`)
      .join("\n");

    const prompt = [
      `CREATE NEW CHARACTER: ${seed.name} (${seed.handle})`,
      `Role: ${seed.role}`,
      seed.brief ? `Author description: ${seed.brief}` : "",
      "",
      "EXISTING ENSEMBLE (do not duplicate their traits):",
      existingCast || "None yet.",
      "",
      "Generate a complete character profile.",
      "This character must feel native to the show world. Distinct from",
      "every existing cast member.",
      "",
      "Return JSON with these five fields:",
      "summary: Full production narrative. Snapshot, physicality, interiority,",
      "  voice, relationships, and arc. 200-350 words.",
      "physicalDescription: Casting DNA. Physical type, age range, screen presence.",
      "  What genre does this body belong in? 60-100 words.",
      "visualAnchor: Compact image-generation descriptor. Face shape, hair",
      "  (color/texture/length), eye color, skin tone, build, 1-2 defining",
      "  features, default costume silhouette. No psychology. 80-120 words.",
      "castingNotes: Real-world casting vision. Comps, analogues, notes for",
      "  a casting director. 40-80 words.",
      "evolution: How this character changes across the story. What do they",
      "  want vs need? What do they believe at the start and what do they learn?",
      "  2-3 sentences.",
    ].filter(Boolean).join("\n");

    const fullPrompt = `${getProjectDNA(show)}\n\n${prompt}`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: "application/json",
        responseSchema: schemas.fullCharacterProfile,
      },
    });

    const text = response.text;
    if (!text) throw new Error(`Empty profile response for ${seed.name}`);

    if (onLog) {
      onLog({ prompt: fullPrompt, response: text, model: modelId });
    }

    return JSON.parse(text) as FullCharacterProfile;
  });
};

export interface PortraitAnalysis {
  visualAnchor?: string;
  physicalDescription?: string;
  castingNotes?: string;
}

export const analyzePortraitImage = async (file: File, characterName: string, show: Show, mode: GenerationMode = 'paid'): Promise<PortraitAnalysis | null> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.replace(/^data:image\/\w+;base64,/, ''));
      };
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(file);
    });

    const mimeType = (file.type || 'image/jpeg') as any;

    const prompt = [
      `This is a reference image for a character named ${characterName} from "${show.titleSuggestion || show.name}".`,
      `Their role in the show: ${resolveCharacter(show, characterName)?.role || 'unknown'}.`,
      '',
      PORTRAIT_ANALYSIS_FIELDS,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: resolveTextModel(mode, true),
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt },
        ]
      }
    });

    const text = response.text?.trim();
    if (!text) return null;

    try {
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(clean);
      return {
        ...(parsed.visualAnchor ? { visualAnchor: parsed.visualAnchor } : {}),
        ...(parsed.physicalDescription ? { physicalDescription: parsed.physicalDescription } : {}),
        ...(parsed.castingNotes ? { castingNotes: parsed.castingNotes } : {}),
      };
    } catch {
      return null;
    }
  });
};

export const mineCharacterSummary = async (
  show: Show,
  char: Partial<Character>,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<{ summary: string; visualAnchor: string }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode);

    const sourceKnowledge = [
      char.role        ? `ROLE: ${char.role}` : '',
      char.physicalDescription ? `SOURCE DESCRIPTION: ${char.physicalDescription}` : '',
      char.evolution   ? `ARC (from source): ${char.evolution}` : '',
      char.voiceProfile ? `VOICE (from source): ${char.voiceProfile}` : '',
      char.castingNotes ? `CASTING (from source): ${char.castingNotes}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `
GENERATE FULL CHARACTER PROFILE: ${char.name} (${char.handle})

WHAT THE SOURCE DOCUMENT SAYS ABOUT THIS CHARACTER:
${sourceKnowledge || 'Minimal — character is referenced but not described in detail.'}

SHOW CONTEXT:
Title: ${show.titleSuggestion || show.name}
Premise: ${show.premise}
Themes: ${show.themes}
World: ${show.styleConfig.positivePrompt}

${MINE_CHARACTER_TASK1}

${MINE_CHARACTER_TASK2}
`;

    const fullPrompt = `${getProjectDNA(show)}\n\n${prompt}`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
      config: {
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json',
        responseSchema: schemas.characterSummary,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');

    if (onLog) {
      onLog({ prompt: fullPrompt, response: text, model: modelId });
    }

    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || '',
      visualAnchor: parsed.visualAnchor || '',
    };
  });
};

export const generateCharacterVoiceProfile = async (
  show: Show,
  char: Partial<Character>,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
    const knownData = [
      char.role ? `Role: ${char.role}` : '',
      char.summary ? `Profile: ${char.summary.substring(0, 400)}` : '',
      char.evolution ? `Arc: ${char.evolution}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `
Write a VOICE PROFILE for ${char.name} (${char.handle}) from ${show.titleSuggestion || show.name}.

${knownData}

A voice profile describes how this character speaks — not what they say.
Include: sentence rhythm, vocabulary range, verbal habits under pressure,
what they reach for when nervous, when they speak in full sentences vs fragments,
whether they finish others's thoughts or leave their own unfinished.

Do NOT list personality traits. Do NOT describe their arc.
Only describe the SOUND and RHYTHM of how they speak.

One compact paragraph, 40-60 words. No label, no preamble.
`.trim();

    const fullPrompt = `${getProjectDNA(show)}\n\n${prompt}`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
      config: { systemInstruction: getDynamicSystemInstruction(show) },
    });

    const text = response.text?.trim() || '';
    if (onLog) {
      onLog({ prompt: fullPrompt, response: text, model: modelId });
    }
    return text;
  });
};

export const generateBleedPalette = async (
  show: Show,
  char: Partial<Character>,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<string> => {
  if (!char.isProtagonist) return '';
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
    const prompt = `
SHOW: ${show.titleSuggestion || show.name}
PREMISE: ${show.premise}
CHARACTER: ${char.name} (${char.handle})
ROLE: ${char.role}
PROFILE: ${(char.summary || char.physicalDescription || '').substring(0, 300)}

This character experiences involuntary memory bleeds — visions of an ancient war
that intrude into their present-day reality.

Propose a COLOR PALETTE for how their bleeds are rendered in watercolor.
The palette should feel like it belongs to what THEY specifically remember:
their emotional relationship to the visions, their faction, their psychological state.

Return a SHORT COLOR DESCRIPTION only — 3 to 6 words.
Examples: "deep violet and cold iron blue"
          "amber embers and bleached bone"
          "saturated cyan and pale ash"

No preamble. No explanation. Just the color description.
`.trim();

    const fullPrompt = `${getProjectDNA(show)}\n\n${prompt}`;
    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
    });
    const text = response.text?.trim() || '';
    if (onLog) {
      onLog({ prompt: fullPrompt, response: text, model: modelId });
    }
    return text;
  });
};

export const classifyProtagonists = async (
  show: Show,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<Record<string, boolean>> => {
  // Returns a map of character id -> isProtagonist
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
    const charList = show.characters.map(c =>
      `${c.name} (${c.handle}) — ${c.role}: ${(c.summary || c.physicalDescription || '').substring(0, 150)}`
    ).join('\n');

    const prompt = `
SHOW: ${show.titleSuggestion || show.name}
PREMISE: ${show.premise}

ENSEMBLE:
${charList}

Identify which characters are PRESENT-DAY PROTAGONISTS.
A present-day protagonist is a character who:
  — exists in the current timeline of the story
  — actively experiences the show's central mechanism (memory, haunting, vision, etc.)
  — is one of the 2-4 characters whose present-day journey IS the show

Return a JSON object: { "handle": true/false } for every character.
Champions, historical figures, antagonists, and background characters are false.
Do not invent characters. Only classify what is listed above.
`.trim();

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text;
    if (onLog) {
      onLog({ prompt, rawResponse: text || '', model: modelId });
    }

    const parsed = JSON.parse(text || '{}');
    const result: Record<string, boolean> = {};
    for (const char of show.characters) {
      const handle = char.handle;
      const shortHandle = handle.split('.').pop() ?? handle;
      result[char.id] = parsed[handle] ?? parsed[shortHandle] ?? false;
    }
    return result;
  });
};

export interface ReferenceCandidate {
  label: string;
  type: LockedReferenceType;
  imagePrompt: string;
  description: string;
}

export const scanWorldElements = async (
  show: Show,
  mode: GenerationMode = 'paid'
): Promise<ReferenceCandidate[]> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const prompt = `
READ SHOW BIBLE AND SETTING ANCHORS.
PROPOSE 4-6 SPECIFIC VISUAL ELEMENTS WORTH LOCKING AS REFERENCES.

FOCUS ON:
- Named locations (e.g. "The Iron Spire", "Sector 7 Market")
- Recurring props (e.g. "Standard Issue Pulse Rifle", "The Ancient Map")
- Costume details (e.g. "High Command Uniform", "Scavenger Rags")
- Specific color palettes or textures (e.g. "Neon-Drenched Rain", "Rusted Industrial")

RETURN JSON ARRAY OF OBJECTS:
{
  "label": "Short name",
  "type": "environment" | "prop" | "minor-character" | "costume" | "palette" | "other",
  "imagePrompt": "Detailed visual prompt for image generation",
  "description": "Brief explanation of why this is a key reference"
}

DO NOT invent elements not supported by the bible.
`.trim();

    const response = await ai.models.generateContent({
      model: resolveTextModel(mode, true), // Use Flash for extraction
      contents: `${getProjectDNA(show)}\n\n${prompt}`,
      config: { 
        systemInstruction: getDynamicSystemInstruction(show),
        responseMimeType: 'application/json'
      },
    });

    const text = response.text;
    if (!text) return [];
    try {
      return JSON.parse(text) as ReferenceCandidate[];
    } catch (e) {
      console.error("Failed to parse scanWorldElements response", e);
      return [];
    }
  });
};

export const generateVoiceConstraints = async (
  show: Show,
  char: Partial<Character>,
  mode: GenerationMode = 'paid',
  onLog?: (log: { prompt: string; rawResponse?: string; response?: string; model: string }) => void
): Promise<string> => {
  // Only skip if voiceProfile is completely absent.
  // Short profiles are valid -- do not apply a length threshold.
  if (!char.voiceProfile?.trim()) return "";
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const modelId = resolveTextModel(mode, true);
    const prompt = `
Read this voice profile for ${char.name}:
${char.voiceProfile}

Identify the "HOW" of this character's speech.
Include:
  - Specific phrases they use
  - Idiosyncracies in how they speak
  - Rhythms or vocabulary that distinguish them from others

Write it as 1-2 sentences that provide a hard constraint for dialogue generation.
Examples:
  "ALWAYS uses technical jargon and metrics; NEVER uses emotional adjectives."
  "Speaks in short, clipped fragments; frequently uses the phrase 'As expected' to dismiss others."
  "Speaks in present-tense absolutes; NEVER uses conditional words like 'might' or 'perhaps'."

One sentence only. No preamble.
`.trim();

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    const text = response.text?.trim() || '';
    if (onLog) {
      onLog({ prompt, rawResponse: text, model: modelId });
    }
    return text;
  });
};

// ... character establishment generators (D272: narrow cleanup)
