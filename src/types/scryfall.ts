import { z } from 'zod';

export const ImageUrisSchema = z.object({
  small: z.string().url().optional(),
  normal: z.string().url().optional(),
  large: z.string().url().optional(),
  png: z.string().url().optional(),
  art_crop: z.string().url().optional(),
  border_crop: z.string().url().optional(),
});

export const CardFaceSchema = z.object({
  object: z.literal('card_face'),
  name: z.string(),
  mana_cost: z.string().optional(),
  type_line: z.string().optional(),
  oracle_text: z.string().optional(),
  colors: z.array(z.string()).optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  loyalty: z.string().optional(),
  flavor_text: z.string().optional(),
  illustration_id: z.string().uuid().optional(),
  image_uris: ImageUrisSchema.optional(),
});

export const CardSchema = z.object({
  object: z.literal('card'),
  id: z.string().uuid(),
  oracle_id: z.string().uuid(),
  multiverse_ids: z.array(z.number()).optional(),
  mtgo_id: z.number().optional(),
  arena_id: z.number().optional(),
  tcgplayer_id: z.number().optional(),
  cardmarket_id: z.number().optional(),
  name: z.string(),
  lang: z.string(),
  released_at: z.string(),
  uri: z.string().url(),
  scryfall_uri: z.string().url(),
  layout: z.string(),
  highres_image: z.boolean(),
  image_status: z.string(),
  image_uris: ImageUrisSchema.optional(),
  mana_cost: z.string().optional(),
  cmc: z.number(),
  type_line: z.string(),
  oracle_text: z.string().optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  loyalty: z.string().optional(),
  colors: z.array(z.string()).optional(),
  color_identity: z.array(z.string()),
  keywords: z.array(z.string()),
  all_parts: z.array(z.object({
    object: z.string(),
    id: z.string().uuid(),
    component: z.string(),
    name: z.string(),
    type_line: z.string(),
    uri: z.string().url(),
  })).optional(),
  card_faces: z.array(CardFaceSchema).optional(),
  legalities: z.record(z.string()),
  games: z.array(z.string()),
  reserved: z.boolean(),
  foil: z.boolean(),
  nonfoil: z.boolean(),
  finishes: z.array(z.string()),
  oversized: z.boolean(),
  promo: z.boolean(),
  reprint: z.boolean(),
  variation: z.boolean(),
  set_id: z.string().uuid(),
  set: z.string(),
  set_name: z.string(),
  set_type: z.string(),
  set_uri: z.string().url(),
  set_search_uri: z.string().url(),
  scryfall_set_uri: z.string().url(),
  rulings_uri: z.string().url(),
  prints_search_uri: z.string().url(),
  collector_number: z.string(),
  digital: z.boolean(),
  rarity: z.string(),
  watermark: z.string().optional(),
  flavor_text: z.string().optional(),
  card_back_id: z.string().uuid(),
  artist: z.string().optional(),
  artist_ids: z.array(z.string().uuid()).optional(),
  illustration_id: z.string().uuid().optional(),
  border_color: z.string(),
  frame: z.string(),
  full_art: z.boolean(),
  textless: z.boolean(),
  booster: z.boolean(),
  story_spotlight: z.boolean(),
  prices: z.record(z.string().nullable()),
  related_uris: z.record(z.string().url()),
});

export const CardListSchema = z.object({
  object: z.literal('list'),
  total_cards: z.number().optional(),
  has_more: z.boolean(),
  next_page: z.string().url().optional(),
  data: z.array(CardSchema),
});

export const SearchParamsSchema = z.object({
  q: z.string(),
  unique: z.enum(['cards', 'art', 'prints']).optional(),
  order: z.enum(['name', 'set', 'released', 'rarity', 'color', 'usd', 'eur', 'tix', 'cmc', 'power', 'toughness', 'edhrec', 'artist']).optional(),
  dir: z.enum(['auto', 'asc', 'desc']).optional(),
  include_extras: z.boolean().optional(),
  include_multilingual: z.boolean().optional(),
  include_variations: z.boolean().optional(),
  page: z.number().optional(),
});

export const CardIdentifierSchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({ mtgo_id: z.number() }),
  z.object({ multiverse_id: z.number() }),
  z.object({ oracle_id: z.string().uuid() }),
  z.object({ illustration_id: z.string().uuid() }),
  z.object({ name: z.string() }),
  z.object({ name: z.string(), set: z.string() }),
  z.object({ collector_number: z.string(), set: z.string() }),
]);

export const ErrorSchema = z.object({
  object: z.literal('error'),
  code: z.string(),
  status: z.number(),
  details: z.string(),
  type: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

export type ImageUris = z.infer<typeof ImageUrisSchema>;
export type CardFace = z.infer<typeof CardFaceSchema>;
export type Card = z.infer<typeof CardSchema>;
export type CardList = z.infer<typeof CardListSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
export type CardIdentifier = z.infer<typeof CardIdentifierSchema>;
export type ScryfallError = z.infer<typeof ErrorSchema>;

export type ImageVariant = 'small' | 'normal' | 'large' | 'png' | 'art_crop' | 'border_crop' | 'png_print';

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes?: number;
  percentage?: number;
}

export interface PrintQuality {
  width: number;
  height: number;
  dpi: number;
  isPrintReady: boolean;
  qualityScore: number;
}

export enum PrintSheetLayout {
  A4_9UP = 'a4_9up',
  LETTER_9UP = 'letter_9up',
  A4_18UP = 'a4_18up',
  CUSTOM = 'custom'
}

export interface PrintValidationResult {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
  estimatedDpi: number;
}