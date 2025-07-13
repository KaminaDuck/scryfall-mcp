/**
 * File-serving MCP resources for the Scryfall server.
 */

import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { createFileManager } from '../fileManager.js';
import { createCardDatabase } from '../database.js';
import { logger } from '../logger.js';

/**
 * Serve a downloaded card image by file ID.
 */
export async function serveCardImage(fileId: string): Promise<[Buffer | string, string]> {
  logger.info(`[Resource] Serving card image for file ID: ${fileId}`);

  try {
    const fm = await createFileManager();
    try {
      const result = await fm.readFileContent(fileId);
      if (result) {
        const [content, mimeType] = result;
        return [content, mimeType];
      } else {
        const errorMsg = { status: 'error', message: `File not found for ID: ${fileId}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }
    } finally {
      fm.close();
    }
  } catch (error) {
    logger.error('[Error] Failed to serve card image:', error);
    const errorMsg = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorMsg), 'application/json'];
  }
}

/**
 * Serve a downloaded art crop image by file ID.
 */
export async function serveArtCrop(fileId: string): Promise<[Buffer | string, string]> {
  logger.info(`[Resource] Serving art crop for file ID: ${fileId}`);

  try {
    const fm = await createFileManager();
    try {
      const result = await fm.readFileContent(fileId);
      if (result) {
        const [content, mimeType] = result;
        return [content, mimeType];
      } else {
        const errorMsg = { status: 'error', message: `File not found for ID: ${fileId}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }
    } finally {
      fm.close();
    }
  } catch (error) {
    logger.error('[Error] Failed to serve art crop:', error);
    const errorMsg = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorMsg), 'application/json'];
  }
}

/**
 * Serve metadata JSON file for a downloaded card.
 */
export async function serveMetadata(fileId: string): Promise<[string, string]> {
  logger.info(`[Resource] Serving metadata for file ID: ${fileId}`);

  try {
    const fm = await createFileManager();
    try {
      // Get the card info to find the JSON file
      const info = await fm.getResourceInfo(fileId);
      if (!info) {
        const errorMsg = { status: 'error', message: `Metadata not found for ID: ${fileId}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // For art crops, JSON files are stored alongside the images
      // We need to find the corresponding JSON file
      const db = await createCardDatabase();
      try {
        const cardInfo = db.getCardByFileId(fileId);
        if (cardInfo && cardInfo.card_name.includes('_art_crop')) {
          // This is an art crop, try to find the JSON file
          const imagePath = cardInfo.filename;
          const jsonPath = imagePath.replace(extname(imagePath), '.json');

          if (existsSync(jsonPath)) {
            const content = await readFile(jsonPath, 'utf-8');
            return [content, 'application/json'];
          }
        }

        const errorMsg = { status: 'error', message: `Metadata file not found for ID: ${fileId}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      } finally {
        db.close();
      }
    } finally {
      fm.close();
    }
  } catch (error) {
    logger.error('[Error] Failed to serve metadata:', error);
    const errorMsg = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorMsg), 'application/json'];
  }
}