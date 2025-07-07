import { config } from '../config/index.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private logLevel: LogLevel;

  constructor(level?: string) {
    this.logLevel = this.parseLogLevel(level || config.logging.level);
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatLogEntry(entry: LogEntry): string {
    const baseMessage = `[${entry.timestamp}] ${entry.level}: ${entry.message}`;
    
    if (entry.context) {
      const contextString = JSON.stringify(entry.context, null, 2);
      return `${baseMessage}\nContext: ${contextString}`;
    }
    
    if (entry.error) {
      return `${baseMessage}\nError: ${entry.error.message}\nStack: ${entry.error.stack}`;
    }
    
    return baseMessage;
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context,
      error,
    };

    const formattedMessage = this.formatLogEntry(entry);
    
    if (level >= LogLevel.ERROR) {
      console.error(formattedMessage);
    } else if (level >= LogLevel.WARN) {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }
}

export const logger = new Logger();