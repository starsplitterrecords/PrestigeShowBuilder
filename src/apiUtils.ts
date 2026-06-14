import { Show, GenerationLogEntry, TextGenerationLogEntry } from './types/models';
import { GENERATION_LOG_MAX } from './constants/generation.constants';

export const TEXT_LOG_MAX = 500;

export const getApiKey = () => {
  // process.env.API_KEY is the primary key injected by AI Studio after selection
  const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (envKey) return envKey;

  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
    if (customKey) return customKey;
    
    const serverKey = (window as any).SERVER_GEMINI_API_KEY;
    if (serverKey) return serverKey;
  }
  
  return '';
};

export function appendGenerationLog(
  dispatch: any,
  show: Show,
  entry: Omit<GenerationLogEntry, 'id' | 'timestamp'>
): void {
  const newEntry: GenerationLogEntry = {
    id: Math.random().toString(36).substring(2, 11),
    timestamp: Date.now(),
    ...entry,
  };
  const existing = show.generationLog ?? [];
  const updated = [newEntry, ...existing].slice(0, GENERATION_LOG_MAX);
  dispatch({ type: 'UPDATE_SHOW', updates: { generationLog: updated } });
}

export function appendTextGenerationLog(
  dispatch: any,
  show: Show,
  entry: Omit<TextGenerationLogEntry, 'id' | 'timestamp'>
): void {
  const fullEntry: TextGenerationLogEntry = {
    id: `tlog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    ...entry,
  };

  const existing = show.textGenerationLog || [];
  const next = [...existing, fullEntry];

  // Cap with FIFO eviction
  const capped = next.length > TEXT_LOG_MAX
    ? next.slice(next.length - TEXT_LOG_MAX)
    : next;

  dispatch({
    type: 'UPDATE_SHOW',
    updates: { textGenerationLog: capped },
  });
}
