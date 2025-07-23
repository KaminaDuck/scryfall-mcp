/**
 * Logging utility that respects MCP stdio protocol constraints.
 * 
 * In MCP mode, all output must go to stderr to avoid interfering with
 * the JSON protocol on stdout. This module provides consistent logging
 * across different execution modes.
 */

import { isMcpMode } from './config.js';
import { platform } from 'node:os';
import { join } from 'node:path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private minLevel: LogLevel;
  private originalLevel: LogLevel;
  private isMcp: boolean;
  private temporaryLevelTimeout: NodeJS.Timeout | undefined;

  constructor() {
    this.minLevel = process.env['NODE_ENV'] === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.originalLevel = this.minLevel;
    this.isMcp = isMcpMode();
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = this.formatTimestamp();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg, null, 0) : String(arg);
      } catch (error) {
        return '[Circular/Error formatting object]';
      }
    }).join(' ') : '';
    
    return `${timestamp} - scryfall-mcp - ${level} - ${message}${formattedArgs}`;
  }

  private formatTimestamp(): string {
    const now = new Date();
    if (process.env['LOG_TIMESTAMP_FORMAT'] === 'simple') {
      return now.toLocaleTimeString();
    } else if (process.env['LOG_TIMESTAMP_FORMAT'] === 'none') {
      return '';
    } else {
      return now.toISOString();
    }
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (level < this.minLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, ...args);
    
    if (this.isMcp) {
      // In MCP mode, all output goes to stderr to avoid interfering with stdio protocol
      try {
        process.stderr.write(formattedMessage + '\n');
      } catch (error) {
        // Fallback: if stderr write fails, do nothing to prevent stdout pollution
        // This prevents logger failures from crashing the server
      }
    } else {
      // In standalone mode, use appropriate console methods
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
    this.originalLevel = level;
  }

  /**
   * Check if running in MCP mode (useful for other modules)
   */
  isMcpMode(): boolean {
    return this.isMcp;
  }

  /**
   * Flush any pending stderr writes
   */
  flush(): void {
    try {
      if (this.isMcp) {
        // Force flush stderr buffer
        process.stderr.write('');
      }
    } catch (error) {
      // Ignore flush errors to prevent logger failures from crashing the server
    }
  }

  /**
   * Temporarily set a different log level for debugging
   * @param level The temporary log level
   * @param duration Duration in milliseconds (default: 30 seconds)
   */
  setTemporaryLevel(level: LogLevel, duration: number = 30000): void {
    // Clear any existing temporary level timeout
    if (this.temporaryLevelTimeout) {
      clearTimeout(this.temporaryLevelTimeout);
    }

    // Set temporary level
    this.minLevel = level;
    this.info(`[Logger] Temporary log level set to ${LogLevel[level]} for ${duration}ms`);

    // Reset to original level after duration
    this.temporaryLevelTimeout = setTimeout(() => {
      this.minLevel = this.originalLevel;
      this.info(`[Logger] Log level reset to ${LogLevel[this.originalLevel]}`);
      this.temporaryLevelTimeout = undefined;
    }, duration);
  }

  /**
   * Reset log level to original value immediately
   */
  resetLevel(): void {
    if (this.temporaryLevelTimeout) {
      clearTimeout(this.temporaryLevelTimeout);
      this.temporaryLevelTimeout = undefined;
    }
    this.minLevel = this.originalLevel;
    this.info(`[Logger] Log level reset to ${LogLevel[this.originalLevel]}`);
  }

  /**
   * Log environment diagnostics to help troubleshoot Claude Desktop integration issues.
   */
  logEnvironmentDiagnostics(): void {
    this.info('[Diagnostics] === Environment Diagnostics ===');
    this.info(`[Diagnostics] Platform: ${platform()}`);
    this.info(`[Diagnostics] Node.js version: ${process.version}`);
    this.info(`[Diagnostics] Process ID: ${process.pid}`);
    this.info(`[Diagnostics] Working directory: ${process.cwd()}`);
    this.info(`[Diagnostics] Script arguments: ${process.argv.join(' ')}`);
    this.info(`[Diagnostics] MCP mode: ${this.isMcp}`);
    
    // Log relevant environment variables
    const relevantVars = [
      'NODE_ENV', 'MCP_SERVER_NAME', 'MCP_ENABLE_FILE_DOWNLOADS', 
      'SCRYFALL_DATA_DIR', 'npm_execpath', 'npm_config_user_config'
    ];
    
    if (platform() === 'win32') {
      relevantVars.push('APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'TEMP', 'TMP');
    } else if (platform() === 'darwin') {
      relevantVars.push('HOME', 'USER', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 
                       'XDG_DATA_HOME', '__CFBundleIdentifier', 'APP_SANDBOX_CONTAINER_ID');
    } else {
      relevantVars.push('HOME', 'XDG_CACHE_HOME', 'TMPDIR');
    }

    this.info('[Diagnostics] Environment variables:');
    for (const varName of relevantVars) {
      const value = process.env[varName];
      if (value !== undefined) {
        // Check for unresolved variables
        if (value.includes('${')) {
          this.error(`[Diagnostics] ⚠️  ${varName}=${value} (CONTAINS UNRESOLVED VARIABLES)`);
        } else {
          this.info(`[Diagnostics] ${varName}=${value}`);
        }
      } else {
        this.warn(`[Diagnostics] ${varName}=<not set>`);
      }
    }
    
    // Detect execution context
    const npmExecPath = process.env['npm_execpath'];
    const isNpx = (process.argv[0] && process.argv[0].includes('npx')) || 
                 (npmExecPath ? npmExecPath.includes('npx') : false);
    if (isNpx) {
      this.warn('[Diagnostics] ⚠️  NPX execution detected - may cause environment variable issues on Windows');
    }

    this.info('[Diagnostics] === End Environment Diagnostics ===');
  }

  /**
   * Log Windows-specific path information to help diagnose path-related issues.
   */
  logWindowsPathInfo(): void {
    if (platform() !== 'win32') {
      this.debug('[WindowsPath] Not running on Windows, skipping Windows path diagnostics');
      return;
    }

    this.info('[WindowsPath] === Windows Path Diagnostics ===');
    
    // Check critical Windows paths
    const windowsPaths = {
      'APPDATA': process.env['APPDATA'],
      'LOCALAPPDATA': process.env['LOCALAPPDATA'],
      'USERPROFILE': process.env['USERPROFILE'],
      'TEMP': process.env['TEMP'],
      'TMP': process.env['TMP'],
      'PROGRAMFILES': process.env['PROGRAMFILES'],
      'PROGRAMFILES(X86)': process.env['PROGRAMFILES(X86)']
    };

    for (const [name, path] of Object.entries(windowsPaths)) {
      if (path) {
        if (path.includes('${')) {
          this.error(`[WindowsPath] ❌ ${name}: ${path} (UNRESOLVED VARIABLE)`);
        } else {
          this.info(`[WindowsPath] ✅ ${name}: ${path}`);
          
          // Try to construct common subpaths for validation
          if (name === 'APPDATA') {
            const testPaths = [
              join(path, 'npm'),
              join(path, 'scryfall_mcp')
            ];
            for (const testPath of testPaths) {
              this.debug(`[WindowsPath] Test path: ${testPath}`);
            }
          }
        }
      } else {
        this.warn(`[WindowsPath] ⚠️  ${name}: <not set>`);
      }
    }

    // Check for common Windows path issues
    const currentPath = process.cwd();
    if (currentPath.includes(' ')) {
      this.warn(`[WindowsPath] ⚠️  Current path contains spaces: ${currentPath}`);
    }

    if (currentPath.length > 260) {
      this.warn(`[WindowsPath] ⚠️  Current path exceeds Windows path limit (260 chars): ${currentPath}`);
    }

    // Log drive information
    const drive = currentPath.charAt(0).toUpperCase();
    this.info(`[WindowsPath] Current drive: ${drive}:`);

    this.info('[WindowsPath] === End Windows Path Diagnostics ===');
  }

  /**
   * Enhanced error logging with Windows-specific error codes and path information.
   */
  logWindowsError(message: string, error: any, context?: string): void {
    const prefix = context ? `[${context}]` : '[WindowsError]';
    
    this.error(`${prefix} ${message}`, error);
    
    if (platform() === 'win32' && error) {
      const errorCode = error.code || error.errno;
      const errorMessage = error.message || String(error);
      
      this.error(`${prefix} Error code: ${errorCode}`);
      
      // Provide Windows-specific error explanations
      if (errorCode === 'ENOENT') {
        this.error(`${prefix} ENOENT: File or directory not found`);
        this.error(`${prefix} This often indicates path resolution issues on Windows`);
        this.error(`${prefix} Check if environment variables like \${APPDATA} are properly resolved`);
      } else if (errorCode === 'EACCES') {
        this.error(`${prefix} EACCES: Permission denied`);
        this.error(`${prefix} This indicates insufficient permissions on Windows`);
        this.error(`${prefix} Try running as administrator or check directory permissions`);
      } else if (errorCode === 'EPERM') {
        this.error(`${prefix} EPERM: Operation not permitted`);
        this.error(`${prefix} This may indicate file system permissions or antivirus interference`);
      } else if (errorCode === 'EMFILE' || errorCode === 'ENFILE') {
        this.error(`${prefix} ${errorCode}: Too many open files`);
        this.error(`${prefix} This may indicate a resource leak or system limitation`);
      }
      
      // Log path if available
      if (error.path) {
        this.error(`${prefix} Problematic path: ${error.path}`);
        if (error.path.includes('${')) {
          this.error(`${prefix} ❌ Path contains unresolved environment variables!`);
        }
      }
    }
  }

  /**
   * Log macOS-specific path information to help diagnose path-related issues.
   */
  logMacOSPathInfo(): void {
    if (platform() !== 'darwin') {
      this.debug('[macOSPath] Not running on macOS, skipping macOS path diagnostics');
      return;
    }

    this.info('[macOSPath] === macOS Path Diagnostics ===');
    
    // Check critical macOS paths
    const macOSPaths = {
      'HOME': process.env['HOME'],
      'USER': process.env['USER'],
      'TMPDIR': process.env['TMPDIR'],
      'XDG_CACHE_HOME': process.env['XDG_CACHE_HOME'],
      'XDG_CONFIG_HOME': process.env['XDG_CONFIG_HOME'],
      'XDG_DATA_HOME': process.env['XDG_DATA_HOME'],
      'PATH': process.env['PATH']
    };

    for (const [name, path] of Object.entries(macOSPaths)) {
      if (path) {
        this.info(`[macOSPath] ✅ ${name}: ${path}`);
        
        // Check for sandboxed paths
        if (name === 'HOME' && path.includes('/Library/Containers/')) {
          this.warn(`[macOSPath] ⚠️  Sandboxed HOME detected: ${path}`);
          this.warn('[macOSPath] App is running in a sandbox - file access will be restricted');
        }
      } else {
        this.warn(`[macOSPath] ⚠️  ${name}: <not set>`);
      }
    }

    // Check common macOS directories
    const commonDirs = [
      join(process.env['HOME'] || '', 'Library', 'Application Support'),
      join(process.env['HOME'] || '', 'Library', 'Caches'),
      '/tmp',
      '/private/tmp',
      '/var/folders'
    ];

    this.info('[macOSPath] Common directory accessibility:');
    for (const dir of commonDirs) {
      if (dir.startsWith('/System') || dir.startsWith('/usr') && !dir.startsWith('/usr/local')) {
        this.warn(`[macOSPath] ⚠️  ${dir} - SIP protected`);
      } else {
        this.info(`[macOSPath] ${dir}`);
      }
    }

    // Check current working directory
    const cwd = process.cwd();
    this.info(`[macOSPath] Current working directory: ${cwd}`);
    
    // Check for common macOS path issues
    if (cwd.includes('/Library/Containers/')) {
      this.warn('[macOSPath] ⚠️  Working in sandboxed container directory');
    }
    
    if (cwd.startsWith('/System') || cwd.startsWith('/usr') && !cwd.startsWith('/usr/local')) {
      this.warn('[macOSPath] ⚠️  Working in SIP-protected directory');
    }

    // Check for Claude Desktop specific paths
    if (cwd.includes('com.anthropic.claude')) {
      this.info('[macOSPath] Claude Desktop application directory detected');
    }

    this.info('[macOSPath] === End macOS Path Diagnostics ===');
  }

  /**
   * Enhanced error logging with macOS-specific error codes and path information.
   */
  logMacOSError(message: string, error: any, context?: string): void {
    const prefix = context ? `[${context}]` : '[macOSError]';
    
    this.error(`${prefix} ${message}`, error);
    
    if (platform() === 'darwin' && error) {
      const errorCode = error.code || error.errno;
      const errorMessage = error.message || String(error);
      
      this.error(`${prefix} Error code: ${errorCode}`);
      
      // Provide macOS-specific error explanations
      if (errorCode === 'ENOENT') {
        this.error(`${prefix} ENOENT: File or directory not found`);
        this.error(`${prefix} This may indicate sandbox restrictions or permission issues`);
        this.error(`${prefix} Try setting SCRYFALL_DATA_DIR to an accessible location`);
      } else if (errorCode === 'EACCES') {
        this.error(`${prefix} EACCES: Permission denied`);
        this.error(`${prefix} Common causes on macOS:`);
        this.error(`${prefix} - App Sandbox restrictions`);
        this.error(`${prefix} - System Integrity Protection (SIP)`);
        this.error(`${prefix} - Standard UNIX permissions`);
        this.error(`${prefix} Solutions:`);
        this.error(`${prefix} - Use SCRYFALL_DATA_DIR to specify a writable directory`);
        this.error(`${prefix} - Grant file access in System Settings > Privacy & Security`);
      } else if (errorCode === 'EPERM') {
        this.error(`${prefix} EPERM: Operation not permitted`);
        this.error(`${prefix} This usually indicates macOS security restrictions`);
      } else if (errorCode === 'EROFS') {
        this.error(`${prefix} EROFS: Read-only file system`);
        this.error(`${prefix} Cannot write to this location - use a different directory`);
      } else if (errorCode === 'ENOTDIR') {
        this.error(`${prefix} ENOTDIR: Not a directory`);
        this.error(`${prefix} The specified path exists but is not a directory`);
      }
      
      // Log path if available
      if (error.path) {
        this.error(`${prefix} Problematic path: ${error.path}`);
        
        // Check for common problematic paths
        if (error.path.startsWith('/System') || error.path.startsWith('/usr')) {
          this.error(`${prefix} ❌ Path is in a system-protected location!`);
        }
        if (error.path.includes('/Library/Containers/')) {
          this.error(`${prefix} ❌ Path indicates app sandboxing issues!`);
        }
      }
      
      // Provide specific guidance based on error context
      if (error.syscall === 'mkdir') {
        this.error(`${prefix} Failed to create directory - check parent directory permissions`);
      } else if (error.syscall === 'open') {
        this.error(`${prefix} Failed to open file - check file permissions and parent directory`);
      }
    }
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export the class for testing purposes
export { Logger };

// Ensure logger is properly flushed on process exit
process.on('exit', () => {
  logger.flush();
});

process.on('SIGINT', () => {
  logger.flush();
});

process.on('SIGTERM', () => {
  logger.flush();
});