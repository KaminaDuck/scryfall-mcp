import { z } from 'zod';
import { ValidationError } from './errors.js';

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string,
): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      if (!firstError) {
        throw new ValidationError('Validation failed', undefined, input, { zodError: error.errors, input });
      }
      
      const path = firstError.path.join('.');
      const message = `${context ? `${context}: ` : ''}${firstError.message}${path ? ` (path: ${path})` : ''}`;
      
      throw new ValidationError(
        message,
        path,
        'received' in firstError ? firstError.received : undefined,
        {
          zodError: error.errors,
          input,
        },
      );
    }
    
    throw error;
  }
}

export function sanitizeCardName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-']/g, '').trim();
}

export function sanitizeSetCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateCardIdentifier(identifier: any): boolean {
  if (!identifier || typeof identifier !== 'object') {
    return false;
  }

  const hasId = 'id' in identifier && typeof identifier.id === 'string' && isValidUUID(identifier.id);
  const hasName = 'name' in identifier && typeof identifier.name === 'string' && identifier.name.trim().length > 0;
  const hasSetAndNumber = 'set' in identifier && 'collectorNumber' in identifier &&
    typeof identifier.set === 'string' && typeof identifier.collectorNumber === 'string';

  return hasId || hasName || hasSetAndNumber;
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export function validateImageVariant(variant: string): boolean {
  const validVariants = ['small', 'normal', 'large', 'png', 'art_crop', 'border_crop'];
  return validVariants.includes(variant);
}

export function validateSetCode(code: string): boolean {
  return /^[a-z0-9]{3,5}$/i.test(code);
}

export function validateCollectorNumber(number: string): boolean {
  return /^[0-9]+[a-z]*$/i.test(number);
}

export function validateColorArray(colors: any): boolean {
  if (!Array.isArray(colors)) {
    return false;
  }

  const validColors = ['W', 'U', 'B', 'R', 'G', 'C'];
  return colors.every(color => typeof color === 'string' && validColors.includes(color));
}

export function validateRarity(rarity: string): boolean {
  const validRarities = ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'];
  return validRarities.includes(rarity.toLowerCase());
}

export function parsePageNumber(page: any): number {
  if (typeof page === 'number') {
    return Math.max(1, Math.floor(page));
  }
  
  if (typeof page === 'string') {
    const parsed = parseInt(page, 10);
    return isNaN(parsed) ? 1 : Math.max(1, parsed);
  }
  
  return 1;
}

export function parseLimit(limit: any, defaultLimit: number = 20, maxLimit: number = 100): number {
  if (typeof limit === 'number') {
    return Math.min(maxLimit, Math.max(1, Math.floor(limit)));
  }
  
  if (typeof limit === 'string') {
    const parsed = parseInt(limit, 10);
    return isNaN(parsed) ? defaultLimit : Math.min(maxLimit, Math.max(1, parsed));
  }
  
  return defaultLimit;
}

export function parseOffset(offset: any): number {
  if (typeof offset === 'number') {
    return Math.max(0, Math.floor(offset));
  }
  
  if (typeof offset === 'string') {
    const parsed = parseInt(offset, 10);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }
  
  return 0;
}