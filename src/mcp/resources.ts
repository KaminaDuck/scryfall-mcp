import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { ScryfallClient } from '../services/scryfall-client.js';
import { GraphService } from '../services/graph-service.js';

export class MCPResources {
  constructor(
    private scryfallClient: ScryfallClient,
    private graphService: GraphService,
  ) {}

  getResources(): Resource[] {
    return [
      {
        uri: 'card://',
        name: 'Card Resource',
        description: 'Access individual card data by ID',
        mimeType: 'application/json',
      },
      {
        uri: 'set://',
        name: 'Set Resource',
        description: 'Access set information by set code',
        mimeType: 'application/json',
      },
      {
        uri: 'collection://downloaded',
        name: 'Downloaded Cards Collection',
        description: 'Access the collection of downloaded cards',
        mimeType: 'application/json',
      },
      {
        uri: 'collection://images',
        name: 'Downloaded Images Collection',
        description: 'Access the collection of downloaded images',
        mimeType: 'application/json',
      },
      {
        uri: 'stats://database',
        name: 'Database Statistics',
        description: 'Access database statistics and metrics',
        mimeType: 'application/json',
      },
      {
        uri: 'collection://print-files',
        name: 'Print Files Collection',
        description: 'Access all generated print files',
        mimeType: 'application/json',
      },
      {
        uri: 'collection://print-ready-cards',
        name: 'Print-Ready Cards Collection',
        description: 'Access cards suitable for printing',
        mimeType: 'application/json',
      },
      {
        uri: 'printfile://',
        name: 'Print File Resource',
        description: 'Access individual print file data by ID',
        mimeType: 'application/json',
      },
      {
        uri: 'print-sheet://',
        name: 'Print Sheet Resource',
        description: 'Access print sheets by layout type',
        mimeType: 'application/json',
      },
    ];
  }

  async handleResourceRequest(uri: string): Promise<any> {
    const url = new URL(uri);
    
    switch (url.protocol) {
      case 'card:':
        return await this.getCardResource(url.pathname);
      case 'set:':
        return await this.getSetResource(url.pathname);
      case 'collection:':
        return await this.getCollectionResource(url.pathname);
      case 'stats:':
        return await this.getStatsResource(url.pathname);
      case 'printfile:':
        return await this.getPrintFileResource(url.pathname);
      case 'print-sheet:':
        return await this.getPrintSheetResource(url.pathname);
      default:
        throw new Error(`Unsupported resource protocol: ${url.protocol}`);
    }
  }

  private async getCardResource(cardId: string): Promise<any> {
    if (!cardId || cardId === '/') {
      throw new Error('Card ID is required');
    }

    const cleanId = cardId.startsWith('/') ? cardId.slice(1) : cardId;
    
    const storedCard = await this.graphService.findCard({ id: cleanId });
    
    if (storedCard) {
      const images = await this.graphService.listDownloadedCards({
        limit: 1,
        offset: 0,
      });
      
      const cardWithImages = images.find(c => c.id === cleanId);
      
      return {
        source: 'local',
        card: storedCard,
        images: cardWithImages?.images || [],
      };
    }

    try {
      const card = await this.scryfallClient.getCard(cleanId);
      return {
        source: 'scryfall',
        card: {
          id: card.id,
          name: card.name,
          set: card.set,
          set_name: card.set_name,
          collector_number: card.collector_number,
          released_at: card.released_at,
          mana_cost: card.mana_cost,
          cmc: card.cmc,
          type_line: card.type_line,
          oracle_text: card.oracle_text,
          power: card.power,
          toughness: card.toughness,
          loyalty: card.loyalty,
          colors: card.colors,
          color_identity: card.color_identity,
          rarity: card.rarity,
          artist: card.artist,
          flavor_text: card.flavor_text,
          scryfall_uri: card.scryfall_uri,
          image_uris: card.image_uris,
          layout: card.layout,
          legalities: card.legalities,
          prices: card.prices,
        },
        images: [],
      };
    } catch (error) {
      throw new Error(`Card not found: ${cleanId}`);
    }
  }

  private async getSetResource(setCode: string): Promise<any> {
    if (!setCode || setCode === '/') {
      throw new Error('Set code is required');
    }

    const cleanCode = setCode.startsWith('/') ? setCode.slice(1) : setCode;
    
    const cards = await this.graphService.searchCards({
      set: cleanCode,
      limit: 50,
    });

    if (cards.length === 0) {
      try {
        const searchResult = await this.scryfallClient.searchCards({
          q: `set:${cleanCode}`,
        });
        
        return {
          source: 'scryfall',
          set_code: cleanCode,
          cards: searchResult.data.map(card => ({
            id: card.id,
            name: card.name,
            collector_number: card.collector_number,
            rarity: card.rarity,
            mana_cost: card.mana_cost,
            cmc: card.cmc,
            type_line: card.type_line,
            image_uris: card.image_uris,
          })),
          total_cards: searchResult.total_cards,
          has_more: searchResult.has_more,
        };
      } catch (error) {
        throw new Error(`Set not found: ${cleanCode}`);
      }
    }

    return {
      source: 'local',
      set_code: cleanCode,
      cards: cards.map(card => ({
        id: card.id,
        name: card.name,
        collector_number: card.collectorNumber,
        rarity: card.rarity,
        mana_cost: card.manaCost,
        cmc: card.cmc,
        type_line: card.typeLine,
        oracle_text: card.oracleText,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
        colors: card.colors,
        color_identity: card.colorIdentity,
        artist: card.artist,
        flavor_text: card.flavorText,
        scryfall_uri: card.scryfallUri,
        layout: card.layout,
        created_at: card.createdAt,
        updated_at: card.updatedAt,
      })),
      total_cards: cards.length,
    };
  }

  private async getCollectionResource(collectionType: string): Promise<any> {
    const type = collectionType.startsWith('/') ? collectionType.slice(1) : collectionType;
    
    switch (type) {
      case 'downloaded':
        return await this.getDownloadedCardsCollection();
      case 'images':
        return await this.getDownloadedImagesCollection();
      case 'print-files':
        return await this.getPrintFilesCollection();
      case 'print-ready-cards':
        return await this.getPrintReadyCardsCollection();
      default:
        throw new Error(`Unknown collection type: ${type}`);
    }
  }

  private async getDownloadedCardsCollection(): Promise<any> {
    const cards = await this.graphService.listDownloadedCards({
      limit: 100,
      offset: 0,
    });

    return {
      collection_type: 'downloaded_cards',
      total_cards: cards.length,
      cards: cards.map(card => ({
        id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.setName,
        collector_number: card.collectorNumber,
        rarity: card.rarity,
        colors: card.colors,
        color_identity: card.colorIdentity,
        mana_cost: card.manaCost,
        cmc: card.cmc,
        type_line: card.typeLine,
        layout: card.layout,
        artist: card.artist,
        created_at: card.createdAt,
        updated_at: card.updatedAt,
        image_count: card.images.length,
        available_variants: card.images.map(img => img.variant),
      })),
    };
  }

  private async getDownloadedImagesCollection(): Promise<any> {
    const cards = await this.graphService.listDownloadedCards({
      limit: 100,
      offset: 0,
    });

    const images = cards.flatMap(card => 
      card.images.map(img => ({
        id: img.id,
        card_id: card.id,
        card_name: card.name,
        set: card.set,
        collector_number: card.collectorNumber,
        variant: img.variant,
        file_path: img.filePath,
        file_size: img.fileSize,
        checksum: img.checksum,
        width: img.width,
        height: img.height,
        dpi: img.dpi,
        is_print_ready: img.isPrintReady,
        format: img.format,
        downloaded_at: img.downloadedAt,
      })),
    );

    return {
      collection_type: 'downloaded_images',
      total_images: images.length,
      images,
    };
  }

  private async getStatsResource(statsType: string): Promise<any> {
    const type = statsType.startsWith('/') ? statsType.slice(1) : statsType;
    
    switch (type) {
      case 'database':
        return await this.getDatabaseStats();
      default:
        throw new Error(`Unknown stats type: ${type}`);
    }
  }

  private async getDatabaseStats(): Promise<any> {
    const stats = await this.graphService.getStats();
    
    return {
      stats_type: 'database',
      generated_at: new Date().toISOString(),
      ...stats,
    };
  }

  private async getPrintFilesCollection(): Promise<any> {
    const printFiles = await this.graphService.findPrintFiles({
      limit: 100,
      offset: 0,
    });

    return {
      collection_type: 'print_files',
      total_print_files: printFiles.length,
      print_files: printFiles.map(file => ({
        id: file.id,
        layout: file.layout,
        format: file.format,
        file_path: file.filePath,
        file_size: file.fileSize,
        page_count: file.pageCount,
        card_count: file.cardIds.length,
        card_ids: file.cardIds,
        dimensions: file.dimensions,
        created_at: file.createdAt,
        checksum: file.checksum,
      })),
    };
  }

  private async getPrintReadyCardsCollection(): Promise<any> {
    const cards = await this.graphService.getPrintReadyCards({
      limit: 100,
      offset: 0,
    });

    return {
      collection_type: 'print_ready_cards',
      total_cards: cards.length,
      cards: cards.map(card => ({
        id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.setName,
        collector_number: card.collectorNumber,
        rarity: card.rarity,
        colors: card.colors,
        color_identity: card.colorIdentity,
        mana_cost: card.manaCost,
        cmc: card.cmc,
        type_line: card.typeLine,
        layout: card.layout,
        artist: card.artist,
        created_at: card.createdAt,
        updated_at: card.updatedAt,
        print_ready_images: card.images.filter(img => img.isPrintReady).map(img => ({
          variant: img.variant,
          file_path: img.filePath,
          width: img.width,
          height: img.height,
          dpi: img.dpi,
          file_size: img.fileSize,
        })),
      })),
    };
  }

  private async getPrintFileResource(printFileId: string): Promise<any> {
    if (!printFileId || printFileId === '/') {
      throw new Error('Print file ID is required');
    }

    const cleanId = printFileId.startsWith('/') ? printFileId.slice(1) : printFileId;
    
    const printFiles = await this.graphService.findPrintFiles({
      limit: 1,
      offset: 0,
    });

    const printFile = printFiles.find(file => file.id === cleanId);

    if (!printFile) {
      throw new Error(`Print file not found: ${cleanId}`);
    }

    return {
      source: 'local',
      print_file: {
        id: printFile.id,
        layout: printFile.layout,
        format: printFile.format,
        file_path: printFile.filePath,
        file_size: printFile.fileSize,
        page_count: printFile.pageCount,
        card_count: printFile.cardIds.length,
        card_ids: printFile.cardIds,
        dimensions: printFile.dimensions,
        created_at: printFile.createdAt,
        checksum: printFile.checksum,
      },
    };
  }

  private async getPrintSheetResource(layout: string): Promise<any> {
    if (!layout || layout === '/') {
      throw new Error('Print sheet layout is required');
    }

    const cleanLayout = layout.startsWith('/') ? layout.slice(1) : layout;
    
    const printFiles = await this.graphService.findPrintFiles({
      layout: cleanLayout,
      limit: 50,
      offset: 0,
    });

    return {
      source: 'local',
      layout: cleanLayout,
      total_print_sheets: printFiles.length,
      print_sheets: printFiles.map(file => ({
        id: file.id,
        format: file.format,
        file_path: file.filePath,
        file_size: file.fileSize,
        page_count: file.pageCount,
        card_count: file.cardIds.length,
        card_ids: file.cardIds,
        dimensions: file.dimensions,
        created_at: file.createdAt,
        checksum: file.checksum,
      })),
    };
  }
}