import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mcp_search_cards } from '../src/tools/search.js';
import { mcp_download_card } from '../src/tools/download.js';
import { mcp_get_card_artwork } from '../src/tools/artwork.js';
import { mcp_database_report } from '../src/tools/database.js';

// Mock the dependencies
jest.mock('../src/lib/scryfall-api.js');
jest.mock('../src/lib/card-download.js');
jest.mock('../src/lib/database-operations.js');

const mockScryfallAPI = {
  searchCards: jest.fn(),
  getCardById: jest.fn(),
  getImageUris: jest.fn(),
};

const mockCardDownloader = {
  downloadCardImages: jest.fn(),
};

const mockDatabaseOperations = {
  generateDatabaseReport: jest.fn(),
};

// Mock modules
jest.doMock('../src/lib/scryfall-api.js', () => ({
  scryfallAPI: mockScryfallAPI,
}));

jest.doMock('../src/lib/card-download.js', () => ({
  cardDownloader: mockCardDownloader,
}));

jest.doMock('../src/lib/database-operations.js', () => ({
  databaseOperations: mockDatabaseOperations,
}));

describe('MCP Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mcp_search_cards', () => {
    test('should search cards successfully', async () => {
      const mockCards = [
        {
          id: 'test-id-1',
          name: 'Lightning Bolt',
          set: 'lea',
          set_name: 'Limited Edition Alpha',
          collector_number: '1',
          rarity: 'common',
          illustration_id: 'art-id-1',
          image_uris: {
            small: 'https://example.com/small.jpg',
            normal: 'https://example.com/normal.jpg',
            large: 'https://example.com/large.jpg',
            png: 'https://example.com/png.png',
            art_crop: 'https://example.com/art.jpg',
            border_crop: 'https://example.com/border.jpg',
          },
          prices: { usd: '1.00' },
          scryfall_uri: 'https://scryfall.com/card/test',
        },
        {
          id: 'test-id-2',
          name: 'Lightning Bolt',
          set: 'leb',
          set_name: 'Limited Edition Beta',
          collector_number: '1',
          rarity: 'common',
          illustration_id: 'art-id-1',
          image_uris: {
            small: 'https://example.com/small2.jpg',
            normal: 'https://example.com/normal2.jpg',
            large: 'https://example.com/large2.jpg',
            png: 'https://example.com/png2.png',
            art_crop: 'https://example.com/art2.jpg',
            border_crop: 'https://example.com/border2.jpg',
          },
          prices: { usd: '5.00' },
          scryfall_uri: 'https://scryfall.com/card/test2',
        }
      ];

      mockScryfallAPI.searchCards.mockResolvedValue(mockCards);

      const result = await mcp_search_cards('Lightning Bolt');

      expect(result.status).toBe('success');
      expect(result.count).toBe(2);
      expect(result.cards).toBeDefined();
      expect(result.cards!['Lightning Bolt']).toBeDefined();
      expect(result.cards!['Lightning Bolt'].variations).toHaveLength(2);
    });

    test('should handle empty search results', async () => {
      mockScryfallAPI.searchCards.mockResolvedValue([]);

      const result = await mcp_search_cards('nonexistent card');

      expect(result.status).toBe('success');
      expect(result.count).toBe(0);
      expect(result.cards).toEqual({});
    });

    test('should handle search errors', async () => {
      mockScryfallAPI.searchCards.mockRejectedValue(new Error('API Error'));

      const result = await mcp_search_cards('Lightning Bolt');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Search failed');
    });

    test('should handle empty query', async () => {
      const result = await mcp_search_cards('');

      expect(result.status).toBe('error');
      expect(result.message).toBe('Query parameter is required');
    });
  });

  describe('mcp_download_card', () => {
    test('should download card successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Download successful',
        filepath: '/path/to/card.jpg',
        cardName: 'Lightning Bolt',
        setCode: 'lea',
        collectorNumber: '1',
      };

      mockCardDownloader.downloadCardImages.mockResolvedValue([mockResult]);

      const result = await mcp_download_card('Lightning Bolt');

      expect(result.status).toBe('success');
      expect(result.filepath).toBe('/path/to/card.jpg');
      expect(result.data?.card_name).toBe('Lightning Bolt');
    });

    test('should handle download failure', async () => {
      const mockResult = {
        success: false,
        message: 'Card not found',
        cardName: 'Nonexistent Card',
      };

      mockCardDownloader.downloadCardImages.mockResolvedValue([mockResult]);

      const result = await mcp_download_card('Nonexistent Card');

      expect(result.status).toBe('error');
      expect(result.message).toBe('Card not found');
    });

    test('should handle empty card name', async () => {
      const result = await mcp_download_card('');

      expect(result.status).toBe('error');
      expect(result.message).toBe('Card name is required');
    });
  });

  describe('mcp_get_card_artwork', () => {
    test('should get card artwork successfully', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Lightning Bolt',
        image_uris: {
          small: 'https://example.com/small.jpg',
          normal: 'https://example.com/normal.jpg',
          large: 'https://example.com/large.jpg',
          png: 'https://example.com/png.png',
          art_crop: 'https://example.com/art.jpg',
          border_crop: 'https://example.com/border.jpg',
        },
      };

      mockScryfallAPI.getCardById.mockResolvedValue(mockCard);

      const result = await mcp_get_card_artwork('test-id');

      expect(result.status).toBe('success');
      expect(result.data?.card_id).toBe('test-id');
      expect(result.data?.card_name).toBe('Lightning Bolt');
      expect(result.data?.image_uris).toEqual(mockCard.image_uris);
    });

    test('should handle card with no artwork', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Test Card',
      };

      mockScryfallAPI.getCardById.mockResolvedValue(mockCard);

      const result = await mcp_get_card_artwork('test-id');

      expect(result.status).toBe('error');
      expect(result.message).toContain('No artwork available');
    });

    test('should handle double-faced cards', async () => {
      const mockCard = {
        id: 'test-id',
        name: 'Double-Faced Card',
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
      };

      mockScryfallAPI.getCardById.mockResolvedValue(mockCard);

      const result = await mcp_get_card_artwork('test-id');

      expect(result.status).toBe('success');
      expect(result.data?.card_faces).toHaveLength(2);
    });

    test('should handle invalid card ID', async () => {
      mockScryfallAPI.getCardById.mockRejectedValue(new Error('404'));

      const result = await mcp_get_card_artwork('invalid-id');

      expect(result.status).toBe('error');
      expect(result.message).toContain('Card not found');
    });

    test('should handle empty card ID', async () => {
      const result = await mcp_get_card_artwork('');

      expect(result.status).toBe('error');
      expect(result.message).toBe('Card ID is required');
    });
  });

  describe('mcp_database_report', () => {
    test('should generate database report successfully', async () => {
      const mockReport = {
        totalRecords: 100,
        recordsBySet: { lea: 25, leb: 30, m19: 45 },
        recentDownloads: [
          { card_name: 'Lightning Bolt', download_date: '2023-01-01', set_code: 'lea' }
        ],
        statistics: {
          uniqueCards: 75,
          totalSets: 3,
          oldestDownload: '2023-01-01',
          newestDownload: '2023-01-03',
          totalFileSize: 1000000,
          averageFileSize: 10000,
        },
        sets: { lea: 25, leb: 30, m19: 45 },
        missingFiles: [],
        directoryStructure: {
          cardImages: { totalFiles: 100, totalSize: 800000 },
          artCrops: { totalFiles: 50, totalSize: 200000, setDirectories: ['lea', 'leb', 'm19'] }
        }
      };

      mockDatabaseOperations.generateDatabaseReport.mockResolvedValue(mockReport);

      const result = await mcp_database_report();

      expect(result.status).toBe('success');
      expect(result.total_records).toBe(100);
      expect(result.records_by_set).toEqual(mockReport.recordsBySet);
      expect(result.data?.statistics).toEqual(mockReport.statistics);
    });

    test('should handle database report errors', async () => {
      mockDatabaseOperations.generateDatabaseReport.mockRejectedValue(new Error('Database error'));

      const result = await mcp_database_report();

      expect(result.status).toBe('error');
      expect(result.message).toContain('Database report failed');
    });
  });
});