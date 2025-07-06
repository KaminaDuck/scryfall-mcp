import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Helper to get environment variable with fallback
function getEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value) {
    const num = parseInt(value, 10);
    return isNaN(num) ? defaultValue : num;
  }
  return defaultValue;
}

// Default data directory
const defaultDataDir = join(homedir(), '.scryfall_mcp');

export const CONFIG = {
  // Database configuration
  DATABASE_PATH: getEnvVar('SCRYFALL_DATABASE_PATH', join(defaultDataDir, 'scryfall.db')),
  
  // Image storage paths
  CARD_IMAGES_DIR: getEnvVar('SCRYFALL_CARD_IMAGES_DIR', join(defaultDataDir, 'card-images')),
  ART_CROPS_DIR: getEnvVar('SCRYFALL_ART_CROPS_DIR', join(defaultDataDir, 'art-crops')),
  
  // API configuration
  SCRYFALL_API_BASE: 'https://api.scryfall.com',
  RATE_LIMIT_DELAY: getEnvNumber('SCRYFALL_RATE_LIMIT_DELAY', 100), // milliseconds
  
  // Download configuration
  MAX_RETRIES: 3,
  TIMEOUT: 30000, // 30 seconds
  MAX_CONCURRENT_DOWNLOADS: getEnvNumber('SCRYFALL_MAX_CONCURRENT_DOWNLOADS', 3),
  
  // Pagination
  DEFAULT_PAGE_SIZE: 175,
  
  // Logging
  VERBOSE_LOGGING: process.env.SCRYFALL_VERBOSE_LOGGING === 'true',
} as const;

export function ensureDirectoryExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function initializeDirectories(): void {
  ensureDirectoryExists(CONFIG.CARD_IMAGES_DIR);
  ensureDirectoryExists(CONFIG.ART_CROPS_DIR);
  ensureDirectoryExists(join(CONFIG.DATABASE_PATH, '..'));
}

export function resolveHomePath(path: string): string {
  return path.startsWith('~') ? join(homedir(), path.slice(1)) : path;
}