#!/usr/bin/env node

import { createServer } from './mcp/server.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';
import { ConfigurationError } from './utils/errors.js';

async function main(): Promise<void> {
  try {
    logger.info('Starting Scryfall MCP server', {
      version: '1.0.0',
      nodeVersion: process.version,
      logLevel: config.logging.level,
    });

    if (!config.neo4j.password) {
      throw new ConfigurationError(
        'Neo4j password is required. Please set NEO4J_PASSWORD environment variable.',
        'NEO4J_PASSWORD',
      );
    }

    logger.debug('Configuration loaded', {
      neo4jUri: config.neo4j.uri,
      neo4jUsername: config.neo4j.username,
      imageStoragePath: config.storage.imagePath,
      scryfallRateLimit: config.scryfall.rateLimit,
    });

    const server = await createServer();
    
    logger.info('Initializing MCP server...');
    await server.start();
    
    logger.info('Scryfall MCP server is running and ready to accept requests');

  } catch (error) {
    logger.error('Failed to start Scryfall MCP server', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Unhandled error in main process', error);
    process.exit(1);
  });
}