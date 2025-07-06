import { databaseOperations } from '../lib/database-operations.js';
import { CardDatabase } from '../lib/database.js';
import { formatError } from '../lib/utils.js';
import { ToolResponse } from '../types.js';

export async function mcp_verify_database(): Promise<ToolResponse> {
  try {
    const verification = await databaseOperations.verifyDatabaseIntegrity();

    return {
      status: 'success',
      message: `Database verification completed: ${verification.verifiedRecords} verified, ${verification.missingFiles.length} missing files`,
      verified_records: verification.verifiedRecords,
      missing_files: verification.missingFiles,
      data: {
        total_records: verification.totalRecords,
        verified_records: verification.verifiedRecords,
        missing_files: verification.missingFiles,
        orphaned_files: verification.orphanedFiles,
        corrupted_metadata: verification.corruptedMetadata
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Database verification failed: ${formatError(error)}`
    };
  }
}

export async function mcp_scan_directory(): Promise<ToolResponse> {
  try {
    const scanResult = await databaseOperations.scanDirectoryForImages();

    return {
      status: 'success',
      message: `Directory scan completed: ${scanResult.addedRecords} new records added from ${scanResult.totalFiles} files`,
      data: {
        added_records: scanResult.addedRecords,
        total_files: scanResult.totalFiles,
        skipped_files: scanResult.skippedFiles,
        error_files: scanResult.errorFiles
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Directory scan failed: ${formatError(error)}`
    };
  }
}

export async function mcp_clean_database(): Promise<ToolResponse> {
  try {
    const cleanupResult = await databaseOperations.cleanDatabase();

    return {
      status: 'success',
      message: `Database cleanup completed: ${cleanupResult.cleanedRecords} records cleaned`,
      cleaned_records: cleanupResult.cleanedRecords,
      data: {
        cleaned_records: cleanupResult.cleanedRecords,
        removed_files: cleanupResult.removedFiles,
        errors: cleanupResult.errors
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Database cleanup failed: ${formatError(error)}`
    };
  }
}

export async function mcp_database_report(): Promise<ToolResponse> {
  try {
    const report = await databaseOperations.generateDatabaseReport();

    return {
      status: 'success',
      message: `Database report generated: ${report.totalRecords} total records across ${report.statistics.totalSets} sets`,
      total_records: report.totalRecords,
      records_by_set: report.recordsBySet,
      recent_downloads: report.recentDownloads,
      sets: report.sets,
      missing_files: report.missingFiles,
      data: {
        total_records: report.totalRecords,
        records_by_set: report.recordsBySet,
        recent_downloads: report.recentDownloads,
        statistics: report.statistics,
        sets: report.sets,
        missing_files: report.missingFiles,
        directory_structure: report.directoryStructure
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Database report failed: ${formatError(error)}`
    };
  }
}

export async function mcp_get_card_info(cardName: string, setCode?: string): Promise<ToolResponse> {
  try {
    if (!cardName || cardName.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card name is required'
      };
    }

    const database = new CardDatabase();
    const cardInfo = database.getCardInfo(cardName.trim(), setCode);
    database.close();

    if (!cardInfo) {
      return {
        status: 'error',
        message: `Card not found in database: ${cardName}${setCode ? ` in set ${setCode}` : ''}`
      };
    }

    return {
      status: 'success',
      message: `Retrieved card info for ${cardName}`,
      data: cardInfo
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Failed to retrieve card info: ${formatError(error)}`
    };
  }
}

export async function mcp_search_database(query: string): Promise<ToolResponse> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        status: 'error',
        message: 'Search query is required'
      };
    }

    const database = new CardDatabase();
    const results = database.searchCards(query.trim());
    database.close();

    return {
      status: 'success',
      message: `Found ${results.length} cards matching "${query}"`,
      count: results.length,
      data: results
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Database search failed: ${formatError(error)}`
    };
  }
}

export async function mcp_remove_card(cardName: string, setCode?: string): Promise<ToolResponse> {
  try {
    if (!cardName || cardName.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card name is required'
      };
    }

    const database = new CardDatabase();
    const success = database.removeCard(cardName.trim(), setCode);
    database.close();

    if (success) {
      return {
        status: 'success',
        message: `Removed card from database: ${cardName}${setCode ? ` in set ${setCode}` : ''}`
      };
    } else {
      return {
        status: 'error',
        message: `Card not found in database: ${cardName}${setCode ? ` in set ${setCode}` : ''}`
      };
    }

  } catch (error) {
    return {
      status: 'error',
      message: `Failed to remove card: ${formatError(error)}`
    };
  }
}

export async function mcp_get_database_stats(): Promise<ToolResponse> {
  try {
    const database = new CardDatabase();
    const stats = database.getStatistics();
    const recordsBySet = database.getRecordsBySet();
    const recentDownloads = database.getRecentDownloads();
    database.close();

    return {
      status: 'success',
      message: `Database statistics retrieved`,
      total_records: stats.totalCards,
      records_by_set: recordsBySet,
      recent_downloads: recentDownloads,
      sets: recordsBySet,
      data: {
        total_cards: stats.totalCards,
        unique_cards: stats.uniqueCards,
        total_sets: stats.totalSets,
        oldest_download: stats.oldestDownload,
        newest_download: stats.newestDownload,
        records_by_set: recordsBySet,
        recent_downloads: recentDownloads
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Failed to retrieve database statistics: ${formatError(error)}`
    };
  }
}