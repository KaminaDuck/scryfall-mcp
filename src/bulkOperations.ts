/**
 * Database bulk operations for the Scryfall card database.
 * 
 * This module provides utilities for bulk operations such as:
 * - Verifying database integrity
 * - Scanning directories for image files
 * - Cleaning the database
 * - Generating reports
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { CardDatabase, createCardDatabase, CardRecord } from './database.js';
import { logger } from './logger.js';

export interface IntegrityResult {
  totalRecords: number;
  missingFiles: number;
}

export interface ScanResult {
  totalFiles: number;
  addedToDb: number;
}

export interface DatabaseReport {
  totalRecords: number;
  missingFiles: number;
  sets: Record<string, number>;
  setDirectories: number;
  totalImages: number;
  databaseCoverage: number;
}

export class BulkOperations {
  private db: CardDatabase | null = null;

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await createCardDatabase();
    }
  }

  /**
   * Verify database integrity by checking if all referenced files exist.
   */
  async verifyDatabaseIntegrity(verbose: boolean = false): Promise<IntegrityResult> {
    await this.init();

    const cards = this.db!.getAllCards();
    const totalRecords = cards.length;
    let missingFiles = 0;

    logger.info(`Verifying ${totalRecords} database records...`);

    for (const card of cards) {
      const filename = card.filename;
      if (!existsSync(filename)) {
        missingFiles++;
        if (verbose) {
          logger.warn(`Missing file: ${filename} for card ${card.card_name}`);
        }
      }
    }

    if (missingFiles === 0) {
      logger.info('All files referenced in the database exist.');
    } else {
      logger.warn(`Found ${missingFiles} missing files out of ${totalRecords} records.`);
    }

    return { totalRecords, missingFiles };
  }

  /**
   * Scan a directory for image files and optionally add them to the database.
   */
  async scanDirectoryForImages(
    directory: string,
    updateDb: boolean = false,
    verbose: boolean = false
  ): Promise<ScanResult> {
    if (!existsSync(directory)) {
      logger.error(`Directory ${directory} does not exist.`);
      return { totalFiles: 0, addedToDb: 0 };
    }

    await this.init();

    let totalFiles = 0;
    let addedToDb = 0;

    logger.info(`Scanning directory ${directory} for image files...`);

    const imageFiles = await this.walkDirectoryForImages(directory);

    for (const filePath of imageFiles) {
      totalFiles++;

      try {
        // Extract set name from directory
        const setName = basename(dirname(filePath)).replace(/_/g, ' ');

        // Extract card name from filename
        const fileName = basename(filePath);
        let cardName = basename(fileName, extname(fileName)).replace(/_/g, ' ');

        // Check if there's a corresponding JSON file with more info
        const jsonFilePath = join(dirname(filePath), `${basename(fileName, extname(fileName))}.json`);
        let cardId: string | undefined;
        let setCode: string | undefined;
        let imageUrl: string | undefined;

        if (existsSync(jsonFilePath)) {
          try {
            const jsonContent = await readFile(jsonFilePath, 'utf-8');
            const cardData = JSON.parse(jsonContent);
            cardId = cardData.id;
            setCode = cardData.set;
            imageUrl = cardData.image_uris?.art_crop;
            // Use the actual card name from the JSON if available
            if (cardData.name) {
              cardName = cardData.name;
            }
          } catch (error) {
            if (verbose) {
              logger.error(`Error parsing JSON file: ${jsonFilePath}`, error);
            }
          }
        }

        // Create a unique identifier for the card
        const cardVersionId = `${cardName}_${setCode || ''}_${cardId || ''}_art_crop`;

        if (updateDb) {
          if (!this.db!.cardExists(cardVersionId)) {
            this.db!.addCard(
              cardVersionId,
              filePath,
              cardId,
              setCode,
              imageUrl
            );
            addedToDb++;
            if (verbose) {
              logger.info(`Added to database: ${filePath}`);
            }
          } else if (verbose) {
            logger.debug(`Already in database: ${filePath}`);
          }
        } else if (verbose) {
          logger.debug(`Found image: ${filePath}`);
        }
      } catch (error) {
        if (verbose) {
          logger.error(`Error processing ${filePath}:`, error);
        }
      }
    }

    logger.info(`Found ${totalFiles} image files.`);
    if (updateDb) {
      logger.info(`Added ${addedToDb} new records to the database.`);
    }

    return { totalFiles, addedToDb };
  }

  /**
   * Recursively walk a directory and find all image files.
   */
  private async walkDirectoryForImages(directory: string): Promise<string[]> {
    const imageFiles: string[] = [];
    const imageExtensions = ['.jpg', '.png', '.jpeg', '.gif'];

    try {
      const entries = await readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(directory, entry.name);

        if (entry.isFile()) {
          const extension = extname(entry.name).toLowerCase();
          if (imageExtensions.includes(extension)) {
            imageFiles.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          const subFiles = await this.walkDirectoryForImages(fullPath);
          imageFiles.push(...subFiles);
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${directory}:`, error);
    }

    return imageFiles;
  }

  /**
   * Clean the database by removing records for files that no longer exist.
   */
  async cleanDatabase(dryRun: boolean = true, verbose: boolean = false): Promise<number> {
    await this.init();

    const cards = this.db!.getAllCards();
    const toRemove: string[] = [];

    logger.info(`Checking ${cards.length} database records for missing files...`);

    for (const card of cards) {
      const filename = card.filename;
      if (!existsSync(filename)) {
        toRemove.push(card.card_name);
        if (verbose) {
          logger.info(`Will remove: ${card.card_name} (file: ${filename})`);
        }
      }
    }

    if (dryRun) {
      logger.info(`Would remove ${toRemove.length} records from the database (dry run).`);
    } else {
      for (const cardName of toRemove) {
        this.db!.removeCard(cardName);
      }
      logger.info(`Removed ${toRemove.length} records from the database.`);
    }

    return toRemove.length;
  }

  /**
   * Generate a comprehensive report on the database status.
   */
  async generateReport(): Promise<DatabaseReport> {
    await this.init();

    const cards = this.db!.getAllCards();
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

    // Check for missing files
    let missingFiles = 0;
    for (const card of cards) {
      if (!existsSync(card.filename)) {
        missingFiles++;
      }
    }

    // Check image directories
    let setDirectories = 0;
    let totalImages = 0;
    const imageDir = '.local/scryfall_images';

    if (existsSync(imageDir)) {
      try {
        const entries = await readdir(imageDir, { withFileTypes: true });
        const setDirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
        setDirectories = setDirs.length;

        // Count image files
        for (const setDir of setDirs) {
          const setPath = join(imageDir, setDir);
          try {
            const files = await readdir(setPath);
            const imageFiles = files.filter(file => {
              const fullPath = join(setPath, file);
              return statSync(fullPath).isFile() && 
                     ['.jpg', '.png', '.jpeg', '.gif'].includes(extname(file).toLowerCase());
            });
            totalImages += imageFiles.length;
          } catch (error) {
            // Ignore errors for individual directories
          }
        }
      } catch (error) {
        logger.error(`Error reading image directory ${imageDir}:`, error);
      }
    }

    const databaseCoverage = totalImages > 0 ? (totalRecords / totalImages) * 100 : 0;

    return {
      totalRecords,
      missingFiles,
      sets,
      setDirectories,
      totalImages,
      databaseCoverage: Math.round(databaseCoverage * 100) / 100
    };
  }

  /**
   * Print a formatted report to the logger.
   */
  async printReport(): Promise<void> {
    const report = await this.generateReport();

    logger.info('\n=== Database Report ===');
    logger.info(`Total records: ${report.totalRecords}`);
    logger.info(`Missing files: ${report.missingFiles}`);
    logger.info('\nRecords by set:');
    
    const sortedSets = Object.entries(report.sets)
      .sort(([, a], [, b]) => b - a);
    
    for (const [setCode, count] of sortedSets) {
      logger.info(`  ${setCode}: ${count}`);
    }

    if (report.setDirectories > 0) {
      logger.info(`\nFound ${report.setDirectories} set directories`);
      logger.info(`Total image files: ${report.totalImages}`);
      logger.info(`Database coverage: ${report.databaseCoverage}% of files are in the database`);
    } else {
      logger.info('\nNo image directories found.');
    }
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Export a singleton instance
export const bulkOperations = new BulkOperations();