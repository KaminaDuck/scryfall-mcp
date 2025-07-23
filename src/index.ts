#!/usr/bin/env node

/**
 * Scryfall MCP Server - Main Entry Point
 * 
 * This module serves as the entry point for the Scryfall MCP server,
 * initializing the server and handling the startup process.
 */

import { server, initializeServer } from './server.js';
import { logger } from './logger.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { platform } from 'node:os';

/**
 * Validate environment variables and detect unresolved variables that may cause issues.
 */
function validateEnvironmentVariables(): void {
  const criticalVars = ['APPDATA', 'LOCALAPPDATA', 'USERPROFILE'];
  
  if (platform() === 'win32') {
    logger.info('[Env] Running on Windows, checking environment variables...');
    
    // Check if running under Claude Desktop
    const isClaudeDesktop = process.env['CLAUDE_DESKTOP'] || 
                           process.cwd().includes('AnthropicClaude') ||
                           process.env['npm_config_user_agent']?.includes('Claude');
    
    if (isClaudeDesktop) {
      logger.warn('[Env] Detected Claude Desktop execution context');
      logger.warn('[Env] Known issue: Claude Desktop may not expand Windows environment variables with npx');
    }
    
    let hasUnresolvedVars = false;
    for (const varName of criticalVars) {
      const value = process.env[varName];
      if (!value) {
        logger.warn(`[Env] Missing Windows environment variable: ${varName}`);
      } else if (value.includes('${')) {
        hasUnresolvedVars = true;
        logger.error(`[Env] Unresolved environment variable detected: ${varName}=${value}`);
        logger.error('[Env] This may cause ENOENT errors. Claude Desktop may not be expanding variables properly.');
      } else {
        logger.info(`[Env] ${varName}=${value}`);
      }
    }
    
    // Provide specific guidance if unresolved variables are detected
    if (hasUnresolvedVars) {
      logger.error('[Env] === WINDOWS ENVIRONMENT VARIABLE ISSUE DETECTED ===');
      logger.error('[Env] Claude Desktop is not expanding environment variables correctly.');
      logger.error('[Env] Please try one of these solutions:');
      logger.error('[Env] 1. Use global installation: npm install -g @kaminaduck/scryfall-mcp-server');
      logger.error('[Env] 2. Use the Windows wrapper: scryfall-mcp-server-windows');
      logger.error('[Env] 3. Set explicit paths in Claude Desktop configuration');
      logger.error('[Env] See README.md for detailed Windows troubleshooting steps');
      logger.error('[Env] ================================================');
    }
  }
  
  // Check for literal unresolved variables in other environment variables
  for (const [key, value] of Object.entries(process.env)) {
    if (value && typeof value === 'string' && value.includes('${')) {
      logger.warn(`[Env] Potentially unresolved variable in ${key}: ${value}`);
    }
  }
}

/**
 * Detect and log execution context information for troubleshooting.
 */
function detectExecutionContext(): void {
  logger.info(`[Context] Platform: ${platform()}`);
  logger.info(`[Context] Node version: ${process.version}`);
  logger.info(`[Context] Working directory: ${process.cwd()}`);
  logger.info(`[Context] Script path: ${process.argv[1]}`);
  
  // Detect NPX execution
  const npmExecPath = process.env['npm_execpath'];
  const npmConfigPath = process.env['npm_config_user_config'];
  const isNpx = (process.argv[0] && process.argv[0].includes('npx')) || 
               (npmExecPath ? npmExecPath.includes('npx') : false) ||
               (npmConfigPath ? npmConfigPath.includes('npx') : false);
  
  if (isNpx) {
    logger.info('[Context] Detected NPX execution - this may cause environment variable issues on Windows');
    if (platform() === 'win32') {
      logger.warn('[Context] NPX on Windows with Claude Desktop is known to cause ${APPDATA} expansion issues');
      logger.warn('[Context] Consider using global installation or Windows wrapper script');
    }
  }
  
  // Detect Claude Desktop execution context
  const isClaudeDesktop = process.env['CLAUDE_DESKTOP'] || 
                         process.cwd().includes('AnthropicClaude') ||
                         process.env['npm_execpath']?.includes('AnthropicClaude') ||
                         process.env['npm_config_user_agent']?.includes('Claude') ||
                         // macOS-specific Claude Desktop indicators
                         process.cwd().includes('com.anthropic.claude') ||
                         process.env['HOME']?.includes('/Library/Application Support/Claude');
                         
  if (isClaudeDesktop) {
    logger.info('[Context] Claude Desktop execution detected');
    if (platform() === 'win32') {
      logger.warn('[Context] Windows + Claude Desktop detected - monitoring for environment variable issues');
    } else if (platform() === 'darwin') {
      logger.warn('[Context] macOS + Claude Desktop detected - may have file system restrictions');
    }
  }
  
  // Log MCP-specific context
  const mcpServerName = process.env['MCP_SERVER_NAME'];
  if (mcpServerName) {
    logger.info(`[Context] MCP Server Name: ${mcpServerName}`);
  }
  
  const mcpFileDownloads = process.env['MCP_ENABLE_FILE_DOWNLOADS'];
  if (mcpFileDownloads) {
    logger.info(`[Context] MCP File Downloads: ${mcpFileDownloads}`);
  }
  
  // Additional Windows diagnostics if running under Claude Desktop
  if (isClaudeDesktop && platform() === 'win32') {
    logger.info('[Context] Performing additional Windows diagnostics...');
    
    // Check for common environment variable issues
    const problematicVars = ['APPDATA', 'LOCALAPPDATA', 'USERPROFILE'].filter(
      varName => {
        const value = process.env[varName];
        return value && value.includes('${');
      }
    );
    
    if (problematicVars.length > 0) {
      logger.error(`[Context] Found unresolved environment variables: ${problematicVars.join(', ')}`);
      logger.error('[Context] This will likely cause path resolution failures');
    }
  }
  
  // Additional macOS diagnostics if running under Claude Desktop
  if (isClaudeDesktop && platform() === 'darwin') {
    logger.info('[Context] Performing additional macOS diagnostics...');
    
    // Check for sandboxing indicators
    const sandboxIndicators = [
      process.env['APP_SANDBOX_CONTAINER_ID'],
      process.env['__CFBundleIdentifier'],
      process.cwd().includes('/Library/Containers/'),
      process.env['HOME']?.includes('/Library/Containers/')
    ].filter(Boolean);
    
    if (sandboxIndicators.length > 0) {
      logger.warn('[Context] App Sandbox restrictions detected - file access may be limited');
      logger.warn('[Context] Consider setting SCRYFALL_DATA_DIR to an accessible location');
    }
    
    // Check for SIP-protected paths
    const protectedPaths = ['/System', '/usr', '/bin', '/sbin', '/var'];
    const cwd = process.cwd();
    if (protectedPaths.some(path => cwd.startsWith(path))) {
      logger.warn('[Context] Working directory is in a SIP-protected location');
    }
  }
}

async function main(): Promise<void> {
  let serverInitialized = false;
  let transportConnected = false;
  
  try {
    logger.info('[Setup] Starting Scryfall MCP server...');
    
    // Validate environment and detect issues early
    try {
      validateEnvironmentVariables();
      detectExecutionContext();
    } catch (envError) {
      logger.warn('[Setup] Environment validation warnings:', envError);
      // Continue despite environment warnings
    }
    
    // Platform-specific initialization checks
    if (platform() === 'win32') {
      logger.info('[Setup] Performing Windows-specific initialization checks...');
      
      // Check for common Windows path issues
      try {
        const testPath = process.env['APPDATA'] || 'C:\\Users\\Default\\AppData\\Roaming';
        logger.info(`[Setup] Windows path test using: ${testPath}`);
      } catch (pathError) {
        logger.error('[Setup] Windows path resolution issue detected:', pathError);
      }
    } else if (platform() === 'darwin') {
      logger.info('[Setup] Performing macOS-specific initialization checks...');
      
      // Check for common macOS path issues
      try {
        const homePath = process.env['HOME'] || '/tmp';
        logger.info(`[Setup] macOS home path: ${homePath}`);
        
        // Check if we're in a sandboxed environment
        if (homePath.includes('/Library/Containers/')) {
          logger.warn('[Setup] Sandboxed environment detected - file access may be restricted');
        }
      } catch (pathError) {
        logger.error('[Setup] macOS path resolution issue detected:', pathError);
      }
    }
    
    // Initialize server before transport connection to prevent initialization failures
    // from causing transport disconnection
    logger.info('[Setup] Initializing server components...');
    try {
      await initializeServer();
      serverInitialized = true;
      logger.info('[Setup] Server initialization completed successfully');
    } catch (initError: any) {
      logger.warn('[Setup] Server initialization encountered issues:', initError.message);
      
      // Determine if we can continue without full initialization
      const criticalErrors = ['MODULE_NOT_FOUND', 'ERR_INVALID_ARG_TYPE', 'EACCES'];
      if (initError.code && criticalErrors.includes(initError.code)) {
        logger.error('[Setup] Critical initialization error - cannot continue');
        throw initError;
      }
      
      logger.info('[Setup] Continuing with limited functionality (API-only mode)');
      // Server can still provide basic functionality without full initialization
    }
    
    // Create stdio transport for MCP communication
    logger.info('[Setup] Creating MCP transport...');
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport with error handling
    logger.info('[Setup] Connecting to MCP transport...');
    try {
      await server.connect(transport);
      transportConnected = true;
      logger.info('[Setup] ✓ Scryfall MCP server is running and ready for requests');
    } catch (transportError) {
      logger.error('[Setup] Failed to connect to MCP transport:', transportError);
      throw transportError;
    }
    
    // Handle process termination gracefully
    process.on('SIGINT', async () => {
      logger.info('[Setup] Received SIGINT, shutting down gracefully...');
      try {
        await server.close();
      } catch (closeError) {
        logger.error('[Setup] Error during graceful shutdown:', closeError);
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('[Setup] Received SIGTERM, shutting down gracefully...');
      try {
        await server.close();
      } catch (closeError) {
        logger.error('[Setup] Error during graceful shutdown:', closeError);
      }
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('[Setup] Failed to start Scryfall MCP server:', error);
    
    // Enhanced error details with platform-specific diagnostics
    const errorDetails: any = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      platform: platform(),
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      serverInitialized,
      transportConnected
    };
    
    // Add Windows-specific error information
    if (platform() === 'win32') {
      errorDetails.windowsEnvironment = {
        APPDATA: process.env['APPDATA'] || 'NOT_SET',
        LOCALAPPDATA: process.env['LOCALAPPDATA'] || 'NOT_SET', 
        USERPROFILE: process.env['USERPROFILE'] || 'NOT_SET'
      };
      
      // Check for common Windows error patterns
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ENOENT')) {
        logger.error('[Setup] ENOENT error detected - this is likely a path resolution issue on Windows');
        logger.error('[Setup] Check if environment variables like ${APPDATA} are being resolved properly');
        logger.error('[Setup] Try: npm install -g @kaminaduck/scryfall-mcp-server');
      }
      
      if (errorMessage.includes('EACCES')) {
        logger.error('[Setup] EACCES error detected - this is likely a permissions issue on Windows');
        logger.error('[Setup] Check if the process has write permissions to the target directory');
      }
    }
    
    // Add macOS-specific error information
    if (platform() === 'darwin') {
      errorDetails.macOSEnvironment = {
        HOME: process.env['HOME'] || 'NOT_SET',
        USER: process.env['USER'] || 'NOT_SET',
        TMPDIR: process.env['TMPDIR'] || 'NOT_SET',
        XDG_CACHE_HOME: process.env['XDG_CACHE_HOME'] || 'NOT_SET'
      };
      
      // Check for common macOS error patterns
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ENOENT')) {
        logger.error('[Setup] ENOENT error detected - this is likely a path access issue on macOS');
        logger.error('[Setup] Claude Desktop may have restricted file system access');
        logger.error('[Setup] Try setting: export SCRYFALL_DATA_DIR="$HOME/Documents/scryfall_mcp"');
      }
      
      if (errorMessage.includes('EACCES')) {
        logger.error('[Setup] EACCES error detected - this is likely a permissions issue on macOS');
        logger.error('[Setup] This may be due to App Sandbox or SIP restrictions');
        logger.error('[Setup] Try using a user-writable directory like ~/Documents or /tmp');
      }
      
      if (errorMessage.includes('EROFS')) {
        logger.error('[Setup] EROFS error detected - attempting to write to a read-only file system');
        logger.error('[Setup] Set SCRYFALL_DATA_DIR to a writable location');
      }
    }
    
    logger.error('[Setup] Error details:', errorDetails);
    
    // Provide helpful next steps
    logger.error('[Setup] === TROUBLESHOOTING STEPS ===');
    logger.error('[Setup] 1. Check the error message above for specific issues');
    logger.error('[Setup] 2. Try setting SCRYFALL_DATA_DIR environment variable to a writable directory');
    logger.error('[Setup] 3. For persistent issues, see the README.md troubleshooting section');
    logger.error('[Setup] 4. Report issues at: https://github.com/KaminaDuck/scryfall-mcp/issues');
    
    process.exit(1);
  }
}

// Global error handlers to prevent unhandled exceptions from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Global] Unhandled promise rejection:', reason);
  logger.error('[Global] Promise that was rejected:', promise);
  
  // Provide platform-specific guidance for common rejection causes
  if (reason && typeof reason === 'object' && 'code' in reason) {
    const errorCode = (reason as any).code;
    if (errorCode === 'ENOENT' && platform() === 'darwin') {
      logger.error('[Global] File/directory not found - possible macOS permission issue');
      logger.error('[Global] Try setting SCRYFALL_DATA_DIR to an accessible location');
    } else if (errorCode === 'EACCES') {
      logger.error('[Global] Permission denied - check file system permissions');
    }
  }
  
  // Give the logger time to flush before exiting
  setTimeout(() => process.exit(1), 100);
});

process.on('uncaughtException', (error) => {
  logger.error('[Global] Uncaught exception:', error);
  logger.error('[Global] Error stack:', error.stack);
  
  // Provide helpful context for common exceptions
  if (error.message.includes('Transport closed unexpectedly')) {
    logger.error('[Global] MCP transport closed - this often indicates an initialization failure');
    logger.error('[Global] Check the logs above for storage directory or permission errors');
  } else if (error.code === 'ENOENT') {
    logger.error('[Global] File or directory not found during operation');
    if (platform() === 'darwin') {
      logger.error('[Global] On macOS, this may be due to sandbox restrictions');
    }
  }
  
  // Give the logger time to flush before exiting
  setTimeout(() => process.exit(1), 100);
});

// Only run if this file is executed directly (reliable check for npx execution)
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main().catch((error) => {
    logger.error('[Setup] Unhandled error in main:', error);
    logger.error('[Setup] Error occurred during startup, exiting...');
    process.exit(1);
  });
}