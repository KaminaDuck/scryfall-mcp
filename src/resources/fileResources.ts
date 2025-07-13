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
      // Check if this might be a transform card by looking for face 0 by default
      const db = await createCardDatabase();
      let cardInfo;
      try {
        cardInfo = db.getCardByFileId(fileId);
        if (!cardInfo) {
          // Check if there's a face 0 for this base file ID
          const result = await fm.readFileContent(fileId);
          if (result) {
            const [content, mimeType] = result;
            return [content, mimeType];
          } else {
            const errorMsg = { status: 'error', message: `File not found for ID: ${fileId}` };
            return [JSON.stringify(errorMsg), 'application/json'];
          }
        }
        
        // Check if this card is part of a transform card
        const isTransform = db.isTransformCard(cardInfo.card_name);
        if (isTransform) {
          // For transform cards, default to face 0
          return await serveCardImageFace(fileId, 0);
        } else {
          // Single-faced card - use existing behavior
          const result = await fm.readFileContent(fileId);
          if (result) {
            const [content, mimeType] = result;
            return [content, mimeType];
          } else {
            const errorMsg = { status: 'error', message: `File not found for ID: ${fileId}` };
            return [JSON.stringify(errorMsg), 'application/json'];
          }
        }
      } finally {
        db.close();
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
      // Check if this might be a transform card by looking for face 0 by default
      const db = await createCardDatabase();
      let cardInfo;
      try {
        cardInfo = db.getCardByFileId(fileId);
        if (!cardInfo) {
          // Try direct file access
          const result = await fm.readFileContent(fileId);
          if (result) {
            const [content, mimeType] = result;
            return [content, mimeType];
          } else {
            const errorMsg = { status: 'error', message: `File not found for ID: ${fileId}` };
            return [JSON.stringify(errorMsg), 'application/json'];
          }
        }
        
        // Check if this card is part of a transform card
        const isTransform = db.isTransformCard(cardInfo.card_name);
        if (isTransform) {
          // For transform cards, default to face 0
          return await serveArtCropFace(fileId, 0);
        } else {
          // Single-faced card - use existing behavior
          const result = await fm.readFileContent(fileId);
          if (result) {
            const [content, mimeType] = result;
            return [content, mimeType];
          } else {
            const errorMsg = { status: 'error', message: `File not found for ID: ${fileId}` };
            return [JSON.stringify(errorMsg), 'application/json'];
          }
        }
      } finally {
        db.close();
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
      const db = await createCardDatabase();
      try {
        const cardInfo = db.getCardByFileId(fileId);
        if (!cardInfo) {
          const errorMsg = { status: 'error', message: `Metadata not found for ID: ${fileId}` };
          return [JSON.stringify(errorMsg), 'application/json'];
        }
        
        // Check if this card is part of a transform card
        const isTransform = db.isTransformCard(cardInfo.card_name);
        if (isTransform) {
          // For transform cards, default to face 0
          return await serveMetadataFace(fileId, 0);
        } else {
          // Single-faced card - check if it's an art crop
          if (cardInfo.card_name.includes('_art_crop')) {
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
        }
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

/**
 * Serve a specific face of a transform card image by file ID and face index.
 */
export async function serveCardImageFace(fileId: string, faceIndex: number): Promise<[Buffer | string, string]> {
  logger.info(`[Resource] Serving card image face ${faceIndex} for file ID: ${fileId}`);

  try {
    const db = await createCardDatabase();
    try {
      // Get the base card info to determine the card name
      const baseCardInfo = db.getCardByFileId(fileId);
      if (!baseCardInfo) {
        const errorMsg = { status: 'error', message: `Card not found for file ID: ${fileId}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // Get the face-specific card info
      const faceCardInfo = db.getCardFaceInfo(baseCardInfo.card_name, faceIndex);
      if (!faceCardInfo) {
        const errorMsg = { status: 'error', message: `Face ${faceIndex} not found for card: ${baseCardInfo.card_name}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // Use the face-specific file ID to get the content
      const fm = await createFileManager();
      try {
        const result = await fm.readFileContent(faceCardInfo.file_id);
        if (result) {
          const [content, mimeType] = result;
          return [content, mimeType];
        } else {
          const errorMsg = { status: 'error', message: `File not found for face ${faceIndex} of card: ${baseCardInfo.card_name}` };
          return [JSON.stringify(errorMsg), 'application/json'];
        }
      } finally {
        fm.close();
      }
    } finally {
      db.close();
    }
  } catch (error) {
    logger.error(`[Error] Failed to serve card image face ${faceIndex}:`, error);
    const errorMsg = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorMsg), 'application/json'];
  }
}

/**
 * Serve a specific face of a transform card art crop by file ID and face index.
 */
export async function serveArtCropFace(fileId: string, faceIndex: number): Promise<[Buffer | string, string]> {
  logger.info(`[Resource] Serving art crop face ${faceIndex} for file ID: ${fileId}`);

  try {
    const db = await createCardDatabase();
    try {
      // Get the base card info to determine the card name
      const baseCardInfo = db.getCardByFileId(fileId);
      if (!baseCardInfo) {
        const errorMsg = { status: 'error', message: `Card not found for file ID: ${fileId}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // Get the face-specific card info (look for art crop variant)
      const faceCardInfo = db.getCardFaceInfo(baseCardInfo.card_name, faceIndex);
      if (!faceCardInfo) {
        const errorMsg = { status: 'error', message: `Art crop face ${faceIndex} not found for card: ${baseCardInfo.card_name}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // Use the face-specific file ID to get the content
      const fm = await createFileManager();
      try {
        const result = await fm.readFileContent(faceCardInfo.file_id);
        if (result) {
          const [content, mimeType] = result;
          return [content, mimeType];
        } else {
          const errorMsg = { status: 'error', message: `Art crop file not found for face ${faceIndex} of card: ${baseCardInfo.card_name}` };
          return [JSON.stringify(errorMsg), 'application/json'];
        }
      } finally {
        fm.close();
      }
    } finally {
      db.close();
    }
  } catch (error) {
    logger.error(`[Error] Failed to serve art crop face ${faceIndex}:`, error);
    const errorMsg = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorMsg), 'application/json'];
  }
}

/**
 * Serve face-specific metadata for a transform card by file ID and face index.
 */
export async function serveMetadataFace(fileId: string, faceIndex: number): Promise<[string, string]> {
  logger.info(`[Resource] Serving metadata face ${faceIndex} for file ID: ${fileId}`);

  try {
    const db = await createCardDatabase();
    try {
      // Get the base card info to determine the card name
      const baseCardInfo = db.getCardByFileId(fileId);
      if (!baseCardInfo) {
        const errorMsg = { status: 'error', message: `Card not found for file ID: ${fileId}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // Get the face-specific card info
      const faceCardInfo = db.getCardFaceInfo(baseCardInfo.card_name, faceIndex);
      if (!faceCardInfo) {
        const errorMsg = { status: 'error', message: `Metadata face ${faceIndex} not found for card: ${baseCardInfo.card_name}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // Check if this is an art crop (metadata only exists for art crops)
      if (!faceCardInfo.card_name.includes('_art_crop')) {
        const errorMsg = { status: 'error', message: `Metadata is only available for art crop images. Face ${faceIndex} is not an art crop.` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }

      // Find the corresponding JSON file for this face
      const imagePath = faceCardInfo.filename;
      const jsonPath = imagePath.replace(extname(imagePath), '.json');

      if (existsSync(jsonPath)) {
        const content = await readFile(jsonPath, 'utf-8');
        return [content, 'application/json'];
      } else {
        const errorMsg = { status: 'error', message: `Metadata file not found for face ${faceIndex} of card: ${baseCardInfo.card_name}` };
        return [JSON.stringify(errorMsg), 'application/json'];
      }
    } finally {
      db.close();
    }
  } catch (error) {
    logger.error(`[Error] Failed to serve metadata face ${faceIndex}:`, error);
    const errorMsg = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorMsg), 'application/json'];
  }
}