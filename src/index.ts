import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import server from './server.js';

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Scryfall DXT MCP server started and ready');
}

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});