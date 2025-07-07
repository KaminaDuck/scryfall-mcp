import { z } from 'zod';

export const CardNodeSchema = z.object({
  id: z.string().uuid(),
  oracleId: z.string().uuid(),
  name: z.string(),
  set: z.string(),
  setName: z.string(),
  collectorNumber: z.string(),
  lang: z.string(),
  releasedAt: z.string(),
  manaCost: z.string().optional(),
  cmc: z.number(),
  typeLine: z.string(),
  oracleText: z.string().optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  loyalty: z.string().optional(),
  colors: z.array(z.string()),
  colorIdentity: z.array(z.string()),
  rarity: z.string(),
  artist: z.string().optional(),
  flavorText: z.string().optional(),
  scryfallUri: z.string().url(),
  layout: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ImageNodeSchema = z.object({
  id: z.string(),
  cardId: z.string().uuid(),
  variant: z.enum(['small', 'normal', 'large', 'png', 'art_crop', 'border_crop', 'png_print']),
  filePath: z.string(),
  fileSize: z.number(),
  checksum: z.string(),
  width: z.number(),
  height: z.number(),
  format: z.string(),
  downloadedAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  dpi: z.number().optional(),
  isPrintReady: z.boolean().optional(),
  printValidatedAt: z.string().datetime().optional(),
});

export const SetNodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  setType: z.string(),
  releasedAt: z.string().optional(),
  cardCount: z.number(),
  digital: z.boolean(),
  iconSvgUri: z.string().url().optional(),
  scryfallUri: z.string().url(),
});

export const PrintFileNodeSchema = z.object({
  id: z.string(),
  cardIds: z.array(z.string().uuid()),
  layout: z.enum(['a4_9up', 'letter_9up', 'a4_18up', 'custom']),
  format: z.enum(['pdf', 'png']),
  filePath: z.string(),
  fileSize: z.number(),
  pageCount: z.number().optional(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
  createdAt: z.string().datetime(),
  checksum: z.string(),
});

export const RelationshipSchema = z.object({
  type: z.enum(['HAS_IMAGE', 'BELONGS_TO', 'RELATED_TO', 'REPRINTED_IN', 'HAS_PRINT_FILE']),
  properties: z.record(z.any()).optional(),
});

export const DatabaseConfigSchema = z.object({
  uri: z.string(),
  username: z.string(),
  password: z.string(),
  database: z.string().optional(),
  maxConnectionPoolSize: z.number().optional().default(50),
});

export type CardNode = z.infer<typeof CardNodeSchema>;
export type ImageNode = z.infer<typeof ImageNodeSchema>;
export type SetNode = z.infer<typeof SetNodeSchema>;
export type PrintFileNode = z.infer<typeof PrintFileNodeSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

export interface QueryResult<T> {
  records: T[];
  summary: {
    query: {
      text: string;
      parameters: Record<string, any>;
    };
    counters: {
      nodesCreated: number;
      nodesDeleted: number;
      relationshipsCreated: number;
      relationshipsDeleted: number;
      propertiesSet: number;
    };
    resultAvailableAfter: number;
    resultConsumedAfter: number;
  };
}

export interface TransactionContext {
  run: <T = any>(query: string, parameters?: Record<string, any>) => Promise<QueryResult<T>>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}