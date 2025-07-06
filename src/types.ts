import { z } from 'zod';

// Zod schemas for validation
export const ScryfallCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  scryfall_uri: z.string(),
  uri: z.string(),
  layout: z.string(),
  image_uris: z.object({
    small: z.string(),
    normal: z.string(),
    large: z.string(),
    png: z.string(),
    art_crop: z.string(),
    border_crop: z.string(),
  }).optional(),
  card_faces: z.array(z.object({
    image_uris: z.object({
      small: z.string(),
      normal: z.string(),
      large: z.string(),
      png: z.string(),
      art_crop: z.string(),
      border_crop: z.string(),
    }).optional(),
  })).optional(),
  set: z.string(),
  set_name: z.string(),
  collector_number: z.string(),
  rarity: z.string(),
  prices: z.object({
    usd: z.string().nullable(),
    usd_foil: z.string().nullable(),
    eur: z.string().nullable(),
    eur_foil: z.string().nullable(),
  }).optional(),
  legalities: z.record(z.string()).optional(),
  type_line: z.string(),
  oracle_text: z.string().optional(),
  mana_cost: z.string().optional(),
  cmc: z.number().optional(),
  colors: z.array(z.string()).optional(),
  color_identity: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  games: z.array(z.string()).optional(),
  reserved: z.boolean().optional(),
  foil: z.boolean().optional(),
  nonfoil: z.boolean().optional(),
  finishes: z.array(z.string()).optional(),
  oversized: z.boolean().optional(),
  promo: z.boolean().optional(),
  reprint: z.boolean().optional(),
  variation: z.boolean().optional(),
  set_id: z.string().optional(),
  set_search_uri: z.string().optional(),
  scryfall_set_uri: z.string().optional(),
  rulings_uri: z.string().optional(),
  prints_search_uri: z.string().optional(),
  artist: z.string().optional(),
  artist_ids: z.array(z.string()).optional(),
  illustration_id: z.string().optional(),
  border_color: z.string().optional(),
  frame: z.string().optional(),
  full_art: z.boolean().optional(),
  textless: z.boolean().optional(),
  booster: z.boolean().optional(),
  story_spotlight: z.boolean().optional(),
  edhrec_rank: z.number().optional(),
  preview: z.object({
    source: z.string(),
    source_uri: z.string(),
    previewed_at: z.string(),
  }).optional(),
  purchase_uris: z.record(z.string()).optional(),
  related_uris: z.record(z.string()).optional(),
});

export const ScryfallSearchResponseSchema = z.object({
  object: z.literal('list'),
  total_cards: z.number(),
  has_more: z.boolean(),
  next_page: z.string().optional(),
  data: z.array(ScryfallCardSchema),
});

export const SearchOptionsSchema = z.object({
  query: z.string(),
  unique: z.enum(['cards', 'art', 'prints']).optional(),
  order: z.enum(['name', 'set', 'released', 'rarity', 'color', 'usd', 'tix', 'eur', 'cmc', 'power', 'toughness', 'edhrec', 'penny', 'artist', 'review']).optional(),
  dir: z.enum(['auto', 'asc', 'desc']).optional(),
  include_extras: z.boolean().optional(),
  include_multilingual: z.boolean().optional(),
  include_variations: z.boolean().optional(),
  page: z.number().optional(),
});

// TypeScript interfaces derived from schemas
export type ScryfallCard = z.infer<typeof ScryfallCardSchema>;
export type ScryfallSearchResponse = z.infer<typeof ScryfallSearchResponseSchema>;
export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

// Database interfaces
export interface DatabaseCard {
  id: number;
  card_name: string;
  filename: string;
  download_date: string;
  card_id: string;
  set_code: string;
  image_url: string;
}

// MCP Response interfaces
export interface ToolResponse<T = unknown> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  count?: number;
  cards?: Record<string, unknown>;
  total_records?: number;
  records_by_set?: Record<string, number>;
  recent_downloads?: Array<{
    card_name: string;
    download_date: string;
    set_code: string;
  }>;
  missing_files?: string[];
  cleaned_records?: number;
  verified_records?: number;
  filepath?: string;
  set_name?: string;
  sets?: Record<string, number>;
}

// Image URIs interface
export interface ImageUris {
  small: string;
  normal: string;
  large: string;
  png: string;
  art_crop: string;
  border_crop: string;
}

// Card artwork response
export interface CardArtwork {
  card_id: string;
  card_name: string;
  image_uris: ImageUris | null;
  card_faces?: Array<{
    image_uris: ImageUris | null;
  }>;
}

// Download options
export interface DownloadOptions {
  force?: boolean;
  setCode?: string;
  collectorNumber?: string;
  downloadArtCrop?: boolean;
}

// Database statistics
export interface DatabaseStats {
  total_records: number;
  records_by_set: Record<string, number>;
  recent_downloads: Array<{
    card_name: string;
    download_date: string;
    set_code: string;
  }>;
  sets: Record<string, number>;
}