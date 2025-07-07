import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { PrintSheetLayout } from '../types/scryfall.js';
import { DownloadResult } from '../types/mcp.js';
import { PrintFileNode } from '../types/database.js';
import { getPrintOutputPath } from '../config/index.js';

export interface PrintSheetOptions {
  includeBleed: boolean;
  outputFormat: 'pdf' | 'png';
  cardSpacing?: number;
  marginSize?: number;
}

export interface LayoutDimensions {
  pageWidth: number;
  pageHeight: number;
  cardWidth: number;
  cardHeight: number;
  rows: number;
  cols: number;
  marginX: number;
  marginY: number;
  spacing: number;
}

export class PrintService {
  private printCache: Map<string, PrintFileNode> = new Map();

  constructor() {}

  async generatePrintSheet(
    cardResults: DownloadResult[],
    layout: PrintSheetLayout = PrintSheetLayout.A4_9UP,
    options: PrintSheetOptions = { includeBleed: true, outputFormat: 'pdf' },
  ): Promise<PrintFileNode> {
    const cacheKey = this.generateCacheKey(cardResults, layout, options);
    
    if (this.printCache.has(cacheKey)) {
      const cached = this.printCache.get(cacheKey)!;
      const exists = await this.fileExists(cached.filePath);
      if (exists) {
        return cached;
      }
    }

    const layoutDims = this.getLayoutDimensions(layout);
    const fileName = this.generateFileName(cardResults, layout, options.outputFormat);
    const filePath = getPrintOutputPath(fileName);

    await this.ensureDirectoryExists(path.dirname(filePath));

    if (options.outputFormat === 'pdf') {
      return this.generatePDFSheet(cardResults, layoutDims, filePath, options);
    } else {
      throw new Error('PNG output format not yet implemented');
    }
  }

  async generateSingleCardPrint(
    cardResult: DownloadResult,
    options: PrintSheetOptions = { includeBleed: true, outputFormat: 'pdf' },
  ): Promise<PrintFileNode> {
    return this.generatePrintSheet([cardResult], PrintSheetLayout.A4_9UP, options);
  }

  validatePrintLayout(layout: PrintSheetLayout, cardCount: number): boolean {
    const layoutDims = this.getLayoutDimensions(layout);
    const maxCards = layoutDims.rows * layoutDims.cols;
    return cardCount <= maxCards;
  }

  private async generatePDFSheet(
    cardResults: DownloadResult[],
    layoutDims: LayoutDimensions,
    filePath: string,
    options: PrintSheetOptions,
  ): Promise<PrintFileNode> {
    const doc = new PDFDocument({
      size: [layoutDims.pageWidth, layoutDims.pageHeight],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: 'MTG Card Print Sheet',
        Author: 'Scryfall MCP',
        Subject: 'Magic: The Gathering Card Print Sheet',
        Keywords: cardResults.map(r => r.cardName).join(', '),
      },
    });

    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    const positions = this.calculateCardPositions(layoutDims);
    const cardsPerPage = layoutDims.rows * layoutDims.cols;
    let currentPage = 0;
    let pageCount = 1;

    for (let i = 0; i < cardResults.length; i++) {
      const cardResult = cardResults[i];
      if (!cardResult) continue;
      
      const positionIndex = i % cardsPerPage;
      
      if (positionIndex === 0 && i > 0) {
        doc.addPage();
        currentPage++;
        pageCount++;
      }

      const position = positions[positionIndex];
      if (!position) continue;
      
      try {
        const imageExists = await this.fileExists(cardResult.filePath);
        if (!imageExists) {
          console.warn(`Image file not found: ${cardResult.filePath}`);
          continue;
        }

        doc.image(cardResult.filePath, position.x, position.y, {
          width: layoutDims.cardWidth,
          height: layoutDims.cardHeight,
        });

        if (options.includeBleed) {
          this.addCutMarks(doc, position, layoutDims);
        }

      } catch (error) {
        console.error(`Failed to add card image ${cardResult.cardName}:`, error);
      }
    }

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const stats = await fs.stat(filePath);
    const checksum = await this.calculateChecksum(filePath);

    const printFile: PrintFileNode = {
      id: this.generatePrintFileId(cardResults, layoutDims),
      cardIds: cardResults.map(r => r.cardId),
      layout: this.layoutEnumToString(PrintSheetLayout.A4_9UP),
      format: 'pdf',
      filePath,
      fileSize: stats.size,
      pageCount,
      dimensions: {
        width: layoutDims.pageWidth,
        height: layoutDims.pageHeight,
      },
      createdAt: new Date().toISOString(),
      checksum,
    };

    this.printCache.set(this.generateCacheKey(cardResults, PrintSheetLayout.A4_9UP, options), printFile);
    return printFile;
  }

  private getLayoutDimensions(layout: PrintSheetLayout): LayoutDimensions {
    const cardWidthMm = 63;
    const cardHeightMm = 88;
    const bleedMm = 3;
    
    const mmToPoints = 2.834645669;
    
    const cardWidth = (cardWidthMm + bleedMm * 2) * mmToPoints;
    const cardHeight = (cardHeightMm + bleedMm * 2) * mmToPoints;

    switch (layout) {
      case PrintSheetLayout.A4_9UP:
        return {
          pageWidth: 595.28, // A4 width in points
          pageHeight: 841.89, // A4 height in points
          cardWidth,
          cardHeight,
          rows: 3,
          cols: 3,
          marginX: 20,
          marginY: 20,
          spacing: 5,
        };

      case PrintSheetLayout.LETTER_9UP:
        return {
          pageWidth: 612, // Letter width in points
          pageHeight: 792, // Letter height in points
          cardWidth,
          cardHeight,
          rows: 3,
          cols: 3,
          marginX: 20,
          marginY: 20,
          spacing: 5,
        };

      case PrintSheetLayout.A4_18UP:
        return {
          pageWidth: 595.28,
          pageHeight: 841.89,
          cardWidth: cardWidth * 0.7,
          cardHeight: cardHeight * 0.7,
          rows: 6,
          cols: 3,
          marginX: 15,
          marginY: 15,
          spacing: 3,
        };

      default:
        throw new Error(`Unsupported layout: ${layout}`);
    }
  }

  private calculateCardPositions(layoutDims: LayoutDimensions): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    
    const availableWidth = layoutDims.pageWidth - (layoutDims.marginX * 2);
    const availableHeight = layoutDims.pageHeight - (layoutDims.marginY * 2);
    
    const totalSpacingX = layoutDims.spacing * (layoutDims.cols - 1);
    const totalSpacingY = layoutDims.spacing * (layoutDims.rows - 1);
    
    const cardSpaceWidth = (availableWidth - totalSpacingX) / layoutDims.cols;
    const cardSpaceHeight = (availableHeight - totalSpacingY) / layoutDims.rows;

    for (let row = 0; row < layoutDims.rows; row++) {
      for (let col = 0; col < layoutDims.cols; col++) {
        const x = layoutDims.marginX + col * (cardSpaceWidth + layoutDims.spacing);
        const y = layoutDims.marginY + row * (cardSpaceHeight + layoutDims.spacing);
        
        positions.push({
          x: x + (cardSpaceWidth - layoutDims.cardWidth) / 2,
          y: y + (cardSpaceHeight - layoutDims.cardHeight) / 2,
        });
      }
    }

    return positions;
  }

  private addCutMarks(
    doc: typeof PDFDocument,
    position: { x: number; y: number },
    layoutDims: LayoutDimensions,
  ): void {
    const markLength = 10;
    const markOffset = 5;

    doc.strokeColor('#000000').lineWidth(0.5);

    // Top-left corner
    doc.moveTo(position.x - markOffset - markLength, position.y - markOffset)
       .lineTo(position.x - markOffset, position.y - markOffset)
       .stroke();
    doc.moveTo(position.x - markOffset, position.y - markOffset - markLength)
       .lineTo(position.x - markOffset, position.y - markOffset)
       .stroke();

    // Top-right corner
    const rightX = position.x + layoutDims.cardWidth;
    doc.moveTo(rightX + markOffset, position.y - markOffset)
       .lineTo(rightX + markOffset + markLength, position.y - markOffset)
       .stroke();
    doc.moveTo(rightX + markOffset, position.y - markOffset - markLength)
       .lineTo(rightX + markOffset, position.y - markOffset)
       .stroke();

    // Bottom-left corner
    const bottomY = position.y + layoutDims.cardHeight;
    doc.moveTo(position.x - markOffset - markLength, bottomY + markOffset)
       .lineTo(position.x - markOffset, bottomY + markOffset)
       .stroke();
    doc.moveTo(position.x - markOffset, bottomY + markOffset)
       .lineTo(position.x - markOffset, bottomY + markOffset + markLength)
       .stroke();

    // Bottom-right corner
    doc.moveTo(rightX + markOffset, bottomY + markOffset)
       .lineTo(rightX + markOffset + markLength, bottomY + markOffset)
       .stroke();
    doc.moveTo(rightX + markOffset, bottomY + markOffset)
       .lineTo(rightX + markOffset, bottomY + markOffset + markLength)
       .stroke();
  }

  private generateFileName(
    cardResults: DownloadResult[],
    layout: PrintSheetLayout,
    format: 'pdf' | 'png',
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cardCount = cardResults.length;
    const layoutStr = layout.replace('_', '-').toLowerCase();
    
    if (cardResults.length === 1) {
      const card = cardResults[0];
      if (card) {
        const safeName = card.cardName.replace(/[^a-zA-Z0-9-_]/g, '_');
        return `${card.set}-${card.collectorNumber}-${safeName}.${format}`;
      }
    }
    
    return `print-sheet-${layoutStr}-${cardCount}cards-${timestamp}.${format}`;
  }

  private generatePrintFileId(cardResults: DownloadResult[], layoutDims: LayoutDimensions): string {
    const cardIds = cardResults.map(r => r.cardId).sort();
    const layoutKey = `${layoutDims.rows}x${layoutDims.cols}`;
    const hash = crypto.createHash('md5').update(cardIds.join('-') + layoutKey).digest('hex');
    return `print-${hash.substring(0, 12)}`;
  }

  private generateCacheKey(
    cardResults: DownloadResult[],
    layout: PrintSheetLayout,
    options: PrintSheetOptions,
  ): string {
    const cardIds = cardResults.map(r => r.cardId).sort().join('-');
    const optionsKey = `${layout}-${options.outputFormat}-${options.includeBleed}`;
    return `${cardIds}-${optionsKey}`;
  }

  private layoutEnumToString(layout: PrintSheetLayout): 'a4_9up' | 'letter_9up' | 'a4_18up' | 'custom' {
    switch (layout) {
      case PrintSheetLayout.A4_9UP:
        return 'a4_9up';
      case PrintSheetLayout.LETTER_9UP:
        return 'letter_9up';
      case PrintSheetLayout.A4_18UP:
        return 'a4_18up';
      case PrintSheetLayout.CUSTOM:
        return 'custom';
      default:
        return 'a4_9up';
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  async deletePrintFile(filePath: string): Promise<void> {
    await fs.unlink(filePath);
    
    for (const [key, value] of this.printCache.entries()) {
      if (value.filePath === filePath) {
        this.printCache.delete(key);
        break;
      }
    }
  }
}