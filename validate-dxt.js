#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('Validating Scryfall DXT structure...\n');

// Check required files
const requiredFiles = [
  'manifest.json',
  'package.json',
  'dist/index.js',
  'README.md'
];

let isValid = true;

// Check files exist
console.log('Checking required files:');
for (const file of requiredFiles) {
  const exists = existsSync(file);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) isValid = false;
}

// Validate manifest.json
console.log('\nValidating manifest.json:');
try {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  
  // Check required fields
  const requiredFields = ['dxt_version', 'name', 'version', 'description', 'author', 'server'];
  for (const field of requiredFields) {
    const hasField = field in manifest;
    console.log(`  ${hasField ? '✓' : '✗'} ${field}`);
    if (!hasField) isValid = false;
  }
  
  // Check server configuration
  if (manifest.server) {
    console.log('\nValidating server configuration:');
    const serverChecks = {
      'type is "node"': manifest.server.type === 'node',
      'entry_point exists': !!manifest.server.entry_point,
      'mcp_config exists': !!manifest.server.mcp_config,
      'mcp_config.command exists': !!manifest.server.mcp_config?.command,
      'mcp_config.args exists': !!manifest.server.mcp_config?.args
    };
    
    for (const [check, result] of Object.entries(serverChecks)) {
      console.log(`  ${result ? '✓' : '✗'} ${check}`);
      if (!result) isValid = false;
    }
  }
  
  // Check tools
  if (manifest.tools && Array.isArray(manifest.tools)) {
    console.log(`\nFound ${manifest.tools.length} tools defined`);
  }
  
  // Check user config
  if (manifest.user_config) {
    console.log(`Found ${Object.keys(manifest.user_config).length} user configuration options`);
  }
  
} catch (error) {
  console.error('✗ Failed to parse manifest.json:', error.message);
  isValid = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (isValid) {
  console.log('✓ DXT structure is valid!');
  console.log('\nTo package the extension, run: npm run package');
} else {
  console.log('✗ DXT structure validation failed');
  console.log('\nPlease fix the issues above before packaging');
  process.exit(1);
}