/**
 * Database-related MCP tools for the Scryfall server.
 */

import { bulkOperations } from '../bulkOperations.js';
import { logger } from '../logger.js';

export interface DatabaseResult {
  status: 'success' | 'error';
  message?: string;
  total_records?: number;
  missing_files?: number;
  integrity?: boolean;
  total_files?: number;
  added_to_db?: number;
  directory?: string;
  records_removed?: number;
  records_to_remove?: number;
  executed?: boolean;
  sets?: Record<string, number>;
  set_directories?: number;
  total_images?: number;
  database_coverage?: number;
}

/**
 * Verify database integrity by checking if all referenced files exist.
 * Returns response structure matching Python implementation.
 */
export async function mcpVerifyDatabase(): Promise<DatabaseResult> {
  logger.info('[API] Verifying database integrity');

  try {
    const { totalRecords, missingFiles } = await bulkOperations.verifyDatabaseIntegrity(false);

    const result: DatabaseResult = {
      status: 'success',
      total_records: totalRecords,
      missing_files: missingFiles,
      integrity: missingFiles === 0
    };

    logger.info(`[API] Database verification complete: ${totalRecords} total records, ${missingFiles} missing files`);
    return result;
    
  } catch (error: any) {
    logger.error('[Error] Failed to verify database:', error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred during database verification'
    };
  }
}

/**
 * Scan a directory for image files and optionally add them to the database.
 * Returns response structure matching Python implementation.
 */
export async function mcpScanDirectory(
  directory: string,
  updateDb: boolean = false
): Promise<DatabaseResult> {
  logger.info(`[API] Scanning directory: ${directory} (update_db: ${updateDb})`);

  try {
    // Validate input parameters
    if (!directory || directory.trim().length === 0) {
      return {
        status: 'error',
        message: 'Directory path cannot be empty'
      };
    }

    const trimmedDirectory = directory.trim();
    
    const { totalFiles, addedToDb } = await bulkOperations.scanDirectoryForImages(
      trimmedDirectory,
      updateDb,
      false
    );

    const result: DatabaseResult = {
      status: 'success',
      total_files: totalFiles,
      added_to_db: addedToDb,
      directory: trimmedDirectory
    };

    logger.info(`[API] Directory scan complete: ${totalFiles} files found, ${addedToDb} added to database`);
    return result;
    
  } catch (error: any) {
    logger.error(`[Error] Failed to scan directory '${directory}':`, error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred during directory scan'
    };
  }
}

/**
 * Clean the database by removing records for files that no longer exist.
 * Returns response structure matching Python implementation.
 */
export async function mcpCleanDatabase(execute: boolean = false): Promise<DatabaseResult> {
  logger.info(`[API] Cleaning database (execute: ${execute})`);

  try {
    const toRemove = await bulkOperations.cleanDatabase(!execute, false);

    const result: DatabaseResult = {
      status: 'success',
      records_removed: execute ? toRemove : 0,
      records_to_remove: toRemove,
      executed: execute
    };

    if (execute) {
      logger.info(`[API] Database cleanup executed: ${toRemove} records removed`);
    } else {
      logger.info(`[API] Database cleanup dry run: ${toRemove} records would be removed`);
    }
    
    return result;
    
  } catch (error: any) {
    logger.error('[Error] Failed to clean database:', error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred during database cleanup'
    };
  }
}

/**
 * Generate a comprehensive report on the database status.
 * Returns response structure matching Python implementation with same statistics and formatting.
 */
export async function mcpDatabaseReport(): Promise<DatabaseResult> {
  logger.info('[API] Generating database report');

  try {
    const report = await bulkOperations.generateReport();

    const result: DatabaseResult = {
      status: 'success',
      total_records: report.totalRecords,
      missing_files: report.missingFiles,
      sets: report.sets,
      set_directories: report.setDirectories,
      total_images: report.totalImages,
      database_coverage: report.databaseCoverage
    };

    logger.info(`[API] Database report generated: ${report.totalRecords} records, ${report.totalImages} images, ${report.databaseCoverage}% coverage`);
    return result;
    
  } catch (error: any) {
    logger.error('[Error] Failed to generate database report:', error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred during database report generation'
    };
  }
}