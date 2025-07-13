/**
 * Logging utility that respects MCP stdio protocol constraints.
 * 
 * In MCP mode, all output must go to stderr to avoid interfering with
 * the JSON protocol on stdout. This module provides consistent logging
 * across different execution modes.
 */

import { isMcpMode } from './config.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private minLevel: LogLevel;
  private isMcp: boolean;

  constructor() {
    this.minLevel = process.env['NODE_ENV'] === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.isMcp = isMcpMode();
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    
    return `${timestamp} - scryfall-mcp - ${level} - ${message}${formattedArgs}`;
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (level < this.minLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, ...args);
    
    if (this.isMcp) {
      // In MCP mode, all output goes to stderr to avoid interfering with stdio protocol
      process.stderr.write(formattedMessage + '\n');
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
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export the class for testing purposes
export { Logger };