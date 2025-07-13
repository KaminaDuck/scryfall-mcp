/**
 * Database-related MCP resources for the Scryfall server.
 */

import { createCardDatabase } from '../database.js';
import { logger } from '../logger.js';

/**
 * Get statistics about the card database.
 */
export async function databaseStats(): Promise<[string, string]> {
  logger.info('[Resource] Getting database statistics');

  try {
    const db = await createCardDatabase();
    try {
      const cards = db.getAllCards();
      const totalRecords = cards.length;

      // Count by set
      const sets: Record<string, number> = {};
      for (const card of cards) {
        const setCode = card.set_code || 'Unknown';
        if (!sets[setCode]) {
          sets[setCode] = 0;
        }
        sets[setCode]++;
      }

      // Most recent downloads
      const recent = [];
      const sortedCards = cards
        .sort((a, b) => new Date(b.download_date).getTime() - new Date(a.download_date).getTime())
        .slice(0, 5);
      
      for (const card of sortedCards) {
        recent.push({
          card_name: card.card_name,
          download_date: card.download_date
        });
      }

      const stats = {
        total_records: totalRecords,
        sets: Object.fromEntries(
          Object.entries(sets).sort(([, a], [, b]) => b - a)
        ),
        recent_downloads: recent
      };

      return [JSON.stringify(stats, null, 2), 'application/json'];
    } finally {
      db.close();
    }
  } catch (error) {
    logger.error('[Error] Failed to get database stats:', error);
    const errorResponse = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorResponse), 'application/json'];
  }
}