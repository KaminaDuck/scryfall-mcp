import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CONFIG, ensureDirectoryExists } from '../config.js';
import { CardDatabase } from './database.js';
import { scryfallAPI, ScryfallAPIError } from './scryfall-api.js';
import { 
  generateCardFilename, 
  extractImageExtension, 
  getCurrentISODateTime, 
  formatError,
  validateCardName 
} from './utils.js';
import { DownloadOptions, ScryfallCard } from '../types.js';

export interface DownloadResult {
  success: boolean;
  message: string;
  filepath?: string;
  cardName?: string;
  setCode?: string;
  collectorNumber?: string;
  skipped?: boolean;
  error?: string;
}

export class CardDownloader {
  private database: CardDatabase;

  constructor(database?: CardDatabase) {
    this.database = database || new CardDatabase();
  }

  async downloadCardImages(
    cardNames: string[], 
    options: DownloadOptions = {}
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    
    // Ensure the card images directory exists
    ensureDirectoryExists(CONFIG.CARD_IMAGES_DIR);

    for (const cardName of cardNames) {
      if (!validateCardName(cardName)) {
        results.push({
          success: false,
          message: `Invalid card name: ${cardName}`,
          cardName,
          error: 'Invalid card name'
        });
        continue;
      }

      try {
        const result = await this.downloadSingleCard(cardName, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          message: `Failed to download ${cardName}: ${formatError(error)}`,
          cardName,
          error: formatError(error)
        });
      }
    }

    return results;
  }

  private async downloadSingleCard(
    cardName: string, 
    options: DownloadOptions
  ): Promise<DownloadResult> {
    const { force = false, setCode, collectorNumber } = options;

    // Check if card already exists in database
    if (!force && this.database.cardExists(cardName, setCode, collectorNumber)) {
      const existingCard = this.database.getCardInfo(cardName, setCode);
      if (existingCard) {
        const filepath = join(CONFIG.CARD_IMAGES_DIR, existingCard.filename);
        if (existsSync(filepath)) {
          return {
            success: true,
            message: `Card already downloaded: ${cardName}`,
            filepath,
            cardName,
            setCode: existingCard.set_code,
            skipped: true
          };
        }
      }
    }

    // Fetch card data from Scryfall
    let card: ScryfallCard;
    try {
      if (setCode && collectorNumber) {
        card = await scryfallAPI.getCardBySetAndNumber(setCode, collectorNumber);
      } else if (setCode) {
        card = await scryfallAPI.getCardByName(cardName, setCode);
      } else {
        card = await scryfallAPI.getCardByName(cardName);
      }
    } catch (error) {
      if (error instanceof ScryfallAPIError && error.status === 404) {
        return {
          success: false,
          message: `Card not found: ${cardName}`,
          cardName,
          error: 'Card not found'
        };
      }
      throw error;
    }

    // Get image URIs
    const imageUris = scryfallAPI.getImageUris(card);
    if (!imageUris) {
      return {
        success: false,
        message: `No image available for card: ${cardName}`,
        cardName,
        error: 'No image available'
      };
    }

    // Generate filename
    const baseFilename = generateCardFilename(card, true);
    const imageExtension = extractImageExtension(imageUris.large);
    const filename = `${baseFilename}.${imageExtension}`;
    const filepath = join(CONFIG.CARD_IMAGES_DIR, filename);

    // Download the image
    try {
      const imageBuffer = await scryfallAPI.downloadImage(imageUris.large);
      writeFileSync(filepath, imageBuffer);
    } catch (error) {
      return {
        success: false,
        message: `Failed to download image for ${cardName}: ${formatError(error)}`,
        cardName,
        error: formatError(error)
      };
    }

    // Add to database
    const databaseCard = {
      card_name: card.name,
      filename,
      download_date: getCurrentISODateTime(),
      card_id: card.id,
      set_code: card.set,
      image_url: imageUris.large
    };

    try {
      this.database.addCard(databaseCard);
    } catch (error) {
      // Log the error but don't fail the download
      console.warn(`Failed to add card to database: ${formatError(error)}`);
    }

    return {
      success: true,
      message: `Successfully downloaded ${card.name}`,
      filepath,
      cardName: card.name,
      setCode: card.set,
      collectorNumber: card.collector_number
    };
  }

  async downloadCardsByQuery(
    query: string, 
    options: DownloadOptions = {}
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];

    try {
      const cards = await scryfallAPI.searchCards(query, {
        unique: 'prints',
        order: 'name'
      });

      if (cards.length === 0) {
        return [{
          success: false,
          message: `No cards found for query: ${query}`,
          error: 'No cards found'
        }];
      }

      // Download each card
      for (const card of cards) {
        const cardOptions: DownloadOptions = {
          ...options,
          setCode: card.set,
          collectorNumber: card.collector_number
        };

        try {
          const result = await this.downloadSingleCard(card.name, cardOptions);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            message: `Failed to download ${card.name}: ${formatError(error)}`,
            cardName: card.name,
            error: formatError(error)
          });
        }
      }
    } catch (error) {
      return [{
        success: false,
        message: `Search failed: ${formatError(error)}`,
        error: formatError(error)
      }];
    }

    return results;
  }

  async downloadRandomCard(): Promise<DownloadResult> {
    try {
      const card = await scryfallAPI.getRandomCard();
      return await this.downloadSingleCard(card.name, {});
    } catch (error) {
      return {
        success: false,
        message: `Failed to download random card: ${formatError(error)}`,
        error: formatError(error)
      };
    }
  }

  async getDownloadProgress(results: DownloadResult[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    const total = results.length;
    const successful = results.filter(r => r.success && !r.skipped).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    const errors = results.filter(r => r.error).map(r => r.error!);

    return {
      total,
      successful,
      failed,
      skipped,
      errors
    };
  }

  // Batch download with progress tracking
  async batchDownload(
    cardNames: string[],
    options: DownloadOptions = {},
    progressCallback?: (progress: { current: number; total: number; cardName: string }) => void
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const total = cardNames.length;

    for (let i = 0; i < cardNames.length; i++) {
      const cardName = cardNames[i];
      
      if (progressCallback) {
        progressCallback({ current: i + 1, total, cardName });
      }

      try {
        const result = await this.downloadSingleCard(cardName, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          message: `Failed to download ${cardName}: ${formatError(error)}`,
          cardName,
          error: formatError(error)
        });
      }
    }

    return results;
  }

  close(): void {
    this.database.close();
  }
}

// Export a default instance
export const cardDownloader = new CardDownloader();