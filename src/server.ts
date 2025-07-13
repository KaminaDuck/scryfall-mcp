/**
 * Main MCP server configuration for the Scryfall server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool implementations
import {
  mcpSearchCards,
  mcpGetCardArtwork
} from './tools/searchTools.js';
import {
  mcpDownloadCard,
  mcpDownloadArtCrop
} from './tools/downloadTools.js';
import {
  mcpVerifyDatabase,
  mcpScanDirectory,
  mcpCleanDatabase,
  mcpDatabaseReport
} from './tools/databaseTools.js';

// Import resource implementations
import {
  cardById,
  cardByName,
  randomCard
} from './resources/cardResources.js';
import {
  databaseStats
} from './resources/databaseResources.js';
import {
  serveCardImage,
  serveArtCrop,
  serveMetadata
} from './resources/fileResources.js';

import { logger } from './logger.js';
import { getStorageDirectory, ensureDirectoryPermissions, isMcpMode } from './config.js';

// Create the MCP server
export const server = new Server({
  name: 'scryfall-server',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {}
  }
});

// Initialize the server with enhanced error handling and validation
async function initializeServer() {
  try {
    logger.info('[Setup] Initializing Scryfall MCP server...');
    
    // Enhanced pre-startup checks
    if (isMcpMode()) {
      logger.info('[Setup] Running in MCP mode - performing storage validation');
      
      // Validate storage directory with detailed error handling
      let storageDir: string;
      try {
        storageDir = await getStorageDirectory();
        logger.info(`[Setup] Storage directory resolved: ${storageDir}`);
      } catch (storageError: any) {
        const errorMsg = `Failed to resolve storage directory: ${storageError.message}`;
        logger.error(`[Setup] ${errorMsg}`);
        throw new Error(`Server initialization failed - ${errorMsg}`);
      }
      
      // Verify directory permissions with fallback mechanism
      try {
        const hasPermissions = await ensureDirectoryPermissions(storageDir);
        if (!hasPermissions) {
          logger.error(`[Setup] Critical: Cannot write to storage directory: ${storageDir}`);
          logger.error('[Setup] This will prevent file downloads from working.');
          logger.error('[Setup] Please ensure the directory exists and is writable, or set SCRYFALL_DATA_DIR to a valid path.');
          
          // In MCP mode, this is more critical - consider it an error
          if (process.env['MCP_ENABLE_FILE_DOWNLOADS'] === 'true') {
            throw new Error(`Storage directory ${storageDir} is not writable and file downloads are enabled`);
          } else {
            logger.warn('[Setup] Continuing without file download capability');
          }
        } else {
          logger.info(`[Setup] Storage directory permissions verified: ${storageDir}`);
        }
      } catch (permissionError: any) {
        const errorMsg = `Storage directory permission check failed: ${permissionError.message}`;
        logger.error(`[Setup] ${errorMsg}`);
        throw new Error(`Server initialization failed - ${errorMsg}`);
      }
      
      // Verify required subdirectories can be created
      try {
        const cardImagesDir = await getStorageDirectory('scryfall_card_images');
        const artCropsDir = await getStorageDirectory('scryfall_images');
        logger.info(`[Setup] Subdirectories verified: card images (${cardImagesDir}), art crops (${artCropsDir})`);
      } catch (subdirError: any) {
        const errorMsg = `Failed to create required subdirectories: ${subdirError.message}`;
        logger.error(`[Setup] ${errorMsg}`);
        throw new Error(`Server initialization failed - ${errorMsg}`);
      }
    } else {
      logger.info('[Setup] Running in standalone mode');
    }
    
    // Additional system checks
    try {
      // Verify Node.js version compatibility
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0');
      if (majorVersion < 18) {
        logger.warn(`[Setup] Warning: Node.js version ${nodeVersion} detected. Version 18+ is recommended.`);
      } else {
        logger.info(`[Setup] Node.js version ${nodeVersion} is compatible`);
      }
      
      // Verify required environment variables if in MCP mode
      if (isMcpMode()) {
        const requiredEnvVars = ['MCP_SERVER_NAME', 'MCP_ENABLE_FILE_DOWNLOADS'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
          logger.info(`[Setup] Optional environment variables not set: ${missingVars.join(', ')}`);
        }
      }
      
    } catch (systemCheckError: any) {
      logger.warn(`[Setup] System check warnings: ${systemCheckError.message}`);
      // Don't fail initialization for system check warnings
    }
    
    logger.info('[Setup] ✓ Scryfall MCP server initialized successfully');
    logger.info('[Setup] ✓ Ready to handle MCP requests');
    
  } catch (error: any) {
    logger.error(`[Setup] ✗ Server initialization failed: ${error.message || error}`);
    logger.error('[Setup] Please check the error details above and resolve any issues before retrying');
    throw new Error(`Scryfall MCP server initialization failed: ${error.message || error}`);
  }
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'mcp_search_cards',
        description: 'Search for Magic: The Gathering cards using the Scryfall API',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to use (e.g., "lightning bolt", "t:creature c:red")'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'mcp_download_card',
        description: 'Download a high-resolution image of a specific Magic: The Gathering card',
        inputSchema: {
          type: 'object',
          properties: {
            card_name: {
              type: 'string',
              description: 'The name of the card to download'
            },
            set_code: {
              type: 'string',
              description: 'Optional set code to specify a particular printing (e.g., "m10", "znr")'
            },
            collector_number: {
              type: 'string',
              description: 'Optional collector number to specify a particular printing'
            },
            force_download: {
              type: 'boolean',
              description: 'Whether to force download even if the card already exists',
              default: false
            }
          },
          required: ['card_name']
        }
      },
      {
        name: 'mcp_download_art_crop',
        description: 'Download an art crop image of a specific Magic: The Gathering card',
        inputSchema: {
          type: 'object',
          properties: {
            card_name: {
              type: 'string',
              description: 'The name of the card to download'
            },
            set_code: {
              type: 'string',
              description: 'Optional set code to specify a particular printing (e.g., "m10", "znr")'
            },
            collector_number: {
              type: 'string',
              description: 'Optional collector number to specify a particular printing'
            },
            force_download: {
              type: 'boolean',
              description: 'Whether to force download even if the card already exists',
              default: false
            }
          },
          required: ['card_name']
        }
      },
      {
        name: 'mcp_get_card_artwork',
        description: 'Get the artwork for a specific Magic: The Gathering card',
        inputSchema: {
          type: 'object',
          properties: {
            card_id: {
              type: 'string',
              description: 'The Scryfall ID of the card'
            }
          },
          required: ['card_id']
        }
      },
      {
        name: 'mcp_verify_database',
        description: 'Verify database integrity by checking if all referenced files exist',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'mcp_scan_directory',
        description: 'Scan a directory for image files and optionally add them to the database',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory to scan'
            },
            update_db: {
              type: 'boolean',
              description: 'Whether to update the database with found files',
              default: false
            }
          },
          required: ['directory']
        }
      },
      {
        name: 'mcp_clean_database',
        description: 'Clean the database by removing records for files that no longer exist',
        inputSchema: {
          type: 'object',
          properties: {
            execute: {
              type: 'boolean',
              description: 'If true, actually remove records; if false, only report what would be removed',
              default: false
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'mcp_database_report',
        description: 'Generate a comprehensive report on the database status',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!args) {
      throw new Error('Arguments are required but not provided');
    }

    switch (name) {
      case 'mcp_search_cards':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await mcpSearchCards(args?.['query'] as string), null, 2)
            }
          ]
        };

      case 'mcp_download_card':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await mcpDownloadCard(
                  args?.['card_name'] as string,
                  args?.['set_code'] as string | undefined,
                  args?.['collector_number'] as string | undefined,
                  (args?.['force_download'] as boolean) || false
                ),
                null,
                2
              )
            }
          ]
        };

      case 'mcp_download_art_crop':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await mcpDownloadArtCrop(
                  args?.['card_name'] as string,
                  args?.['set_code'] as string | undefined,
                  args?.['collector_number'] as string | undefined,
                  (args?.['force_download'] as boolean) || false
                ),
                null,
                2
              )
            }
          ]
        };

      case 'mcp_get_card_artwork':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await mcpGetCardArtwork(args?.['card_id'] as string), null, 2)
            }
          ]
        };

      case 'mcp_verify_database':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await mcpVerifyDatabase(), null, 2)
            }
          ]
        };

      case 'mcp_scan_directory':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await mcpScanDirectory(args?.['directory'] as string, args?.['update_db'] as boolean || false),
                null,
                2
              )
            }
          ]
        };

      case 'mcp_clean_database':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await mcpCleanDatabase(args?.['execute'] as boolean || false), null, 2)
            }
          ]
        };

      case 'mcp_database_report':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await mcpDatabaseReport(), null, 2)
            }
          ]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
          })
        }
      ],
      isError: true
    };
  }
});

// Register resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'resource://card/{card_id}',
        name: 'Card by ID',
        description: 'Get detailed card information by Scryfall ID',
        mimeType: 'application/json'
      },
      {
        uri: 'resource://card/name/{card_name}',
        name: 'Card by Name',
        description: 'Get detailed card information by name',
        mimeType: 'application/json'
      },
      {
        uri: 'resource://random_card',
        name: 'Random Card',
        description: 'Get a random Magic: The Gathering card',
        mimeType: 'application/json'
      },
      {
        uri: 'resource://database/stats',
        name: 'Database Statistics',
        description: 'Get statistics about the card database',
        mimeType: 'application/json'
      },
      {
        uri: 'resource://download/card/{file_id}',
        name: 'Downloaded Card Image',
        description: 'Access downloaded card images by file ID',
        mimeType: 'image/*'
      },
      {
        uri: 'resource://download/art/{file_id}',
        name: 'Downloaded Art Crop',
        description: 'Access downloaded art crop images by file ID',
        mimeType: 'image/*'
      },
      {
        uri: 'resource://download/metadata/{file_id}',
        name: 'Card Metadata',
        description: 'Access JSON metadata for downloaded cards',
        mimeType: 'application/json'
      }
    ]
  };
});

// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    // Parse the URI and route to appropriate handler
    if (uri.startsWith('resource://card/name/')) {
      const cardName = uri.replace('resource://card/name/', '');
      const [content, mimeType] = await cardByName(decodeURIComponent(cardName));
      return {
        contents: [
          {
            uri,
            mimeType,
            text: content
          }
        ]
      };
    } else if (uri.startsWith('resource://card/')) {
      const cardId = uri.replace('resource://card/', '');
      const [content, mimeType] = await cardById(cardId);
      return {
        contents: [
          {
            uri,
            mimeType,
            text: content
          }
        ]
      };
    } else if (uri === 'resource://random_card') {
      const [content, mimeType] = await randomCard();
      return {
        contents: [
          {
            uri,
            mimeType,
            text: content
          }
        ]
      };
    } else if (uri === 'resource://database/stats') {
      const [content, mimeType] = await databaseStats();
      return {
        contents: [
          {
            uri,
            mimeType,
            text: content
          }
        ]
      };
    } else if (uri.startsWith('resource://download/card/')) {
      const fileId = uri.replace('resource://download/card/', '');
      const [content, mimeType] = await serveCardImage(fileId);
      return {
        contents: [
          {
            uri,
            mimeType,
            blob: content instanceof Buffer ? content : Buffer.from(content)
          }
        ]
      };
    } else if (uri.startsWith('resource://download/art/')) {
      const fileId = uri.replace('resource://download/art/', '');
      const [content, mimeType] = await serveArtCrop(fileId);
      return {
        contents: [
          {
            uri,
            mimeType,
            blob: content instanceof Buffer ? content : Buffer.from(content)
          }
        ]
      };
    } else if (uri.startsWith('resource://download/metadata/')) {
      const fileId = uri.replace('resource://download/metadata/', '');
      const [content, mimeType] = await serveMetadata(fileId);
      return {
        contents: [
          {
            uri,
            mimeType,
            text: content
          }
        ]
      };
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }
  } catch (error) {
    logger.error(`Error reading resource ${uri}:`, error);
    const errorResponse = JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: errorResponse
        }
      ]
    };
  }
});

// Initialize server on startup
initializeServer().catch((error) => {
  logger.error('[Setup] Failed to initialize server:', error);
  process.exit(1);
});