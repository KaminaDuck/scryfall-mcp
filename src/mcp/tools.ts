import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ScryfallClient } from '../services/scryfall-client.js';
import { ImageDownloader } from '../services/image-downloader.js';
import { GraphService } from '../services/graph-service.js';
import { PrintService } from '../services/print-service.js';
import { PrintSheetLayout } from '../types/scryfall.js';
import { 
  DownloadCardImageInput, 
  DownloadCardImageInputSchema,
  DownloadPrintFileInput,
  DownloadPrintFileInputSchema,
  GeneratePrintSheetInput,
  GeneratePrintSheetInputSchema,
  GetCardDetailsInput,
  GetCardDetailsInputSchema,
  ListDownloadedCardsInput,
  ListDownloadedCardsInputSchema,
  MCPToolResponse,
  SearchCardsInput,
  SearchCardsInputSchema,
  ValidatePrintQualityInput,
  ValidatePrintQualityInputSchema,
} from '../types/mcp.js';

export class MCPTools {
  constructor(
    private scryfallClient: ScryfallClient,
    private imageDownloader: ImageDownloader,
    private graphService: GraphService,
    private printService: PrintService,
  ) {}

  getTools(): Tool[] {
    return [
      {
        name: 'search_cards',
        description: 'Search for Magic: The Gathering cards using Scryfall API',
        inputSchema: {
          type: 'object',
          properties: SearchCardsInputSchema.shape,
          required: ['query'],
        },
      },
      {
        name: 'download_card_image',
        description: 'Download and store a card image from Scryfall',
        inputSchema: {
          type: 'object',
          properties: DownloadCardImageInputSchema.shape,
          required: ['cardId'],
        },
      },
      {
        name: 'get_card_details',
        description: 'Get detailed information about a specific card',
        inputSchema: {
          type: 'object',
          properties: GetCardDetailsInputSchema.shape,
          required: ['identifier'],
        },
      },
      {
        name: 'list_downloaded_cards',
        description: 'List cards that have been downloaded and stored locally',
        inputSchema: {
          type: 'object',
          properties: ListDownloadedCardsInputSchema.shape,
          required: [],
        },
      },
      {
        name: 'get_random_card',
        description: 'Get a random Magic: The Gathering card',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'autocomplete_card_name',
        description: 'Get autocomplete suggestions for card names',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Partial card name to autocomplete',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_database_stats',
        description: 'Get statistics about the local card database',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'download_print_file',
        description: 'Download high-quality images optimized for printing',
        inputSchema: {
          type: 'object',
          properties: DownloadPrintFileInputSchema.shape,
          required: ['cardId'],
        },
      },
      {
        name: 'generate_print_sheet',
        description: 'Create multi-card print sheets in PDF format',
        inputSchema: {
          type: 'object',
          properties: GeneratePrintSheetInputSchema.shape,
          required: ['cardIds'],
        },
      },
      {
        name: 'validate_print_quality',
        description: 'Check if a card image meets print quality requirements',
        inputSchema: {
          type: 'object',
          properties: ValidatePrintQualityInputSchema.shape,
          required: ['cardId'],
        },
      },
      {
        name: 'list_print_files',
        description: 'List generated print files and sheets',
        inputSchema: {
          type: 'object',
          properties: {
            layout: {
              type: 'string',
              enum: ['a4_9up', 'letter_9up', 'a4_18up'],
              description: 'Filter by print sheet layout',
            },
            format: {
              type: 'string',
              enum: ['pdf', 'png'],
              description: 'Filter by output format',
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of results',
            },
            offset: {
              type: 'number',
              minimum: 0,
              description: 'Number of results to skip',
            },
          },
          required: [],
        },
      },
    ];
  }

  async handleToolCall(toolName: string, args: any): Promise<MCPToolResponse> {
    try {
      switch (toolName) {
        case 'search_cards':
          return await this.searchCards(args);
        case 'download_card_image':
          return await this.downloadCardImage(args);
        case 'get_card_details':
          return await this.getCardDetails(args);
        case 'list_downloaded_cards':
          return await this.listDownloadedCards(args);
        case 'get_random_card':
          return await this.getRandomCard();
        case 'autocomplete_card_name':
          return await this.autocompleteCardName(args);
        case 'get_database_stats':
          return await this.getDatabaseStats();
        case 'download_print_file':
          return await this.downloadPrintFile(args);
        case 'generate_print_sheet':
          return await this.generatePrintSheet(args);
        case 'validate_print_quality':
          return await this.validatePrintQuality(args);
        case 'list_print_files':
          return await this.listPrintFiles(args);
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async searchCards(args: SearchCardsInput): Promise<MCPToolResponse> {
    const input = SearchCardsInputSchema.parse(args);
    
    const searchParams = {
      q: input.query,
      unique: input.unique,
      order: input.order,
      dir: input.dir,
      includeExtras: input.includeExtras,
      page: input.page,
    };

    const result = await this.scryfallClient.searchCards(searchParams);

    return {
      success: true,
      data: {
        total_cards: result.total_cards,
        has_more: result.has_more,
        next_page: result.next_page,
        cards: result.data.map(card => ({
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
        })),
      },
    };
  }

  private async downloadCardImage(args: DownloadCardImageInput): Promise<MCPToolResponse> {
    const input = DownloadCardImageInputSchema.parse(args);
    
    const card = await this.scryfallClient.getCard(input.cardId);
    
    await this.graphService.storeCard(card);
    
    const downloadResult = await this.imageDownloader.downloadCardImage(
      card,
      input.variant,
      input.face,
    );

    await this.graphService.storeImageRecord(downloadResult);

    return {
      success: true,
      data: {
        card_id: downloadResult.cardId,
        card_name: downloadResult.cardName,
        set: downloadResult.set,
        collector_number: downloadResult.collectorNumber,
        variant: downloadResult.variant,
        file_path: downloadResult.filePath,
        file_size: downloadResult.fileSize,
        checksum: downloadResult.checksum,
        width: downloadResult.width,
        height: downloadResult.height,
        dpi: downloadResult.dpi,
        is_print_ready: downloadResult.isPrintReady,
        print_validation: downloadResult.printValidation,
        message: `Downloaded ${downloadResult.variant} image for ${downloadResult.cardName}`,
      },
    };
  }

  private async getCardDetails(args: GetCardDetailsInput): Promise<MCPToolResponse> {
    const input = GetCardDetailsInputSchema.parse(args);
    
    let card;
    const identifier = input.identifier;

    if ('id' in identifier) {
      card = await this.scryfallClient.getCard(identifier.id);
    } else if ('name' in identifier && 'set' in identifier) {
      card = await this.scryfallClient.getCardByName(identifier.name, { 
        exact: true, 
        set: identifier.set, 
      });
    } else if ('collectorNumber' in identifier && 'set' in identifier) {
      card = await this.scryfallClient.getCardBySetAndNumber(
        identifier.set, 
        identifier.collectorNumber,
      );
    } else if ('name' in identifier) {
      card = await this.scryfallClient.getCardByName(identifier.name, { exact: true });
    } else {
      return {
        success: false,
        error: 'Invalid card identifier provided',
      };
    }

    const storedCard = await this.graphService.findCard({ id: card.id });
    
    return {
      success: true,
      data: {
        ...card,
        is_stored_locally: !!storedCard,
        stored_at: storedCard?.createdAt,
      },
    };
  }

  private async listDownloadedCards(args: ListDownloadedCardsInput): Promise<MCPToolResponse> {
    const input = ListDownloadedCardsInputSchema.parse(args);
    
    const cards = await this.graphService.listDownloadedCards({
      set: input.set,
      variant: input.hasVariant,
      limit: input.limit,
      offset: input.offset,
    });

    return {
      success: true,
      data: {
        total_results: cards.length,
        cards: cards.map(card => ({
          id: card.id,
          name: card.name,
          set: card.set,
          set_name: card.setName,
          collector_number: card.collectorNumber,
          released_at: card.releasedAt,
          mana_cost: card.manaCost,
          cmc: card.cmc,
          type_line: card.typeLine,
          oracle_text: card.oracleText,
          power: card.power,
          toughness: card.toughness,
          loyalty: card.loyalty,
          colors: card.colors,
          color_identity: card.colorIdentity,
          rarity: card.rarity,
          artist: card.artist,
          flavor_text: card.flavorText,
          scryfall_uri: card.scryfallUri,
          layout: card.layout,
          created_at: card.createdAt,
          updated_at: card.updatedAt,
          images: card.images.map(img => ({
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
        })),
      },
    };
  }

  private async getRandomCard(): Promise<MCPToolResponse> {
    const card = await this.scryfallClient.getRandom();
    
    return {
      success: true,
      data: {
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
    };
  }

  private async autocompleteCardName(args: { query: string }): Promise<MCPToolResponse> {
    const suggestions = await this.scryfallClient.autocomplete(args.query);
    
    return {
      success: true,
      data: {
        query: args.query,
        suggestions,
      },
    };
  }

  private async getDatabaseStats(): Promise<MCPToolResponse> {
    const stats = await this.graphService.getStats();
    
    return {
      success: true,
      data: stats,
    };
  }

  private async downloadPrintFile(args: DownloadPrintFileInput): Promise<MCPToolResponse> {
    const input = DownloadPrintFileInputSchema.parse(args);
    
    const card = await this.scryfallClient.getCard(input.cardId);
    
    await this.graphService.storeCard(card);
    
    const downloadResult = await this.imageDownloader.downloadPrintReadyImage(
      card,
      input.face,
    );

    await this.graphService.storeImageRecord(downloadResult);

    return {
      success: true,
      data: {
        card_id: downloadResult.cardId,
        card_name: downloadResult.cardName,
        set: downloadResult.set,
        collector_number: downloadResult.collectorNumber,
        variant: downloadResult.variant,
        file_path: downloadResult.filePath,
        file_size: downloadResult.fileSize,
        checksum: downloadResult.checksum,
        width: downloadResult.width,
        height: downloadResult.height,
        dpi: downloadResult.dpi,
        is_print_ready: downloadResult.isPrintReady,
        print_validation: downloadResult.printValidation,
        message: `Downloaded print-ready ${downloadResult.variant} image for ${downloadResult.cardName}`,
      },
    };
  }

  private async generatePrintSheet(args: GeneratePrintSheetInput): Promise<MCPToolResponse> {
    const input = GeneratePrintSheetInputSchema.parse(args);
    
    const cardResults: any[] = [];
    
    for (const cardId of input.cardIds) {
      const card = await this.scryfallClient.getCard(cardId);
      await this.graphService.storeCard(card);
      
      const downloadResult = await this.imageDownloader.downloadPrintReadyImage(card);
      await this.graphService.storeImageRecord(downloadResult);
      
      cardResults.push(downloadResult);
    }

    const layout = this.stringToLayoutEnum(input.layout);
    const printFile = await this.printService.generatePrintSheet(
      cardResults,
      layout,
      {
        includeBleed: input.includeBleed,
        outputFormat: input.outputFormat,
      },
    );

    await this.graphService.storePrintFile(printFile);

    return {
      success: true,
      data: {
        print_file_id: printFile.id,
        layout: printFile.layout,
        format: printFile.format,
        file_path: printFile.filePath,
        file_size: printFile.fileSize,
        page_count: printFile.pageCount,
        card_count: printFile.cardIds.length,
        dimensions: printFile.dimensions,
        created_at: printFile.createdAt,
        checksum: printFile.checksum,
        message: `Generated ${input.layout} print sheet with ${input.cardIds.length} cards`,
      },
    };
  }

  private async validatePrintQuality(args: ValidatePrintQualityInput): Promise<MCPToolResponse> {
    const input = ValidatePrintQualityInputSchema.parse(args);
    
    const card = await this.scryfallClient.getCard(input.cardId);
    
    const downloadResult = await this.imageDownloader.downloadCardImage(
      card,
      input.variant,
    );

    const printValidation = downloadResult.printValidation;
    
    return {
      success: true,
      data: {
        card_id: input.cardId,
        card_name: downloadResult.cardName,
        variant: input.variant,
        width: downloadResult.width,
        height: downloadResult.height,
        dpi: downloadResult.dpi,
        is_print_ready: downloadResult.isPrintReady,
        validation: printValidation,
        recommendations: printValidation?.recommendations || [],
        warnings: printValidation?.warnings || [],
      },
    };
  }

  private async listPrintFiles(args: any): Promise<MCPToolResponse> {
    const printFiles = await this.graphService.findPrintFiles({
      layout: args.layout,
      format: args.format,
      limit: args.limit || 20,
      offset: args.offset || 0,
    });

    return {
      success: true,
      data: {
        total_results: printFiles.length,
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
      },
    };
  }

  private stringToLayoutEnum(layout: string): PrintSheetLayout {
    switch (layout) {
      case 'a4_9up':
        return PrintSheetLayout.A4_9UP;
      case 'letter_9up':
        return PrintSheetLayout.LETTER_9UP;
      case 'a4_18up':
        return PrintSheetLayout.A4_18UP;
      default:
        return PrintSheetLayout.A4_9UP;
    }
  }

}