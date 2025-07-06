import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ScryfallAPI, ScryfallAPIError } from '../src/lib/scryfall-api.js';

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('ScryfallAPI', () => {
  let api: ScryfallAPI;

  beforeEach(() => {
    api = new ScryfallAPI('https://api.scryfall.com', 0); // No rate limiting for tests
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchCards', () => {
    test('should search for cards successfully', async () => {
      const mockResponse = {
        object: 'list',
        total_cards: 1,
        has_more: false,
        data: [
          {
            id: 'test-id',
            name: 'Lightning Bolt',
            scryfall_uri: 'https://scryfall.com/card/test',
            uri: 'https://api.scryfall.com/cards/test',
            layout: 'normal',
            image_uris: {
              small: 'https://example.com/small.jpg',
              normal: 'https://example.com/normal.jpg',
              large: 'https://example.com/large.jpg',
              png: 'https://example.com/png.png',
              art_crop: 'https://example.com/art.jpg',
              border_crop: 'https://example.com/border.jpg',
            },
            set: 'lea',
            set_name: 'Limited Edition Alpha',
            collector_number: '1',
            rarity: 'common',
            type_line: 'Instant',
            oracle_text: 'Lightning Bolt deals 3 damage to any target.',
            mana_cost: '{R}',
            cmc: 1,
            colors: ['R'],
            color_identity: ['R'],
            keywords: [],
            games: ['paper'],
            reserved: false,
            foil: false,
            nonfoil: true,
            finishes: ['nonfoil'],
            oversized: false,
            promo: false,
            reprint: false,
            variation: false,
            artist: 'Christopher Rush',
            border_color: 'black',
            frame: '1993',
            full_art: false,
            textless: false,
            booster: true,
            story_spotlight: false,
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const cards = await api.searchCards('Lightning Bolt');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(cards).toHaveLength(1);
      expect(cards[0].name).toBe('Lightning Bolt');
      expect(cards[0].set).toBe('lea');
    });

    test('should handle no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"details": "No cards found"}',
      } as Response);

      const cards = await api.searchCards('nonexistent card');
      expect(cards).toHaveLength(0);
    });

    test('should handle pagination', async () => {
      const page1Response = {
        object: 'list',
        total_cards: 2,
        has_more: true,
        next_page: 'https://api.scryfall.com/cards/search?page=2',
        data: [
          {
            id: 'test-id-1',
            name: 'Card 1',
            scryfall_uri: 'https://scryfall.com/card/test1',
            uri: 'https://api.scryfall.com/cards/test1',
            layout: 'normal',
            set: 'test',
            set_name: 'Test Set',
            collector_number: '1',
            rarity: 'common',
            type_line: 'Instant',
          }
        ]
      };

      const page2Response = {
        object: 'list',
        total_cards: 2,
        has_more: false,
        data: [
          {
            id: 'test-id-2',
            name: 'Card 2',
            scryfall_uri: 'https://scryfall.com/card/test2',
            uri: 'https://api.scryfall.com/cards/test2',
            layout: 'normal',
            set: 'test',
            set_name: 'Test Set',
            collector_number: '2',
            rarity: 'common',
            type_line: 'Creature',
          }
        ]
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page1Response,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => page2Response,
        } as Response);

      const cards = await api.searchCards('test query');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(cards).toHaveLength(2);
      expect(cards[0].name).toBe('Card 1');
      expect(cards[1].name).toBe('Card 2');
    });
  });

  describe('getCardById', () => {
    test('should get card by ID successfully', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Lightning Bolt',
        scryfall_uri: 'https://scryfall.com/card/test',
        uri: 'https://api.scryfall.com/cards/test',
        layout: 'normal',
        set: 'lea',
        set_name: 'Limited Edition Alpha',
        collector_number: '1',
        rarity: 'common',
        type_line: 'Instant',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      } as Response);

      const card = await api.getCardById('test-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/test-id',
        expect.any(Object)
      );
      expect(card.name).toBe('Lightning Bolt');
    });

    test('should throw error for invalid card ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"details": "Card not found"}',
      } as Response);

      await expect(api.getCardById('invalid-id')).rejects.toThrow(ScryfallAPIError);
    });
  });

  describe('getCardByName', () => {
    test('should get card by name successfully', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Lightning Bolt',
        scryfall_uri: 'https://scryfall.com/card/test',
        uri: 'https://api.scryfall.com/cards/test',
        layout: 'normal',
        set: 'lea',
        set_name: 'Limited Edition Alpha',
        collector_number: '1',
        rarity: 'common',
        type_line: 'Instant',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      } as Response);

      const card = await api.getCardByName('Lightning Bolt');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/named?exact=Lightning%20Bolt',
        expect.any(Object)
      );
      expect(card.name).toBe('Lightning Bolt');
    });

    test('should get card by name with set code', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Lightning Bolt',
        scryfall_uri: 'https://scryfall.com/card/test',
        uri: 'https://api.scryfall.com/cards/test',
        layout: 'normal',
        set: 'lea',
        set_name: 'Limited Edition Alpha',
        collector_number: '1',
        rarity: 'common',
        type_line: 'Instant',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      } as Response);

      const card = await api.getCardByName('Lightning Bolt', 'lea');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/named?exact=Lightning%20Bolt&set=lea',
        expect.any(Object)
      );
      expect(card.set).toBe('lea');
    });
  });

  describe('getRandomCard', () => {
    test('should get random card successfully', async () => {
      const mockCard = {
        id: 'random-id',
        name: 'Random Card',
        scryfall_uri: 'https://scryfall.com/card/random',
        uri: 'https://api.scryfall.com/cards/random',
        layout: 'normal',
        set: 'rnd',
        set_name: 'Random Set',
        collector_number: '42',
        rarity: 'rare',
        type_line: 'Creature',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCard,
      } as Response);

      const card = await api.getRandomCard();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/random',
        expect.any(Object)
      );
      expect(card.name).toBe('Random Card');
    });
  });

  describe('getImageUris', () => {
    test('should get image URIs from card with image_uris', () => {
      const card = {
        id: 'test-id',
        name: 'Test Card',
        image_uris: {
          small: 'https://example.com/small.jpg',
          normal: 'https://example.com/normal.jpg',
          large: 'https://example.com/large.jpg',
          png: 'https://example.com/png.png',
          art_crop: 'https://example.com/art.jpg',
          border_crop: 'https://example.com/border.jpg',
        },
      } as any;

      const imageUris = api.getImageUris(card);
      expect(imageUris).toEqual(card.image_uris);
    });

    test('should get image URIs from double-faced card', () => {
      const card = {
        id: 'test-id',
        name: 'Test Card',
        card_faces: [
          {
            image_uris: {
              small: 'https://example.com/front_small.jpg',
              normal: 'https://example.com/front_normal.jpg',
              large: 'https://example.com/front_large.jpg',
              png: 'https://example.com/front_png.png',
              art_crop: 'https://example.com/front_art.jpg',
              border_crop: 'https://example.com/front_border.jpg',
            }
          },
          {
            image_uris: {
              small: 'https://example.com/back_small.jpg',
              normal: 'https://example.com/back_normal.jpg',
              large: 'https://example.com/back_large.jpg',
              png: 'https://example.com/back_png.png',
              art_crop: 'https://example.com/back_art.jpg',
              border_crop: 'https://example.com/back_border.jpg',
            }
          }
        ]
      } as any;

      const imageUris = api.getImageUris(card);
      expect(imageUris).toEqual(card.card_faces[0].image_uris);
    });

    test('should return null for card without images', () => {
      const card = {
        id: 'test-id',
        name: 'Test Card',
      } as any;

      const imageUris = api.getImageUris(card);
      expect(imageUris).toBeNull();
    });
  });

  describe('error handling', () => {
    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getCardById('test-id')).rejects.toThrow(ScryfallAPIError);
    });

    test('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect(api.getCardById('test-id')).rejects.toThrow(ScryfallAPIError);
    });

    test('should handle HTTP errors with details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => '{"details": "Invalid search query"}',
      } as Response);

      await expect(api.searchCards('invalid query')).rejects.toThrow('Invalid search query');
    });
  });
});