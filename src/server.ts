import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  InitializeRequestSchema,
  Tool,
  Resource,
} from '@modelcontextprotocol/sdk/types.js';

import { initializeDirectories } from './config.js';
import { formatError } from './lib/utils.js';

// Import tools
import { mcp_search_cards } from './tools/search.js';
import { 
  mcp_download_card, 
  mcp_download_art_crop, 
  mcp_batch_download, 
  mcp_batch_download_art_crops 
} from './tools/download.js';
import { 
  mcp_get_card_artwork, 
  mcp_get_card_artwork_by_name, 
  mcp_get_random_card_artwork,
  mcp_get_card_image_urls 
} from './tools/artwork.js';
import { 
  mcp_verify_database, 
  mcp_scan_directory, 
  mcp_clean_database, 
  mcp_database_report,
  mcp_get_card_info,
  mcp_search_database,
  mcp_remove_card,
  mcp_get_database_stats
} from './tools/database.js';

// Import resources
import { 
  getCardById, 
  getCardByName, 
  getRandomCard, 
  getCardBySetAndNumber,
  searchCards,
  autocompleteCardName,
  getCardPrintings,
  getCardRulings
} from './resources/cards.js';
import { 
  getDatabaseStats, 
  getDatabaseReport,
  getCardInfo,
  searchDatabaseCards,
  getCardsBySet,
  getAllCards
} from './resources/database.js';

// Define tools
const tools: Tool[] = [
  {
    name: 'mcp_search_cards',
    description: 'Search for Magic: The Gathering cards using Scryfall API',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for cards (e.g., "Lightning Bolt", "c:red", "type:creature")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'mcp_download_card',
    description: 'Download a Magic: The Gathering card image',
    inputSchema: {
      type: 'object',
      properties: {
        card_name: {
          type: 'string',
          description: 'Name of the card to download',
        },
        set_code: {
          type: 'string',
          description: 'Optional set code to specify which printing to download',
        },
        collector_number: {
          type: 'string',
          description: 'Optional collector number to specify exact card',
        },
        force: {
          type: 'boolean',
          description: 'Force download even if card already exists',
          default: false,
        },
      },
      required: ['card_name'],
    },
  },
  {
    name: 'mcp_download_art_crop',
    description: 'Download art crop image for a Magic: The Gathering card',
    inputSchema: {
      type: 'object',
      properties: {
        card_name: {
          type: 'string',
          description: 'Name of the card to download art crop for',
        },
        set_code: {
          type: 'string',
          description: 'Optional set code to specify which printing to download',
        },
        collector_number: {
          type: 'string',
          description: 'Optional collector number to specify exact card',
        },
        force: {
          type: 'boolean',
          description: 'Force download even if art crop already exists',
          default: false,
        },
      },
      required: ['card_name'],
    },
  },
  {
    name: 'mcp_batch_download',
    description: 'Download multiple Magic: The Gathering card images',
    inputSchema: {
      type: 'object',
      properties: {
        card_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of card names to download',
        },
        set_code: {
          type: 'string',
          description: 'Optional set code to specify which printing to download for all cards',
        },
        force: {
          type: 'boolean',
          description: 'Force download even if cards already exist',
          default: false,
        },
      },
      required: ['card_names'],
    },
  },
  {
    name: 'mcp_batch_download_art_crops',
    description: 'Download art crops for multiple Magic: The Gathering cards',
    inputSchema: {
      type: 'object',
      properties: {
        card_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of card names to download art crops for',
        },
        set_code: {
          type: 'string',
          description: 'Optional set code to specify which printing to download for all cards',
        },
        force: {
          type: 'boolean',
          description: 'Force download even if art crops already exist',
          default: false,
        },
      },
      required: ['card_names'],
    },
  },
  {
    name: 'mcp_get_card_artwork',
    description: 'Get artwork URLs for a Magic: The Gathering card by ID',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: {
          type: 'string',
          description: 'Scryfall card ID',
        },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'mcp_get_card_artwork_by_name',
    description: 'Get artwork URLs for a Magic: The Gathering card by name',
    inputSchema: {
      type: 'object',
      properties: {
        card_name: {
          type: 'string',
          description: 'Name of the card',
        },
        set_code: {
          type: 'string',
          description: 'Optional set code to specify which printing',
        },
      },
      required: ['card_name'],
    },
  },
  {
    name: 'mcp_get_random_card_artwork',
    description: 'Get artwork URLs for a random Magic: The Gathering card',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mcp_get_card_image_urls',
    description: 'Get all image URLs for a Magic: The Gathering card',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: {
          type: 'string',
          description: 'Scryfall card ID',
        },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'mcp_verify_database',
    description: 'Verify database integrity and check for missing files',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mcp_scan_directory',
    description: 'Scan directories for images and add them to the database',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mcp_clean_database',
    description: 'Clean database by removing records for missing files',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mcp_database_report',
    description: 'Generate comprehensive database report',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mcp_get_card_info',
    description: 'Get card information from the local database',
    inputSchema: {
      type: 'object',
      properties: {
        card_name: {
          type: 'string',
          description: 'Name of the card',
        },
        set_code: {
          type: 'string',
          description: 'Optional set code to specify which printing',
        },
      },
      required: ['card_name'],
    },
  },
  {
    name: 'mcp_search_database',
    description: 'Search the local database for cards',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for card names',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'mcp_remove_card',
    description: 'Remove a card from the local database',
    inputSchema: {
      type: 'object',
      properties: {
        card_name: {
          type: 'string',
          description: 'Name of the card to remove',
        },
        set_code: {
          type: 'string',
          description: 'Optional set code to specify which printing',
        },
      },
      required: ['card_name'],
    },
  },
  {
    name: 'mcp_get_database_stats',
    description: 'Get database statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Define resources
const resources: Resource[] = [
  {
    uri: 'scryfall://cards/by-id/{card_id}',
    name: 'Card by ID',
    description: 'Get Magic: The Gathering card data by Scryfall ID',
    mimeType: 'application/json',
  },
  {
    uri: 'scryfall://cards/by-name/{card_name}',
    name: 'Card by Name',
    description: 'Get Magic: The Gathering card data by name',
    mimeType: 'application/json',
  },
  {
    uri: 'scryfall://cards/by-set/{set_code}/{collector_number}',
    name: 'Card by Set and Number',
    description: 'Get Magic: The Gathering card data by set and collector number',
    mimeType: 'application/json',
  },
  {
    uri: 'scryfall://cards/random',
    name: 'Random Card',
    description: 'Get a random Magic: The Gathering card',
    mimeType: 'application/json',
  },
  {
    uri: 'scryfall://cards/search?q={query}',
    name: 'Search Cards',
    description: 'Search for Magic: The Gathering cards',
    mimeType: 'application/json',
  },
  {
    uri: 'scryfall://cards/autocomplete?q={query}',
    name: 'Autocomplete Card Names',
    description: 'Get card name suggestions for autocomplete',
    mimeType: 'application/json',
  },
  {
    uri: 'scryfall://cards/{card_id}/prints',
    name: 'Card Printings',
    description: 'Get all printings of a Magic: The Gathering card',
    mimeType: 'application/json',
  },
  {
    uri: 'scryfall://cards/{card_id}/rulings',
    name: 'Card Rulings',
    description: 'Get rulings for a Magic: The Gathering card',
    mimeType: 'application/json',
  },
  {
    uri: 'database://stats',
    name: 'Database Statistics',
    description: 'Get statistics about the local card database',
    mimeType: 'application/json',
  },
  {
    uri: 'database://report',
    name: 'Database Report',
    description: 'Get comprehensive report about the local card database',
    mimeType: 'application/json',
  },
  {
    uri: 'database://cards/by-name/{card_name}',
    name: 'Database Card Info',
    description: 'Get card information from the local database',
    mimeType: 'application/json',
  },
  {
    uri: 'database://cards/search?q={query}',
    name: 'Database Search',
    description: 'Search the local database for cards',
    mimeType: 'application/json',
  },
  {
    uri: 'database://cards/by-set/{set_code}',
    name: 'Database Cards by Set',
    description: 'Get all cards in a set from the local database',
    mimeType: 'application/json',
  },
  {
    uri: 'database://cards/all',
    name: 'All Database Cards',
    description: 'Get all cards from the local database',
    mimeType: 'application/json',
  },
];

// Create server
const server = new Server(
  {
    name: 'scryfall-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Initialize directories
initializeDirectories();

// Set up request handlers
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  return {
    protocolVersion: request.params.protocolVersion,
    capabilities: {
      tools: {},
      resources: {},
    },
    serverInfo: {
      name: 'scryfall-mcp',
      version: '1.0.0',
    },
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources };
});

// Helper function to safely extract arguments
function getRequiredArg<T>(args: any, key: string, defaultValue?: T): T {
  if (!args || args[key] === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required argument: ${key}`);
  }
  return args[key] as T;
}

function getOptionalArg<T>(args: any, key: string, defaultValue: T): T {
  if (!args || args[key] === undefined) {
    return defaultValue;
  }
  return args[key] as T;
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'mcp_search_cards':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_search_cards(getRequiredArg<string>(args, 'query'))) }] };
      
      case 'mcp_download_card':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_download_card(
          getRequiredArg<string>(args, 'card_name'),
          getOptionalArg<string>(args, 'set_code', ''),
          getOptionalArg<string>(args, 'collector_number', ''),
          getOptionalArg<boolean>(args, 'force', false)
        )) }] };
      
      case 'mcp_download_art_crop':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_download_art_crop(
          getRequiredArg<string>(args, 'card_name'),
          getOptionalArg<string>(args, 'set_code', ''),
          getOptionalArg<string>(args, 'collector_number', ''),
          getOptionalArg<boolean>(args, 'force', false)
        )) }] };
      
      case 'mcp_batch_download':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_batch_download(
          getRequiredArg<string[]>(args, 'card_names'),
          getOptionalArg<string>(args, 'set_code', ''),
          getOptionalArg<boolean>(args, 'force', false)
        )) }] };
      
      case 'mcp_batch_download_art_crops':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_batch_download_art_crops(
          getRequiredArg<string[]>(args, 'card_names'),
          getOptionalArg<string>(args, 'set_code', ''),
          getOptionalArg<boolean>(args, 'force', false)
        )) }] };
      
      case 'mcp_get_card_artwork':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_get_card_artwork(getRequiredArg<string>(args, 'card_id'))) }] };
      
      case 'mcp_get_card_artwork_by_name':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_get_card_artwork_by_name(
          getRequiredArg<string>(args, 'card_name'),
          getOptionalArg<string>(args, 'set_code', '')
        )) }] };
      
      case 'mcp_get_random_card_artwork':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_get_random_card_artwork()) }] };
      
      case 'mcp_get_card_image_urls':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_get_card_image_urls(getRequiredArg<string>(args, 'card_id'))) }] };
      
      case 'mcp_verify_database':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_verify_database()) }] };
      
      case 'mcp_scan_directory':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_scan_directory()) }] };
      
      case 'mcp_clean_database':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_clean_database()) }] };
      
      case 'mcp_database_report':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_database_report()) }] };
      
      case 'mcp_get_card_info':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_get_card_info(
          getRequiredArg<string>(args, 'card_name'),
          getOptionalArg<string>(args, 'set_code', '')
        )) }] };
      
      case 'mcp_search_database':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_search_database(getRequiredArg<string>(args, 'query'))) }] };
      
      case 'mcp_remove_card':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_remove_card(
          getRequiredArg<string>(args, 'card_name'),
          getOptionalArg<string>(args, 'set_code', '')
        )) }] };
      
      case 'mcp_get_database_stats':
        return { content: [{ type: 'text', text: JSON.stringify(await mcp_get_database_stats()) }] };
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = formatError(error);
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          status: 'error', 
          message: errorMessage 
        }) 
      }] 
    };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri.startsWith('scryfall://cards/by-id/')) {
      const cardId = uri.replace('scryfall://cards/by-id/', '');
      return { contents: [{ type: 'text', text: JSON.stringify(await getCardById(cardId)) }] };
    }
    
    if (uri.startsWith('scryfall://cards/by-name/')) {
      const cardName = decodeURIComponent(uri.replace('scryfall://cards/by-name/', ''));
      return { contents: [{ type: 'text', text: JSON.stringify(await getCardByName(cardName)) }] };
    }
    
    if (uri.startsWith('scryfall://cards/by-set/')) {
      const parts = uri.replace('scryfall://cards/by-set/', '').split('/');
      const setCode = parts[0];
      const collectorNumber = parts[1];
      return { contents: [{ type: 'text', text: JSON.stringify(await getCardBySetAndNumber(setCode, collectorNumber)) }] };
    }
    
    if (uri === 'scryfall://cards/random') {
      return { contents: [{ type: 'text', text: JSON.stringify(await getRandomCard()) }] };
    }
    
    if (uri.startsWith('scryfall://cards/search?q=')) {
      const query = decodeURIComponent(uri.replace('scryfall://cards/search?q=', ''));
      return { contents: [{ type: 'text', text: JSON.stringify(await searchCards(query)) }] };
    }
    
    if (uri.startsWith('scryfall://cards/autocomplete?q=')) {
      const query = decodeURIComponent(uri.replace('scryfall://cards/autocomplete?q=', ''));
      return { contents: [{ type: 'text', text: JSON.stringify(await autocompleteCardName(query)) }] };
    }
    
    if (uri.startsWith('scryfall://cards/') && uri.includes('/prints')) {
      const cardId = uri.replace('scryfall://cards/', '').replace('/prints', '');
      return { contents: [{ type: 'text', text: JSON.stringify(await getCardPrintings(cardId)) }] };
    }
    
    if (uri.startsWith('scryfall://cards/') && uri.includes('/rulings')) {
      const cardId = uri.replace('scryfall://cards/', '').replace('/rulings', '');
      return { contents: [{ type: 'text', text: JSON.stringify(await getCardRulings(cardId)) }] };
    }
    
    if (uri === 'database://stats') {
      return { contents: [{ type: 'text', text: JSON.stringify(await getDatabaseStats()) }] };
    }
    
    if (uri === 'database://report') {
      return { contents: [{ type: 'text', text: JSON.stringify(await getDatabaseReport()) }] };
    }
    
    if (uri.startsWith('database://cards/by-name/')) {
      const cardName = decodeURIComponent(uri.replace('database://cards/by-name/', ''));
      return { contents: [{ type: 'text', text: JSON.stringify(await getCardInfo(cardName)) }] };
    }
    
    if (uri.startsWith('database://cards/search?q=')) {
      const query = decodeURIComponent(uri.replace('database://cards/search?q=', ''));
      return { contents: [{ type: 'text', text: JSON.stringify(await searchDatabaseCards(query)) }] };
    }
    
    if (uri.startsWith('database://cards/by-set/')) {
      const setCode = uri.replace('database://cards/by-set/', '');
      return { contents: [{ type: 'text', text: JSON.stringify(await getCardsBySet(setCode)) }] };
    }
    
    if (uri === 'database://cards/all') {
      return { contents: [{ type: 'text', text: JSON.stringify(await getAllCards()) }] };
    }
    
    throw new Error(`Unknown resource: ${uri}`);
  } catch (error) {
    const errorMessage = formatError(error);
    return { 
      contents: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: errorMessage 
        }) 
      }] 
    };
  }
});

// Error handling
server.onerror = (error) => {
  console.error('Server error:', error);
};

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

// Export the server
export default server;