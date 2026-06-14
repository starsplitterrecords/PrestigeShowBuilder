import { Show } from '../types/models';
import { ShowStorage } from '../storage/ShowStorage';
import { deriveVoiceCard } from '../ai/textGeneration/cardDerivation';
import { migrateShow } from '../storage/migrations';
export { migrateShow };

/**
* D267: derive voiceCard for every character that has a
* voiceProfile but no voiceCard. One-time migration.
* Idempotent — re-runnable safely (skips characters that
* already have a card).
*/
export const migrateVoiceCards = async (): Promise<{
  derived: number; skipped: number; failed: number;
}> => {
  const result = { derived: 0, skipped: 0, failed: 0 };
  const allShows = await ShowStorage.getAll();
  
  for (const show of allShows) {
    let modified = false;
    for (const char of (show.characters || [])) {
      if (char.voiceCard && !char.voiceCardStale) {
        result.skipped++;
        continue;
      }
      if (!char.voiceProfile) {
        result.skipped++;
        continue;
      }
      try {
        const card = await deriveVoiceCard(char, 'paid');
        if (card) {
          char.voiceCard = card;
          char.voiceCardStale = false;
          result.derived++;
          modified = true;
        } else {
          result.failed++;
        }
      } catch (e) {
        console.error(`[D267 migration] derive failed for ${char.handle}:`, e);
        result.failed++;
      }
      // Rate-limit between characters to avoid hammering Gemini
      await new Promise(r => setTimeout(r, 250));
    }
    if (modified) {
      await ShowStorage.saveOne(show);
    }
  }
  
  console.log(`[D267 migration] derived: ${result.derived}, skipped: ${result.skipped}, failed: ${result.failed}`);
  return result;
};
