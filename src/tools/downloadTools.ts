/**
 * Download-related MCP tools for the Scryfall server.
 */

import { downloadManager } from '../downloadManager.js';
import { createCardDatabase } from '../database.js';
import { getStorageDirectory } from '../config.js';
import { logger } from '../logger.js';

export interface DownloadResult {
  status: 'success' | 'error';
  message: string;
  filepath?: string;
  card_name?: string;
  set_code?: string;
  collector_number?: string;
  resource_uri?: string;
  metadata_uri?: string;
}

/**
 * Download a high-resolution image of a specific Magic: The Gathering card.
 * Returns response structure matching Python implementation.
 */
export async function mcpDownloadCard(
  cardName: string,
  setCode?: string,
  collectorNumber?: string,
  forceDownload: boolean = false
): Promise<DownloadResult> {
  logger.info(`[API] Downloading card: ${cardName} (Set: ${setCode}, Number: ${collectorNumber})`);

  try {
    // Validate input parameters
    if (!cardName || cardName.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card name cannot be empty'
      };
    }

    const trimmedCardName = cardName.trim();

    // Prepare the parameters for download (matching Python filtering logic)
    const setCodes = setCode ? [setCode.toLowerCase()] : undefined;
    const collectorNumbers = collectorNumber ? [collectorNumber] : undefined;

    // Get the appropriate storage directory (always provide a valid path for MCP mode)
    const baseDir = await getStorageDirectory();

    // Download the card image
    const downloadedFiles = await downloadManager.downloadCardImages(
      [trimmedCardName],
      forceDownload,
      setCodes,
      collectorNumbers,
      baseDir
    );

    if (downloadedFiles.length > 0 && downloadedFiles[0]) {
      // Get the file path and register it for resource serving
      const filePath = downloadedFiles[0].filePath;

      // Generate card version ID matching Python behavior
      let cardVersionId = trimmedCardName;
      if (setCode && collectorNumber) {
        cardVersionId = `${trimmedCardName}_${setCode.toLowerCase()}_${collectorNumber}`;
      }

      const db = await createCardDatabase();
      try {
        const cardInfo = db.getCardInfo(cardVersionId);
        let fileId = cardInfo?.file_id;

        // If no existing record found, register the file and get the file_id
        if (!fileId) {
          // File should already be registered by the download manager, but let's verify
          const newCardInfo = db.getCardInfo(cardVersionId);
          fileId = newCardInfo?.file_id;
        }

        // Build result matching Python implementation structure
        const result: DownloadResult = {
          status: 'success',
          message: `Card '${trimmedCardName}' downloaded successfully`,
          filepath: filePath,
          card_name: trimmedCardName
        };
        
        // Add optional fields only if defined (matching Python conditional assignment)
        if (setCode !== undefined) {
          result.set_code = setCode;
        }
        if (collectorNumber !== undefined) {
          result.collector_number = collectorNumber;
        }

        // Add resource URI if we have a file_id (matching Python resource_uri format)
        if (fileId) {
          result.resource_uri = `resource://download/card/${fileId}`;
        }

        logger.info(`[API] Card download successful: ${trimmedCardName} -> ${fileId || 'no file_id'}`);
        return result;
      } finally {
        db.close();
      }
    } else {
      return {
        status: 'error',
        message: `Failed to download card '${trimmedCardName}' - no files were downloaded`
      };
    }
  } catch (error: any) {
    logger.error(`[Error] Failed to download card '${cardName}':`, error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred during card download'
    };
  }
}

/**
 * Download an art crop image of a specific Magic: The Gathering card.
 * Returns response structure matching Python implementation.
 */
export async function mcpDownloadArtCrop(
  cardName: string,
  setCode?: string,
  collectorNumber?: string,
  forceDownload: boolean = false
): Promise<DownloadResult> {
  logger.info(`[API] Downloading art crop: ${cardName} (Set: ${setCode}, Number: ${collectorNumber})`);

  try {
    // Validate input parameters
    if (!cardName || cardName.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card name cannot be empty'
      };
    }

    const trimmedCardName = cardName.trim();

    // Prepare the parameters for download (matching Python filtering logic)
    const setCodes = setCode ? [setCode.toLowerCase()] : undefined;
    const collectorNumbers = collectorNumber ? [collectorNumber] : undefined;

    // Get the appropriate storage directory (always provide a valid path for MCP mode)
    const baseDir = await getStorageDirectory();

    // Download the art crop
    const downloadedFiles = await downloadManager.downloadArtCrops(
      [trimmedCardName],
      forceDownload,
      setCodes,
      collectorNumbers,
      baseDir
    );

    // Create a unique identifier for the card version (matching Python behavior)
    let cardVersionId = `${trimmedCardName}_art_crop`;
    if (setCode && collectorNumber) {
      cardVersionId = `${trimmedCardName}_${setCode.toLowerCase()}_${collectorNumber}_art_crop`;
    }

    if (downloadedFiles.length > 0 && downloadedFiles[0]) {
      // Get the file paths
      const imagePath = downloadedFiles[0].filePath;
      const jsonPath = downloadedFiles[0].jsonPath;

      // Get file_id from database
      const db = await createCardDatabase();
      try {
        const cardInfo = db.getCardInfo(cardVersionId);
        let fileId = cardInfo?.file_id;

        // If no existing record found, register the file and get the file_id
        if (!fileId) {
          // File should already be registered by the download manager, but let's verify
          const newCardInfo = db.getCardInfo(cardVersionId);
          fileId = newCardInfo?.file_id;
        }

        // Build result matching Python implementation structure
        const result: DownloadResult = {
          status: 'success',
          message: `Art crop for '${trimmedCardName}' downloaded successfully`,
          filepath: imagePath,
          card_name: trimmedCardName
        };
        
        // Add optional fields only if defined (matching Python conditional assignment)
        if (setCode !== undefined) {
          result.set_code = setCode;
        }
        if (collectorNumber !== undefined) {
          result.collector_number = collectorNumber;
        }

        // Add resource URIs if we have file_id (matching Python resource_uri format)
        if (fileId) {
          result.resource_uri = `resource://download/art/${fileId}`;
          // Add metadata_uri if we have JSON metadata
          if (jsonPath) {
            result.metadata_uri = `resource://download/metadata/${fileId}`;
          }
        }

        logger.info(`[API] Art crop download successful: ${trimmedCardName} -> ${fileId || 'no file_id'}`);
        return result;
      } finally {
        db.close();
      }
    } else {
      return {
        status: 'error',
        message: `Failed to download art crop for '${trimmedCardName}' - no files were downloaded`
      };
    }
  } catch (error: any) {
    logger.error(`[Error] Failed to download art crop for '${cardName}':`, error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred during art crop download'
    };
  }
}