/**
 * Card-related MCP resources for the Scryfall server.
 */

import { scryfallClient } from '../scryfallClient.js';
import { logger } from '../logger.js';

/**
 * Get detailed information about a specific Magic: The Gathering card by ID.
 */
export async function cardById(cardId: string): Promise<[string, string]> {
  logger.info(`[Resource] Getting card data for ID: ${cardId}`);

  try {
    // Fetch the card data from Scryfall
    const cardData = await scryfallClient.getCardById(cardId);
    
    return [JSON.stringify(cardData, null, 2), 'application/json'];
  } catch (error) {
    logger.error('[Error] Failed to get card resource:', error);
    const errorResponse = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorResponse), 'application/json'];
  }
}

/**
 * Get detailed information about a specific Magic: The Gathering card by name.
 */
export async function cardByName(cardName: string): Promise<[string, string]> {
  logger.info(`[Resource] Getting card data for name: ${cardName}`);

  try {
    // Fetch the card data from Scryfall
    const cardData = await scryfallClient.getCardByName(cardName);
    
    return [JSON.stringify(cardData, null, 2), 'application/json'];
  } catch (error) {
    logger.error('[Error] Failed to get card resource by name:', error);
    const errorResponse = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorResponse), 'application/json'];
  }
}

/**
 * Get a random Magic: The Gathering card.
 */
export async function randomCard(): Promise<[string, string]> {
  logger.info('[Resource] Getting a random card');

  try {
    // Fetch a random card from Scryfall
    const cardData = await scryfallClient.getRandomCard();
    
    return [JSON.stringify(cardData, null, 2), 'application/json'];
  } catch (error) {
    logger.error('[Error] Failed to get random card:', error);
    const errorResponse = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return [JSON.stringify(errorResponse), 'application/json'];
  }
}