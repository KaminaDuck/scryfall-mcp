import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { CONFIG } from '../config.js';
import { CardDatabase } from './database.js';
import { DatabaseCard } from '../types.js';
import { formatError, getCurrentISODateTime } from './utils.js';

export interface DatabaseVerificationResult {
  verifiedRecords: number;
  missingFiles: string[];
  orphanedFiles: string[];
  corruptedMetadata: string[];
  totalRecords: number;
}

export interface DatabaseScanResult {
  addedRecords: number;
  skippedFiles: string[];
  errorFiles: string[];
  totalFiles: number;
}

export interface DatabaseCleanupResult {
  cleanedRecords: number;
  removedFiles: string[];
  errors: string[];
}

export interface DatabaseReport {
  totalRecords: number;
  recordsBySet: Record<string, number>;
  recentDownloads: Array<{
    card_name: string;
    download_date: string;
    set_code: string;
  }>;
  statistics: {
    uniqueCards: number;
    totalSets: number;
    oldestDownload: string | null;
    newestDownload: string | null;
    totalFileSize: number;
    averageFileSize: number;
  };
  sets: Record<string, number>;
  missingFiles: string[];
  directoryStructure: {
    cardImages: {
      totalFiles: number;
      totalSize: number;
    };
    artCrops: {
      totalFiles: number;
      totalSize: number;
      setDirectories: string[];
    };
  };
}

export class DatabaseOperations {
  private database: CardDatabase;

  constructor(database?: CardDatabase) {
    this.database = database || new CardDatabase();
  }

  async verifyDatabaseIntegrity(): Promise<DatabaseVerificationResult> {
    const allCards = this.database.getAllCards();
    const verifiedRecords: number[] = [];
    const missingFiles: string[] = [];
    const orphanedFiles: string[] = [];
    const corruptedMetadata: string[] = [];

    // Check each database record
    for (const card of allCards) {
      const fullPath = this.getFullFilePath(card);
      
      if (existsSync(fullPath)) {
        verifiedRecords.push(card.id);
      } else {
        missingFiles.push(card.filename);
      }
    }

    // Check for orphaned files
    const cardImagesFiles = this.scanDirectory(CONFIG.CARD_IMAGES_DIR);
    const artCropsFiles = this.scanDirectoryRecursive(CONFIG.ART_CROPS_DIR);
    
    const allDatabaseFiles = new Set(allCards.map(card => card.filename));
    
    for (const file of [...cardImagesFiles, ...artCropsFiles]) {
      if (!allDatabaseFiles.has(file)) {
        orphanedFiles.push(file);
      }
    }

    // Check metadata files in art crops directory
    const metadataFiles = this.scanDirectoryRecursive(CONFIG.ART_CROPS_DIR, ['.json']);
    
    for (const metadataFile of metadataFiles) {
      const fullPath = join(CONFIG.ART_CROPS_DIR, metadataFile);
      try {
        const content = readFileSync(fullPath, 'utf8');
        JSON.parse(content);
      } catch (error) {
        corruptedMetadata.push(metadataFile);
      }
    }

    return {
      verifiedRecords: verifiedRecords.length,
      missingFiles,
      orphanedFiles,
      corruptedMetadata,
      totalRecords: allCards.length
    };
  }

  async scanDirectoryForImages(): Promise<DatabaseScanResult> {
    const addedRecords: number[] = [];
    const skippedFiles: string[] = [];
    const errorFiles: string[] = [];
    
    // Scan card images directory
    const cardImagesFiles = this.scanDirectory(CONFIG.CARD_IMAGES_DIR, ['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    
    for (const filename of cardImagesFiles) {
      try {
        const result = await this.addImageToDatabase(filename, false);
        if (result.added) {
          addedRecords.push(result.id!);
        } else {
          skippedFiles.push(filename);
        }
      } catch (error) {
        errorFiles.push(filename);
      }
    }

    // Scan art crops directory
    const artCropsFiles = this.scanDirectoryRecursive(CONFIG.ART_CROPS_DIR, ['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    
    for (const filename of artCropsFiles) {
      try {
        const result = await this.addImageToDatabase(filename, true);
        if (result.added) {
          addedRecords.push(result.id!);
        } else {
          skippedFiles.push(filename);
        }
      } catch (error) {
        errorFiles.push(filename);
      }
    }

    return {
      addedRecords: addedRecords.length,
      skippedFiles,
      errorFiles,
      totalFiles: cardImagesFiles.length + artCropsFiles.length
    };
  }

  async cleanDatabase(): Promise<DatabaseCleanupResult> {
    const cleanedRecords: number[] = [];
    const removedFiles: string[] = [];
    const errors: string[] = [];

    const allCards = this.database.getAllCards();

    for (const card of allCards) {
      const fullPath = this.getFullFilePath(card);
      
      if (!existsSync(fullPath)) {
        try {
          const success = this.database.removeCardById(card.id);
          if (success) {
            cleanedRecords.push(card.id);
            removedFiles.push(card.filename);
          } else {
            errors.push(`Failed to remove database record for ${card.filename}`);
          }
        } catch (error) {
          errors.push(`Error removing record for ${card.filename}: ${formatError(error)}`);
        }
      }
    }

    return {
      cleanedRecords: cleanedRecords.length,
      removedFiles,
      errors
    };
  }

  async generateDatabaseReport(): Promise<DatabaseReport> {
    const totalRecords = this.database.getTotalCount();
    const recordsBySet = this.database.getRecordsBySet();
    const recentDownloads = this.database.getRecentDownloads();
    const statistics = this.database.getStatistics();
    const verification = await this.verifyDatabaseIntegrity();

    // Calculate file sizes
    const cardImagesInfo = this.getDirectoryInfo(CONFIG.CARD_IMAGES_DIR);
    const artCropsInfo = this.getDirectoryInfoRecursive(CONFIG.ART_CROPS_DIR);

    const directoryStructure = {
      cardImages: {
        totalFiles: cardImagesInfo.fileCount,
        totalSize: cardImagesInfo.totalSize
      },
      artCrops: {
        totalFiles: artCropsInfo.fileCount,
        totalSize: artCropsInfo.totalSize,
        setDirectories: artCropsInfo.subdirectories
      }
    };

    return {
      totalRecords,
      recordsBySet,
      recentDownloads,
      statistics: {
        ...statistics,
        totalFileSize: cardImagesInfo.totalSize + artCropsInfo.totalSize,
        averageFileSize: totalRecords > 0 ? 
          (cardImagesInfo.totalSize + artCropsInfo.totalSize) / totalRecords : 0
      },
      sets: recordsBySet,
      missingFiles: verification.missingFiles,
      directoryStructure
    };
  }

  private getFullFilePath(card: DatabaseCard): string {
    // Art crops are stored in subdirectories
    if (card.card_name.endsWith('_art_crop')) {
      return join(CONFIG.ART_CROPS_DIR, card.filename);
    }
    return join(CONFIG.CARD_IMAGES_DIR, card.filename);
  }

  private scanDirectory(dirPath: string, extensions: string[] = []): string[] {
    if (!existsSync(dirPath)) {
      return [];
    }

    const files: string[] = [];
    const items = readdirSync(dirPath);

    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);

      if (stat.isFile()) {
        if (extensions.length === 0 || extensions.includes(extname(item).toLowerCase())) {
          files.push(item);
        }
      }
    }

    return files;
  }

  private scanDirectoryRecursive(dirPath: string, extensions: string[] = []): string[] {
    if (!existsSync(dirPath)) {
      return [];
    }

    const files: string[] = [];
    const items = readdirSync(dirPath);

    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);

      if (stat.isDirectory()) {
        const subFiles = this.scanDirectoryRecursive(itemPath, extensions);
        files.push(...subFiles.map(file => join(item, file)));
      } else if (stat.isFile()) {
        if (extensions.length === 0 || extensions.includes(extname(item).toLowerCase())) {
          files.push(item);
        }
      }
    }

    return files;
  }

  private async addImageToDatabase(
    filename: string, 
    isArtCrop: boolean
  ): Promise<{ added: boolean; id?: number }> {
    // Parse filename to extract card information
    const cardInfo = this.parseFilename(filename, isArtCrop);
    
    // Check if already exists
    const existingCard = this.database.getCardInfo(cardInfo.cardName, cardInfo.setCode);
    if (existingCard) {
      return { added: false };
    }

    // Create database record
    const databaseCard: Omit<DatabaseCard, 'id'> = {
      card_name: cardInfo.cardName,
      filename: filename,
      download_date: getCurrentISODateTime(),
      card_id: cardInfo.cardId || '',
      set_code: cardInfo.setCode || '',
      image_url: ''
    };

    try {
      const id = this.database.addCard(databaseCard);
      return { added: true, id };
    } catch (error) {
      throw new Error(`Failed to add ${filename} to database: ${formatError(error)}`);
    }
  }

  private parseFilename(filename: string, isArtCrop: boolean): {
    cardName: string;
    setCode?: string;
    collectorNumber?: string;
    cardId?: string;
  } {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Handle art crop files
    if (isArtCrop) {
      const parts = nameWithoutExt.split('_');
      if (parts.length >= 3) {
        const cardName = parts.slice(0, -2).join(' ');
        const setCode = parts[parts.length - 2];
        const collectorNumber = parts[parts.length - 1];
        
        return {
          cardName: `${cardName}_art_crop`,
          setCode,
          collectorNumber
        };
      }
    }

    // Handle regular card files
    const parts = nameWithoutExt.split('_');
    if (parts.length >= 3) {
      const cardName = parts.slice(0, -2).join(' ');
      const setCode = parts[parts.length - 2];
      const collectorNumber = parts[parts.length - 1];
      
      return {
        cardName,
        setCode,
        collectorNumber
      };
    }

    // Fallback to just the filename
    return {
      cardName: nameWithoutExt.replace(/_/g, ' ')
    };
  }

  private getDirectoryInfo(dirPath: string): { fileCount: number; totalSize: number } {
    if (!existsSync(dirPath)) {
      return { fileCount: 0, totalSize: 0 };
    }

    let fileCount = 0;
    let totalSize = 0;
    const items = readdirSync(dirPath);

    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);

      if (stat.isFile()) {
        fileCount++;
        totalSize += stat.size;
      }
    }

    return { fileCount, totalSize };
  }

  private getDirectoryInfoRecursive(dirPath: string): { 
    fileCount: number; 
    totalSize: number; 
    subdirectories: string[] 
  } {
    if (!existsSync(dirPath)) {
      return { fileCount: 0, totalSize: 0, subdirectories: [] };
    }

    let fileCount = 0;
    let totalSize = 0;
    const subdirectories: string[] = [];
    const items = readdirSync(dirPath);

    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);

      if (stat.isDirectory()) {
        subdirectories.push(item);
        const subInfo = this.getDirectoryInfoRecursive(itemPath);
        fileCount += subInfo.fileCount;
        totalSize += subInfo.totalSize;
      } else if (stat.isFile()) {
        fileCount++;
        totalSize += stat.size;
      }
    }

    return { fileCount, totalSize, subdirectories };
  }

  close(): void {
    this.database.close();
  }
}

// Export a default instance
export const databaseOperations = new DatabaseOperations();