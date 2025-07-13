/**
 * Search functionality tests.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { scryfallClient } from '../src/scryfallClient.js';
import { mcpSearchCards, mcpGetCardArtwork } from '../src/tools/searchTools.js';

// Rate limiting for API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Search functionality', () => {
  beforeAll(async () => {
    // Add initial delay to avoid hitting rate limits
    await delay(500);
  });

  describe('ScryfallClient', () => {
    it('should search for cards successfully', async () => {
      await delay(500); // Rate limiting
      
      const cards = await scryfallClient.searchCards('name:"Lightning Bolt"');
      
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBeGreaterThan(0);
      
      const firstCard = cards[0];
      expect(firstCard).toBeDefined();
      if (firstCard) {
        expect(firstCard).toHaveProperty('name');
        expect(firstCard).toHaveProperty('id');
        expect(firstCard).toHaveProperty('set');
        expect(firstCard.name).toContain('Lightning Bolt');
      }
    }, 10000);

    it('should handle card not found gracefully', async () => {
      await delay(500); // Rate limiting
      
      const cards = await scryfallClient.searchCards('name:"Nonexistent Card That Should Never Exist 12345"');
      
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBe(0);
    }, 10000);

    it('should get card by name', async () => {
      await delay(500); // Rate limiting
      
      const card = await scryfallClient.getCardByName('Lightning Bolt');
      
      expect(card).toHaveProperty('name', 'Lightning Bolt');
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('image_uris');
    }, 10000);

    it('should get random card', async () => {
      await delay(500); // Rate limiting
      
      const card = await scryfallClient.getRandomCard();
      
      expect(card).toHaveProperty('name');
      expect(card).toHaveProperty('id');
      expect(typeof card.name).toBe('string');
      expect(typeof card.id).toBe('string');
    }, 10000);

    it('should group cards by name and art', async () => {
      await delay(500); // Rate limiting
      
      const cards = await scryfallClient.searchCards('name:"Lightning Bolt"');
      const grouped = scryfallClient.groupCardsByNameAndArt(cards);
      
      expect(typeof grouped).toBe('object');
      expect('Lightning Bolt' in grouped).toBe(true);
      expect(Array.isArray(grouped['Lightning Bolt'])).toBe(true);
      
      const lightningBoltCards = grouped['Lightning Bolt'];
      if (lightningBoltCards) {
        expect(lightningBoltCards.length).toBeGreaterThan(0);
        
        // Check that display_name was added
        const firstVariant = lightningBoltCards[0];
        if (firstVariant) {
          expect(firstVariant).toHaveProperty('display_name');
          expect(typeof firstVariant.display_name).toBe('string');
        }
      }
    }, 10000);
  });

  describe('MCP Search Tools', () => {
    it('should search cards via MCP tool', async () => {
      await delay(500); // Rate limiting
      
      const result = await mcpSearchCards('name:"Lightning Bolt"');
      
      expect(result).toHaveProperty('status', 'success');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('cards');
      expect(typeof result.count).toBe('number');
      expect(result.count).toBeGreaterThan(0);
      expect(typeof result.cards).toBe('object');
      expect('Lightning Bolt' in result.cards!).toBe(true);
    }, 10000);

    it('should handle search errors gracefully', async () => {
      await delay(500); // Rate limiting
      
      const result = await mcpSearchCards('invalid:syntax[');
      
      expect(result).toHaveProperty('status', 'error');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
    }, 10000);

    it('should get card artwork via MCP tool', async () => {
      await delay(500); // Rate limiting
      
      // First get a card to get its ID
      const cards = await scryfallClient.searchCards('name:"Lightning Bolt"');
      expect(cards.length).toBeGreaterThan(0);
      
      const firstCard = cards[0];
      expect(firstCard).toBeDefined();
      if (!firstCard) {
        throw new Error('No card found');
      }
      const cardId = firstCard.id;
      const result = await mcpGetCardArtwork(cardId);
      
      expect(result).toHaveProperty('status', 'success');
      expect(result).toHaveProperty('card_name');
      expect(result).toHaveProperty('artwork');
      expect(typeof result.artwork).toBe('object');
      expect(result.artwork).toHaveProperty('large');
    }, 15000);

    it('should handle invalid card ID gracefully', async () => {
      await delay(500); // Rate limiting
      
      const result = await mcpGetCardArtwork('invalid-card-id-12345');
      
      expect(result).toHaveProperty('status', 'error');
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
    }, 10000);
  });
});