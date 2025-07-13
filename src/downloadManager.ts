/**
 * Download manager for Scryfall card images and art crops.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import fetch from 'node-fetch';
import { scryfallClient, Card } from './scryfallClient.js';
import { CardDatabase, createCardDatabase } from './database.js';
import { getCardImagesDirectory, getArtCropsDirectory } from './config.js';
import { logger } from './logger.js';

export interface DownloadResult {
  cardName: string;
  filePath: string;
  jsonPath?: string;
  face_index?: number;
  face_name?: string;
  total_faces?: number;
  is_transform_card?: boolean;
}

export interface DownloadSummary {
  totalCards: number;
  downloaded: number;
  skipped: number;
  errors: number;
  downloadedFiles: DownloadResult[];
  totalImages?: number;
}

interface ImageUrlInfo {
  url: string;
  faceName: string;
  faceIndex: number;
}

export class DownloadManager {
  private db: CardDatabase | null = null;

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await createCardDatabase();
    }
  }

  /**
   * Extract image URLs from a card, handling both single-faced and multi-faced cards.
   */
  private extractImageUrls(card: Card, imageType: 'large' | 'art_crop'): ImageUrlInfo[] {
    const results: ImageUrlInfo[] = [];

    // Check for single-faced card first
    if (card.image_uris?.[imageType]) {
      results.push({
        url: card.image_uris[imageType],
        faceName: card.name,
        faceIndex: 0
      });
      return results;
    }

    // Check for multi-faced card
    if (card.card_faces && card.card_faces.length > 0) {
      card.card_faces.forEach((face, index) => {
        if (face.image_uris?.[imageType]) {
          results.push({
            url: face.image_uris[imageType],
            faceName: face.name,
            faceIndex: index
          });
        }
      });
    }

    return results;
  }

  /**
   * Download card images for a list of card names.
   */
  async downloadCardImages(
    cardNames: string[],
    forceDownload: boolean = false,
    setCodes?: string[],
    collectorNumbers?: string[],
    baseDir?: string
  ): Promise<DownloadResult[]> {
    await this.init();

    const setCodesArray = setCodes || new Array(cardNames.length).fill(null);
    const collectorNumbersArray = collectorNumbers || new Array(cardNames.length).fill(null);
    
    const summary: DownloadSummary = {
      totalCards: cardNames.length,
      downloaded: 0,
      skipped: 0,
      errors: 0,
      downloadedFiles: [],
      totalImages: 0
    };

    logger.info(`Processing ${cardNames.length} cards for image download...`);

    // Use provided base_dir or get from config
    const outputFolder = baseDir ? 
      join(baseDir, 'scryfall_card_images') : 
      await getCardImagesDirectory();
    
    await mkdir(outputFolder, { recursive: true });

    for (let index = 0; index < cardNames.length; index++) {
      const cardName = cardNames[index];
      const setCode = setCodesArray[index];
      const collectorNumber = collectorNumbersArray[index];

      const cardNameForFilename = (cardName ?? 'unknown').replace(/\s/g, '_').replace(/\/\//g, '_');

      // Create a unique identifier for the card version
      let cardVersionId = cardName;
      if (setCode && collectorNumber) {
        cardVersionId = `${cardName}_${setCode}_${collectorNumber}`;
      }

      // Check if the card exists in the database
      if (cardVersionId && this.db!.cardExists(cardVersionId) && !forceDownload) {
        logger.info(`[${index + 1}/${cardNames.length}] Image for '${cardName}' (${setCode} #${collectorNumber}) already exists, skipping...`);
        summary.skipped++;
        continue;
      }

      try {
        let card: Card;

        // Use the specific set/collector number endpoint if provided
        if (setCode && collectorNumber) {
          logger.info(`[${index + 1}/${cardNames.length}] Fetching specific version: ${setCode} #${collectorNumber}`);
          card = await scryfallClient.getCardBySetAndNumber(setCode.toLowerCase(), collectorNumber);
        } else {
          card = await scryfallClient.getCardByName(cardName ?? 'unknown');
        }

        logger.info(`[${index + 1}/${cardNames.length}] Fetching data for '${cardName}' from Scryfall...`);

        const imageUrls = this.extractImageUrls(card, 'large');

        if (imageUrls.length > 0) {
          const isTransformCard = imageUrls.length > 1;
          logger.info(`[${index + 1}/${cardNames.length}] Found ${imageUrls.length} image(s) for '${cardName}'${isTransformCard ? ' (transform card)' : ''}`);

          let cardDownloaded = false;
          for (const imageInfo of imageUrls) {
            try {
              let imageExtension = extname(imageInfo.url ?? '');
              if (imageInfo.url.includes('?')) {
                const urlBase = imageInfo.url.split('?')[0];
                imageExtension = extname(urlBase ?? '');
              }

              // Generate filename based on whether it's a transform card
              let imageFilename: string;
              let faceCardVersionId: string;
              
              if (isTransformCard) {
                const faceNameForFilename = imageInfo.faceName.replace(/\s/g, '_').replace(/\/\//g, '_');
                if (setCode && collectorNumber) {
                  imageFilename = `${cardNameForFilename}_face${imageInfo.faceIndex}_${faceNameForFilename}_${setCode}_${collectorNumber}${imageExtension}`;
                  faceCardVersionId = `${cardName}_${setCode}_${collectorNumber}_face${imageInfo.faceIndex}`;
                } else {
                  imageFilename = `${cardNameForFilename}_face${imageInfo.faceIndex}_${faceNameForFilename}${imageExtension}`;
                  faceCardVersionId = `${cardName}_face${imageInfo.faceIndex}`;
                }
              } else {
                // Single-faced card - maintain existing pattern for backward compatibility
                if (setCode && collectorNumber) {
                  imageFilename = `${cardNameForFilename}_${setCode}_${collectorNumber}${imageExtension}`;
                  faceCardVersionId = cardVersionId ?? cardName ?? 'unknown';
                } else {
                  imageFilename = `${cardNameForFilename}${imageExtension}`;
                  faceCardVersionId = cardVersionId ?? cardName ?? 'unknown';
                }
              }

              // Check if this specific face already exists
              if (this.db!.cardExists(faceCardVersionId) && !forceDownload) {
                logger.info(`Face ${imageInfo.faceIndex} (${imageInfo.faceName}) already exists, skipping...`);
                continue;
              }

              const imageFilepath = join(outputFolder, imageFilename);

              logger.info(`[${index + 1}/${cardNames.length}] Downloading face ${imageInfo.faceIndex} (${imageInfo.faceName})...`);
              
              const imageResponse = await fetch(imageInfo.url);
              if (!imageResponse.ok) {
                throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
              }

              const imageBuffer = await imageResponse.buffer();
              await writeFile(imageFilepath, imageBuffer);
              logger.info(`Saved to ${imageFilepath}`);

              // Store face-specific database record
              const faceCardName = isTransformCard ? `${cardName} (Face ${imageInfo.faceIndex}: ${imageInfo.faceName})` : cardName;
              this.db!.addCard(
                faceCardVersionId,
                imageFilepath,
                card.id,
                card.set,
                imageInfo.url
              );

              summary.totalImages!++;
              summary.downloadedFiles.push({
                cardName: faceCardName ?? 'unknown',
                filePath: imageFilepath,
                face_index: imageInfo.faceIndex,
                face_name: imageInfo.faceName,
                total_faces: imageUrls.length,
                is_transform_card: isTransformCard
              });
              cardDownloaded = true;
            } catch (faceError) {
              logger.error(`[${index + 1}/${cardNames.length}] Error downloading face ${imageInfo.faceIndex} (${imageInfo.faceName}):`, faceError);
              // Continue with other faces
            }
          }

          if (cardDownloaded) {
            summary.downloaded++;
          } else {
            summary.errors++;
          }
        } else {
          logger.warn(`[${index + 1}/${cardNames.length}] No large image found for '${cardName}'.`);
          summary.errors++;
        }
      } catch (error) {
        logger.error(`[${index + 1}/${cardNames.length}] Error downloading '${cardName}':`, error);
        summary.errors++;
      }

      // Delay between requests (handled by scryfallClient)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.logSummary('Image download', summary);
    return summary.downloadedFiles;
  }

  /**
   * Download art crop images for a list of card names.
   */
  async downloadArtCrops(
    cardNames: string[],
    forceDownload: boolean = false,
    setCodes?: string[],
    collectorNumbers?: string[],
    baseDir?: string
  ): Promise<DownloadResult[]> {
    await this.init();

    const setCodesArray = setCodes || new Array(cardNames.length).fill(null);
    const collectorNumbersArray = collectorNumbers || new Array(cardNames.length).fill(null);
    
    const summary: DownloadSummary = {
      totalCards: cardNames.length,
      downloaded: 0,
      skipped: 0,
      errors: 0,
      downloadedFiles: [],
      totalImages: 0
    };

    logger.info(`Processing ${cardNames.length} cards for art crop download...`);

    // Use provided base_dir or get from config
    const outputFolder = baseDir ? 
      join(baseDir, 'scryfall_images') : 
      await getArtCropsDirectory();
    
    await mkdir(outputFolder, { recursive: true });

    for (let index = 0; index < cardNames.length; index++) {
      const cardName = cardNames[index];
      const setCode = setCodesArray[index];
      const collectorNumber = collectorNumbersArray[index];

      // Create a unique identifier for the card version
      let cardVersionId = `${cardName}_art_crop`;
      if (setCode && collectorNumber) {
        cardVersionId = `${cardName}_${setCode}_${collectorNumber}_art_crop`;
      }

      // Check if the card exists in the database
      if (cardVersionId && this.db!.cardExists(cardVersionId) && !forceDownload) {
        logger.info(`[${index + 1}/${cardNames.length}] Art crop for '${cardName}' (${setCode} #${collectorNumber}) already exists, skipping...`);
        summary.skipped++;
        continue;
      }

      try {
        let card: Card;

        // Use the specific set/collector number endpoint if provided
        if (setCode && collectorNumber) {
          logger.info(`[${index + 1}/${cardNames.length}] Fetching specific version: ${setCode} #${collectorNumber}`);
          card = await scryfallClient.getCardBySetAndNumber(setCode.toLowerCase(), collectorNumber);
        } else {
          card = await scryfallClient.getCardByName(cardName ?? 'unknown');
        }

        logger.info(`[${index + 1}/${cardNames.length}] Fetching data for '${cardName}' from Scryfall...`);

        const imageUrls = this.extractImageUrls(card, 'art_crop');

        if (imageUrls.length > 0) {
          const isTransformCard = imageUrls.length > 1;
          logger.info(`[${index + 1}/${cardNames.length}] Found ${imageUrls.length} art crop(s) for '${cardName}'${isTransformCard ? ' (transform card)' : ''}`);

          // Create a folder for the set
          const setName = (card.set_name || 'unknown_set')
            .replace(/\s/g, '_')
            .replace(/:/g, '_');
          const setFolder = join(outputFolder, setName);
          await mkdir(setFolder, { recursive: true });

          const cardNameForFilename = (cardName ?? 'unknown').replace(/\s/g, '_').replace(/\/\//g, '_');

          let cardDownloaded = false;
          for (const imageInfo of imageUrls) {
            try {
              let imageExtension = extname(imageInfo.url ?? '');
              if (imageInfo.url.includes('?')) {
                const urlBase = imageInfo.url.split('?')[0];
                imageExtension = extname(urlBase ?? '');
              }

              // Generate filename based on whether it's a transform card
              let imageFilename: string;
              let jsonFilename: string;
              let faceCardVersionId: string;
              
              if (isTransformCard) {
                const faceNameForFilename = imageInfo.faceName.replace(/\s/g, '_').replace(/\/\//g, '_');
                if (setCode && collectorNumber) {
                  imageFilename = `${cardNameForFilename}_face${imageInfo.faceIndex}_${faceNameForFilename}_${setCode}_${collectorNumber}${imageExtension}`;
                  jsonFilename = `${cardNameForFilename}_face${imageInfo.faceIndex}_${faceNameForFilename}_${setCode}_${collectorNumber}.json`;
                  faceCardVersionId = `${cardName}_${setCode}_${collectorNumber}_face${imageInfo.faceIndex}_art_crop`;
                } else {
                  imageFilename = `${cardNameForFilename}_face${imageInfo.faceIndex}_${faceNameForFilename}${imageExtension}`;
                  jsonFilename = `${cardNameForFilename}_face${imageInfo.faceIndex}_${faceNameForFilename}.json`;
                  faceCardVersionId = `${cardName}_face${imageInfo.faceIndex}_art_crop`;
                }
              } else {
                // Single-faced card - maintain existing pattern for backward compatibility
                if (setCode && collectorNumber) {
                  imageFilename = `${cardNameForFilename}_${setCode}_${collectorNumber}${imageExtension}`;
                  jsonFilename = `${cardNameForFilename}_${setCode}_${collectorNumber}.json`;
                  faceCardVersionId = cardVersionId ?? `${cardName}_art_crop`;
                } else {
                  imageFilename = `${cardNameForFilename}${imageExtension}`;
                  jsonFilename = `${cardNameForFilename}.json`;
                  faceCardVersionId = cardVersionId ?? `${cardName}_art_crop`;
                }
              }

              // Check if this specific face already exists
              if (this.db!.cardExists(faceCardVersionId) && !forceDownload) {
                logger.info(`Art crop face ${imageInfo.faceIndex} (${imageInfo.faceName}) already exists, skipping...`);
                continue;
              }

              const imageFilepath = join(setFolder, imageFilename);
              const jsonFilepath = join(setFolder, jsonFilename);

              logger.info(`[${index + 1}/${cardNames.length}] Downloading art crop face ${imageInfo.faceIndex} (${imageInfo.faceName})...`);
              
              const imageResponse = await fetch(imageInfo.url);
              if (!imageResponse.ok) {
                throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
              }

              const imageBuffer = await imageResponse.buffer();
              await writeFile(imageFilepath, imageBuffer);
              logger.info(`Saved to ${imageFilepath}`);

              // Store face-specific database record
              const faceCardName = isTransformCard ? `${cardName} (Face ${imageInfo.faceIndex}: ${imageInfo.faceName})` : cardName;
              this.db!.addCard(
                faceCardVersionId,
                imageFilepath,
                card.id,
                card.set,
                imageInfo.url
              );

              // Save card data to JSON file with face-specific information
              await writeFile(jsonFilepath, JSON.stringify(card, null, 4), 'utf-8');

              summary.totalImages!++;
              summary.downloadedFiles.push({
                cardName: faceCardName ?? 'unknown',
                filePath: imageFilepath,
                jsonPath: jsonFilepath,
                face_index: imageInfo.faceIndex,
                face_name: imageInfo.faceName,
                total_faces: imageUrls.length,
                is_transform_card: isTransformCard
              });
              cardDownloaded = true;
            } catch (faceError) {
              logger.error(`[${index + 1}/${cardNames.length}] Error downloading art crop face ${imageInfo.faceIndex} (${imageInfo.faceName}):`, faceError);
              // Continue with other faces
            }
          }

          if (cardDownloaded) {
            summary.downloaded++;
          } else {
            summary.errors++;
          }
        } else {
          logger.warn(`[${index + 1}/${cardNames.length}] No art crop found for '${cardName}'.`);
          summary.errors++;
        }
      } catch (error) {
        logger.error(`[${index + 1}/${cardNames.length}] Error downloading art crop for '${cardName}':`, error);
        summary.errors++;
      }

      // Delay between requests (handled by scryfallClient)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    this.logSummary('Art crop download', summary);
    return summary.downloadedFiles;
  }

  /**
   * Log download summary statistics.
   */
  private logSummary(operation: string, summary: DownloadSummary): void {
    logger.info(`\n${operation} process complete!`);
    logger.info(`Total cards processed: ${summary.totalCards}`);
    logger.info(`Downloaded: ${summary.downloaded}`);
    if (summary.totalImages !== undefined && summary.totalImages !== summary.downloaded) {
      logger.info(`Total images downloaded: ${summary.totalImages}`);
    }
    logger.info(`Skipped (already existed): ${summary.skipped}`);
    logger.info(`Errors encountered: ${summary.errors}`);
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
export const downloadManager = new DownloadManager();