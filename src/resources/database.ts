import { CardDatabase } from '../lib/database.js';
import { formatError } from '../lib/utils.js';

export async function getDatabaseStats(): Promise<object> {
  try {
    const database = new CardDatabase();
    
    try {
      const stats = database.getStatistics();
      const recordsBySet = database.getRecordsBySet();
      const recentDownloads = database.getRecentDownloads();

      return {
        object: 'database_stats',
        total_records: stats.totalCards,
        unique_cards: stats.uniqueCards,
        total_sets: stats.totalSets,
        oldest_download: stats.oldestDownload,
        newest_download: stats.newestDownload,
        records_by_set: recordsBySet,
        recent_downloads: recentDownloads,
        sets: recordsBySet
      };
    } finally {
      database.close();
    }

  } catch (error) {
    throw new Error(`Failed to retrieve database statistics: ${formatError(error)}`);
  }
}

export async function getDatabaseReport(): Promise<object> {
  try {
    const database = new CardDatabase();
    
    try {
      const totalRecords = database.getTotalCount();
      const recordsBySet = database.getRecordsBySet();
      const recentDownloads = database.getRecentDownloads();
      const statistics = database.getStatistics();

      return {
        object: 'database_report',
        total_records: totalRecords,
        records_by_set: recordsBySet,
        recent_downloads: recentDownloads,
        statistics: {
          total_cards: statistics.totalCards,
          unique_cards: statistics.uniqueCards,
          total_sets: statistics.totalSets,
          oldest_download: statistics.oldestDownload,
          newest_download: statistics.newestDownload
        },
        sets: recordsBySet
      };
    } finally {
      database.close();
    }

  } catch (error) {
    throw new Error(`Failed to generate database report: ${formatError(error)}`);
  }
}

export async function getCardInfo(cardName: string, setCode?: string): Promise<object> {
  try {
    if (!cardName || cardName.trim().length === 0) {
      throw new Error('Card name is required');
    }

    const database = new CardDatabase();
    
    try {
      const cardInfo = database.getCardInfo(cardName.trim(), setCode);

      if (!cardInfo) {
        throw new Error(`Card not found in database: ${cardName}${setCode ? ` in set ${setCode}` : ''}`);
      }

      return {
        object: 'card_info',
        ...cardInfo
      };
    } finally {
      database.close();
    }

  } catch (error) {
    throw new Error(`Failed to retrieve card info: ${formatError(error)}`);
  }
}

export async function searchDatabaseCards(query: string): Promise<object> {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    const database = new CardDatabase();
    
    try {
      const results = database.searchCards(query.trim());

      return {
        object: 'list',
        total_cards: results.length,
        data: results
      };
    } finally {
      database.close();
    }

  } catch (error) {
    throw new Error(`Database search failed: ${formatError(error)}`);
  }
}

export async function getCardsBySet(setCode: string): Promise<object> {
  try {
    if (!setCode || setCode.trim().length === 0) {
      throw new Error('Set code is required');
    }

    const database = new CardDatabase();
    
    try {
      const cards = database.getCardsBySet(setCode.trim());

      return {
        object: 'list',
        total_cards: cards.length,
        set_code: setCode.trim(),
        data: cards
      };
    } finally {
      database.close();
    }

  } catch (error) {
    throw new Error(`Failed to retrieve cards by set: ${formatError(error)}`);
  }
}

export async function getAllCards(): Promise<object> {
  try {
    const database = new CardDatabase();
    
    try {
      const cards = database.getAllCards();

      return {
        object: 'list',
        total_cards: cards.length,
        data: cards
      };
    } finally {
      database.close();
    }

  } catch (error) {
    throw new Error(`Failed to retrieve all cards: ${formatError(error)}`);
  }
}