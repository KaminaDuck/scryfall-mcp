#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
const version = packageJson.version;

import { databaseCommands } from './database.js';
import { bulkCommands } from './bulk-operations.js';
import { searchCommands } from './search.js';

const program = new Command();

program
  .name('scryfall-mcp')
  .description('CLI for Scryfall MCP server - Magic: The Gathering card data integration')
  .version(version);

// Add command groups
program.addCommand(databaseCommands);
program.addCommand(bulkCommands);
program.addCommand(searchCommands);

program.parse();