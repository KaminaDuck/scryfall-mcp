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
}

export interface DownloadSummary {
  totalCards: number;
  downloaded: number;
  skipped: number;
  errors: number;
  downloadedFiles: DownloadResult[];
}

export class DownloadManager {
  private db: CardDatabase | null = null;

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await createCardDatabase();
    }
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
      downloadedFiles: []
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

        const largeImageUrl = card.image_uris?.large;

        if (largeImageUrl) {
          let imageExtension = extname(largeImageUrl ?? '');
          if (largeImageUrl.includes('?')) {
            const urlBase = largeImageUrl.split('?')[0];
            imageExtension = extname(urlBase ?? '');
          }

          // Include set code and collector number in filename if available
          let imageFilename: string;
          if (setCode && collectorNumber) {
            imageFilename = `${cardNameForFilename}_${setCode}_${collectorNumber}${imageExtension}`;
          } else {
            imageFilename = `${cardNameForFilename}${imageExtension}`;
          }

          const imageFilepath = join(outputFolder, imageFilename);

          logger.info(`[${index + 1}/${cardNames.length}] Downloading large image for '${cardName}'...`);
          
          const imageResponse = await fetch(largeImageUrl);
          if (!imageResponse.ok) {
            throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
          }

          const imageBuffer = await imageResponse.buffer();
          await writeFile(imageFilepath, imageBuffer);
          logger.info(`Saved to ${imageFilepath}`);

          // Add the card to the database with the version identifier
          if (cardVersionId) {
            this.db!.addCard(
              cardVersionId,
              imageFilepath,
              card.id,
              card.set,
              largeImageUrl
            );
          }

          summary.downloaded++;
          summary.downloadedFiles.push({
            cardName: cardName ?? 'unknown',
            filePath: imageFilepath
          });
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
      downloadedFiles: []
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

        const artCropUrl = card.image_uris?.art_crop;

        if (artCropUrl) {
          // Create a folder for the set
          const setName = (card.set_name || 'unknown_set')
            .replace(/\s/g, '_')
            .replace(/:/g, '_');
          const setFolder = join(outputFolder, setName);
          await mkdir(setFolder, { recursive: true });

          // Prepare the filename
          const cardNameForFilename = (cardName ?? 'unknown').replace(/\s/g, '_').replace(/\/\//g, '_');
          let imageExtension = extname(artCropUrl ?? '');
          if (artCropUrl.includes('?')) {
            const urlBase = artCropUrl.split('?')[0];
            imageExtension = extname(urlBase ?? '');
          }

          // Include set code and collector number in filename if available
          let imageFilename: string;
          if (setCode && collectorNumber) {
            imageFilename = `${cardNameForFilename}_${setCode}_${collectorNumber}${imageExtension}`;
          } else {
            imageFilename = `${cardNameForFilename}${imageExtension}`;
          }

          const imageFilepath = join(setFolder, imageFilename);

          logger.info(`[${index + 1}/${cardNames.length}] Downloading art crop for '${cardName}'...`);
          
          const imageResponse = await fetch(artCropUrl);
          if (!imageResponse.ok) {
            throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
          }

          const imageBuffer = await imageResponse.buffer();
          await writeFile(imageFilepath, imageBuffer);
          logger.info(`Saved to ${imageFilepath}`);

          // Add the card to the database with the version identifier
          if (cardVersionId) {
            this.db!.addCard(
              cardVersionId,
              imageFilepath,
              card.id,
              card.set,
              artCropUrl
            );
          }

          summary.downloaded++;

          // Save card data to JSON file
          const jsonFilename = `${cardNameForFilename}.json`;
          const jsonFilepath = join(setFolder, jsonFilename);
          await writeFile(jsonFilepath, JSON.stringify(card, null, 4), 'utf-8');

          summary.downloadedFiles.push({
            cardName: cardName ?? 'unknown',
            filePath: imageFilepath,
            jsonPath: jsonFilepath
          });
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