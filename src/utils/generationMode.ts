// src/utils/generationMode.ts

export type GenerationMode = 'free' | 'paid';

export const PRO_MODEL   = 'gemini-3.1-pro-preview';
export const FLASH_MODEL = 'gemini-3-flash-preview';

/**
* Returns the appropriate text model for the current generation mode.
* Call this instead of hardcoding a model string in generation functions.
*
* @param mode - the current generationMode from app state
* @param forceFlash - pass true for tasks that should always use Flash
*   regardless of mode (D143 Flash tasks: direction, bleed palette, etc.)
*/
export const resolveTextModel = (
 mode: GenerationMode,
 forceFlash: boolean = false
): string => {
 if (forceFlash) return FLASH_MODEL;
 return mode === 'free' ? FLASH_MODEL : PRO_MODEL;
};

/**
* Returns true if image or video generation is permitted.
* In free mode, all image and video generation is blocked.
*/
export const canGenerateMedia = (mode: GenerationMode): boolean => {
 return mode === 'paid';
};
