import { mkdirSync, existsSync } from 'fs';
import { ScryfallCard } from '../types.js';

export function sanitizeFilename(filename: string): string {
  // Remove or replace characters that are not allowed in filenames
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export function createDirectoryIfNotExists(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatCardDisplayName(card: ScryfallCard): string {
  let displayName = card.name;
  if (card.set && card.collector_number) {
    displayName += ` [${card.set.toUpperCase()}#${card.collector_number}]`;
  }
  return displayName;
}

export function groupCardsByNameAndArt(cards: ScryfallCard[]): Record<string, ScryfallCard[]> {
  const grouped: Record<string, ScryfallCard[]> = {};
  
  for (const card of cards) {
    const key = `${card.name}_${card.illustration_id || 'default'}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(card);
  }
  
  return grouped;
}

export function generateCardFilename(card: ScryfallCard, includeSet: boolean = true): string {
  let filename = sanitizeFilename(card.name);
  
  if (includeSet && card.set && card.collector_number) {
    filename += `_${card.set.toLowerCase()}_${card.collector_number}`;
  }
  
  return filename;
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function extractImageExtension(url: string): string {
  const match = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

export function getCurrentISODateTime(): string {
  return new Date().toISOString();
}

export function sanitizeSetName(setName: string): string {
  return setName
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

export function parseCardQuery(query: string): {
  name: string;
  setCode?: string;
  collectorNumber?: string;
} {
  // Parse queries like "Lightning Bolt" or "Lightning Bolt set:lea" or "Lightning Bolt lea 123"
  const setMatch = query.match(/\bset:([a-zA-Z0-9]+)\b/i);
  const collectorMatch = query.match(/\b([a-zA-Z0-9]+)\s+(\d+[a-zA-Z]?)\b/);
  
  let name = query;
  let setCode: string | undefined;
  let collectorNumber: string | undefined;
  
  if (setMatch) {
    setCode = setMatch[1];
    name = name.replace(setMatch[0], '').trim();
  } else if (collectorMatch) {
    setCode = collectorMatch[1];
    collectorNumber = collectorMatch[2];
    name = name.replace(collectorMatch[0], '').trim();
  }
  
  return { name, setCode, collectorNumber };
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const attempt = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          reject(error);
          return;
        }
        
        const delay = baseDelay * Math.pow(2, attempts - 1);
        setTimeout(attempt, delay);
      }
    };
    
    attempt();
  });
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function validateCardName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 200;
}

export function normalizeCardName(name: string): string {
  return name.trim().toLowerCase();
}