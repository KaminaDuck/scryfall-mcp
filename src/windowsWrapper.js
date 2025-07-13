#!/usr/bin/env node

/**
 * Windows Wrapper Script for Scryfall MCP Server
 * 
 * This script handles environment variable expansion issues when launched 
 * via npx from Claude Desktop on Windows. It resolves common Windows path 
 * issues before launching the main Node.js application.
 */

import { spawn } from 'child_process';
import { platform, homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

/**
 * Resolve Windows environment variables that Claude Desktop fails to expand
 * @param {string} envValue - Environment variable value that may contain unresolved variables
 * @returns {string} - Resolved environment variable value
 */
function resolveWindowsEnvironmentVariable(envValue) {
  if (!envValue || platform() !== 'win32') {
    return envValue;
  }

  let resolved = envValue;
  
  // Resolve ${APPDATA}
  if (resolved.includes('${APPDATA}')) {
    const appData = process.env.APPDATA || 
                   join(process.env.USERPROFILE || homedir(), 'AppData', 'Roaming');
    resolved = resolved.replace(/\$\{APPDATA\}/g, appData);
  }
  
  // Resolve ${LOCALAPPDATA}
  if (resolved.includes('${LOCALAPPDATA}')) {
    const localAppData = process.env.LOCALAPPDATA || 
                        join(process.env.USERPROFILE || homedir(), 'AppData', 'Local');
    resolved = resolved.replace(/\$\{LOCALAPPDATA\}/g, localAppData);
  }
  
  // Resolve ${USERPROFILE}
  if (resolved.includes('${USERPROFILE}')) {
    const userProfile = process.env.USERPROFILE || homedir();
    resolved = resolved.replace(/\$\{USERPROFILE\}/g, userProfile);
  }
  
  // Also handle %VARIABLE% style expansion
  resolved = resolved.replace(/%([^%]+)%/g, (match, varName) => {
    return process.env[varName] || match;
  });
  
  return resolved;
}

/**
 * Detect if Claude Desktop is not properly expanding environment variables
 * @returns {boolean} - True if environment variable issues are detected
 */
function detectEnvironmentIssues() {
  if (platform() !== 'win32') {
    return false;
  }
  
  // Check for literal unresolved variables in environment
  const criticalVars = ['APPDATA', 'LOCALAPPDATA', 'USERPROFILE'];
  
  for (const varName of criticalVars) {
    const value = process.env[varName];
    if (value && value.includes('${')) {
      console.error(`[WindowsWrapper] Detected unresolved environment variable: ${varName}=${value}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Fix environment variables before launching the main application
 */
function fixEnvironmentVariables() {
  const hasIssues = detectEnvironmentIssues();
  
  if (hasIssues) {
    console.log('[WindowsWrapper] Applying Windows environment variable fixes...');
    
    // Fix common environment variables
    if (process.env.APPDATA && process.env.APPDATA.includes('${')) {
      const fixed = resolveWindowsEnvironmentVariable(process.env.APPDATA);
      console.log(`[WindowsWrapper] Fixed APPDATA: ${process.env.APPDATA} -> ${fixed}`);
      process.env.APPDATA = fixed;
    }
    
    if (process.env.LOCALAPPDATA && process.env.LOCALAPPDATA.includes('${')) {
      const fixed = resolveWindowsEnvironmentVariable(process.env.LOCALAPPDATA);
      console.log(`[WindowsWrapper] Fixed LOCALAPPDATA: ${process.env.LOCALAPPDATA} -> ${fixed}`);
      process.env.LOCALAPPDATA = fixed;
    }
    
    if (process.env.USERPROFILE && process.env.USERPROFILE.includes('${')) {
      const fixed = resolveWindowsEnvironmentVariable(process.env.USERPROFILE);
      console.log(`[WindowsWrapper] Fixed USERPROFILE: ${process.env.USERPROFILE} -> ${fixed}`);
      process.env.USERPROFILE = fixed;
    }
    
    // Fix any SCRYFALL_DATA_DIR if it contains unresolved variables
    if (process.env.SCRYFALL_DATA_DIR) {
      const fixed = resolveWindowsEnvironmentVariable(process.env.SCRYFALL_DATA_DIR);
      if (fixed !== process.env.SCRYFALL_DATA_DIR) {
        console.log(`[WindowsWrapper] Fixed SCRYFALL_DATA_DIR: ${process.env.SCRYFALL_DATA_DIR} -> ${fixed}`);
        process.env.SCRYFALL_DATA_DIR = fixed;
      }
    }
  }
}

/**
 * Find the main index.js file to execute
 * @returns {string} - Path to the main index.js file
 */
function findMainScript() {
  // Try different possible locations
  const possiblePaths = [
    join(__dirname, 'index.js'),
    join(__dirname, '..', 'dist', 'index.js'),
    join(__dirname, '..', 'index.js'),
    resolve(__dirname, 'index.js')
  ];
  
  for (const scriptPath of possiblePaths) {
    if (existsSync(scriptPath)) {
      console.log(`[WindowsWrapper] Found main script at: ${scriptPath}`);
      return scriptPath;
    }
  }
  
  // If not found, default to the expected location
  const defaultPath = join(__dirname, 'index.js');
  console.log(`[WindowsWrapper] Using default script path: ${defaultPath}`);
  return defaultPath;
}

/**
 * Launch the main Scryfall MCP server with fixed environment
 */
function launchMainServer() {
  const mainScript = findMainScript();
  
  // Ensure we mark this as wrapped execution
  process.env.SCRYFALL_WINDOWS_WRAPPER = 'true';
  
  console.log('[WindowsWrapper] Launching Scryfall MCP server...');
  console.log(`[WindowsWrapper] Node version: ${process.version}`);
  console.log(`[WindowsWrapper] Platform: ${platform()}`);
  
  // Spawn the main process, inheriting stdio for MCP protocol
  const child = spawn(process.execPath, [mainScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env
  });
  
  // Forward signals to child process
  process.on('SIGINT', () => {
    console.log('[WindowsWrapper] Received SIGINT, forwarding to main server...');
    child.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('[WindowsWrapper] Received SIGTERM, forwarding to main server...');
    child.kill('SIGTERM');
  });
  
  // Exit with same code as child
  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[WindowsWrapper] Main server exited with signal: ${signal}`);
      process.kill(process.pid, signal);
    } else {
      console.log(`[WindowsWrapper] Main server exited with code: ${code}`);
      process.exit(code || 0);
    }
  });
  
  child.on('error', (error) => {
    console.error(`[WindowsWrapper] Failed to start main server: ${error.message}`);
    process.exit(1);
  });
}

// Only run if this file is executed directly  
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check for test flag
  if (process.argv.includes('--test')) {
    console.log('[WindowsWrapper] Running in test mode...');
    console.log(`[WindowsWrapper] Platform: ${platform()}`);
    console.log(`[WindowsWrapper] Node version: ${process.version}`);
    
    if (platform() === 'win32') {
      console.log('[WindowsWrapper] Testing Windows environment variable resolution...');
      const testIssues = detectEnvironmentIssues();
      if (testIssues) {
        console.log('[WindowsWrapper] Environment issues detected - fixes would be applied in normal mode');
      } else {
        console.log('[WindowsWrapper] No environment issues detected');
      }
    }
    
    console.log('[WindowsWrapper] Test completed successfully');
    process.exit(0);
  }
  
  if (platform() === 'win32') {
    console.log('[WindowsWrapper] Windows Wrapper for Scryfall MCP Server');
    console.log('[WindowsWrapper] Checking for environment variable issues...');
    
    // Fix environment variables first
    fixEnvironmentVariables();
    
    // Then launch the main server
    launchMainServer();
  } else {
    console.log('[WindowsWrapper] Not running on Windows, launching main server directly...');
    launchMainServer();
  }
}

export {
  resolveWindowsEnvironmentVariable,
  detectEnvironmentIssues,
  fixEnvironmentVariables,
  findMainScript
};