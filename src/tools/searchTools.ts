/**
 * Search-related MCP tools for the Scryfall server.
 */

import { scryfallClient } from '../scryfallClient.js';
import { logger } from '../logger.js';

export interface SearchResult {
  status: 'success' | 'error';
  message?: string;
  count?: number;
  cards?: Record<string, any[]>;
}

export interface ArtworkResult {
  status: 'success' | 'error';
  message?: string;
  card_name?: string;
  artist?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  artwork?: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    art_crop?: string;
    border_crop?: string;
  };
}

/**
 * Search for Magic: The Gathering cards using the Scryfall API.
 * Implements the same card grouping logic as the Python version.
 */
export async function mcpSearchCards(query: string): Promise<SearchResult> {
  logger.info(`[API] Searching for cards with query: ${query}`);

  try {
    // Validate input query
    if (!query || query.trim().length === 0) {
      return {
        status: 'error',
        message: 'Search query cannot be empty'
      };
    }

    // Search for cards
    const cards = await scryfallClient.searchCards(query.trim());

    if (cards.length === 0) {
      logger.warn(`[API] No cards found for query: ${query}`);
      return { status: 'success', count: 0, cards: {} };
    }

    // Group cards by name and identify alternate artworks (matches Python group_cards_by_name_and_art)
    const cardGroups = scryfallClient.groupCardsByNameAndArt(cards);

    // Create response structure matching Python implementation format
    const result: SearchResult = {
      status: 'success',
      count: cards.length,
      cards: {}
    };

    // Process each card group to ensure nested structure matches Python version
    for (const [name, variants] of Object.entries(cardGroups)) {
      if (!name || variants.length === 0) {
        continue; // Skip invalid groups
      }

      result.cards![name] = [];

      for (const card of variants) {
        try {
          // Extract essential information for each card variant (matches Python format)
          const cardInfo = {
            name: card.name || 'Unknown',
            set: card.set || '',
            set_name: card.set_name || '',
            collector_number: card.collector_number || '',
            rarity: card.rarity || '',
            artist: card.artist || '',
            display_name: card.display_name || card.name,
            id: card.id,
            scryfall_uri: card.scryfall_uri || '',
            image_uris: card.image_uris || {}
          };

          result.cards![name].push(cardInfo);
        } catch (cardError: any) {
          logger.warn(`Error processing card variant: ${cardError.message}`);
          continue; // Skip problematic card variants
        }
      }

      // Remove empty groups
      if (result.cards![name].length === 0) {
        delete result.cards![name];
      }
    }

    logger.info(`[API] Found ${cards.length} cards grouped into ${Object.keys(result.cards!).length} unique names for query: ${query}`);
    return result;
    
  } catch (error: any) {
    logger.error(`[Error] Failed to search cards for query "${query}":`, error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred during card search'
    };
  }
}

/**
 * Get the artwork for a specific Magic: The Gathering card.
 */
export async function mcpGetCardArtwork(cardId: string): Promise<ArtworkResult> {
  logger.info(`[API] Getting artwork for card ID: ${cardId}`);

  try {
    // Fetch the card data from Scryfall
    const cardData = await scryfallClient.getCardById(cardId);

    // Extract the image URIs
    let imageUris = cardData.image_uris;

    if (!imageUris) {
      // Handle double-faced cards
      if (cardData.card_faces && cardData.card_faces.length > 0 && cardData.card_faces[0]) {
        // Get the front face image
        imageUris = cardData.card_faces[0].image_uris;
      }
    }

    if (!imageUris) {
      return {
        status: 'error',
        message: `No artwork found for card ID: ${cardId}`
      };
    }

    // Create a response with the artwork URLs
    return {
      status: 'success',
      card_name: cardData.name,
      artist: cardData.artist,
      set: cardData.set,
      set_name: cardData.set_name,
      collector_number: cardData.collector_number,
      artwork: {
        ...(imageUris?.small !== undefined && { small: imageUris.small }),
        ...(imageUris?.normal !== undefined && { normal: imageUris.normal }),
        ...(imageUris?.large !== undefined && { large: imageUris.large }),
        ...(imageUris?.png !== undefined && { png: imageUris.png }),
        ...(imageUris?.art_crop !== undefined && { art_crop: imageUris.art_crop }),
        ...(imageUris?.border_crop !== undefined && { border_crop: imageUris.border_crop })
      }
    };
  } catch (error) {
    logger.error('[Error] Failed to get card artwork:', error);
    return { 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}