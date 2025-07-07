import { GraphService } from '../../src/services/graph-service.js';
import { Card } from '../../src/types/scryfall.js';
import { DownloadResult } from '../../src/types/mcp.js';

jest.mock('neo4j-driver');

describe('GraphService', () => {
  let graphService: GraphService;
  let mockDriver: any;
  let mockSession: any;

  beforeEach(() => {
    mockSession = {
      run: jest.fn(),
      close: jest.fn(),
    };

    mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
      close: jest.fn(),
    };

    jest.doMock('neo4j-driver', () => ({
      driver: jest.fn().mockReturnValue(mockDriver),
      auth: {
        basic: jest.fn(),
      },
    }));

    graphService = new GraphService({
      uri: 'bolt://localhost:7687',
      username: 'test',
      password: 'test',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeCard', () => {
    it('should store a card successfully', async () => {
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

      const mockResult = {
        records: [{
          get: jest.fn().mockReturnValue({
            properties: {
              id: mockCard.id,
              name: mockCard.name,
            },
          }),
        }],
      };

      mockSession.run.mockResolvedValue(mockResult);

      const result = await graphService.storeCard(mockCard);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (c:Card {id: $id})'),
        expect.objectContaining({
          id: mockCard.id,
          properties: expect.objectContaining({
            id: mockCard.id,
            name: mockCard.name,
          }),
        }),
      );

      expect(result).toEqual({
        id: mockCard.id,
        name: mockCard.name,
      });
    });
  });

  describe('storeImageRecord', () => {
    it('should store an image record successfully', async () => {
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

      const mockResult = {
        records: [{
          get: jest.fn().mockReturnValue({
            properties: {
              id: `${mockDownloadResult.cardId}-${mockDownloadResult.variant}`,
              cardId: mockDownloadResult.cardId,
              variant: mockDownloadResult.variant,
            },
          }),
        }],
      };

      mockSession.run.mockResolvedValue(mockResult);

      const result = await graphService.storeImageRecord(mockDownloadResult);

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (i:Image {id: $id})'),
        expect.objectContaining({
          id: `${mockDownloadResult.cardId}-${mockDownloadResult.variant}`,
          cardId: mockDownloadResult.cardId,
        }),
      );

      expect(result).toEqual({
        id: `${mockDownloadResult.cardId}-${mockDownloadResult.variant}`,
        cardId: mockDownloadResult.cardId,
        variant: mockDownloadResult.variant,
      });
    });
  });

  describe('findCard', () => {
    it('should find a card by ID', async () => {
      const mockResult = {
        records: [{
          get: jest.fn().mockReturnValue({
            properties: {
              id: '550c74d4-1fcb-406a-b02a-639a760a4380',
              name: 'Black Lotus',
            },
          }),
        }],
      };

      mockSession.run.mockResolvedValue(mockResult);

      const result = await graphService.findCard({ id: '550c74d4-1fcb-406a-b02a-639a760a4380' });

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (c:Card) WHERE c.id = $id'),
        expect.objectContaining({
          id: '550c74d4-1fcb-406a-b02a-639a760a4380',
        }),
      );

      expect(result).toEqual({
        id: '550c74d4-1fcb-406a-b02a-639a760a4380',
        name: 'Black Lotus',
      });
    });

    it('should return null when card not found', async () => {
      const mockResult = {
        records: [],
      };

      mockSession.run.mockResolvedValue(mockResult);

      const result = await graphService.findCard({ id: 'nonexistent' });

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return database statistics', async () => {
      const mockResults = [
        { records: [{ get: jest.fn().mockReturnValue({ toNumber: () => 100 }) }] },
        { records: [{ get: jest.fn().mockReturnValue({ toNumber: () => 150 }) }] },
        { records: [{ get: jest.fn().mockReturnValue({ toNumber: () => 5 }) }] },
        { records: [
          { get: jest.fn().mockImplementation((key) => 
            key === 'variant' ? 'large' : { toNumber: () => 50 },
          )},
          { get: jest.fn().mockImplementation((key) => 
            key === 'variant' ? 'art_crop' : { toNumber: () => 100 },
          )},
        ]},
        { records: [
          { get: jest.fn().mockImplementation((key) => 
            key === 'set' ? 'lea' : { toNumber: () => 30 },
          )},
          { get: jest.fn().mockImplementation((key) => 
            key === 'set' ? 'leb' : { toNumber: () => 70 },
          )},
        ]},
      ];

      mockSession.run.mockResolvedValueOnce(mockResults[0])
                   .mockResolvedValueOnce(mockResults[1])
                   .mockResolvedValueOnce(mockResults[2])
                   .mockResolvedValueOnce(mockResults[3])
                   .mockResolvedValueOnce(mockResults[4]);

      const result = await graphService.getStats();

      expect(result).toEqual({
        totalCards: 100,
        totalImages: 150,
        totalSets: 5,
        imagesByVariant: {
          large: 50,
          art_crop: 100,
        },
        cardsBySet: {
          lea: 30,
          leb: 70,
        },
      });
    });
  });
});