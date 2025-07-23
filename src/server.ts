/**
 * Main MCP server configuration for the Scryfall server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
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
  serveMetadata,
  serveCardImageFace,
  serveArtCropFace,
  serveMetadataFace
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

// Track whether file operations are available (used for graceful degradation)
let fileOperationsAvailable = false;

// Export the file operations status for use in other modules
export function isFileOperationsAvailable(): boolean {
  return fileOperationsAvailable;
}

// Initialize the server with resilient error handling and graceful degradation
export async function initializeServer() {
  logger.info('[Setup] Initializing Scryfall MCP server...');
  
  try {
    // Log initialization start with detailed environment info
    logger.info('[Setup] Environment details:', {
      platform: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
      mcp_mode: isMcpMode()
    });
    
    // Enhanced pre-startup checks with graceful degradation
    if (isMcpMode()) {
      logger.info('[Setup] Running in MCP mode - performing storage validation');
      
      // Validate storage directory with graceful degradation
      let storageDir: string | null = null;
      try {
        storageDir = await getStorageDirectory();
        logger.info(`[Setup] Storage directory resolved: ${storageDir}`);
      } catch (storageError: any) {
        logger.warn(`[Setup] Failed to resolve storage directory: ${storageError.message}`);
        logger.warn('[Setup] Storage error details:', {
          error: storageError.message,
          code: storageError.code,
          path: storageError.path
        });
        logger.warn('[Setup] File download functionality will be disabled');
        fileOperationsAvailable = false;
      }
      
      // Verify directory permissions with graceful fallback
      if (storageDir) {
        try {
          logger.info('[Setup] Checking storage directory permissions...');
          const hasPermissions = await ensureDirectoryPermissions(storageDir);
          if (!hasPermissions) {
            logger.warn(`[Setup] Cannot write to storage directory: ${storageDir}`);
            logger.warn('[Setup] File downloads will be disabled - server will continue with API-only functionality');
            fileOperationsAvailable = false;
          } else {
            logger.info(`[Setup] Storage directory permissions verified: ${storageDir}`);
            fileOperationsAvailable = true;
          }
        } catch (permissionError: any) {
          logger.warn(`[Setup] Storage directory permission check failed: ${permissionError.message}`);
          logger.warn('[Setup] Permission error details:', {
            error: permissionError.message,
            code: permissionError.code,
            syscall: permissionError.syscall,
            path: permissionError.path
          });
          logger.warn('[Setup] File downloads will be disabled - server will continue with API-only functionality');
          fileOperationsAvailable = false;
        }
      }
      
      // Verify required subdirectories can be created (only if file operations are available)
      if (fileOperationsAvailable && storageDir) {
        try {
          logger.info('[Setup] Verifying subdirectory creation...');
          const cardImagesDir = await getStorageDirectory('scryfall_card_images');
          const artCropsDir = await getStorageDirectory('scryfall_images');
          logger.info(`[Setup] Subdirectories verified: card images (${cardImagesDir}), art crops (${artCropsDir})`);
        } catch (subdirError: any) {
          logger.warn(`[Setup] Failed to create required subdirectories: ${subdirError.message}`);
          logger.warn('[Setup] Subdirectory error details:', {
            error: subdirError.message,
            code: subdirError.code,
            path: subdirError.path
          });
          logger.warn('[Setup] File downloads will be disabled - server will continue with API-only functionality');
          fileOperationsAvailable = false;
        }
      }
      
      // Log the final status of file operations
      if (fileOperationsAvailable) {
        logger.info('[Setup] ✓ File download functionality is available');
      } else {
        logger.info('[Setup] ⚠ File download functionality is disabled - server will provide search and API access only');
      }
    } else {
      logger.info('[Setup] Running in standalone mode');
      try {
        // Even in standalone mode, verify storage is accessible
        const testDir = await getStorageDirectory();
        await ensureDirectoryPermissions(testDir);
        fileOperationsAvailable = true;
        logger.info('[Setup] ✓ Standalone mode storage verified');
      } catch (standaloneError: any) {
        logger.warn('[Setup] Standalone mode storage verification failed:', standaloneError.message);
        fileOperationsAvailable = false;
      }
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
      
      // Log memory usage for diagnostics
      const memUsage = process.memoryUsage();
      logger.info('[Setup] Memory usage:', {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      });
      
    } catch (systemCheckError: any) {
      logger.warn(`[Setup] System check warnings: ${systemCheckError.message}`);
      // Don't fail initialization for system check warnings
    }
    
    logger.info('[Setup] ✓ Scryfall MCP server initialized successfully');
    logger.info('[Setup] ✓ Ready to handle MCP requests');
    
  } catch (criticalError: any) {
    // Catch any unexpected errors during initialization
    logger.error('[Setup] CRITICAL: Unexpected error during server initialization:', criticalError);
    logger.error('[Setup] Critical error details:', {
      message: criticalError.message,
      stack: criticalError.stack,
      code: criticalError.code
    });
    
    // Try to continue with minimal functionality
    fileOperationsAvailable = false;
    logger.warn('[Setup] Attempting to continue with minimal functionality (API-only mode)');
    
    // Re-throw only if we can't recover at all
    if (criticalError.code === 'MODULE_NOT_FOUND' || criticalError.code === 'ERR_INVALID_ARG_TYPE') {
      throw criticalError;
    }
  }
}

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Always available tools (API-based)
  const tools = [
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
    }
  ];

  // File operation dependent tools
  if (fileOperationsAvailable) {
    tools.push(
      {
        name: 'mcp_download_card',
        description: 'Download a high-resolution image of a specific Magic: The Gathering card. Supports transform cards (downloads all faces automatically)',
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
        description: 'Download an art crop image of a specific Magic: The Gathering card. Supports transform cards (downloads all faces automatically)',
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
    );
  }

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!args) {
      throw new Error('Arguments are required but not provided');
    }

    // Check if the requested tool requires file operations
    const fileOperationTools = [
      'mcp_download_card',
      'mcp_download_art_crop',
      'mcp_verify_database',
      'mcp_scan_directory',
      'mcp_clean_database',
      'mcp_database_report'
    ];

    if (fileOperationTools.includes(name) && !fileOperationsAvailable) {
      logger.warn(`[Tool] Tool ${name} requested but file operations are not available`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'File operations are not available. This tool requires write access to the storage directory.',
              details: 'The server is running in API-only mode. You can still search for cards and get card information.',
              tool: name
            }, null, 2)
          }
        ],
        isError: true
      };
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
    logger.error(`[Tool] Error executing tool ${name}:`, error);
    logger.error(`[Tool] Tool arguments:`, args);
    logger.error(`[Tool] Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            tool: name
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
      },
      {
        uri: 'resource://download/card/{file_id}/face/{face_index}',
        name: 'Transform Card Face Image',
        description: 'Access specific face of a transform card by file ID and face index',
        mimeType: 'image/*'
      },
      {
        uri: 'resource://download/art/{file_id}/face/{face_index}',
        name: 'Transform Card Art Crop Face',
        description: 'Access specific art crop face of a transform card by file ID and face index',
        mimeType: 'image/*'
      },
      {
        uri: 'resource://download/metadata/{file_id}/face/{face_index}',
        name: 'Transform Card Face Metadata',
        description: 'Access face-specific metadata for transform cards',
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
      // Check if this is a face-specific request
      const cardPath = uri.replace('resource://download/card/', '');
      if (cardPath.includes('/face/')) {
        const [fileId, facePart] = cardPath.split('/face/');
        const faceIndex = parseInt(facePart || '0', 10);
        if (isNaN(faceIndex)) {
          throw new Error(`Invalid face index: ${facePart}`);
        }
        const [content, mimeType] = await serveCardImageFace(fileId!, faceIndex);
        return {
          contents: [
            {
              uri,
              mimeType,
              blob: content instanceof Buffer ? content : Buffer.from(content)
            }
          ]
        };
      } else {
        // Standard card image request
        const [content, mimeType] = await serveCardImage(cardPath);
        return {
          contents: [
            {
              uri,
              mimeType,
              blob: content instanceof Buffer ? content : Buffer.from(content)
            }
          ]
        };
      }
    } else if (uri.startsWith('resource://download/art/')) {
      // Check if this is a face-specific request
      const artPath = uri.replace('resource://download/art/', '');
      if (artPath.includes('/face/')) {
        const [fileId, facePart] = artPath.split('/face/');
        const faceIndex = parseInt(facePart || '0', 10);
        if (isNaN(faceIndex)) {
          throw new Error(`Invalid face index: ${facePart}`);
        }
        const [content, mimeType] = await serveArtCropFace(fileId!, faceIndex);
        return {
          contents: [
            {
              uri,
              mimeType,
              blob: content instanceof Buffer ? content : Buffer.from(content)
            }
          ]
        };
      } else {
        // Standard art crop request
        const [content, mimeType] = await serveArtCrop(artPath);
        return {
          contents: [
            {
              uri,
              mimeType,
              blob: content instanceof Buffer ? content : Buffer.from(content)
            }
          ]
        };
      }
    } else if (uri.startsWith('resource://download/metadata/')) {
      // Check if this is a face-specific request
      const metadataPath = uri.replace('resource://download/metadata/', '');
      if (metadataPath.includes('/face/')) {
        const [fileId, facePart] = metadataPath.split('/face/');
        const faceIndex = parseInt(facePart || '0', 10);
        if (isNaN(faceIndex)) {
          throw new Error(`Invalid face index: ${facePart}`);
        }
        const [content, mimeType] = await serveMetadataFace(fileId!, faceIndex);
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
        // Standard metadata request
        const [content, mimeType] = await serveMetadata(metadataPath);
        return {
          contents: [
            {
              uri,
              mimeType,
              text: content
            }
          ]
        };
      }
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }
  } catch (error) {
    logger.error(`[Resource] Error reading resource ${uri}:`, error);
    logger.error(`[Resource] Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    const errorResponse = JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      resource: uri
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

// Add prompts list handler (server doesn't provide prompts, but handler prevents JSON-RPC errors)
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: []
  };
});