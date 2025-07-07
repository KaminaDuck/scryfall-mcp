import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import * as imageSize from 'image-size';
import { Card, DownloadProgress, ImageVariant, PrintQuality, PrintValidationResult } from '../types/scryfall.js';
import { DownloadResult } from '../types/mcp.js';
import { config, ensureImageDirectory, getAbsoluteImagePath } from '../config/index.js';

export class ImageDownloader {
  private downloadCache: Map<string, DownloadResult> = new Map();

  async downloadCardImage(
    card: Card,
    variant: ImageVariant = 'large',
    face?: 'front' | 'back',
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<DownloadResult> {
    const cacheKey = `${card.id}-${variant}-${face || 'default'}`;
    
    if (this.downloadCache.has(cacheKey)) {
      const cached = this.downloadCache.get(cacheKey)!;
      const exists = await this.fileExists(cached.filePath);
      if (exists) {
        return cached;
      }
    }

    const imageUrl = this.getImageUrl(card, variant, face);
    if (!imageUrl) {
      throw new Error(`No ${variant} image available for card ${card.name}${face ? ` (${face} face)` : ''}`);
    }

    const fileName = this.generateFileName(card, variant, face);
    const relativePath = path.join(card.set, fileName);
    const absolutePath = getAbsoluteImagePath(relativePath);

    await this.ensureDirectoryExists(path.dirname(absolutePath));

    const existingFile = await this.checkExistingFile(absolutePath);
    if (existingFile) {
      const metadata = await this.extractImageMetadata(absolutePath);
      const result: DownloadResult = {
        cardId: card.id,
        cardName: card.name,
        set: card.set,
        collectorNumber: card.collector_number,
        variant,
        filePath: absolutePath,
        fileSize: existingFile.size,
        checksum: await this.calculateChecksum(absolutePath),
        width: metadata.width,
        height: metadata.height,
        dpi: metadata.dpi,
        isPrintReady: metadata.isPrintReady,
        printValidation: this.validatePrintQuality(metadata),
      };
      this.downloadCache.set(cacheKey, result);
      return result;
    }

    const tempPath = `${absolutePath}.tmp`;
    
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'scryfall-mcp/1.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

      let bytesDownloaded = 0;

      if (response.body) {
        const writeStream = createWriteStream(tempPath);

        response.body.on('data', (chunk: Buffer) => {
          bytesDownloaded += chunk.length;
          if (onProgress) {
            onProgress({
              bytesDownloaded,
              totalBytes,
              percentage: totalBytes ? (bytesDownloaded / totalBytes) * 100 : undefined,
            });
          }
        });

        await pipeline(response.body, writeStream);
      }

      await fs.rename(tempPath, absolutePath);

      const stats = await fs.stat(absolutePath);
      const checksum = await this.calculateChecksum(absolutePath);
      const metadata = await this.extractImageMetadata(absolutePath);

      const result: DownloadResult = {
        cardId: card.id,
        cardName: card.name,
        set: card.set,
        collectorNumber: card.collector_number,
        variant,
        filePath: absolutePath,
        fileSize: stats.size,
        checksum,
        width: metadata.width,
        height: metadata.height,
        dpi: metadata.dpi,
        isPrintReady: metadata.isPrintReady,
        printValidation: this.validatePrintQuality(metadata),
      };

      this.downloadCache.set(cacheKey, result);
      return result;

    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {}
      
      throw error;
    }
  }

  private getImageUrl(card: Card, variant: ImageVariant, face?: 'front' | 'back'): string | undefined {
    // Handle special png_print variant by falling back to png
    const actualVariant = variant === 'png_print' ? 'png' : variant;
    
    if (card.card_faces && face) {
      const faceIndex = face === 'front' ? 0 : 1;
      const cardFace = card.card_faces[faceIndex];
      return cardFace?.image_uris?.[actualVariant as keyof typeof cardFace.image_uris];
    }

    return card.image_uris?.[actualVariant as keyof typeof card.image_uris];
  }

  private generateFileName(card: Card, variant: ImageVariant, face?: 'front' | 'back'): string {
    const safeName = card.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const parts = [
      card.collector_number,
      safeName,
      variant,
    ];

    if (face) {
      parts.push(face);
    }

    const extension = variant === 'png' || variant === 'png_print' ? 'png' : 'jpg';
    return `${parts.join('-')}.${extension}`;
  }

  private async extractImageMetadata(filePath: string): Promise<PrintQuality> {
    try {
      const dimensions = imageSize.imageSize(filePath);
      const width = dimensions.width || 0;
      const height = dimensions.height || 0;
      
      const cardWidthMm = 63;
      const cardHeightMm = 88;
      
      const dpiX = (width / cardWidthMm) * 25.4;
      const dpiY = (height / cardHeightMm) * 25.4;
      const dpi = Math.min(dpiX, dpiY);
      
      const isPrintReady = dpi >= config.print.minDpi;
      const qualityScore = Math.min(100, (dpi / 600) * 100);
      
      return {
        width,
        height,
        dpi,
        isPrintReady,
        qualityScore,
      };
    } catch (error) {
      return {
        width: 0,
        height: 0,
        dpi: 0,
        isPrintReady: false,
        qualityScore: 0,
      };
    }
  }

  private validatePrintQuality(quality: PrintQuality): PrintValidationResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    if (quality.dpi < 300) {
      warnings.push(`Low resolution: ${quality.dpi.toFixed(0)} DPI is below recommended 300 DPI for printing`);
      recommendations.push('Consider using a higher resolution image variant like PNG');
    }
    
    if (quality.dpi < 150) {
      warnings.push('Very low resolution may result in pixelated prints');
      recommendations.push('This image is not suitable for high-quality printing');
    }
    
    if (quality.width < 500 || quality.height < 500) {
      warnings.push('Small image dimensions may not scale well for printing');
    }
    
    const isValid = quality.dpi >= config.print.minDpi && quality.isPrintReady;
    
    return {
      isValid,
      warnings,
      recommendations,
      estimatedDpi: quality.dpi,
    };
  }

  async downloadPrintReadyImage(
    card: Card,
    face?: 'front' | 'back',
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<DownloadResult> {
    const preferredVariants: ImageVariant[] = ['png', 'large', 'normal'];
    
    for (const variant of preferredVariants) {
      try {
        const result = await this.downloadCardImage(card, variant, face, onProgress);
        
        if (config.print.enableValidation && result.printValidation) {
          if (result.printValidation.isValid) {
            return result;
          }
          
          if (variant === preferredVariants[preferredVariants.length - 1]) {
            console.warn(`Print quality warning for ${card.name}:`, result.printValidation.warnings);
          }
        }
        
        return result;
      } catch (error) {
        if (variant === preferredVariants[preferredVariants.length - 1]) {
          throw error;
        }
        continue;
      }
    }
    
    throw new Error(`No suitable image variant found for card ${card.name}`);
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

  private async checkExistingFile(filePath: string): Promise<{ size: number } | null> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile() && stats.size > 0) {
        return { size: stats.size };
      }
    } catch {}
    return null;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async listDownloadedImages(filters?: {
    set?: string;
    variant?: ImageVariant;
  }): Promise<DownloadResult[]> {
    const baseDir = ensureImageDirectory();
    const results: DownloadResult[] = [];

    try {
      const sets = filters?.set ? [filters.set] : await fs.readdir(baseDir).catch(() => []);

      for (const set of sets) {
        const setDir = path.join(baseDir, set);
        
        try {
          const stats = await fs.stat(setDir);
          if (!stats.isDirectory()) continue;

          const files = await fs.readdir(setDir);

          for (const file of files) {
            if (!file.match(/\.(jpg|png)$/i)) continue;

            const filePath = path.join(setDir, file);
            const fileStats = await fs.stat(filePath);

            const parts = path.basename(file, path.extname(file)).split('-');
            if (parts.length < 3) continue;

            const variantPart = parts[parts.length - 1];
            if (!variantPart) continue;
            const variant = variantPart as ImageVariant;
            
            if (filters?.variant && variant !== filters.variant) continue;

            const cardName = parts.slice(1, -1).join('-').replace(/_/g, ' ');
            const collectorNumber = parts[0];
            
            if (cardName && collectorNumber) {
              results.push({
                cardId: '',
                cardName,
                set,
                collectorNumber,
                variant,
                filePath,
                fileSize: fileStats.size,
                checksum: '',
              });
            }
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return results;
  }

  async deleteCardImage(filePath: string): Promise<void> {
    await fs.unlink(filePath);
    
    for (const [key, value] of this.downloadCache.entries()) {
      if (value.filePath === filePath) {
        this.downloadCache.delete(key);
        break;
      }
    }
  }
}