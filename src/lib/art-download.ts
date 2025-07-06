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
  validateCardName,
  sanitizeSetName 
} from './utils.js';
import { DownloadOptions, ScryfallCard } from '../types.js';

export interface ArtDownloadResult {
  success: boolean;
  message: string;
  filepath?: string;
  metadataPath?: string;
  cardName?: string;
  setCode?: string;
  collectorNumber?: string;
  skipped?: boolean;
  error?: string;
}

export class ArtDownloader {
  private database: CardDatabase;

  constructor(database?: CardDatabase) {
    this.database = database || new CardDatabase();
  }

  async downloadArtCrops(
    cardNames: string[], 
    options: DownloadOptions = {}
  ): Promise<ArtDownloadResult[]> {
    const results: ArtDownloadResult[] = [];
    
    // Ensure the art crops directory exists
    ensureDirectoryExists(CONFIG.ART_CROPS_DIR);

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
        const result = await this.downloadSingleArtCrop(cardName, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          message: `Failed to download art crop for ${cardName}: ${formatError(error)}`,
          cardName,
          error: formatError(error)
        });
      }
    }

    return results;
  }

  private async downloadSingleArtCrop(
    cardName: string, 
    options: DownloadOptions
  ): Promise<ArtDownloadResult> {
    const { force = false, setCode, collectorNumber } = options;

    // Check if art crop already exists in database
    const artCropName = `${cardName}_art_crop`;
    if (!force && this.database.cardExists(artCropName, setCode, collectorNumber)) {
      const existingCard = this.database.getCardInfo(artCropName, setCode);
      if (existingCard) {
        const filepath = join(CONFIG.ART_CROPS_DIR, existingCard.filename);
        if (existsSync(filepath)) {
          return {
            success: true,
            message: `Art crop already downloaded: ${cardName}`,
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

    // Create set-specific directory
    const setDirName = sanitizeSetName(card.set_name || card.set);
    const setDir = join(CONFIG.ART_CROPS_DIR, setDirName);
    ensureDirectoryExists(setDir);

    // Generate filename
    const baseFilename = generateCardFilename(card, true);
    const imageExtension = extractImageExtension(imageUris.art_crop);
    const filename = `${baseFilename}.${imageExtension}`;
    const metadataFilename = `${baseFilename}.json`;
    
    const filepath = join(setDir, filename);
    const metadataPath = join(setDir, metadataFilename);

    // Download the art crop image
    try {
      const imageBuffer = await scryfallAPI.downloadImage(imageUris.art_crop);
      writeFileSync(filepath, imageBuffer);
    } catch (error) {
      return {
        success: false,
        message: `Failed to download art crop for ${cardName}: ${formatError(error)}`,
        cardName,
        error: formatError(error)
      };
    }

    // Create metadata file
    const metadata = {
      card_name: card.name,
      card_id: card.id,
      set_code: card.set,
      set_name: card.set_name,
      collector_number: card.collector_number,
      artist: card.artist,
      download_date: getCurrentISODateTime(),
      image_urls: {
        art_crop: imageUris.art_crop,
        large: imageUris.large,
        normal: imageUris.normal
      },
      scryfall_uri: card.scryfall_uri
    };

    try {
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.warn(`Failed to write metadata file: ${formatError(error)}`);
    }

    // Add to database with _art_crop suffix
    const databaseCard = {
      card_name: artCropName,
      filename: join(setDirName, filename), // Include set directory in filename
      download_date: getCurrentISODateTime(),
      card_id: card.id,
      set_code: card.set,
      image_url: imageUris.art_crop
    };

    try {
      this.database.addCard(databaseCard);
    } catch (error) {
      // Log the error but don't fail the download
      console.warn(`Failed to add art crop to database: ${formatError(error)}`);
    }

    return {
      success: true,
      message: `Successfully downloaded art crop for ${card.name}`,
      filepath,
      metadataPath,
      cardName: card.name,
      setCode: card.set,
      collectorNumber: card.collector_number
    };
  }

  async downloadArtCropsByQuery(
    query: string, 
    options: DownloadOptions = {}
  ): Promise<ArtDownloadResult[]> {
    const results: ArtDownloadResult[] = [];

    try {
      const cards = await scryfallAPI.searchCards(query, {
        unique: 'art',
        order: 'name'
      });

      if (cards.length === 0) {
        return [{
          success: false,
          message: `No cards found for query: ${query}`,
          error: 'No cards found'
        }];
      }

      // Download each card's art crop
      for (const card of cards) {
        const cardOptions: DownloadOptions = {
          ...options,
          setCode: card.set,
          collectorNumber: card.collector_number
        };

        try {
          const result = await this.downloadSingleArtCrop(card.name, cardOptions);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            message: `Failed to download art crop for ${card.name}: ${formatError(error)}`,
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

  async downloadArtCropBySet(
    setCode: string,
    options: DownloadOptions = {}
  ): Promise<ArtDownloadResult[]> {
    const query = `set:${setCode}`;
    return await this.downloadArtCropsByQuery(query, options);
  }

  async downloadRandomArtCrop(): Promise<ArtDownloadResult> {
    try {
      const card = await scryfallAPI.getRandomCard();
      return await this.downloadSingleArtCrop(card.name, {});
    } catch (error) {
      return {
        success: false,
        message: `Failed to download random art crop: ${formatError(error)}`,
        error: formatError(error)
      };
    }
  }

  async getArtDownloadProgress(results: ArtDownloadResult[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    errors: string[];
    setDirectories: string[];
  }> {
    const total = results.length;
    const successful = results.filter(r => r.success && !r.skipped).length;
    const failed = results.filter(r => !r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    const errors = results.filter(r => r.error).map(r => r.error!);
    
    // Get unique set directories created
    const setDirectories = Array.from(new Set(
      results
        .filter(r => r.filepath && r.success)
        .map(r => r.filepath!)
        .map(filepath => filepath.split('/').slice(-2, -1)[0])
    ));

    return {
      total,
      successful,
      failed,
      skipped,
      errors,
      setDirectories
    };
  }

  // Batch download with progress tracking
  async batchDownloadArtCrops(
    cardNames: string[],
    options: DownloadOptions = {},
    progressCallback?: (progress: { current: number; total: number; cardName: string }) => void
  ): Promise<ArtDownloadResult[]> {
    const results: ArtDownloadResult[] = [];
    const total = cardNames.length;

    for (let i = 0; i < cardNames.length; i++) {
      const cardName = cardNames[i];
      
      if (progressCallback) {
        progressCallback({ current: i + 1, total, cardName });
      }

      try {
        const result = await this.downloadSingleArtCrop(cardName, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          message: `Failed to download art crop for ${cardName}: ${formatError(error)}`,
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
export const artDownloader = new ArtDownloader();