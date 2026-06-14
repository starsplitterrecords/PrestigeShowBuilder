import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "../../domainUtils";
import { resolveTextModel, GenerationMode } from "../../utils/generationMode";
import { withRetry } from "../geminiClient";
import { Character } from "../../types/models";

/**
* D267: derive a short dialogue-relevant voice card from a
* character's long-form voiceProfile. Result is ~100 chars,
* focused on HOW the character speaks (not why), suitable for
* injection into dialogue generation prompts.
*
* Returns null if voiceProfile is empty or derivation fails.
* Caller should handle null by falling back to role.
*/
export const deriveVoiceCard = async (
 character: Character,
 mode: GenerationMode = 'paid'
): Promise<string | null> => {
 if (!character.voiceProfile || character.voiceProfile.trim().length < 10) {
   return null;
 }
 
 return withRetry(async () => {
   const ai = new GoogleGenAI({ apiKey: getApiKey() });
   const modelId = resolveTextModel(mode);
 
   const prompt = `
Extract the dialogue-relevant voice guidance from this character's
voiceProfile. Produce ONE short line, max 100 characters, that
captures HOW this character speaks. Focus on speech rhythm, word
choice, and verbal habits. Skip psychology, motivation, or backstory.
 
CHARACTER: ${character.name} (${character.handle})
ROLE: ${character.role}
VOICE PROFILE:
${character.voiceProfile}
 
Return ONLY the one-line card. No quotes, no preamble, no explanation.
If the profile contains explicit speech-pattern guidance, extract that.
If it's mostly psychology, infer the speech pattern from context.
Examples of good cards:
 - "listens, answers once. doesn't introduce himself."
 - "acts before finishing the thought. pushes conversations further."
 - "fills silence until people react."
`;
 
   const response = await ai.models.generateContent({
     model: modelId,
     contents: prompt,
   });
 
   const text = response.text?.trim();
   if (!text || text.length < 5) return null;
 
   // Strip surrounding quotes if model added them
   const cleaned = text
     .replace(/^["“‘]/, '')
     .replace(/["”’]$/, '')
     .trim();
 
   // Cap at 120 chars defensively (target is 100)
   return cleaned.slice(0, 120);
 });
};
