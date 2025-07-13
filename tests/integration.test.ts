/**
 * Integration tests for the MCP server functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { server } from '../src/server.js';
import { 
  getStorageDirectory, 
  getCardImagesDirectory, 
  getArtCropsDirectory,
  getDatabasePath 
} from '../src/config.js';

// Rate limiting for API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Integration Tests', () => {
  let testDataDir: string;

  beforeAll(async () => {
    testDataDir = join(tmpdir(), `scryfall-integration-test-${Date.now()}`);
    process.env['SCRYFALL_DATA_DIR'] = testDataDir;
    
    // Add initial delay to avoid hitting rate limits
    await delay(1000);
  });

  afterAll(async () => {
    try {
      await rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration', () => {
    it('should use test data directory', async () => {
      const storageDir = await getStorageDirectory();
      expect(storageDir).toBe(testDataDir);
    });

    it('should create proper subdirectories', async () => {
      const cardImagesDir = await getCardImagesDirectory();
      const artCropsDir = await getArtCropsDirectory();
      const dbPath = await getDatabasePath();

      expect(cardImagesDir).toBe(join(testDataDir, 'scryfall_card_images'));
      expect(artCropsDir).toBe(join(testDataDir, 'scryfall_images'));
      expect(dbPath).toBe(join(testDataDir, 'scryfall_database.db'));
    });
  });

  describe('MCP Server', () => {
    it('should be properly initialized', () => {
      expect(server).toBeDefined();
      expect(typeof server.connect).toBe('function');
      expect(typeof server.close).toBe('function');
    });

    it('should handle list tools request', async () => {
      const listToolsHandler = (server as any).requestHandlers.get('tools/list');
      expect(listToolsHandler).toBeDefined();

      const response = await listToolsHandler({});
      expect(response).toHaveProperty('tools');
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.tools.length).toBeGreaterThan(0);

      // Check for expected tools
      const toolNames = response.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('mcp_search_cards');
      expect(toolNames).toContain('mcp_download_card');
      expect(toolNames).toContain('mcp_download_art_crop');
      expect(toolNames).toContain('mcp_verify_database');
    });

    it('should handle list resources request', async () => {
      const listResourcesHandler = (server as any).requestHandlers.get('resources/list');
      expect(listResourcesHandler).toBeDefined();

      const response = await listResourcesHandler({});
      expect(response).toHaveProperty('resources');
      expect(Array.isArray(response.resources)).toBe(true);
      expect(response.resources.length).toBeGreaterThan(0);

      // Check for expected resources
      const resourceUris = response.resources.map((resource: any) => resource.uri);
      expect(resourceUris).toContain('resource://card/{card_id}');
      expect(resourceUris).toContain('resource://random_card');
      expect(resourceUris).toContain('resource://database/stats');
    });

    it('should execute search tool successfully', async () => {
      await delay(1000); // Rate limiting

      const callToolHandler = (server as any).requestHandlers.get('tools/call');
      expect(callToolHandler).toBeDefined();

      const response = await callToolHandler({
        params: {
          name: 'mcp_search_cards',
          arguments: { query: 'name:"Lightning Bolt"' }
        }
      });

      expect(response).toHaveProperty('content');
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);

      const content = JSON.parse(response.content[0].text);
      expect(content).toHaveProperty('status', 'success');
      expect(content).toHaveProperty('count');
      expect(content.count).toBeGreaterThan(0);
    }, 15000);

    it('should execute database verification tool', async () => {
      const callToolHandler = (server as any).requestHandlers.get('tools/call');
      
      const response = await callToolHandler({
        params: {
          name: 'mcp_verify_database',
          arguments: {}
        }
      });

      expect(response).toHaveProperty('content');
      const content = JSON.parse(response.content[0].text);
      expect(content).toHaveProperty('status', 'success');
      expect(content).toHaveProperty('total_records');
      expect(content).toHaveProperty('missing_files');
      expect(content).toHaveProperty('integrity');
    });

    it('should serve random card resource', async () => {
      await delay(1000); // Rate limiting

      const readResourceHandler = (server as any).requestHandlers.get('resources/read');
      expect(readResourceHandler).toBeDefined();

      const response = await readResourceHandler({
        params: { uri: 'resource://random_card' }
      });

      expect(response).toHaveProperty('contents');
      expect(Array.isArray(response.contents)).toBe(true);
      expect(response.contents.length).toBe(1);

      const content = response.contents[0];
      expect(content).toHaveProperty('mimeType', 'application/json');
      expect(content).toHaveProperty('text');

      const cardData = JSON.parse(content.text);
      expect(cardData).toHaveProperty('name');
      expect(cardData).toHaveProperty('id');
    }, 15000);

    it('should serve database stats resource', async () => {
      const readResourceHandler = (server as any).requestHandlers.get('resources/read');
      
      const response = await readResourceHandler({
        params: { uri: 'resource://database/stats' }
      });

      expect(response).toHaveProperty('contents');
      const content = response.contents[0];
      expect(content).toHaveProperty('mimeType', 'application/json');

      const stats = JSON.parse(content.text);
      expect(stats).toHaveProperty('total_records');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('recent_downloads');
    });

    it('should handle tool errors gracefully', async () => {
      const callToolHandler = (server as any).requestHandlers.get('tools/call');
      
      const response = await callToolHandler({
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      });

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('isError', true);
      
      const content = JSON.parse(response.content[0].text);
      expect(content).toHaveProperty('status', 'error');
      expect(content).toHaveProperty('message');
    });

    it('should handle resource errors gracefully', async () => {
      const readResourceHandler = (server as any).requestHandlers.get('resources/read');
      
      const response = await readResourceHandler({
        params: { uri: 'resource://unknown/resource' }
      });

      expect(response).toHaveProperty('contents');
      const content = response.contents[0];
      expect(content).toHaveProperty('mimeType', 'application/json');

      const errorData = JSON.parse(content.text);
      expect(errorData).toHaveProperty('status', 'error');
      expect(errorData).toHaveProperty('message');
    });
  });
});