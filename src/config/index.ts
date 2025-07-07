import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import path from 'path';

loadEnv();

const ConfigSchema = z.object({
  neo4j: z.object({
    uri: z.string().min(1),
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  storage: z.object({
    imagePath: z.string().min(1),
  }),
  scryfall: z.object({
    rateLimit: z.number().min(1).max(10),
    requestDelay: z.number().min(0),
  }),
  server: z.object({
    port: z.number().optional(),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
  }),
  proxy: z.object({
    http: z.string().optional(),
    https: z.string().optional(),
  }),
  print: z.object({
    outputPath: z.string().min(1),
    minDpi: z.number().min(72).max(1200),
    sheetFormat: z.enum(['a4_9up', 'letter_9up', 'a4_18up']),
    enableValidation: z.boolean(),
  }),
});

const rawConfig = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
  },
  storage: {
    imagePath: process.env.IMAGE_STORAGE_PATH || path.join(process.cwd(), 'images'),
  },
  scryfall: {
    rateLimit: parseInt(process.env.SCRYFALL_RATE_LIMIT || '10', 10),
    requestDelay: parseInt(process.env.SCRYFALL_REQUEST_DELAY || '100', 10),
  },
  server: {
    port: process.env.MCP_SERVER_PORT ? parseInt(process.env.MCP_SERVER_PORT, 10) : undefined,
  },
  logging: {
    level: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
  proxy: {
    http: process.env.HTTP_PROXY,
    https: process.env.HTTPS_PROXY,
  },
  print: {
    outputPath: process.env.PRINT_OUTPUT_PATH || path.join(process.cwd(), 'print'),
    minDpi: parseInt(process.env.MIN_PRINT_DPI || '300', 10),
    sheetFormat: (process.env.PRINT_SHEET_FORMAT || 'a4_9up') as 'a4_9up' | 'letter_9up' | 'a4_18up',
    enableValidation: (process.env.ENABLE_PRINT_VALIDATION || 'true') === 'true',
  },
};

const validationResult = ConfigSchema.safeParse(rawConfig);

if (!validationResult.success) {
  console.error('Configuration validation failed:', validationResult.error.format());
  console.error('\nPlease check your environment variables and ensure all required values are set.');
  console.error('You can copy .env.example to .env and update the values.');
  process.exit(1);
}

export const config = validationResult.data;

export function getAbsoluteImagePath(relativePath: string): string {
  return path.isAbsolute(config.storage.imagePath)
    ? path.join(config.storage.imagePath, relativePath)
    : path.join(process.cwd(), config.storage.imagePath, relativePath);
}

export function ensureImageDirectory(): string {
  const absolutePath = path.isAbsolute(config.storage.imagePath)
    ? config.storage.imagePath
    : path.join(process.cwd(), config.storage.imagePath);
  
  return absolutePath;
}

export function getPrintOutputPath(relativePath: string): string {
  return path.isAbsolute(config.print.outputPath)
    ? path.join(config.print.outputPath, relativePath)
    : path.join(process.cwd(), config.print.outputPath, relativePath);
}

export function ensurePrintDirectory(): string {
  const absolutePath = path.isAbsolute(config.print.outputPath)
    ? config.print.outputPath
    : path.join(process.cwd(), config.print.outputPath);
  
  return absolutePath;
}