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
                         process.env['npm_config_user_agent']?.includes('Claude');
                         
  if (isClaudeDesktop) {
    logger.info('[Context] Claude Desktop execution detected');
    if (platform() === 'win32') {
      logger.warn('[Context] Windows + Claude Desktop detected - monitoring for environment variable issues');
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
}

async function main(): Promise<void> {
  try {
    logger.info('[Setup] Starting Scryfall MCP server...');
    
    // Validate environment and detect issues early
    validateEnvironmentVariables();
    detectExecutionContext();
    
    // Windows-specific initialization checks
    if (platform() === 'win32') {
      logger.info('[Setup] Performing Windows-specific initialization checks...');
      
      // Check for common Windows path issues
      try {
        const testPath = process.env['APPDATA'] || 'C:\\Users\\Default\\AppData\\Roaming';
        logger.info(`[Setup] Windows path test using: ${testPath}`);
      } catch (pathError) {
        logger.error('[Setup] Windows path resolution issue detected:', pathError);
      }
    }
    
    // Initialize server before transport connection to prevent initialization failures
    // from causing transport disconnection
    logger.info('[Setup] Initializing server...');
    try {
      await initializeServer();
      logger.info('[Setup] Server initialization completed successfully');
    } catch (initError) {
      logger.warn('[Setup] Server initialization encountered issues, continuing with limited functionality:', initError);
      // Continue with transport connection even if initialization has issues
      // The server can still provide basic functionality without full initialization
    }
    
    // Create stdio transport for MCP communication
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    logger.info('[Setup] Scryfall MCP server is running and ready for requests');
    
    // Handle process termination gracefully
    process.on('SIGINT', async () => {
      logger.info('[Setup] Received SIGINT, shutting down gracefully...');
      await server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('[Setup] Received SIGTERM, shutting down gracefully...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('[Setup] Failed to start Scryfall MCP server:', error);
    
    // Enhanced error details with Windows-specific diagnostics
    const errorDetails: any = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown',
      platform: platform(),
      nodeVersion: process.version,
      workingDirectory: process.cwd()
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
      }
      
      if (errorMessage.includes('EACCES')) {
        logger.error('[Setup] EACCES error detected - this is likely a permissions issue on Windows');
        logger.error('[Setup] Check if the process has write permissions to the target directory');
      }
    }
    
    logger.error('[Setup] Error details:', errorDetails);
    process.exit(1);
  }
}

// Global error handlers to prevent unhandled exceptions from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Global] Unhandled promise rejection:', reason);
  logger.error('[Global] Promise that was rejected:', promise);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('[Global] Uncaught exception:', error);
  logger.error('[Global] Error stack:', error.stack);
  process.exit(1);
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