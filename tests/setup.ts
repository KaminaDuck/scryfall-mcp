/**
 * Jest test setup file.
 */

import { beforeAll, afterAll } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, mkdir } from 'node:fs/promises';

// Set up test environment variables
process.env['NODE_ENV'] = 'test';
process.env['SCRYFALL_DATA_DIR'] = join(tmpdir(), 'scryfall-mcp-test');

// Global test setup
beforeAll(async () => {
  // Create test directory
  await mkdir(process.env['SCRYFALL_DATA_DIR']!, { recursive: true });
});

// Global test cleanup
afterAll(async () => {
  // Clean up test directory
  try {
    await rm(process.env['SCRYFALL_DATA_DIR']!, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});