import neo4j, { Driver } from 'neo4j-driver';
import { Card } from '../types/scryfall.js';
import { CardNode, DatabaseConfig, ImageNode, PrintFileNode, SetNode } from '../types/database.js';
import { DownloadResult } from '../types/mcp.js';
import { config } from '../config/index.js';

export class GraphService {
  private driver: Driver;
  private isConnected = false;

  constructor(dbConfig?: DatabaseConfig) {
    const connectionConfig = dbConfig || {
      uri: config.neo4j.uri,
      username: config.neo4j.username,
      password: config.neo4j.password,
    };

    this.driver = neo4j.driver(
      connectionConfig.uri,
      neo4j.auth.basic(connectionConfig.username, connectionConfig.password),
      {
        maxConnectionPoolSize: 'maxConnectionPoolSize' in connectionConfig ? connectionConfig.maxConnectionPoolSize : 50,
        connectionAcquisitionTimeout: 30000,
      },
    );
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to Neo4j: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    await this.driver.close();
    this.isConnected = false;
  }

  async createConstraintsAndIndexes(): Promise<void> {
    const session = this.driver.session();

    try {
      const constraints = [
        'CREATE CONSTRAINT card_id_unique IF NOT EXISTS FOR (c:Card) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT set_id_unique IF NOT EXISTS FOR (s:Set) REQUIRE s.id IS UNIQUE',
        'CREATE CONSTRAINT image_id_unique IF NOT EXISTS FOR (i:Image) REQUIRE i.id IS UNIQUE',
        'CREATE CONSTRAINT print_file_id_unique IF NOT EXISTS FOR (p:PrintFile) REQUIRE p.id IS UNIQUE',
      ];

      const indexes = [
        'CREATE INDEX card_name_idx IF NOT EXISTS FOR (c:Card) ON (c.name)',
        'CREATE INDEX card_set_idx IF NOT EXISTS FOR (c:Card) ON (c.set)',
        'CREATE INDEX card_oracle_id_idx IF NOT EXISTS FOR (c:Card) ON (c.oracleId)',
        'CREATE INDEX set_code_idx IF NOT EXISTS FOR (s:Set) ON (s.code)',
        'CREATE INDEX image_card_id_idx IF NOT EXISTS FOR (i:Image) ON (i.cardId)',
        'CREATE INDEX image_variant_idx IF NOT EXISTS FOR (i:Image) ON (i.variant)',
        'CREATE INDEX image_print_ready_idx IF NOT EXISTS FOR (i:Image) ON (i.isPrintReady)',
        'CREATE INDEX print_file_layout_idx IF NOT EXISTS FOR (p:PrintFile) ON (p.layout)',
      ];

      for (const constraint of constraints) {
        await session.run(constraint);
      }

      for (const index of indexes) {
        await session.run(index);
      }
    } finally {
      await session.close();
    }
  }

  async storeCard(card: Card): Promise<CardNode> {
    const session = this.driver.session();

    try {
      const cardNode: CardNode = {
        id: card.id,
        oracleId: card.oracle_id,
        name: card.name,
        set: card.set,
        setName: card.set_name,
        collectorNumber: card.collector_number,
        lang: card.lang,
        releasedAt: card.released_at,
        manaCost: card.mana_cost,
        cmc: card.cmc,
        typeLine: card.type_line,
        oracleText: card.oracle_text,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
        colors: card.colors || [],
        colorIdentity: card.color_identity,
        rarity: card.rarity,
        artist: card.artist,
        flavorText: card.flavor_text,
        scryfallUri: card.scryfall_uri,
        layout: card.layout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await session.run(
        `
        MERGE (c:Card {id: $id})
        SET c += $properties
        RETURN c
        `,
        { id: card.id, properties: cardNode },
      );

      return result.records[0]?.get('c').properties;
    } finally {
      await session.close();
    }
  }

  async storeImageRecord(downloadResult: DownloadResult): Promise<ImageNode> {
    const session = this.driver.session();

    try {
      const imageNode: ImageNode = {
        id: `${downloadResult.cardId}-${downloadResult.variant}`,
        cardId: downloadResult.cardId,
        variant: downloadResult.variant,
        filePath: downloadResult.filePath,
        fileSize: downloadResult.fileSize,
        checksum: downloadResult.checksum,
        width: downloadResult.width || 0,
        height: downloadResult.height || 0,
        format: downloadResult.filePath.endsWith('.png') ? 'png' : 'jpg',
        downloadedAt: new Date().toISOString(),
        sourceUrl: '',
        dpi: downloadResult.dpi,
        isPrintReady: downloadResult.isPrintReady,
        printValidatedAt: downloadResult.printValidation ? new Date().toISOString() : undefined,
      };

      const result = await session.run(
        `
        MERGE (i:Image {id: $id})
        SET i += $properties
        MERGE (c:Card {id: $cardId})
        MERGE (c)-[:HAS_IMAGE]->(i)
        RETURN i
        `,
        { 
          id: imageNode.id, 
          properties: imageNode,
          cardId: downloadResult.cardId, 
        },
      );

      return result.records[0]?.get('i').properties;
    } finally {
      await session.close();
    }
  }

  async storeSet(setData: { id: string; code: string; name: string; setType: string; releasedAt?: string; cardCount: number; digital: boolean; scryfallUri: string }): Promise<SetNode> {
    const session = this.driver.session();

    try {
      const setNode: SetNode = {
        ...setData,
        iconSvgUri: undefined,
      };

      const result = await session.run(
        `
        MERGE (s:Set {id: $id})
        SET s += $properties
        RETURN s
        `,
        { id: setData.id, properties: setNode },
      );

      return result.records[0]?.get('s').properties;
    } finally {
      await session.close();
    }
  }

  async findCard(identifier: { id?: string; name?: string; set?: string; collectorNumber?: string }): Promise<CardNode | null> {
    const session = this.driver.session();

    try {
      let query = 'MATCH (c:Card) WHERE ';
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      if (identifier.id) {
        conditions.push('c.id = $id');
        params.id = identifier.id;
      }

      if (identifier.name) {
        conditions.push('c.name = $name');
        params.name = identifier.name;
      }

      if (identifier.set) {
        conditions.push('c.set = $set');
        params.set = identifier.set;
      }

      if (identifier.collectorNumber) {
        conditions.push('c.collectorNumber = $collectorNumber');
        params.collectorNumber = identifier.collectorNumber;
      }

      if (conditions.length === 0) {
        return null;
      }

      query += `${conditions.join(' AND ')  } RETURN c LIMIT 1`;

      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        return null;
      }

      return result.records[0]?.get('c').properties;
    } finally {
      await session.close();
    }
  }

  async searchCards(params: {
    name?: string;
    set?: string;
    colors?: string[];
    rarity?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<CardNode[]> {
    const session = this.driver.session();

    try {
      let query = 'MATCH (c:Card) WHERE ';
      const conditions: string[] = [];
      const queryParams: Record<string, any> = {};

      if (params.name) {
        conditions.push('c.name CONTAINS $name');
        queryParams.name = params.name;
      }

      if (params.set) {
        conditions.push('c.set = $set');
        queryParams.set = params.set;
      }

      if (params.colors && params.colors.length > 0) {
        conditions.push('ALL(color IN $colors WHERE color IN c.colors)');
        queryParams.colors = params.colors;
      }

      if (params.rarity) {
        conditions.push('c.rarity = $rarity');
        queryParams.rarity = params.rarity;
      }

      if (params.type) {
        conditions.push('c.typeLine CONTAINS $type');
        queryParams.type = params.type;
      }

      if (conditions.length === 0) {
        query = 'MATCH (c:Card) RETURN c';
      } else {
        query += `${conditions.join(' AND ')  } RETURN c`;
      }

      query += ' ORDER BY c.name';

      if (params.limit) {
        query += ` LIMIT ${params.limit}`;
      }

      if (params.offset) {
        query += ` SKIP ${params.offset}`;
      }

      const result = await session.run(query, queryParams);
      
      return result.records.map(record => record.get('c').properties);
    } finally {
      await session.close();
    }
  }

  async listDownloadedCards(params: {
    set?: string;
    variant?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<CardNode & { images: ImageNode[] }>> {
    const session = this.driver.session();

    try {
      let query = 'MATCH (c:Card)-[:HAS_IMAGE]->(i:Image) WHERE ';
      const conditions: string[] = [];
      const queryParams: Record<string, any> = {};

      if (params.set) {
        conditions.push('c.set = $set');
        queryParams.set = params.set;
      }

      if (params.variant) {
        conditions.push('i.variant = $variant');
        queryParams.variant = params.variant;
      }

      if (conditions.length === 0) {
        query = 'MATCH (c:Card)-[:HAS_IMAGE]->(i:Image) RETURN c, collect(i) as images';
      } else {
        query += `${conditions.join(' AND ')  } RETURN c, collect(i) as images`;
      }

      query += ' ORDER BY c.name';

      if (params.limit) {
        query += ` LIMIT ${params.limit}`;
      }

      if (params.offset) {
        query += ` SKIP ${params.offset}`;
      }

      const result = await session.run(query, queryParams);
      
      return result.records.map(record => ({
        ...record.get('c').properties,
        images: record.get('images').map((img: any) => img.properties),
      }));
    } finally {
      await session.close();
    }
  }

  async deleteCard(cardId: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        'MATCH (c:Card {id: $cardId}) DETACH DELETE c',
        { cardId },
      );
    } finally {
      await session.close();
    }
  }

  async deleteImageRecord(imageId: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        'MATCH (i:Image {id: $imageId}) DETACH DELETE i',
        { imageId },
      );
    } finally {
      await session.close();
    }
  }

  async storePrintFile(printFileData: PrintFileNode): Promise<PrintFileNode> {
    const session = this.driver.session();

    try {
      const result = await session.run(
        `
        MERGE (p:PrintFile {id: $id})
        SET p += $properties
        WITH p
        UNWIND $cardIds as cardId
        MATCH (c:Card {id: cardId})
        MERGE (c)-[:HAS_PRINT_FILE]->(p)
        RETURN p
        `,
        { 
          id: printFileData.id, 
          properties: printFileData,
          cardIds: printFileData.cardIds,
        },
      );

      return result.records[0]?.get('p').properties;
    } finally {
      await session.close();
    }
  }

  async findPrintFiles(filters: {
    layout?: string;
    format?: string;
    cardIds?: string[];
    createdAfter?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PrintFileNode[]> {
    const session = this.driver.session();

    try {
      let query = 'MATCH (p:PrintFile) WHERE ';
      const conditions: string[] = [];
      const queryParams: Record<string, any> = {};

      if (filters.layout) {
        conditions.push('p.layout = $layout');
        queryParams.layout = filters.layout;
      }

      if (filters.format) {
        conditions.push('p.format = $format');
        queryParams.format = filters.format;
      }

      if (filters.cardIds && filters.cardIds.length > 0) {
        conditions.push('ANY(cardId IN p.cardIds WHERE cardId IN $cardIds)');
        queryParams.cardIds = filters.cardIds;
      }

      if (filters.createdAfter) {
        conditions.push('p.createdAt > $createdAfter');
        queryParams.createdAfter = filters.createdAfter;
      }

      if (conditions.length === 0) {
        query = 'MATCH (p:PrintFile) RETURN p';
      } else {
        query += `${conditions.join(' AND ')} RETURN p`;
      }

      query += ' ORDER BY p.createdAt DESC';

      if (filters.limit) {
        query += ` LIMIT ${filters.limit}`;
      }

      if (filters.offset) {
        query += ` SKIP ${filters.offset}`;
      }

      const result = await session.run(query, queryParams);
      
      return result.records.map(record => record.get('p').properties);
    } finally {
      await session.close();
    }
  }

  async deletePrintFile(printFileId: string): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(
        'MATCH (p:PrintFile {id: $printFileId}) DETACH DELETE p',
        { printFileId },
      );
    } finally {
      await session.close();
    }
  }

  async getPrintReadyCards(filters: {
    minDpi?: number;
    variants?: string[];
    set?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Array<CardNode & { images: ImageNode[] }>> {
    const session = this.driver.session();

    try {
      let query = 'MATCH (c:Card)-[:HAS_IMAGE]->(i:Image) WHERE i.isPrintReady = true';
      const queryParams: Record<string, any> = {};

      if (filters.minDpi !== undefined) {
        query += ' AND i.dpi >= $minDpi';
        queryParams.minDpi = filters.minDpi;
      }

      if (filters.variants && filters.variants.length > 0) {
        query += ' AND i.variant IN $variants';
        queryParams.variants = filters.variants;
      }

      if (filters.set) {
        query += ' AND c.set = $set';
        queryParams.set = filters.set;
      }

      query += ' RETURN c, collect(i) as images ORDER BY c.name';

      if (filters.limit) {
        query += ` LIMIT ${filters.limit}`;
      }

      if (filters.offset) {
        query += ` SKIP ${filters.offset}`;
      }

      const result = await session.run(query, queryParams);
      
      return result.records.map(record => ({
        ...record.get('c').properties,
        images: record.get('images').map((img: any) => img.properties),
      }));
    } finally {
      await session.close();
    }
  }

  async getStats(): Promise<{
    totalCards: number;
    totalImages: number;
    totalSets: number;
    totalPrintFiles: number;
    printReadyImages: number;
    imagesByVariant: Record<string, number>;
    cardsBySet: Record<string, number>;
    printFilesByLayout: Record<string, number>;
  }> {
    const session = this.driver.session();

    try {
      const [cardsResult, imagesResult, setsResult, printFilesResult, printReadyResult, variantResult, setResult, layoutResult] = await Promise.all([
        session.run('MATCH (c:Card) RETURN count(c) as count'),
        session.run('MATCH (i:Image) RETURN count(i) as count'),
        session.run('MATCH (s:Set) RETURN count(s) as count'),
        session.run('MATCH (p:PrintFile) RETURN count(p) as count'),
        session.run('MATCH (i:Image) WHERE i.isPrintReady = true RETURN count(i) as count'),
        session.run('MATCH (i:Image) RETURN i.variant as variant, count(i) as count'),
        session.run('MATCH (c:Card) RETURN c.set as set, count(c) as count'),
        session.run('MATCH (p:PrintFile) RETURN p.layout as layout, count(p) as count'),
      ]);

      const imagesByVariant: Record<string, number> = {};
      variantResult.records.forEach(record => {
        imagesByVariant[record.get('variant')] = record.get('count').toNumber();
      });

      const cardsBySet: Record<string, number> = {};
      setResult.records.forEach(record => {
        cardsBySet[record.get('set')] = record.get('count').toNumber();
      });

      const printFilesByLayout: Record<string, number> = {};
      layoutResult.records.forEach(record => {
        printFilesByLayout[record.get('layout')] = record.get('count').toNumber();
      });

      return {
        totalCards: cardsResult.records[0]?.get('count').toNumber() || 0,
        totalImages: imagesResult.records[0]?.get('count').toNumber() || 0,
        totalSets: setsResult.records[0]?.get('count').toNumber() || 0,
        totalPrintFiles: printFilesResult.records[0]?.get('count').toNumber() || 0,
        printReadyImages: printReadyResult.records[0]?.get('count').toNumber() || 0,
        imagesByVariant,
        cardsBySet,
        printFilesByLayout,
      };
    } finally {
      await session.close();
    }
  }
}