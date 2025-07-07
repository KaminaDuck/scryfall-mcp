import { z } from 'zod';
import { ImageVariant, PrintValidationResult } from './scryfall.js';

export const SearchCardsInputSchema = z.object({
  query: z.string().min(1).describe('The search query for finding cards'),
  unique: z.enum(['cards', 'art', 'prints']).optional().describe('The method to use for ensuring unique results'),
  order: z.enum(['name', 'set', 'released', 'rarity', 'color', 'usd', 'eur', 'tix', 'cmc', 'power', 'toughness', 'edhrec', 'artist']).optional().describe('The order to sort returned cards'),
  dir: z.enum(['auto', 'asc', 'desc']).optional().describe('The direction to sort cards'),
  includeExtras: z.boolean().optional().describe('Include extra cards like tokens'),
  page: z.number().min(1).optional().describe('The page number to return'),
});

export const DownloadCardImageInputSchema = z.object({
  cardId: z.string().describe('The Scryfall ID of the card'),
  variant: z.enum(['small', 'normal', 'large', 'png', 'art_crop', 'border_crop']).optional().default('large').describe('The image variant to download'),
  face: z.enum(['front', 'back']).optional().describe('For double-faced cards, which face to download'),
});

export const GetCardDetailsInputSchema = z.object({
  identifier: z.union([
    z.object({ id: z.string().uuid().describe('Scryfall card ID') }),
    z.object({ name: z.string().describe('Card name (exact)') }),
    z.object({ 
      name: z.string().describe('Card name'), 
      set: z.string().describe('Set code'), 
    }),
    z.object({ 
      collectorNumber: z.string().describe('Collector number'), 
      set: z.string().describe('Set code'), 
    }),
  ]).describe('Card identifier'),
});

export const ListDownloadedCardsInputSchema = z.object({
  set: z.string().optional().describe('Filter by set code'),
  name: z.string().optional().describe('Filter by card name (partial match)'),
  hasVariant: z.enum(['small', 'normal', 'large', 'png', 'art_crop', 'border_crop']).optional().describe('Filter by available image variant'),
  limit: z.number().min(1).max(100).optional().default(20).describe('Maximum number of results'),
  offset: z.number().min(0).optional().default(0).describe('Number of results to skip'),
});

export const DownloadPrintFileInputSchema = z.object({
  cardId: z.string().describe('The Scryfall ID of the card'),
  variant: z.enum(['small', 'normal', 'large', 'png', 'art_crop', 'border_crop']).optional().default('png').describe('The image variant to download'),
  validateQuality: z.boolean().optional().default(true).describe('Whether to validate print quality'),
  face: z.enum(['front', 'back']).optional().describe('For double-faced cards, which face to download'),
});

export const GeneratePrintSheetInputSchema = z.object({
  cardIds: z.array(z.string()).min(1).describe('Array of Scryfall card IDs to include in the print sheet'),
  layout: z.enum(['a4_9up', 'letter_9up', 'a4_18up']).optional().default('a4_9up').describe('The print sheet layout'),
  includeBleed: z.boolean().optional().default(true).describe('Whether to include bleed area in the print sheet'),
  outputFormat: z.enum(['pdf', 'png']).optional().default('pdf').describe('The output format for the print sheet'),
});

export const ValidatePrintQualityInputSchema = z.object({
  cardId: z.string().describe('The Scryfall ID of the card'),
  variant: z.enum(['small', 'normal', 'large', 'png', 'art_crop', 'border_crop']).optional().default('png').describe('The image variant to validate'),
  targetDpi: z.number().min(72).max(1200).optional().describe('Target DPI for print quality validation'),
});

export const MCPToolResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export const MCPResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export type SearchCardsInput = z.infer<typeof SearchCardsInputSchema>;
export type DownloadCardImageInput = z.infer<typeof DownloadCardImageInputSchema>;
export type GetCardDetailsInput = z.infer<typeof GetCardDetailsInputSchema>;
export type ListDownloadedCardsInput = z.infer<typeof ListDownloadedCardsInputSchema>;
export type DownloadPrintFileInput = z.infer<typeof DownloadPrintFileInputSchema>;
export type GeneratePrintSheetInput = z.infer<typeof GeneratePrintSheetInputSchema>;
export type ValidatePrintQualityInput = z.infer<typeof ValidatePrintQualityInputSchema>;
export type MCPToolResponse = z.infer<typeof MCPToolResponseSchema>;
export type MCPResource = z.infer<typeof MCPResourceSchema>;

export interface DownloadResult {
  cardId: string;
  cardName: string;
  set: string;
  collectorNumber: string;
  variant: ImageVariant;
  filePath: string;
  fileSize: number;
  checksum: string;
  width?: number;
  height?: number;
  dpi?: number;
  isPrintReady?: boolean;
  printValidation?: PrintValidationResult;
}