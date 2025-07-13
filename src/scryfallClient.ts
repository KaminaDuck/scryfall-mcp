/**
 * Scryfall API client for Magic: The Gathering card data.
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';

export interface Card {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  artist: string;
  display_name?: string;
  scryfall_uri: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    art_crop?: string;
    border_crop?: string;
  };
  card_faces?: Array<{
    name: string;
    image_uris?: Card['image_uris'];
  }>;
}

export interface SearchResponse {
  object: string;
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: Card[];
  details?: string;
}

export class ScryfallClient {
  private readonly baseUrl = 'https://api.scryfall.com';
  private readonly rateLimitDelay = 200; // 200ms between requests

  /**
   * Add a delay between requests to respect rate limits.
   */
  private async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  /**
   * Make a request to the Scryfall API with retry logic.
   */
  private async makeRequest<T>(url: string, retries = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Not found: ${url}`);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as T;
        
        // Add delay after successful request
        if (attempt < retries) {
          await this.delay();
        }
        
        return data;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        logger.warn(`Request failed (attempt ${attempt}/${retries}):`, error);
        await this.delay();
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  /**
   * Search for cards using Scryfall's search API.
   */
  async searchCards(query: string): Promise<Card[]> {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `${this.baseUrl}/cards/search?q=${encodedQuery}`;
    
    logger.info(`Searching Scryfall for: ${query}`);
    
    const allCards: Card[] = [];
    let currentUrl: string | undefined = searchUrl;

    try {
      while (currentUrl) {
        const data: SearchResponse = await this.makeRequest<SearchResponse>(currentUrl);
        
        if (data.object === 'error') {
          throw new Error(data.details || 'Unknown API error');
        }

        // Add cards from current page
        allCards.push(...data.data);

        // Check if there are more pages
        if (data.has_more && data.next_page) {
          currentUrl = data.next_page;
          logger.debug('Fetching additional results...');
        } else {
          currentUrl = undefined;
        }
      }

      logger.info(`Found ${allCards.length} cards`);
      return allCards;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not found')) {
        logger.info(`No cards found for query: ${query}`);
        return [];
      }
      
      logger.error('Error searching for cards:', error);
      throw error;
    }
  }

  /**
   * Get a card by its Scryfall ID.
   */
  async getCardById(cardId: string): Promise<Card> {
    const url = `${this.baseUrl}/cards/${cardId}`;
    logger.debug(`Getting card by ID: ${cardId}`);
    
    return await this.makeRequest<Card>(url);
  }

  /**
   * Get a card by its name (exact match).
   */
  async getCardByName(cardName: string): Promise<Card> {
    const encodedName = encodeURIComponent(cardName);
    const url = `${this.baseUrl}/cards/named?exact=${encodedName}`;
    logger.debug(`Getting card by name: ${cardName}`);
    
    return await this.makeRequest<Card>(url);
  }

  /**
   * Get a random card.
   */
  async getRandomCard(): Promise<Card> {
    const url = `${this.baseUrl}/cards/random`;
    logger.debug('Getting random card');
    
    return await this.makeRequest<Card>(url);
  }

  /**
   * Get a card by set and collector number.
   */
  async getCardBySetAndNumber(setCode: string, collectorNumber: string): Promise<Card> {
    const url = `${this.baseUrl}/cards/${setCode}/${collectorNumber}`;
    logger.debug(`Getting card by set/number: ${setCode}/${collectorNumber}`);
    
    return await this.makeRequest<Card>(url);
  }

  /**
   * Group cards by name and identify alternate artworks.
   */
  groupCardsByNameAndArt(cards: Card[]): Record<string, Card[]> {
    const cardGroups: Record<string, Card[]> = {};

    for (const card of cards) {
      const name = card.name || 'Unknown';

      if (!cardGroups[name]) {
        cardGroups[name] = [];
      }

      // Add a display name to help identify alternate arts
      const setName = card.set_name || 'Unknown Set';
      const setCode = (card.set || '???').toUpperCase();
      const collectorNumber = card.collector_number || '??';
      const artist = card.artist || 'Unknown Artist';

      // Add a display_name field to help with showing alternate arts
      card.display_name = `${name} [${setCode} - ${setName}, #${collectorNumber}, Art: ${artist}]`;

      cardGroups[name].push(card);
    }

    return cardGroups;
  }
}

// Export a singleton instance
export const scryfallClient = new ScryfallClient();