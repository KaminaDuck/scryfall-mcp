import nock from 'nock';
import { ScryfallClient } from '../../src/services/scryfall-client.js';
import { Card, CardList } from '../../src/types/scryfall.js';

describe('ScryfallClient', () => {
  let client: ScryfallClient;

  beforeEach(() => {
    client = new ScryfallClient();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('searchCards', () => {
    it('should search for cards successfully', async () => {
      const mockResponse: CardList = {
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
          legalities: {
            standard: 'banned',
            pioneer: 'banned',
            modern: 'banned',
            legacy: 'banned',
            pauper: 'not_legal',
            vintage: 'restricted',
            penny: 'not_legal',
            commander: 'banned',
            brawl: 'not_legal',
            historicbrawl: 'not_legal',
            alchemy: 'not_legal',
            paupercommander: 'not_legal',
            duel: 'banned',
            oldschool: 'restricted',
            premodern: 'banned',
          },
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
          artist: 'Christopher Rush',
          border_color: 'black',
          frame: '1993',
          full_art: false,
          textless: false,
          booster: true,
          story_spotlight: false,
          prices: {
            usd: '25000.00',
            usd_foil: null,
            usd_etched: null,
            eur: null,
            eur_foil: null,
            tix: null,
          },
          related_uris: {
            gatherer: 'https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=3',
            tcgplayer_infinite_articles: 'https://infinite.tcgplayer.com/search?contentMode=article&game=magic&partner=scryfall&q=Black+Lotus&utm_campaign=affiliate&utm_medium=api&utm_source=scryfall',
            tcgplayer_infinite_decks: 'https://infinite.tcgplayer.com/search?contentMode=deck&game=magic&partner=scryfall&q=Black+Lotus&utm_campaign=affiliate&utm_medium=api&utm_source=scryfall',
            edhrec: 'https://edhrec.com/route/?cc=Black+Lotus',
          },
        }],
      };

      nock('https://api.scryfall.com')
        .get('/cards/search')
        .query({ q: 'black lotus' })
        .reply(200, mockResponse);

      const result = await client.searchCards({ q: 'black lotus' });

      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Black Lotus');
    });

    it('should handle API errors', async () => {
      nock('https://api.scryfall.com')
        .get('/cards/search')
        .query({ q: 'invalid query' })
        .reply(400, {
          object: 'error',
          code: 'bad_request',
          status: 400,
          details: 'Invalid search query',
        });

      await expect(client.searchCards({ q: 'invalid query' }))
        .rejects
        .toThrow('Scryfall API error: Invalid search query (bad_request)');
    });

    it('should handle rate limiting', async () => {
      nock('https://api.scryfall.com')
        .get('/cards/search')
        .query({ q: 'test' })
        .reply(429, '', { 'Retry-After': '1' })
        .get('/cards/search')
        .query({ q: 'test' })
        .reply(200, {
          object: 'list',
          total_cards: 0,
          has_more: false,
          data: [],
        });

      const result = await client.searchCards({ q: 'test' });
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getCard', () => {
    it('should get a card by ID', async () => {
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

      nock('https://api.scryfall.com')
        .get('/cards/550c74d4-1fcb-406a-b02a-639a760a4380')
        .reply(200, mockCard);

      const result = await client.getCard('550c74d4-1fcb-406a-b02a-639a760a4380');
      expect(result).toEqual(mockCard);
    });
  });

  describe('autocomplete', () => {
    it('should provide autocomplete suggestions', async () => {
      const mockResponse = {
        object: 'catalog',
        total_values: 2,
        data: ['Black Lotus', 'Blacker Lotus'],
      };

      nock('https://api.scryfall.com')
        .get('/cards/autocomplete')
        .query({ q: 'black' })
        .reply(200, mockResponse);

      const result = await client.autocomplete('black');
      expect(result).toEqual(['Black Lotus', 'Blacker Lotus']);
    });
  });
});