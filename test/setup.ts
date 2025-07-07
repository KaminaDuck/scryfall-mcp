// Global test setup file
// This file is executed before all tests

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
process.env.NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
process.env.NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'test-password';
process.env.IMAGE_STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || './test-images';
process.env.SCRYFALL_RATE_LIMIT = process.env.SCRYFALL_RATE_LIMIT || '10';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.mockCard = {
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

// Suppress console.error during tests unless debugging
const originalError = console.error;
console.error = (...args: any[]) => {
  if (process.env.DEBUG_TESTS) {
    originalError(...args);
  }
};

// Clean up after tests
afterAll(() => {
  // Restore console.error
  console.error = originalError;
});