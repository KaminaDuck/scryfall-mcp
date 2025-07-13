#!/usr/bin/env node

/**
 * Scryfall MCP Server - Main Entry Point
 * 
 * This module serves as the entry point for the Scryfall MCP server,
 * initializing the server and handling the startup process.
 */

import { server } from './server.js';
import { logger } from './logger.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

async function main(): Promise<void> {
  try {
    logger.info('[Setup] Starting Scryfall MCP server...');
    
    // Create stdio transport for MCP communication
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    logger.info('[Setup] Scryfall MCP server is running');
    
    // Handle process termination gracefully
    process.on('SIGINT', async () => {
      logger.info('[Setup] Received SIGINT, shutting down gracefully...');
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('[Setup] Received SIGTERM, shutting down gracefully...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('[Setup] Failed to start Scryfall MCP server:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('[Setup] Unhandled error:', error);
    process.exit(1);
  });
}