import { PrintQuality, PrintValidationResult } from '../types/scryfall.js';

// Standard Magic card dimensions in millimeters
export const MAGIC_CARD_DIMENSIONS = {
  width: 63, // mm
  height: 88, // mm
  bleed: 3, // mm
} as const;

// DPI thresholds for different print quality levels
export const DPI_THRESHOLDS = {
  minimum: 150, // Barely acceptable for casual play
  good: 300, // Recommended minimum for quality printing
  excellent: 600, // Professional quality
  maximum: 1200, // Overkill but future-proof
} as const;

// Points per inch conversion factor
export const POINTS_PER_INCH = 72;

// Millimeters to points conversion factor  
export const MM_TO_POINTS = 2.834645669;

/**
 * Calculate DPI based on image dimensions and card size
 */
export function calculateDPI(
  imageWidth: number, 
  imageHeight: number, 
  cardSizeMM: { width: number; height: number } = MAGIC_CARD_DIMENSIONS,
): number {
  const dpiX = (imageWidth / cardSizeMM.width) * 25.4;
  const dpiY = (imageHeight / cardSizeMM.height) * 25.4;
  
  // Return the minimum DPI to ensure both dimensions meet the threshold
  return Math.min(dpiX, dpiY);
}

/**
 * Validate if image meets print quality requirements
 */
export function validatePrintQuality(
  dimensions: { width: number; height: number },
  minDPI: number = DPI_THRESHOLDS.good,
): PrintValidationResult {
  const dpi = calculateDPI(dimensions.width, dimensions.height);
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // DPI validation
  if (dpi < DPI_THRESHOLDS.minimum) {
    warnings.push(`Extremely low resolution: ${dpi.toFixed(0)} DPI is below minimum ${DPI_THRESHOLDS.minimum} DPI`);
    recommendations.push('This image is not suitable for printing and will appear pixelated');
    recommendations.push('Try downloading a higher resolution variant (PNG or large)');
  } else if (dpi < DPI_THRESHOLDS.good) {
    warnings.push(`Low resolution: ${dpi.toFixed(0)} DPI is below recommended ${DPI_THRESHOLDS.good} DPI`);
    recommendations.push('Consider using a higher resolution image for better print quality');
    recommendations.push('PNG variant typically provides the best quality for printing');
  } else if (dpi < minDPI) {
    warnings.push(`Resolution ${dpi.toFixed(0)} DPI is below target ${minDPI} DPI`);
    recommendations.push('Image meets basic requirements but could be higher quality');
  }
  
  // Dimension validation
  if (dimensions.width < 500 || dimensions.height < 500) {
    warnings.push('Small image dimensions may not scale well for printing');
    recommendations.push('Ensure image is downloaded at full resolution');
  }
  
  // Aspect ratio validation
  const expectedAspectRatio = MAGIC_CARD_DIMENSIONS.width / MAGIC_CARD_DIMENSIONS.height;
  const actualAspectRatio = dimensions.width / dimensions.height;
  const aspectRatioTolerance = 0.05; // 5% tolerance
  
  if (Math.abs(actualAspectRatio - expectedAspectRatio) > aspectRatioTolerance) {
    warnings.push('Image aspect ratio does not match standard Magic card proportions');
    recommendations.push('Image may appear stretched or cropped when printed to card size');
  }
  
  const isValid = dpi >= minDPI && warnings.length === 0;
  
  return {
    isValid,
    warnings,
    recommendations,
    estimatedDpi: dpi,
  };
}

/**
 * Assess overall print suitability of an image
 */
export function assessPrintSuitability(imageData: {
  width: number;
  height: number;
  dpi?: number;
  fileSize?: number;
}): PrintQuality {
  const calculatedDPI = imageData.dpi || calculateDPI(imageData.width, imageData.height);
  const isPrintReady = calculatedDPI >= DPI_THRESHOLDS.good;
  
  // Calculate quality score (0-100)
  let qualityScore = 0;
  
  // DPI contributes 70% of the score
  const dpiScore = Math.min(100, (calculatedDPI / DPI_THRESHOLDS.excellent) * 70);
  qualityScore += dpiScore;
  
  // Dimensions contribute 20% of the score
  const minDimension = Math.min(imageData.width, imageData.height);
  const dimensionScore = Math.min(20, (minDimension / 1000) * 20);
  qualityScore += dimensionScore;
  
  // File size contributes 10% of the score (if available)
  if (imageData.fileSize) {
    const fileSizeMB = imageData.fileSize / (1024 * 1024);
    const fileSizeScore = Math.min(10, (fileSizeMB / 5) * 10); // 5MB = max score
    qualityScore += fileSizeScore;
  } else {
    qualityScore += 5; // Default half points if file size unknown
  }
  
  return {
    width: imageData.width,
    height: imageData.height,
    dpi: calculatedDPI,
    isPrintReady,
    qualityScore: Math.round(qualityScore),
  };
}

/**
 * Compare multiple image variants and recommend the best for printing
 */
export function compareImageVariants(variants: Array<{
  variant: string;
  width: number;
  height: number;
  fileSize?: number;
}>): {
  recommended: string;
  rankings: Array<{
    variant: string;
    score: number;
    dpi: number;
    suitability: 'excellent' | 'good' | 'acceptable' | 'poor';
  }>;
} {
  const rankings = variants.map(variant => {
    const quality = assessPrintSuitability(variant);
    let suitability: 'excellent' | 'good' | 'acceptable' | 'poor';
    
    if (quality.dpi >= DPI_THRESHOLDS.excellent) {
      suitability = 'excellent';
    } else if (quality.dpi >= DPI_THRESHOLDS.good) {
      suitability = 'good';
    } else if (quality.dpi >= DPI_THRESHOLDS.minimum) {
      suitability = 'acceptable';
    } else {
      suitability = 'poor';
    }
    
    return {
      variant: variant.variant,
      score: quality.qualityScore,
      dpi: quality.dpi,
      suitability,
    };
  });
  
  // Sort by score descending
  rankings.sort((a, b) => b.score - a.score);
  
  return {
    recommended: rankings[0]?.variant || 'none',
    rankings,
  };
}

/**
 * Estimate final file size for different output formats
 */
export function estimateFileSize(
  dimensions: { width: number; height: number },
  format: 'pdf' | 'png' | 'jpg',
  compressionLevel: 'low' | 'medium' | 'high' = 'medium',
): number {
  const pixelCount = dimensions.width * dimensions.height;
  
  let bytesPerPixel: number;
  
  switch (format) {
    case 'png':
      // PNG typically 3-4 bytes per pixel depending on compression
      bytesPerPixel = compressionLevel === 'high' ? 2.5 : compressionLevel === 'medium' ? 3.5 : 4.5;
      break;
    case 'jpg':
      // JPEG much more compressed
      bytesPerPixel = compressionLevel === 'high' ? 0.5 : compressionLevel === 'medium' ? 1.0 : 2.0;
      break;
    case 'pdf':
      // PDF with embedded images, slightly larger than source
      bytesPerPixel = 4.0;
      break;
    default:
      bytesPerPixel = 3.0;
  }
  
  return Math.round(pixelCount * bytesPerPixel);
}

/**
 * Format dimensions for human-readable display
 */
export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height} pixels`;
}

/**
 * Format file size for human-readable display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Generate a comprehensive quality report
 */
export function generateQualityReport(validation: PrintValidationResult): string {
  const lines: string[] = [];
  
  lines.push('Print Quality Report');
  lines.push('==================');
  lines.push(`DPI: ${validation.estimatedDpi.toFixed(0)}`);
  lines.push(`Status: ${validation.isValid ? 'SUITABLE FOR PRINTING' : 'NOT RECOMMENDED FOR PRINTING'}`);
  
  if (validation.warnings.length > 0) {
    lines.push('\nWarnings:');
    validation.warnings.forEach(warning => lines.push(`  • ${warning}`));
  }
  
  if (validation.recommendations.length > 0) {
    lines.push('\nRecommendations:');
    validation.recommendations.forEach(rec => lines.push(`  • ${rec}`));
  }
  
  return lines.join('\n');
}

/**
 * Calculate bleed area dimensions for print layouts
 */
export function calculateBleedArea(
  cardDimensions: { width: number; height: number } = MAGIC_CARD_DIMENSIONS,
  bleedMM: number = MAGIC_CARD_DIMENSIONS.bleed,
): { width: number; height: number; bleedWidth: number; bleedHeight: number } {
  const bleedWidth = bleedMM * 2; // bleed on both sides
  const bleedHeight = bleedMM * 2; // bleed on top and bottom
  
  return {
    width: cardDimensions.width + bleedWidth,
    height: cardDimensions.height + bleedHeight,
    bleedWidth,
    bleedHeight,
  };
}

/**
 * Convert millimeters to points for PDF generation
 */
export function mmToPoints(mm: number): number {
  return mm * MM_TO_POINTS;
}

/**
 * Convert points to millimeters
 */
export function pointsToMM(points: number): number {
  return points / MM_TO_POINTS;
}

/**
 * Get print quality category based on DPI
 */
export function getPrintQualityCategory(dpi: number): {
  category: 'poor' | 'acceptable' | 'good' | 'excellent';
  description: string;
  color: string;
} {
  if (dpi >= DPI_THRESHOLDS.excellent) {
    return {
      category: 'excellent',
      description: 'Professional quality - perfect for high-end printing',
      color: '#22c55e', // green
    };
  } else if (dpi >= DPI_THRESHOLDS.good) {
    return {
      category: 'good',
      description: 'Good quality - suitable for most printing needs',
      color: '#3b82f6', // blue
    };
  } else if (dpi >= DPI_THRESHOLDS.minimum) {
    return {
      category: 'acceptable',
      description: 'Acceptable quality - may show some pixelation',
      color: '#f59e0b', // yellow
    };
  } else {
    return {
      category: 'poor',
      description: 'Poor quality - not recommended for printing',
      color: '#ef4444', // red
    };
  }
}