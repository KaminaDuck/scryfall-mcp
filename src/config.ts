/**
 * Configuration module for Scryfall MCP server and standalone scripts.
 */

import { tmpdir, homedir, platform } from 'node:os';
import { join } from 'node:path';
import { mkdir, writeFile, unlink, access } from 'node:fs/promises';
import { existsSync, constants } from 'node:fs';
import { logger } from './logger.js';

/**
 * Detect if running under Claude Desktop context.
 * @returns True if Claude Desktop is detected
 */
function detectClaudeDesktopContext(): boolean {
  // Check various indicators of Claude Desktop execution
  return !!
    process.env['CLAUDE_DESKTOP'] ||
    process.cwd().includes('AnthropicClaude') ||
    process.env['npm_execpath']?.includes('AnthropicClaude') ||
    process.env['npm_config_user_agent']?.includes('Claude') ||
    // macOS-specific Claude Desktop indicators
    process.cwd().includes('com.anthropic.claude') ||
    process.env['HOME']?.includes('/Library/Application Support/Claude') ||
    false;
}

/**
 * Resolve Windows environment variables that may not be properly expanded by Claude Desktop.
 * @param path Path that may contain unresolved environment variables
 * @returns Path with environment variables resolved
 */
function resolveWindowsEnvironmentVariables(path: string): string {
  if (platform() !== 'win32') {
    return path;
  }

  // Detect Claude Desktop context
  const isClaudeDesktop = detectClaudeDesktopContext();
  
  // Handle common unresolved Windows environment variables
  let resolvedPath = path;
  let hasUnresolvedVars = false;
  
  // Check for literal ${APPDATA} and resolve it
  if (resolvedPath.includes('${APPDATA}')) {
    hasUnresolvedVars = true;
    const appData = process.env['APPDATA'] || getWindowsAppDataPath();
    resolvedPath = resolvedPath.replace(/\$\{APPDATA\}/g, appData);
    logger.info(`[Config] Resolved ${path} to ${resolvedPath}`);
  }
  
  // Check for literal ${LOCALAPPDATA} and resolve it
  if (resolvedPath.includes('${LOCALAPPDATA}')) {
    hasUnresolvedVars = true;
    const localAppData = process.env['LOCALAPPDATA'] || 
                        join(process.env['USERPROFILE'] || homedir(), 'AppData', 'Local');
    resolvedPath = resolvedPath.replace(/\$\{LOCALAPPDATA\}/g, localAppData);
    logger.info(`[Config] Resolved ${path} to ${resolvedPath}`);
  }
  
  // Check for literal ${USERPROFILE} and resolve it
  if (resolvedPath.includes('${USERPROFILE}')) {
    hasUnresolvedVars = true;
    const userProfile = process.env['USERPROFILE'] || homedir();
    resolvedPath = resolvedPath.replace(/\$\{USERPROFILE\}/g, userProfile);
    logger.info(`[Config] Resolved ${path} to ${resolvedPath}`);
  }
  
  // Also handle %VAR% style Windows variables
  const percentPattern = /%([^%]+)%/g;
  if (percentPattern.test(resolvedPath)) {
    hasUnresolvedVars = true;
    resolvedPath = resolvedPath.replace(percentPattern, (match, varName) => {
      const value = process.env[varName];
      if (value) {
        logger.info(`[Config] Resolved %${varName}% to ${value}`);
        return value;
      }
      logger.warn(`[Config] Unable to resolve %${varName}% - environment variable not found`);
      return match;
    });
  }
  
  if (hasUnresolvedVars && isClaudeDesktop) {
    logger.warn('[Config] Claude Desktop environment variable expansion issue detected');
    logger.warn('[Config] Applied manual resolution for Windows paths');
  }
  
  return resolvedPath;
}

/**
 * Get the Windows AppData path with fallback mechanisms.
 * @returns Path to the Windows AppData directory
 */
function getWindowsAppDataPath(): string {
  if (platform() !== 'win32') {
    return homedir();
  }

  // Try to get APPDATA from environment (ensure it's not unresolved)
  if (process.env['APPDATA'] && !process.env['APPDATA'].includes('${')) {
    return process.env['APPDATA'];
  }
  
  // Try to construct from USERPROFILE (ensure it's not unresolved)
  if (process.env['USERPROFILE'] && !process.env['USERPROFILE'].includes('${')) {
    return join(process.env['USERPROFILE'], 'AppData', 'Roaming');
  }
  
  // Try to get from known Claude Desktop paths if environment variables are unresolved
  const claudeDesktopPaths = [
    join(homedir(), 'AppData', 'Roaming'),
    'C:\\Users\\Default\\AppData\\Roaming',
    join('C:\\Users', process.env['USERNAME'] || 'User', 'AppData', 'Roaming')
  ];
  
  for (const fallbackPath of claudeDesktopPaths) {
    if (existsSync(fallbackPath)) {
      logger.info(`[Config] Using fallback AppData path: ${fallbackPath}`);
      return fallbackPath;
    }
  }
  
  // Last resort: construct from homedir
  return join(homedir(), 'AppData', 'Roaming');
}

/**
 * Get the macOS Application Support path with fallback mechanisms.
 * @returns Path to the macOS Application Support directory
 */
function getMacOSApplicationSupportPath(): string {
  if (platform() !== 'darwin') {
    return homedir();
  }

  // Standard macOS application support paths
  const appSupportPaths = [
    join(homedir(), 'Library', 'Application Support'),
    join('/Library', 'Application Support'),
    join(homedir(), '.local', 'share')  // XDG fallback
  ];

  // Check if we can access the standard paths
  for (const appPath of appSupportPaths) {
    try {
      if (existsSync(appPath)) {
        // Try to check if we can write to this directory
        const testPath = join(appPath, '.scryfall_test');
        try {
          // Don't actually create the test file, just check parent directory
          if (existsSync(appPath)) {
            return appPath;
          }
        } catch (e) {
          logger.warn(`[Config] Cannot use ${appPath}: ${e}`);
        }
      }
    } catch (error) {
      logger.warn(`[Config] Error checking ${appPath}: ${error}`);
    }
  }

  // Fallback to home directory
  logger.warn('[Config] Using home directory as fallback for macOS Application Support');
  return homedir();
}

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
    } catch (writeError: any) {
      // More detailed error for write failures
      if (platform() === 'darwin' && writeError.code === 'EACCES') {
        throw new Error(
          `Directory ${directory} exists but is not writable due to macOS permissions.\n` +
          `This may be due to:\n` +
          `1. System Integrity Protection (SIP) restrictions\n` +
          `2. App Sandbox restrictions in Claude Desktop\n` +
          `3. File system permissions\n` +
          `Try setting SCRYFALL_DATA_DIR to a user-writable location like:\n` +
          `  export SCRYFALL_DATA_DIR="$HOME/Documents/scryfall_mcp"\n` +
          `Or use: export SCRYFALL_DATA_DIR="/tmp/scryfall_mcp"`
        );
      }
      throw new Error(`Directory ${directory} exists but is not writable: ${writeError.message || writeError}`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const isClaudeDesktop = detectClaudeDesktopContext();
      if (isClaudeDesktop && platform() === 'win32' && directory.includes('${')) {
        throw new Error(
          `Storage directory path contains unresolved variables: ${directory}\n` +
          `This is a known Claude Desktop issue on Windows. Please either:\n` +
          `1. Use global installation: npm install -g @kaminaduck/scryfall-mcp-server\n` +
          `2. Set SCRYFALL_DATA_DIR to a full path without variables\n` +
          `3. Use the Windows wrapper script\n` +
          `See README for detailed solutions.`
        );
      } else if (isClaudeDesktop && platform() === 'darwin') {
        throw new Error(
          `Storage directory does not exist: ${directory}\n` +
          `Claude Desktop on macOS may have restricted file access. Try:\n` +
          `1. Set SCRYFALL_DATA_DIR to an accessible location:\n` +
          `   export SCRYFALL_DATA_DIR="$HOME/Documents/scryfall_mcp"\n` +
          `2. Or use the temp directory:\n` +
          `   export SCRYFALL_DATA_DIR="/tmp/scryfall_mcp"\n` +
          `3. Ensure Claude Desktop has file system permissions in System Settings`
        );
      }
      throw new Error(`Storage directory does not exist: ${directory}`);
    } else if (error.code === 'EACCES') {
      if (platform() === 'darwin') {
        throw new Error(
          `Permission denied for directory: ${directory}\n` +
          `On macOS, this typically happens due to:\n` +
          `1. System Integrity Protection (SIP) - cannot write to system directories\n` +
          `2. App Sandbox restrictions - Claude Desktop may have limited file access\n` +
          `3. Standard UNIX permissions - directory owned by another user\n` +
          `Solutions:\n` +
          `- Set SCRYFALL_DATA_DIR to a writable location\n` +
          `- Grant Claude Desktop file access in System Settings > Privacy & Security`
        );
      }
      throw new Error(`Permission denied for directory: ${directory}`);
    } else if (error.code === 'EROFS') {
      throw new Error(`Directory ${directory} is on a read-only file system`);
    } else if (error.code === 'ENOTDIR') {
      throw new Error(`Path exists but is not a directory: ${directory}`);
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
    // Check for environment variable override with Windows variable resolution
    if (process.env['SCRYFALL_DATA_DIR']) {
      baseDir = resolveWindowsEnvironmentVariables(process.env['SCRYFALL_DATA_DIR']);
      logger.info(`Using environment variable SCRYFALL_DATA_DIR: ${baseDir}`);
    } else if (isMcpMode()) {
      // In MCP mode, use temp directory or XDG cache with Windows-specific handling
      const xdgCache = process.env['XDG_CACHE_HOME'];
      if (xdgCache && platform() !== 'win32') {
        baseDir = join(xdgCache, 'scryfall_mcp');
        logger.info(`Using XDG cache directory: ${baseDir}`);
      } else if (platform() === 'win32') {
        // Windows-specific path handling for MCP mode
        try {
          const appData = getWindowsAppDataPath();
          baseDir = join(appData, 'scryfall_mcp');
          logger.info(`Using Windows AppData directory for MCP: ${baseDir}`);
          
          // Double-check for Claude Desktop issues
          if (baseDir.includes('${')) {
            logger.error('[Config] Unresolved variables detected in AppData path!');
            logger.error('[Config] Falling back to alternative directory...');
            baseDir = join(tmpdir(), 'scryfall_downloads');
          }
        } catch (windowsError) {
          logger.warn(`Windows AppData resolution failed, using temp: ${windowsError}`);
          baseDir = join(tmpdir(), 'scryfall_downloads');
          logger.info(`Using temporary directory fallback: ${baseDir}`);
        }
      } else if (platform() === 'darwin') {
        // macOS-specific path handling for MCP mode
        try {
          const appSupport = getMacOSApplicationSupportPath();
          baseDir = join(appSupport, 'scryfall_mcp');
          logger.info(`Using macOS Application Support directory for MCP: ${baseDir}`);
        } catch (macError) {
          logger.warn(`macOS Application Support resolution failed: ${macError}`);
          // Try XDG_CACHE_HOME as fallback
          if (process.env['XDG_CACHE_HOME']) {
            baseDir = join(process.env['XDG_CACHE_HOME'], 'scryfall_mcp');
            logger.info(`Using XDG cache directory: ${baseDir}`);
          } else {
            baseDir = join(tmpdir(), 'scryfall_downloads');
            logger.info(`Using temporary directory fallback: ${baseDir}`);
          }
        }
      } else {
        baseDir = join(tmpdir(), 'scryfall_downloads');
        logger.info(`Using temporary directory: ${baseDir}`);
      }
    } else {
      // Standalone mode - use traditional .local directory with platform-specific handling
      if (platform() === 'win32') {
        const appData = getWindowsAppDataPath();
        baseDir = join(appData, 'scryfall_mcp');
        logger.info(`Using Windows AppData for standalone mode: ${baseDir}`);
      } else if (platform() === 'darwin') {
        const appSupport = getMacOSApplicationSupportPath();
        baseDir = join(appSupport, 'scryfall_mcp');
        logger.info(`Using macOS Application Support for standalone mode: ${baseDir}`);
      } else {
        baseDir = join(homedir(), '.local');
        logger.info(`Using home directory storage: ${baseDir}`);
      }
    }
    
    // Resolve any remaining Windows environment variables in the final path
    baseDir = resolveWindowsEnvironmentVariables(baseDir);
    
    // Add subdirectory if specified
    const storageDir = subdirectory ? join(baseDir, subdirectory) : baseDir;
    
    // Ensure directory exists with better error handling
    try {
      await mkdir(storageDir, { recursive: true });
      logger.info(`Created/verified storage directory: ${storageDir}`);
    } catch (mkdirError: any) {
      throw new Error(`Failed to create storage directory ${storageDir}: ${mkdirError.message || mkdirError}`);
    }
    
    // Validate the directory is accessible and writable
    await validateStorageDirectory(storageDir);
    
    return storageDir;
  } catch (error: any) {
    // Fallback mechanism - try alternative directories with platform-specific paths
    logger.error(`Error with primary storage directory: ${error.message}`);
    
    let fallbackDirs: string[] = [];
    
    if (platform() === 'win32') {
      fallbackDirs = [
        join(tmpdir(), 'scryfall_fallback'),
        join(process.env['USERPROFILE'] || homedir(), 'Documents', 'scryfall_fallback'),
        join(process.env['LOCALAPPDATA'] || join(homedir(), 'AppData', 'Local'), 'scryfall_mcp'),
        join('C:\\ProgramData', 'scryfall_mcp'),
        join(process.cwd(), 'temp_scryfall')
      ];
    } else if (platform() === 'darwin') {
      fallbackDirs = [
        join(tmpdir(), 'scryfall_fallback'),
        join(homedir(), 'Documents', 'scryfall_mcp'),
        join(homedir(), '.scryfall_mcp'),
        join(homedir(), 'Library', 'Caches', 'scryfall_mcp'),
        join('/tmp', 'scryfall_mcp'),
        join(process.cwd(), 'temp_scryfall')
      ];
    } else {
      fallbackDirs = [
        join(tmpdir(), 'scryfall_fallback'),
        join(homedir(), '.cache', 'scryfall_mcp'),
        join(homedir(), '.local', 'share', 'scryfall_mcp'),
        join(process.cwd(), 'temp_scryfall')
      ];
    }
    
    for (const fallback of fallbackDirs) {
      try {
        const fallbackPath = subdirectory ? join(fallback, subdirectory) : fallback;
        await mkdir(fallbackPath, { recursive: true });
        await validateStorageDirectory(fallbackPath);
        logger.info(`Using fallback directory: ${fallbackPath}`);
        return fallbackPath;
      } catch (fallbackError) {
        logger.error(`Fallback ${fallback} also failed: ${fallbackError}`);
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
    // First check if directory exists
    await access(directory, constants.F_OK);
    
    // Check read and write permissions
    await access(directory, constants.R_OK | constants.W_OK);
    
    // Try to create a test file with more robust error handling
    const testFile = join(directory, `.permission_test_${Date.now()}`);
    try {
      await writeFile(testFile, 'test');
      await unlink(testFile);
      return true;
    } catch (writeError: any) {
      // Log specific error for debugging
      if (platform() === 'darwin') {
        logger.warn(`[Config] macOS write test failed in ${directory}: ${writeError.code} - ${writeError.message}`);
        if (writeError.code === 'EACCES') {
          logger.warn('[Config] This may be due to App Sandbox or SIP restrictions');
        }
      } else {
        logger.warn(`[Config] Write test failed in ${directory}: ${writeError.message}`);
      }
      return false;
    }
  } catch (error: any) {
    // Log why permission check failed
    if (error.code === 'ENOENT') {
      logger.warn(`[Config] Directory does not exist: ${directory}`);
    } else if (error.code === 'EACCES') {
      logger.warn(`[Config] No access permissions for directory: ${directory}`);
    } else {
      logger.warn(`[Config] Permission check failed: ${error.message}`);
    }
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