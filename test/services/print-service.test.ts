import { PrintService, PrintSheetOptions } from '../../src/services/print-service.js';
import { PrintSheetLayout } from '../../src/types/scryfall.js';
import { DownloadResult } from '../../src/types/mcp.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('pdfkit');
jest.mock('../../src/config/index.js', () => ({
  getPrintOutputPath: (relativePath: string) => `/test/print/${relativePath}`,
  ensurePrintDirectory: () => '/test/print',
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('PrintService', () => {
  let printService: PrintService;
  let mockCardResults: DownloadResult[];

  beforeEach(() => {
    printService = new PrintService();
    
    mockCardResults = [
      {
        cardId: 'card-1',
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
      },
      {
        cardId: 'card-2',
        cardName: 'Black Lotus',
        set: 'lea',
        collectorNumber: '2',
        variant: 'png',
        filePath: '/test/images/lea/2-Black_Lotus-png.png',
        fileSize: 1200000,
        checksum: 'def456',
        width: 745,
        height: 1040,
        dpi: 300,
        isPrintReady: true,
      },
    ];

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock file system operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({
      size: 2048000,
      isFile: () => true,
    } as any);
    mockFs.readFile.mockResolvedValue(Buffer.from('mock-pdf-content'));
    mockFs.access.mockResolvedValue(undefined);
  });

  describe('generatePrintSheet', () => {
    it('should generate a PDF print sheet with A4 9-up layout', async () => {
      const options: PrintSheetOptions = {
        includeBleed: true,
        outputFormat: 'pdf',
      };

      const result = await printService.generatePrintSheet(
        mockCardResults,
        PrintSheetLayout.A4_9UP,
        options
      );

      expect(result).toMatchObject({
        layout: 'a4_9up',
        format: 'pdf',
        cardIds: ['card-1', 'card-2'],
        fileSize: 2048000,
        pageCount: 1,
      });
      expect(result.id).toMatch(/^print-[a-f0-9]{12}$/);
      expect(result.filePath).toContain('.pdf');
      expect(result.checksum).toBeTruthy();
      expect(result.createdAt).toBeTruthy();
    });

    it('should generate print sheet with Letter 9-up layout', async () => {
      const options: PrintSheetOptions = {
        includeBleed: false,
        outputFormat: 'pdf',
      };

      const result = await printService.generatePrintSheet(
        mockCardResults,
        PrintSheetLayout.LETTER_9UP,
        options
      );

      expect(result.layout).toBe('letter_9up');
      expect(result.dimensions.width).toBe(612); // Letter width in points
      expect(result.dimensions.height).toBe(792); // Letter height in points
    });

    it('should generate print sheet with A4 18-up layout', async () => {
      const result = await printService.generatePrintSheet(
        mockCardResults,
        PrintSheetLayout.A4_18UP,
        { includeBleed: true, outputFormat: 'pdf' }
      );

      expect(result.layout).toBe('a4_18up');
      expect(result.dimensions.width).toBe(595.28); // A4 width in points
    });

    it('should handle single card print', async () => {
      const result = await printService.generateSingleCardPrint(
        mockCardResults[0],
        { includeBleed: true, outputFormat: 'pdf' }
      );

      expect(result.cardIds).toHaveLength(1);
      expect(result.cardIds[0]).toBe('card-1');
    });

    it('should throw error for PNG format (not implemented)', async () => {
      await expect(
        printService.generatePrintSheet(
          mockCardResults,
          PrintSheetLayout.A4_9UP,
          { includeBleed: true, outputFormat: 'png' }
        )
      ).rejects.toThrow('PNG output format not yet implemented');
    });

    it('should return cached result if file exists', async () => {
      // First call
      const result1 = await printService.generatePrintSheet(
        mockCardResults,
        PrintSheetLayout.A4_9UP,
        { includeBleed: true, outputFormat: 'pdf' }
      );

      // Second call should return cached result
      const result2 = await printService.generatePrintSheet(
        mockCardResults,
        PrintSheetLayout.A4_9UP,
        { includeBleed: true, outputFormat: 'pdf' }
      );

      expect(result1.id).toBe(result2.id);
      expect(result1.filePath).toBe(result2.filePath);
    });
  });

  describe('validatePrintLayout', () => {
    it('should validate A4 9-up layout with 9 cards', () => {
      const isValid = printService.validatePrintLayout(PrintSheetLayout.A4_9UP, 9);
      expect(isValid).toBe(true);
    });

    it('should invalidate A4 9-up layout with 10 cards', () => {
      const isValid = printService.validatePrintLayout(PrintSheetLayout.A4_9UP, 10);
      expect(isValid).toBe(false);
    });

    it('should validate A4 18-up layout with 18 cards', () => {
      const isValid = printService.validatePrintLayout(PrintSheetLayout.A4_18UP, 18);
      expect(isValid).toBe(true);
    });

    it('should validate Letter 9-up layout with 5 cards', () => {
      const isValid = printService.validatePrintLayout(PrintSheetLayout.LETTER_9UP, 5);
      expect(isValid).toBe(true);
    });
  });

  describe('getLayoutDimensions', () => {
    it('should return correct dimensions for A4 9-up layout', () => {
      const layoutDims = (printService as any).getLayoutDimensions(PrintSheetLayout.A4_9UP);
      
      expect(layoutDims.pageWidth).toBe(595.28); // A4 width in points
      expect(layoutDims.pageHeight).toBe(841.89); // A4 height in points
      expect(layoutDims.rows).toBe(3);
      expect(layoutDims.cols).toBe(3);
    });

    it('should return correct dimensions for Letter 9-up layout', () => {
      const layoutDims = (printService as any).getLayoutDimensions(PrintSheetLayout.LETTER_9UP);
      
      expect(layoutDims.pageWidth).toBe(612); // Letter width in points
      expect(layoutDims.pageHeight).toBe(792); // Letter height in points
      expect(layoutDims.rows).toBe(3);
      expect(layoutDims.cols).toBe(3);
    });

    it('should throw error for unsupported layout', () => {
      expect(() => {
        (printService as any).getLayoutDimensions('unsupported_layout');
      }).toThrow('Unsupported layout: unsupported_layout');
    });
  });

  describe('calculateCardPositions', () => {
    it('should calculate 9 positions for 3x3 grid', () => {
      const layoutDims = {
        pageWidth: 595.28,
        pageHeight: 841.89,
        cardWidth: 200,
        cardHeight: 280,
        rows: 3,
        cols: 3,
        marginX: 20,
        marginY: 20,
        spacing: 5,
      };

      const positions = (printService as any).calculateCardPositions(layoutDims);
      
      expect(positions).toHaveLength(9);
      expect(positions[0]).toHaveProperty('x');
      expect(positions[0]).toHaveProperty('y');
      expect(typeof positions[0].x).toBe('number');
      expect(typeof positions[0].y).toBe('number');
    });
  });

  describe('generateFileName', () => {
    it('should generate filename for single card', () => {
      const fileName = (printService as any).generateFileName(
        [mockCardResults[0]],
        PrintSheetLayout.A4_9UP,
        'pdf'
      );
      
      expect(fileName).toBe('lea-1-Lightning_Bolt.pdf');
    });

    it('should generate filename for multiple cards', () => {
      const fileName = (printService as any).generateFileName(
        mockCardResults,
        PrintSheetLayout.A4_9UP,
        'pdf'
      );
      
      expect(fileName).toMatch(/^print-sheet-a4-9up-2cards-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.pdf$/);
    });
  });

  describe('file management', () => {
    it('should delete print file', async () => {
      mockFs.unlink.mockResolvedValue(undefined);
      
      await expect(
        printService.deletePrintFile('/test/print/test-file.pdf')
      ).resolves.not.toThrow();
      
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/print/test-file.pdf');
    });

    it('should handle file deletion errors', async () => {
      mockFs.unlink.mockRejectedValue(new Error('File not found'));
      
      await expect(
        printService.deletePrintFile('/test/print/missing-file.pdf')
      ).rejects.toThrow('File not found');
    });
  });

  describe('memory management', () => {
    it('should handle large print jobs without memory issues', async () => {
      // Create a large array of card results
      const largeCardResults = Array.from({ length: 100 }, (_, i) => ({
        ...mockCardResults[0],
        cardId: `card-${i}`,
        cardName: `Card ${i}`,
        collectorNumber: `${i}`,
      }));

      await expect(
        printService.generatePrintSheet(
          largeCardResults.slice(0, 18), // Max for A4 18-up
          PrintSheetLayout.A4_18UP,
          { includeBleed: true, outputFormat: 'pdf' }
        )
      ).resolves.toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing image files gracefully', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      // Should still generate PDF but log warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await printService.generatePrintSheet(
        mockCardResults,
        PrintSheetLayout.A4_9UP,
        { includeBleed: true, outputFormat: 'pdf' }
      );
      
      expect(result).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle directory creation errors', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      
      await expect(
        printService.generatePrintSheet(
          mockCardResults,
          PrintSheetLayout.A4_9UP,
          { includeBleed: true, outputFormat: 'pdf' }
        )
      ).rejects.toThrow('Permission denied');
    });
  });
});