import { Show } from '../../types/show';
import { GnPacket } from '../types';
import { GoogleGenAI } from '@google/genai';
import { getApiKey } from '../../domainUtils';

export function autoFillGnPacket(show: Show): Partial<GnPacket> {
  const episodes = show.seasons?.[0]?.episodes || [];
  const issueCount = episodes.length > 0 ? String(episodes.length) : undefined;

  // Tone hint from register
  const toneMap: Record<string, string> = {
    comedy: 'Deadpan / Satirical / Comic',
    drama:  'Dramatic / Grounded / Intense',
    mixed:  'Tonal blend — specify further',
  };
  const tone = show.register ? toneMap[show.register] : undefined;

  // Format from episode count
  let format: string | undefined;
  if (issueCount) {
    format = `${issueCount}-Issue Limited Series`;
  }

  // First scene setting as a seed for the setting field
  const firstSetting = episodes[0]?.acts?.[0]?.scenes?.[0]?.setting;

  const result: Partial<GnPacket> = {};
  if (show.titleSuggestion || show.name) result.title = show.titleSuggestion || show.name;
  if (show.premise)              result.corePremise = show.premise;
  if (tone)                      result.tone = tone;
  if (format)                    result.format = format;
  if (issueCount)                result.issueCount = issueCount;
  if (firstSetting)              result.setting = firstSetting;
  if (show.narrativeMechanism)   result.recurringObjects = undefined; // can't derive
  return result;
}

export interface GnPacketSuggestions {
  genre?: string;
  emotionalQuestion?: string;
  plotQuestion?: string;
  opposingForce?: string;
  comparableWorks?: string;
  visualWorld?: string;
}

export async function generateGnPacketSuggestions(
  show: Show
): Promise<GnPacketSuggestions> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API key is missing or not configured.');
  }
  const ai = new GoogleGenAI({ apiKey });

  const characters = (show.characters || [])
    .slice(0, 8)
    .map(c => `${c.name} (${c.role || c.handle})`)
    .join(', ');

  const prompt = [
    `TITLE: ${show.titleSuggestion || show.name || 'Untitled'}`,
    `REGISTER: ${show.register || 'drama'}`,
    `PREMISE: ${show.premise || ''}`,
    `THEMES: ${show.themes || ''}`,
    show.narrativeMechanism ? `NARRATIVE MECHANISM: ${show.narrativeMechanism}` : '',
    characters ? `CHARACTERS: ${characters}` : '',
    '',
    'Suggest values for these graphic novel development packet fields.',
    'Be specific. One sentence per field. Return only valid JSON, no markdown.',
    'Fields: genre, emotionalQuestion, plotQuestion, opposingForce, comparableWorks, visualWorld',
  ].filter(Boolean).join('\n');

  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error('AI Enhance timed out')), 30_000)
  );
  
  const call = ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  }) as Promise<any>;

  const response = await Promise.race([call, timeout]);
  const text = (response as any).text || '{}';
  try {
    return JSON.parse(text) as GnPacketSuggestions;
  } catch {
    return {};
  }
}
