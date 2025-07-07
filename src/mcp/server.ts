import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ScryfallClient } from '../services/scryfall-client.js';
import { ImageDownloader } from '../services/image-downloader.js';
import { GraphService } from '../services/graph-service.js';
import { PrintService } from '../services/print-service.js';
import { MCPTools } from './tools.js';
import { MCPResources } from './resources.js';
import { ensurePrintDirectory } from '../config/index.js';

export class MCPServer {
  private server: Server;
  private scryfallClient: ScryfallClient;
  private imageDownloader: ImageDownloader;
  private graphService: GraphService;
  private printService: PrintService;
  private mcpTools: MCPTools;
  private mcpResources: MCPResources;

  constructor() {
    this.server = new Server(
      {
        name: 'scryfall-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          logging: {},
        },
      },
    );

    this.scryfallClient = new ScryfallClient();
    this.imageDownloader = new ImageDownloader();
    this.graphService = new GraphService();
    this.printService = new PrintService();
    this.mcpTools = new MCPTools(this.scryfallClient, this.imageDownloader, this.graphService, this.printService);
    this.mcpResources = new MCPResources(this.scryfallClient, this.graphService);

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.mcpTools.getTools();
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.mcpTools.handleToolCall(name, args);
        
        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result.data, null, 2),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${result.error}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = this.mcpResources.getResources();
      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      try {
        const data = await this.mcpResources.handleResourceRequest(uri);
        
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to read resource ${uri}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    this.server.onerror = (error) => {
      console.error('MCP Server error:', error);
    };
  }

  async start(): Promise<void> {
    try {
      await this.graphService.connect();
      await this.graphService.createConstraintsAndIndexes();
      
      // Ensure print output directory exists
      ensurePrintDirectory();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error('Scryfall MCP server started successfully');
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.graphService.disconnect();
      console.error('Scryfall MCP server stopped');
    } catch (error) {
      console.error('Error stopping MCP server:', error);
    }
  }
}

export async function createServer(): Promise<MCPServer> {
  const server = new MCPServer();
  
  const handleShutdown = async () => {
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  return server;
}