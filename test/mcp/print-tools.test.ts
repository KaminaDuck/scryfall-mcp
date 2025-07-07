import { MCPTools } from '../../src/mcp/tools.js';
import { ScryfallClient } from '../../src/services/scryfall-client.js';
import { ImageDownloader } from '../../src/services/image-downloader.js';
import { GraphService } from '../../src/services/graph-service.js';
import { PrintService } from '../../src/services/print-service.js';
import { Card } from '../../src/types/scryfall.js';
import { DownloadResult } from '../../src/types/mcp.js';

// Mock dependencies
jest.mock('../../src/services/scryfall-client.js');
jest.mock('../../src/services/image-downloader.js');
jest.mock('../../src/services/graph-service.js');
jest.mock('../../src/services/print-service.js');

const MockScryfallClient = ScryfallClient as jest.MockedClass<typeof ScryfallClient>;
const MockImageDownloader = ImageDownloader as jest.MockedClass<typeof ImageDownloader>;
const MockGraphService = GraphService as jest.MockedClass<typeof GraphService>;
const MockPrintService = PrintService as jest.MockedClass<typeof PrintService>;

describe('MCPTools - Print Tools', () => {
  let mcpTools: MCPTools;
  let mockScryfallClient: jest.Mocked<ScryfallClient>;
  let mockImageDownloader: jest.Mocked<ImageDownloader>;
  let mockGraphService: jest.Mocked<GraphService>;
  let mockPrintService: jest.Mocked<PrintService>;

  const mockCard: Card = {
    object: 'card',
    id: 'test-card-id',
    oracle_id: 'oracle-id',
    name: 'Lightning Bolt',
    lang: 'en',
    released_at: '1993-08-05',
    uri: 'https://api.scryfall.com/cards/test-card-id',
    scryfall_uri: 'https://scryfall.com/card/test',
    layout: 'normal',
    highres_image: true,
    image_status: 'highres_scan',
    cmc: 1,
    type_line: 'Instant',
    color_identity: ['R'],
    keywords: [],
    legalities: {},
    games: ['paper', 'mtgo'],
    reserved: false,
    foil: true,
    nonfoil: true,
    finishes: ['nonfoil', 'foil'],
    oversized: false,
    promo: false,
    reprint: false,
    variation: false,
    set_id: 'set-id',
    set: 'lea',
    set_name: 'Limited Edition Alpha',
    set_type: 'core',
    set_uri: 'https://api.scryfall.com/sets/lea',
    set_search_uri: 'https://api.scryfall.com/cards/search?order=set&q=e%3Alea&unique=prints',
    scryfall_set_uri: 'https://scryfall.com/sets/lea',
    rulings_uri: 'https://api.scryfall.com/cards/test/rulings',
    prints_search_uri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-id&unique=prints',
    collector_number: '1',
    digital: false,
    rarity: 'common',
    card_back_id: 'card-back-id',
    border_color: 'black',
    frame: '1993',
    full_art: false,
    textless: false,
    booster: true,
    story_spotlight: false,
    prices: {},
    related_uris: {},
    image_uris: {
      small: 'https://example.com/small.jpg',
      normal: 'https://example.com/normal.jpg',
      large: 'https://example.com/large.jpg',
      png: 'https://example.com/png.png',
    },
  };

  const mockDownloadResult: DownloadResult = {
    cardId: 'test-card-id',
    cardName: 'Lightning Bolt',
    set: 'lea',
    collectorNumber: '1',
    variant: 'png',
    filePath: '/test/images/lea/1-Lightning_Bolt-png.png',
    fileSize: 1024000,
    checksum: 'abc123',
    width: 745,
    height: 1040,
    dpi: 300,
    isPrintReady: true,
    printValidation: {
      isValid: true,
      warnings: [],
      recommendations: [],
      estimatedDpi: 300,
    },
  };

  beforeEach(() => {
    mockScryfallClient = new MockScryfallClient() as jest.Mocked<ScryfallClient>;
    mockImageDownloader = new MockImageDownloader() as jest.Mocked<ImageDownloader>;
    mockGraphService = new MockGraphService() as jest.Mocked<GraphService>;
    mockPrintService = new MockPrintService() as jest.Mocked<PrintService>;

    mcpTools = new MCPTools(
      mockScryfallClient,
      mockImageDownloader,
      mockGraphService,
      mockPrintService
    );

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('download_print_file tool', () => {
    it('should download print-ready image successfully', async () => {
      mockScryfallClient.getCard.mockResolvedValue(mockCard);
      mockGraphService.storeCard.mockResolvedValue({} as any);
      mockImageDownloader.downloadPrintReadyImage.mockResolvedValue(mockDownloadResult);
      mockGraphService.storeImageRecord.mockResolvedValue({} as any);

      const result = await mcpTools.handleToolCall('download_print_file', {
        cardId: 'test-card-id',
        validateQuality: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        card_id: 'test-card-id',
        card_name: 'Lightning Bolt',
        variant: 'png',
        width: 745,
        height: 1040,
        dpi: 300,
        is_print_ready: true,
      });
      expect(mockImageDownloader.downloadPrintReadyImage).toHaveBeenCalledWith(
        mockCard,
        undefined
      );
    });

    it('should handle download_print_file with face parameter', async () => {
      mockScryfallClient.getCard.mockResolvedValue(mockCard);
      mockGraphService.storeCard.mockResolvedValue({} as any);
      mockImageDownloader.downloadPrintReadyImage.mockResolvedValue(mockDownloadResult);
      mockGraphService.storeImageRecord.mockResolvedValue({} as any);

      await mcpTools.handleToolCall('download_print_file', {
        cardId: 'test-card-id',
        face: 'front',
      });

      expect(mockImageDownloader.downloadPrintReadyImage).toHaveBeenCalledWith(
        mockCard,
        'front'
      );
    });

    it('should handle errors in download_print_file', async () => {
      mockScryfallClient.getCard.mockRejectedValue(new Error('Card not found'));

      const result = await mcpTools.handleToolCall('download_print_file', {
        cardId: 'invalid-card-id',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card not found');
    });
  });

  describe('generate_print_sheet tool', () => {
    const mockPrintFile = {
      id: 'print-123',
      cardIds: ['card-1', 'card-2'],
      layout: 'a4_9up' as const,
      format: 'pdf' as const,
      filePath: '/test/print/sheet.pdf',
      fileSize: 2048000,
      pageCount: 1,
      dimensions: { width: 595, height: 842 },
      createdAt: '2023-01-01T00:00:00.000Z',
      checksum: 'def456',
    };

    it('should generate print sheet successfully', async () => {
      mockScryfallClient.getCard
        .mockResolvedValueOnce(mockCard)
        .mockResolvedValueOnce({ ...mockCard, id: 'card-2', name: 'Black Lotus' });
      mockGraphService.storeCard.mockResolvedValue({} as any);
      mockImageDownloader.downloadPrintReadyImage
        .mockResolvedValueOnce(mockDownloadResult)
        .mockResolvedValueOnce({ ...mockDownloadResult, cardId: 'card-2' });
      mockGraphService.storeImageRecord.mockResolvedValue({} as any);
      mockPrintService.generatePrintSheet.mockResolvedValue(mockPrintFile);
      mockGraphService.storePrintFile.mockResolvedValue(mockPrintFile);

      const result = await mcpTools.handleToolCall('generate_print_sheet', {
        cardIds: ['test-card-id', 'card-2'],
        layout: 'a4_9up',
        includeBleed: true,
        outputFormat: 'pdf',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        print_file_id: 'print-123',
        layout: 'a4_9up',
        format: 'pdf',
        card_count: 2,
        page_count: 1,
      });
      expect(mockPrintService.generatePrintSheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ cardId: 'test-card-id' }),
          expect.objectContaining({ cardId: 'card-2' }),
        ]),
        expect.anything(),
        {
          includeBleed: true,
          outputFormat: 'pdf',
        }
      );
    });

    it('should handle generate_print_sheet with default parameters', async () => {
      mockScryfallClient.getCard.mockResolvedValue(mockCard);
      mockGraphService.storeCard.mockResolvedValue({} as any);
      mockImageDownloader.downloadPrintReadyImage.mockResolvedValue(mockDownloadResult);
      mockGraphService.storeImageRecord.mockResolvedValue({} as any);
      mockPrintService.generatePrintSheet.mockResolvedValue(mockPrintFile);
      mockGraphService.storePrintFile.mockResolvedValue(mockPrintFile);

      await mcpTools.handleToolCall('generate_print_sheet', {
        cardIds: ['test-card-id'],
      });

      expect(mockPrintService.generatePrintSheet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        {
          includeBleed: true,
          outputFormat: 'pdf',
        }
      );
    });

    it('should handle errors in generate_print_sheet', async () => {
      mockScryfallClient.getCard.mockRejectedValue(new Error('Card not found'));

      const result = await mcpTools.handleToolCall('generate_print_sheet', {
        cardIds: ['invalid-card-id'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card not found');
    });
  });

  describe('validate_print_quality tool', () => {
    it('should validate print quality successfully', async () => {
      const lowQualityResult = {
        ...mockDownloadResult,
        dpi: 150,
        isPrintReady: false,
        printValidation: {
          isValid: false,
          warnings: ['Low resolution: 150 DPI is below recommended 300 DPI'],
          recommendations: ['Consider using a higher resolution image variant'],
          estimatedDpi: 150,
        },
      };

      mockScryfallClient.getCard.mockResolvedValue(mockCard);
      mockImageDownloader.downloadCardImage.mockResolvedValue(lowQualityResult);

      const result = await mcpTools.handleToolCall('validate_print_quality', {
        cardId: 'test-card-id',
        variant: 'normal',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        card_id: 'test-card-id',
        card_name: 'Lightning Bolt',
        variant: 'normal',
        dpi: 150,
        is_print_ready: false,
        warnings: ['Low resolution: 150 DPI is below recommended 300 DPI'],
        recommendations: ['Consider using a higher resolution image variant'],
      });
    });

    it('should use default variant when not specified', async () => {
      mockScryfallClient.getCard.mockResolvedValue(mockCard);
      mockImageDownloader.downloadCardImage.mockResolvedValue(mockDownloadResult);

      await mcpTools.handleToolCall('validate_print_quality', {
        cardId: 'test-card-id',
      });

      expect(mockImageDownloader.downloadCardImage).toHaveBeenCalledWith(
        mockCard,
        'png'
      );
    });
  });

  describe('list_print_files tool', () => {
    const mockPrintFiles = [
      {
        id: 'print-1',
        cardIds: ['card-1'],
        layout: 'a4_9up',
        format: 'pdf',
        filePath: '/test/print/sheet1.pdf',
        fileSize: 1024000,
        pageCount: 1,
        dimensions: { width: 595, height: 842 },
        createdAt: '2023-01-01T00:00:00.000Z',
        checksum: 'abc123',
      },
      {
        id: 'print-2',
        cardIds: ['card-2', 'card-3'],
        layout: 'letter_9up',
        format: 'pdf',
        filePath: '/test/print/sheet2.pdf',
        fileSize: 2048000,
        pageCount: 1,
        dimensions: { width: 612, height: 792 },
        createdAt: '2023-01-02T00:00:00.000Z',
        checksum: 'def456',
      },
    ];

    it('should list print files successfully', async () => {
      mockGraphService.findPrintFiles.mockResolvedValue(mockPrintFiles);

      const result = await mcpTools.handleToolCall('list_print_files', {
        layout: 'a4_9up',
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        total_results: 2,
        print_files: expect.arrayContaining([
          expect.objectContaining({
            id: 'print-1',
            layout: 'a4_9up',
            card_count: 1,
          }),
          expect.objectContaining({
            id: 'print-2',
            layout: 'letter_9up',
            card_count: 2,
          }),
        ]),
      });
      expect(mockGraphService.findPrintFiles).toHaveBeenCalledWith({
        layout: 'a4_9up',
        format: undefined,
        limit: 10,
        offset: 0,
      });
    });

    it('should use default parameters when not specified', async () => {
      mockGraphService.findPrintFiles.mockResolvedValue([]);

      await mcpTools.handleToolCall('list_print_files', {});

      expect(mockGraphService.findPrintFiles).toHaveBeenCalledWith({
        layout: undefined,
        format: undefined,
        limit: 20,
        offset: 0,
      });
    });
  });

  describe('tool registration', () => {
    it('should include all print tools in getTools()', () => {
      const tools = mcpTools.getTools();
      const toolNames = tools.map(tool => tool.name);

      expect(toolNames).toContain('download_print_file');
      expect(toolNames).toContain('generate_print_sheet');
      expect(toolNames).toContain('validate_print_quality');
      expect(toolNames).toContain('list_print_files');
    });

    it('should have correct input schemas for print tools', () => {
      const tools = mcpTools.getTools();
      
      const downloadPrintFileTool = tools.find(t => t.name === 'download_print_file');
      expect(downloadPrintFileTool?.inputSchema.required).toContain('cardId');
      
      const generatePrintSheetTool = tools.find(t => t.name === 'generate_print_sheet');
      expect(generatePrintSheetTool?.inputSchema.required).toContain('cardIds');
      
      const validatePrintQualityTool = tools.find(t => t.name === 'validate_print_quality');
      expect(validatePrintQualityTool?.inputSchema.required).toContain('cardId');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete print workflow', async () => {
      // Setup mocks for complete workflow
      mockScryfallClient.getCard.mockResolvedValue(mockCard);
      mockGraphService.storeCard.mockResolvedValue({} as any);
      mockImageDownloader.downloadPrintReadyImage.mockResolvedValue(mockDownloadResult);
      mockGraphService.storeImageRecord.mockResolvedValue({} as any);
      
      const mockPrintFile = {
        id: 'print-workflow',
        cardIds: ['test-card-id'],
        layout: 'a4_9up' as const,
        format: 'pdf' as const,
        filePath: '/test/print/workflow.pdf',
        fileSize: 1024000,
        pageCount: 1,
        dimensions: { width: 595, height: 842 },
        createdAt: '2023-01-01T00:00:00.000Z',
        checksum: 'workflow123',
      };
      
      mockPrintService.generatePrintSheet.mockResolvedValue(mockPrintFile);
      mockGraphService.storePrintFile.mockResolvedValue(mockPrintFile);

      // 1. Download print file
      const downloadResult = await mcpTools.handleToolCall('download_print_file', {
        cardId: 'test-card-id',
      });
      expect(downloadResult.success).toBe(true);

      // 2. Generate print sheet
      const printSheetResult = await mcpTools.handleToolCall('generate_print_sheet', {
        cardIds: ['test-card-id'],
      });
      expect(printSheetResult.success).toBe(true);

      // 3. List print files
      mockGraphService.findPrintFiles.mockResolvedValue([mockPrintFile]);
      const listResult = await mcpTools.handleToolCall('list_print_files', {});
      expect(listResult.success).toBe(true);
      expect(listResult.data.print_files).toHaveLength(1);
    });

    it('should handle mixed quality cards in print sheet', async () => {
      const highQualityCard = { ...mockCard, id: 'high-quality' };
      const lowQualityResult = {
        ...mockDownloadResult,
        cardId: 'low-quality',
        dpi: 150,
        isPrintReady: false,
      };

      mockScryfallClient.getCard
        .mockResolvedValueOnce(highQualityCard)
        .mockResolvedValueOnce({ ...mockCard, id: 'low-quality' });
      mockGraphService.storeCard.mockResolvedValue({} as any);
      mockImageDownloader.downloadPrintReadyImage
        .mockResolvedValueOnce(mockDownloadResult)
        .mockResolvedValueOnce(lowQualityResult);
      mockGraphService.storeImageRecord.mockResolvedValue({} as any);
      
      const mockPrintFile = {
        id: 'mixed-quality',
        cardIds: ['high-quality', 'low-quality'],
        layout: 'a4_9up' as const,
        format: 'pdf' as const,
        filePath: '/test/print/mixed.pdf',
        fileSize: 2048000,
        pageCount: 1,
        dimensions: { width: 595, height: 842 },
        createdAt: '2023-01-01T00:00:00.000Z',
        checksum: 'mixed123',
      };
      
      mockPrintService.generatePrintSheet.mockResolvedValue(mockPrintFile);
      mockGraphService.storePrintFile.mockResolvedValue(mockPrintFile);

      const result = await mcpTools.handleToolCall('generate_print_sheet', {
        cardIds: ['high-quality', 'low-quality'],
      });

      expect(result.success).toBe(true);
      expect(mockImageDownloader.downloadPrintReadyImage).toHaveBeenCalledTimes(2);
    });
  });
});