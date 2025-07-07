import { MCPTools } from '../../src/mcp/tools.js';
import { ScryfallClient } from '../../src/services/scryfall-client.js';
import { ImageDownloader } from '../../src/services/image-downloader.js';
import { GraphService } from '../../src/services/graph-service.js';
import { Card, CardList } from '../../src/types/scryfall.js';
import { DownloadResult } from '../../src/types/mcp.js';

jest.mock('../../src/services/scryfall-client.js');
jest.mock('../../src/services/image-downloader.js');
jest.mock('../../src/services/graph-service.js');

describe('MCPTools', () => {
  let mcpTools: MCPTools;
  let mockScryfallClient: jest.Mocked<ScryfallClient>;
  let mockImageDownloader: jest.Mocked<ImageDownloader>;
  let mockGraphService: jest.Mocked<GraphService>;

  beforeEach(() => {
    mockScryfallClient = new ScryfallClient() as jest.Mocked<ScryfallClient>;
    mockImageDownloader = new ImageDownloader() as jest.Mocked<ImageDownloader>;
    mockGraphService = new GraphService() as jest.Mocked<GraphService>;

    mcpTools = new MCPTools(mockScryfallClient, mockImageDownloader, mockGraphService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTools', () => {
    it('should return list of available tools', () => {
      const tools = mcpTools.getTools();
      
      expect(tools).toHaveLength(7);
      expect(tools.map(t => t.name)).toEqual([
        'search_cards',
        'download_card_image',
        'get_card_details',
        'list_downloaded_cards',
        'get_random_card',
        'autocomplete_card_name',
        'get_database_stats',
      ]);
    });
  });

  describe('handleToolCall', () => {
    describe('search_cards', () => {
      it('should search for cards successfully', async () => {
        const mockCardList: CardList = {
          object: 'list',
          total_cards: 1,
          has_more: false,
          data: [{
            object: 'card',
            id: '550c74d4-1fcb-406a-b02a-639a760a4380',
            oracle_id: '7bf9fac6-c27b-4101-837c-85dbbeb1ad6d',
            name: 'Black Lotus',
            lang: 'en',
            released_at: '1993-08-05',
            uri: 'https://api.scryfall.com/cards/550c74d4-1fcb-406a-b02a-639a760a4380',
            scryfall_uri: 'https://scryfall.com/card/lea/232/black-lotus',
            layout: 'normal',
            highres_image: true,
            image_status: 'highres_scan',
            cmc: 0,
            type_line: 'Artifact',
            color_identity: [],
            keywords: [],
            legalities: {},
            games: ['paper'],
            reserved: true,
            foil: false,
            nonfoil: true,
            finishes: ['nonfoil'],
            oversized: false,
            promo: false,
            reprint: false,
            variation: false,
            set_id: '288bd996-960e-488b-8059-78c24b934c75',
            set: 'lea',
            set_name: 'Limited Edition Alpha',
            set_type: 'core',
            set_uri: 'https://api.scryfall.com/sets/288bd996-960e-488b-8059-78c24b934c75',
            set_search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Alea&unique=prints',
            scryfall_set_uri: 'https://scryfall.com/sets/lea',
            rulings_uri: 'https://api.scryfall.com/cards/550c74d4-1fcb-406a-b02a-639a760a4380/rulings',
            prints_search_uri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A7bf9fac6-c27b-4101-837c-85dbbeb1ad6d&unique=prints',
            collector_number: '232',
            digital: false,
            rarity: 'rare',
            card_back_id: '0aeebaf5-8c7d-4636-9e82-8c27447861f7',
            border_color: 'black',
            frame: '1993',
            full_art: false,
            textless: false,
            booster: true,
            story_spotlight: false,
            prices: {},
            related_uris: {},
          }],
        };

        mockScryfallClient.searchCards.mockResolvedValue(mockCardList);

        const result = await mcpTools.handleToolCall('search_cards', { query: 'black lotus' });

        expect(result.success).toBe(true);
        expect(result.data?.cards).toHaveLength(1);
        expect(result.data?.cards[0].name).toBe('Black Lotus');
        expect(mockScryfallClient.searchCards).toHaveBeenCalledWith({
          q: 'black lotus',
          unique: undefined,
          order: undefined,
          dir: undefined,
          includeExtras: undefined,
          page: undefined,
        });
      });

      it('should handle validation errors', async () => {
        const result = await mcpTools.handleToolCall('search_cards', {});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Required');
      });
    });

    describe('download_card_image', () => {
      it('should download card image successfully', async () => {
        const mockCard: Card = {
          object: 'card',
          id: '550c74d4-1fcb-406a-b02a-639a760a4380',
          oracle_id: '7bf9fac6-c27b-4101-837c-85dbbeb1ad6d',
          name: 'Black Lotus',
          lang: 'en',
          released_at: '1993-08-05',
          uri: 'https://api.scryfall.com/cards/550c74d4-1fcb-406a-b02a-639a760a4380',
          scryfall_uri: 'https://scryfall.com/card/lea/232/black-lotus',
          layout: 'normal',
          highres_image: true,
          image_status: 'highres_scan',
          cmc: 0,
          type_line: 'Artifact',
          color_identity: [],
          keywords: [],
          legalities: {},
          games: ['paper'],
          reserved: true,
          foil: false,
          nonfoil: true,
          finishes: ['nonfoil'],
          oversized: false,
          promo: false,
          reprint: false,
          variation: false,
          set_id: '288bd996-960e-488b-8059-78c24b934c75',
          set: 'lea',
          set_name: 'Limited Edition Alpha',
          set_type: 'core',
          set_uri: 'https://api.scryfall.com/sets/288bd996-960e-488b-8059-78c24b934c75',
          set_search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Alea&unique=prints',
          scryfall_set_uri: 'https://scryfall.com/sets/lea',
          rulings_uri: 'https://api.scryfall.com/cards/550c74d4-1fcb-406a-b02a-639a760a4380/rulings',
          prints_search_uri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A7bf9fac6-c27b-4101-837c-85dbbeb1ad6d&unique=prints',
          collector_number: '232',
          digital: false,
          rarity: 'rare',
          card_back_id: '0aeebaf5-8c7d-4636-9e82-8c27447861f7',
          border_color: 'black',
          frame: '1993',
          full_art: false,
          textless: false,
          booster: true,
          story_spotlight: false,
          prices: {},
          related_uris: {},
        };

        const mockDownloadResult: DownloadResult = {
          cardId: '550c74d4-1fcb-406a-b02a-639a760a4380',
          cardName: 'Black Lotus',
          set: 'lea',
          collectorNumber: '232',
          variant: 'large',
          filePath: '/path/to/image.jpg',
          fileSize: 12345,
          checksum: 'abc123',
        };

        mockScryfallClient.getCard.mockResolvedValue(mockCard);
        mockGraphService.storeCard.mockResolvedValue({} as any);
        mockImageDownloader.downloadCardImage.mockResolvedValue(mockDownloadResult);
        mockGraphService.storeImageRecord.mockResolvedValue({} as any);

        const result = await mcpTools.handleToolCall('download_card_image', {
          cardId: '550c74d4-1fcb-406a-b02a-639a760a4380',
        });

        expect(result.success).toBe(true);
        expect(result.data?.card_name).toBe('Black Lotus');
        expect(result.data?.file_path).toBe('/path/to/image.jpg');
        expect(mockScryfallClient.getCard).toHaveBeenCalledWith('550c74d4-1fcb-406a-b02a-639a760a4380');
        expect(mockImageDownloader.downloadCardImage).toHaveBeenCalledWith(mockCard, 'large', undefined);
      });
    });

    describe('get_random_card', () => {
      it('should get a random card', async () => {
        const mockCard: Card = {
          object: 'card',
          id: '550c74d4-1fcb-406a-b02a-639a760a4380',
          oracle_id: '7bf9fac6-c27b-4101-837c-85dbbeb1ad6d',
          name: 'Random Card',
          lang: 'en',
          released_at: '2020-01-01',
          uri: 'https://api.scryfall.com/cards/550c74d4-1fcb-406a-b02a-639a760a4380',
          scryfall_uri: 'https://scryfall.com/card/set/123/random-card',
          layout: 'normal',
          highres_image: true,
          image_status: 'highres_scan',
          cmc: 3,
          type_line: 'Creature — Human',
          color_identity: ['U'],
          keywords: [],
          legalities: {},
          games: ['paper'],
          reserved: false,
          foil: true,
          nonfoil: true,
          finishes: ['foil', 'nonfoil'],
          oversized: false,
          promo: false,
          reprint: false,
          variation: false,
          set_id: '12345678-1234-1234-1234-123456789abc',
          set: 'set',
          set_name: 'Example Set',
          set_type: 'expansion',
          set_uri: 'https://api.scryfall.com/sets/12345678-1234-1234-1234-123456789abc',
          set_search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Aset&unique=prints',
          scryfall_set_uri: 'https://scryfall.com/sets/set',
          rulings_uri: 'https://api.scryfall.com/cards/550c74d4-1fcb-406a-b02a-639a760a4380/rulings',
          prints_search_uri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3A7bf9fac6-c27b-4101-837c-85dbbeb1ad6d&unique=prints',
          collector_number: '123',
          digital: false,
          rarity: 'uncommon',
          card_back_id: '0aeebaf5-8c7d-4636-9e82-8c27447861f7',
          border_color: 'black',
          frame: '2015',
          full_art: false,
          textless: false,
          booster: true,
          story_spotlight: false,
          prices: {},
          related_uris: {},
        };

        mockScryfallClient.getRandom.mockResolvedValue(mockCard);

        const result = await mcpTools.handleToolCall('get_random_card', {});

        expect(result.success).toBe(true);
        expect(result.data?.name).toBe('Random Card');
        expect(mockScryfallClient.getRandom).toHaveBeenCalled();
      });
    });

    describe('unknown tool', () => {
      it('should handle unknown tool calls', async () => {
        const result = await mcpTools.handleToolCall('unknown_tool', {});

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown tool: unknown_tool');
      });
    });
  });
});