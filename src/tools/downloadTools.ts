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
  face_index?: number | undefined;
  face_name?: string | undefined;
  total_faces?: number | undefined;
  is_transform_card?: boolean | undefined;
  faces?: DownloadResult[];
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

    if (downloadedFiles.length > 0) {
      const isTransformCard = downloadedFiles.length > 1;
      const db = await createCardDatabase();
      
      try {
        if (isTransformCard) {
          // Handle transform card with multiple faces
          const faces: DownloadResult[] = [];
          let hasError = false;
          
          for (const file of downloadedFiles) {
            try {
              // Generate face-specific card version ID
              let faceCardVersionId: string;
              if (setCode && collectorNumber) {
                faceCardVersionId = `${trimmedCardName}_${setCode.toLowerCase()}_${collectorNumber}_face${file.face_index}`;
              } else {
                faceCardVersionId = `${trimmedCardName}_face${file.face_index}`;
              }
              
              const cardInfo = db.getCardInfo(faceCardVersionId);
              const fileId = cardInfo?.file_id;
              
              const faceResult: DownloadResult = {
                status: 'success',
                message: `Face ${file.face_index} (${file.face_name}) downloaded successfully`,
                filepath: file.filePath,
                card_name: file.cardName,
                face_index: file.face_index,
                face_name: file.face_name,
                total_faces: file.total_faces,
                is_transform_card: file.is_transform_card
              };
              
              // Add optional fields
              if (setCode !== undefined) {
                faceResult.set_code = setCode;
              }
              if (collectorNumber !== undefined) {
                faceResult.collector_number = collectorNumber;
              }
              
              // Add resource URI if we have a file_id
              if (fileId) {
                faceResult.resource_uri = `resource://download/card/${fileId}`;
              }
              
              faces.push(faceResult);
            } catch (faceError) {
              logger.error(`Error processing face ${file.face_index}:`, faceError);
              hasError = true;
              faces.push({
                status: 'error',
                message: `Failed to process face ${file.face_index} (${file.face_name})`,
                face_index: file.face_index,
                face_name: file.face_name
              });
            }
          }
          
          // Return main result with faces array
          const result: DownloadResult = {
            status: hasError ? 'error' : 'success',
            message: hasError 
              ? `Transform card '${trimmedCardName}' partially downloaded (some faces failed)`
              : `Transform card '${trimmedCardName}' downloaded successfully (${faces.length} faces)`,
            card_name: trimmedCardName,
            total_faces: downloadedFiles[0]?.total_faces,
            is_transform_card: true,
            faces: faces
          };
          
          // Add optional fields
          if (setCode !== undefined) {
            result.set_code = setCode;
          }
          if (collectorNumber !== undefined) {
            result.collector_number = collectorNumber;
          }
          
          logger.info(`[API] Transform card download completed: ${trimmedCardName} -> ${faces.length} faces`);
          return result;
        } else {
          // Handle single-faced card (backward compatibility)
          const file = downloadedFiles[0];
          const filePath = file!.filePath;

          // Generate card version ID matching Python behavior
          let cardVersionId = trimmedCardName;
          if (setCode && collectorNumber) {
            cardVersionId = `${trimmedCardName}_${setCode.toLowerCase()}_${collectorNumber}`;
          }

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
        }
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

    if (downloadedFiles.length > 0) {
      const isTransformCard = downloadedFiles.length > 1;
      const db = await createCardDatabase();
      
      try {
        if (isTransformCard) {
          // Handle transform card with multiple faces
          const faces: DownloadResult[] = [];
          let hasError = false;
          
          for (const file of downloadedFiles) {
            try {
              // Generate face-specific card version ID
              let faceCardVersionId: string;
              if (setCode && collectorNumber) {
                faceCardVersionId = `${trimmedCardName}_${setCode.toLowerCase()}_${collectorNumber}_face${file.face_index}_art_crop`;
              } else {
                faceCardVersionId = `${trimmedCardName}_face${file.face_index}_art_crop`;
              }
              
              const cardInfo = db.getCardInfo(faceCardVersionId);
              const fileId = cardInfo?.file_id;
              
              const faceResult: DownloadResult = {
                status: 'success',
                message: `Art crop face ${file.face_index} (${file.face_name}) downloaded successfully`,
                filepath: file.filePath,
                card_name: file.cardName,
                face_index: file.face_index,
                face_name: file.face_name,
                total_faces: file.total_faces,
                is_transform_card: file.is_transform_card
              };
              
              // Add optional fields
              if (setCode !== undefined) {
                faceResult.set_code = setCode;
              }
              if (collectorNumber !== undefined) {
                faceResult.collector_number = collectorNumber;
              }
              
              // Add resource URIs if we have a file_id
              if (fileId) {
                faceResult.resource_uri = `resource://download/art/${fileId}`;
                // Add metadata_uri if we have JSON metadata
                if (file.jsonPath) {
                  faceResult.metadata_uri = `resource://download/metadata/${fileId}`;
                }
              }
              
              faces.push(faceResult);
            } catch (faceError) {
              logger.error(`Error processing art crop face ${file.face_index}:`, faceError);
              hasError = true;
              faces.push({
                status: 'error',
                message: `Failed to process art crop face ${file.face_index} (${file.face_name})`,
                face_index: file.face_index,
                face_name: file.face_name
              });
            }
          }
          
          // Return main result with faces array
          const result: DownloadResult = {
            status: hasError ? 'error' : 'success',
            message: hasError 
              ? `Transform card art crops for '${trimmedCardName}' partially downloaded (some faces failed)`
              : `Transform card art crops for '${trimmedCardName}' downloaded successfully (${faces.length} faces)`,
            card_name: trimmedCardName,
            total_faces: downloadedFiles[0]?.total_faces,
            is_transform_card: true,
            faces: faces
          };
          
          // Add optional fields
          if (setCode !== undefined) {
            result.set_code = setCode;
          }
          if (collectorNumber !== undefined) {
            result.collector_number = collectorNumber;
          }
          
          logger.info(`[API] Transform card art crop download completed: ${trimmedCardName} -> ${faces.length} faces`);
          return result;
        } else {
          // Handle single-faced card (backward compatibility)
          const file = downloadedFiles[0];
          const imagePath = file!.filePath;
          const jsonPath = file!.jsonPath;

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
        }
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