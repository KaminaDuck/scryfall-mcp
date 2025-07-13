/**
 * Configuration module for Scryfall MCP server and standalone scripts.
 */

import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile, unlink, access } from 'node:fs/promises';
import { existsSync, constants } from 'node:fs';

/**
 * Detect if running in MCP mode.
 * @returns True if running in MCP mode, false otherwise
 */
export function isMcpMode(): boolean {
  // Check for MCP-specific environment variables or execution context
  return process.env['MCP_SERVER_NAME'] !== undefined || 
         process.env['MCP_ENABLE_FILE_DOWNLOADS'] !== undefined;
}

/**
 * Validate that a directory exists and is writable, throwing descriptive errors if not.
 * @param directory Path to validate
 * @throws Error with descriptive message if directory is invalid
 */
export async function validateStorageDirectory(directory: string): Promise<void> {
  try {
    // Check if path exists
    await access(directory, constants.F_OK);
    
    // Check if it's writable
    await access(directory, constants.W_OK);
    
    // Try to write a test file to ensure write permissions work
    const testFile = join(directory, '.scryfall_write_test');
    try {
      await writeFile(testFile, 'test');
      await unlink(testFile);
    } catch (writeError) {
      throw new Error(`Directory ${directory} exists but is not writable: ${writeError}`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Storage directory does not exist: ${directory}`);
    } else if (error.code === 'EACCES') {
      throw new Error(`Permission denied for directory: ${directory}`);
    } else if (error.message?.includes('not writable')) {
      throw error;
    } else {
      throw new Error(`Invalid storage directory ${directory}: ${error.message || error}`);
    }
  }
}

/**
 * Get the appropriate storage directory based on execution mode.
 * @param subdirectory Optional subdirectory name within the storage directory
 * @returns Path string for the storage directory
 */
export async function getStorageDirectory(subdirectory?: string): Promise<string> {
  let baseDir: string;
  
  try {
    // Check for environment variable override
    if (process.env['SCRYFALL_DATA_DIR']) {
      baseDir = process.env['SCRYFALL_DATA_DIR'];
      console.log(`Using environment variable SCRYFALL_DATA_DIR: ${baseDir}`);
    } else if (isMcpMode()) {
      // In MCP mode, use temp directory or XDG cache
      const xdgCache = process.env['XDG_CACHE_HOME'];
      if (xdgCache) {
        baseDir = join(xdgCache, 'scryfall_mcp');
        console.log(`Using XDG cache directory: ${baseDir}`);
      } else {
        baseDir = join(tmpdir(), 'scryfall_downloads');
        console.log(`Using temporary directory: ${baseDir}`);
      }
    } else {
      // Standalone mode - use traditional .local directory
      baseDir = join(homedir(), '.local');
      console.log(`Using home directory storage: ${baseDir}`);
    }
    
    // Add subdirectory if specified
    const storageDir = subdirectory ? join(baseDir, subdirectory) : baseDir;
    
    // Ensure directory exists with better error handling
    try {
      await mkdir(storageDir, { recursive: true });
      console.log(`Created/verified storage directory: ${storageDir}`);
    } catch (mkdirError: any) {
      throw new Error(`Failed to create storage directory ${storageDir}: ${mkdirError.message || mkdirError}`);
    }
    
    // Validate the directory is accessible and writable
    await validateStorageDirectory(storageDir);
    
    return storageDir;
  } catch (error: any) {
    // Fallback mechanism - try alternative directories
    console.error(`Error with primary storage directory: ${error.message}`);
    
    const fallbackDirs = [
      join(tmpdir(), 'scryfall_fallback'),
      join(process.cwd(), 'temp_scryfall')
    ];
    
    for (const fallback of fallbackDirs) {
      try {
        const fallbackPath = subdirectory ? join(fallback, subdirectory) : fallback;
        await mkdir(fallbackPath, { recursive: true });
        await validateStorageDirectory(fallbackPath);
        console.log(`Using fallback directory: ${fallbackPath}`);
        return fallbackPath;
      } catch (fallbackError) {
        console.error(`Fallback ${fallback} also failed: ${fallbackError}`);
        continue;
      }
    }
    
    throw new Error(`Unable to create or access any storage directory. Last error: ${error.message}`);
  }
}

/**
 * Get the directory for card images.
 * @returns Path string for the card images directory
 */
export async function getCardImagesDirectory(): Promise<string> {
  if (isMcpMode()) {
    return await getStorageDirectory('scryfall_card_images');
  } else {
    return await getStorageDirectory('scryfall_card_images');
  }
}

/**
 * Get the directory for art crops.
 * @returns Path string for the art crops directory
 */
export async function getArtCropsDirectory(): Promise<string> {
  if (isMcpMode()) {
    return await getStorageDirectory('scryfall_images');
  } else {
    return await getStorageDirectory('scryfall_images');
  }
}

/**
 * Get the path for the database file.
 * @returns Path string for the database file
 */
export async function getDatabasePath(): Promise<string> {
  const storageDir = await getStorageDirectory();
  return join(storageDir, 'scryfall_database.db');
}

/**
 * Check if we have write permissions to a directory.
 * @param directory Path to check
 * @returns True if we can write to the directory, false otherwise
 */
export async function ensureDirectoryPermissions(directory: string): Promise<boolean> {
  try {
    // Try to create a test file
    const testFile = join(directory, '.permission_test');
    await writeFile(testFile, '');
    await unlink(testFile);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Generate a file path within the base directory.
 * @param baseDir Base directory path
 * @param filename Name of the file
 * @returns Full path to the file
 */
export function getFilePath(baseDir: string, filename: string): string {
  return join(baseDir, filename);
}

/**
 * Check if a directory exists.
 * @param path Path to check
 * @returns True if the directory exists, false otherwise
 */
export function directoryExists(path: string): boolean {
  return existsSync(path);
}