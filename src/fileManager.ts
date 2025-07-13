/**
 * File management utilities for the Scryfall MCP server.
 */

import { readFile, stat, unlink, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { lookup } from 'mime-types';
import { v4 as uuidv4, validate as isValidUuid } from 'uuid';
import { CardDatabase, createCardDatabase } from './database.js';
import { logger } from './logger.js';

export interface ResourceInfo {
  card_name: string;
  filename: string;
  mime_type: string;
  download_date: string;
  set_code: string;
  card_id: string;
}

export class FileManager {
  private db: CardDatabase | null = null;
  private ownsDb: boolean = false;

  constructor(db?: CardDatabase) {
    this.db = db || null;
    this.ownsDb = !db;
  }

  /**
   * Initialize the file manager with database connection.
   */
  async init(): Promise<void> {
    if (!this.db) {
      this.db = await createCardDatabase();
    }
  }

  /**
   * Generate a unique file ID.
   */
  generateFileId(): string {
    return uuidv4();
  }

  /**
   * Get the file path for a given file ID.
   */
  async getFilePath(fileId: string): Promise<string | undefined> {
    if (!this.db) {
      await this.init();
    }

    const filePath = this.db!.getFilePathById(fileId);
    if (filePath) {
      // Security check: ensure the path exists and is a file
      if (existsSync(filePath)) {
        const stats = statSync(filePath);
        if (stats.isFile()) {
          return filePath;
        }
      }
    }
    return undefined;
  }

  /**
   * Determine the MIME type of a file.
   */
  getMimeType(filePath: string): string {
    const mimeType = lookup(filePath);
    if (mimeType) {
      return mimeType;
    }

    // Default MIME types for common extensions
    const extension = extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };

    return mimeMap[extension] || 'application/octet-stream';
  }

  /**
   * Read file content by file ID with enhanced security and error handling.
   */
  async readFileContent(fileId: string): Promise<[Buffer, string] | undefined> {
    try {
      // Validate access first
      const isAccessAllowed = await this.validateResourceAccess('download/card', fileId);
      if (!isAccessAllowed) {
        logger.warn(`Access denied for file ID: ${fileId}`);
        return undefined;
      }

      const filePath = await this.getFilePath(fileId);
      if (!filePath) {
        logger.warn(`File path not found for file ID: ${fileId}`);
        return undefined;
      }

      // Double-check file exists and is readable
      try {
        await stat(filePath);
      } catch (statError: any) {
        logger.error(`File not accessible: ${filePath} - ${statError.message}`);
        return undefined;
      }

      // Read file content with size validation
      const stats = await stat(filePath);
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit
      if (stats.size > maxFileSize) {
        logger.error(`File size exceeds limit: ${stats.size} bytes for ${filePath}`);
        return undefined;
      }

      const content = await readFile(filePath);
      const mimeType = this.getMimeType(filePath);
      
      logger.info(`Successfully read file: ${basename(filePath)} (${content.length} bytes, ${mimeType})`);
      return [content, mimeType];
      
    } catch (error: any) {
      logger.error(`Failed to read file content for ${fileId}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Register a file in the database and return its file ID with enhanced validation.
   */
  async registerFile(
    filePath: string,
    cardName: string,
    cardId?: string,
    setCode?: string,
    imageUrl?: string
  ): Promise<string> {
    try {
      if (!this.db) {
        await this.init();
      }

      // Validate inputs
      if (!filePath || !cardName) {
        throw new Error('File path and card name are required');
      }

      // Verify file exists before registering
      if (!existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }

      // Validate file is actually a file (not directory)
      const stats = statSync(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Validate file extension
      const extension = extname(filePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.json', '.txt'];
      if (!validExtensions.includes(extension)) {
        logger.warn(`Registering file with unusual extension: ${extension}`);
      }

      const fileId = this.generateFileId();
      
      try {
        this.db!.addCard(
          cardName,
          filePath,
          cardId,
          setCode,
          imageUrl,
          fileId
        );
        
        logger.info(`File registered successfully: ${cardName} -> ${fileId} (${basename(filePath)})`);
        return fileId;
        
      } catch (dbError: any) {
        logger.error(`Database error during file registration: ${dbError.message}`);
        throw new Error(`Failed to register file in database: ${dbError.message}`);
      }
      
    } catch (error: any) {
      logger.error(`Failed to register file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up old temporary files.
   */
  async cleanupTempFiles(directory: string, maxAgeHours: number = 24): Promise<number> {
    if (!existsSync(directory)) {
      return 0;
    }

    let deletedCount = 0;
    const currentTime = Date.now();
    const maxAgeMs = maxAgeHours * 3600 * 1000;

    try {
      const files = await this.walkDirectory(directory);
      
      for (const filePath of files) {
        try {
          const stats = await stat(filePath);
          const fileAge = currentTime - stats.mtime.getTime();
          
          if (fileAge > maxAgeMs) {
            await unlink(filePath);
            deletedCount++;
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
    }

    return deletedCount;
  }

  /**
   * Recursively walk a directory and return all file paths.
   */
  private async walkDirectory(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        
        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Ignore errors for individual directories
    }
    
    return files;
  }

  /**
   * Validate that a resource access is allowed with comprehensive security checks.
   */
  async validateResourceAccess(resourceType: string, fileId: string): Promise<boolean> {
    try {
      // Ensure file_id is a valid UUID format
      if (!isValidUuid(fileId)) {
        logger.warn(`Invalid UUID format for file access: ${fileId}`);
        return false;
      }

      // Validate resource type
      const allowedResourceTypes = ['download/card', 'download/art', 'download/metadata'];
      if (!allowedResourceTypes.includes(resourceType)) {
        logger.warn(`Invalid resource type: ${resourceType}`);
        return false;
      }

      // Check if file exists in database
      if (!this.db) {
        await this.init();
      }

      const cardInfo = this.db!.getCardByFileId(fileId);
      if (!cardInfo) {
        logger.warn(`File ID not found in database: ${fileId}`);
        return false;
      }

      // Check if physical file exists
      const filePath = cardInfo.filename;
      if (!existsSync(filePath)) {
        logger.warn(`Physical file does not exist: ${filePath}`);
        return false;
      }

      // Verify file is within allowed directories
      const resolvedPath = require('path').resolve(filePath);
      const allowedDirs = [
        '/tmp/scryfall_downloads',
        '/tmp/scryfall_fallback',
        process.env['SCRYFALL_DATA_DIR'],
        require('os').tmpdir(),
        require('path').join(require('os').homedir(), '.local')
      ].filter(Boolean);

      const isInAllowedDir = allowedDirs.some(dir => {
        if (!dir) return false;
        const resolvedDir = require('path').resolve(dir);
        return resolvedPath.startsWith(resolvedDir);
      });

      if (!isInAllowedDir) {
        logger.warn(`File path outside allowed directories: ${resolvedPath}`);
        return false;
      }

      // Check file size limits (reasonable limits for card images)
      const stats = statSync(filePath);
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit
      if (stats.size > maxFileSize) {
        logger.warn(`File size exceeds limit: ${stats.size} bytes`);
        return false;
      }

      // Validate file extension for expected content types
      const extension = extname(filePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.json', '.txt'];
      if (!validExtensions.includes(extension)) {
        logger.warn(`Invalid file extension: ${extension}`);
        return false;
      }

      return true;
      
    } catch (error: any) {
      logger.error(`Error validating resource access: ${error.message}`);
      return false;
    }
  }

  /**
   * Get comprehensive information about a resource, matching Python version functionality.
   */
  async getResourceInfo(fileId: string): Promise<ResourceInfo | undefined> {
    try {
      if (!this.db) {
        await this.init();
      }

      // Validate file ID format
      if (!isValidUuid(fileId)) {
        logger.warn(`Invalid UUID format for resource info: ${fileId}`);
        return undefined;
      }

      const cardInfo = this.db!.getCardByFileId(fileId);
      if (!cardInfo) {
        logger.warn(`Card info not found for file ID: ${fileId}`);
        return undefined;
      }

      // Verify physical file exists
      const filePath = cardInfo.filename;
      if (!existsSync(filePath)) {
        logger.warn(`Physical file missing for resource info: ${filePath}`);
        return undefined;
      }

      // Get file stats for additional metadata
      let fileStats;
      try {
        fileStats = await stat(filePath);
      } catch (statError: any) {
        logger.error(`Failed to get file stats: ${statError.message}`);
        return undefined;
      }

      const resourceInfo: ResourceInfo = {
        card_name: cardInfo.card_name,
        filename: basename(cardInfo.filename),
        mime_type: this.getMimeType(cardInfo.filename),
        download_date: cardInfo.download_date,
        set_code: cardInfo.set_code || '',
        card_id: cardInfo.card_id || ''
      };

      // Additional metadata that might be useful
      logger.info(`Resource info retrieved for ${fileId}: ${resourceInfo.card_name} (${resourceInfo.filename})`);
      
      return resourceInfo;
      
    } catch (error: any) {
      logger.error(`Failed to get resource info for ${fileId}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Close the database connection if we own it.
   */
  close(): void {
    if (this.ownsDb && this.db) {
      this.db.close();
    }
  }
}

/**
 * Create a file manager instance with automatic initialization.
 */
export async function createFileManager(db?: CardDatabase): Promise<FileManager> {
  const fm = new FileManager(db);
  await fm.init();
  return fm;
}