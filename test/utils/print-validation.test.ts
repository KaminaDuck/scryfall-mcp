import {
  calculateDPI,
  validatePrintQuality,
  assessPrintSuitability,
  compareImageVariants,
  estimateFileSize,
  formatDimensions,
  formatFileSize,
  generateQualityReport,
  calculateBleedArea,
  mmToPoints,
  pointsToMM,
  getPrintQualityCategory,
  DPI_THRESHOLDS,
  MAGIC_CARD_DIMENSIONS,
} from '../../src/utils/print-validation.js';

describe('Print Validation Utilities', () => {
  describe('calculateDPI', () => {
    it('should calculate DPI correctly for standard card dimensions', () => {
      // 745x1040 pixels for 63x88mm card = ~300 DPI
      const dpi = calculateDPI(745, 1040);
      expect(dpi).toBeCloseTo(300, 0);
    });

    it('should calculate DPI for custom card dimensions', () => {
      const customDimensions = { width: 100, height: 150 };
      const dpi = calculateDPI(1000, 1500, customDimensions);
      expect(dpi).toBeCloseTo(254, 0); // 1000px / 100mm * 25.4mm/inch
    });

    it('should return minimum DPI when aspect ratios differ', () => {
      // Wide image with correct height
      const dpi = calculateDPI(1000, 1040);
      expect(dpi).toBeCloseTo(300, 0); // Limited by height
    });

    it('should handle zero dimensions', () => {
      const dpi = calculateDPI(0, 0);
      expect(dpi).toBe(0);
    });
  });

  describe('validatePrintQuality', () => {
    it('should validate high-quality image', () => {
      const result = validatePrintQuality({ width: 1490, height: 2080 }); // ~600 DPI
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.estimatedDpi).toBeCloseTo(600, 0);
    });

    it('should flag low-quality image', () => {
      const result = validatePrintQuality({ width: 372, height: 520 }); // ~150 DPI
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain(
        expect.stringContaining('Low resolution: 150 DPI is below recommended 300 DPI')
      );
      expect(result.recommendations).toContain(
        expect.stringContaining('Consider using a higher resolution image')
      );
    });

    it('should flag extremely low-quality image', () => {
      const result = validatePrintQuality({ width: 186, height: 260 }); // ~75 DPI
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain(
        expect.stringContaining('Extremely low resolution')
      );
      expect(result.recommendations).toContain(
        expect.stringContaining('not suitable for printing')
      );
    });

    it('should validate with custom minimum DPI', () => {
      const result = validatePrintQuality({ width: 745, height: 1040 }, 400); // 300 DPI vs 400 min
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain(
        expect.stringContaining('Resolution 300 DPI is below target 400 DPI')
      );
    });

    it('should flag small dimensions', () => {
      const result = validatePrintQuality({ width: 300, height: 400 });
      
      expect(result.warnings).toContain(
        expect.stringContaining('Small image dimensions may not scale well')
      );
    });

    it('should flag incorrect aspect ratio', () => {
      const result = validatePrintQuality({ width: 1040, height: 1040 }); // Square
      
      expect(result.warnings).toContain(
        expect.stringContaining('aspect ratio does not match standard Magic card proportions')
      );
    });
  });

  describe('assessPrintSuitability', () => {
    it('should assess high-quality image', () => {
      const quality = assessPrintSuitability({
        width: 1490,
        height: 2080,
        fileSize: 5 * 1024 * 1024, // 5MB
      });
      
      expect(quality.dpi).toBeCloseTo(600, 0);
      expect(quality.isPrintReady).toBe(true);
      expect(quality.qualityScore).toBeGreaterThan(80);
    });

    it('should assess medium-quality image', () => {
      const quality = assessPrintSuitability({
        width: 745,
        height: 1040,
        fileSize: 2 * 1024 * 1024, // 2MB
      });
      
      expect(quality.dpi).toBeCloseTo(300, 0);
      expect(quality.isPrintReady).toBe(true);
      expect(quality.qualityScore).toBeGreaterThan(50);
      expect(quality.qualityScore).toBeLessThan(80);
    });

    it('should assess low-quality image', () => {
      const quality = assessPrintSuitability({
        width: 372,
        height: 520,
        fileSize: 500 * 1024, // 500KB
      });
      
      expect(quality.dpi).toBeCloseTo(150, 0);
      expect(quality.isPrintReady).toBe(false);
      expect(quality.qualityScore).toBeLessThan(50);
    });

    it('should handle missing file size', () => {
      const quality = assessPrintSuitability({
        width: 745,
        height: 1040,
      });
      
      expect(quality.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('compareImageVariants', () => {
    const variants = [
      { variant: 'small', width: 146, height: 204, fileSize: 50000 },
      { variant: 'normal', width: 488, height: 680, fileSize: 200000 },
      { variant: 'large', width: 672, height: 936, fileSize: 400000 },
      { variant: 'png', width: 745, height: 1040, fileSize: 800000 },
    ];

    it('should recommend best variant for printing', () => {
      const result = compareImageVariants(variants);
      
      expect(result.recommended).toBe('png');
      expect(result.rankings).toHaveLength(4);
      expect(result.rankings[0].variant).toBe('png');
      expect(result.rankings[0].suitability).toBe('good');
    });

    it('should rank variants by quality score', () => {
      const result = compareImageVariants(variants);
      
      // Rankings should be in descending order of quality
      for (let i = 0; i < result.rankings.length - 1; i++) {
        expect(result.rankings[i].score).toBeGreaterThanOrEqual(result.rankings[i + 1].score);
      }
    });

    it('should assign correct suitability ratings', () => {
      const result = compareImageVariants(variants);
      
      const pngRanking = result.rankings.find(r => r.variant === 'png');
      const smallRanking = result.rankings.find(r => r.variant === 'small');
      
      expect(pngRanking?.suitability).toBe('good');
      expect(smallRanking?.suitability).toBe('poor');
    });

    it('should handle empty variants array', () => {
      const result = compareImageVariants([]);
      
      expect(result.recommended).toBe('none');
      expect(result.rankings).toHaveLength(0);
    });
  });

  describe('estimateFileSize', () => {
    const dimensions = { width: 745, height: 1040 };

    it('should estimate PNG file size', () => {
      const size = estimateFileSize(dimensions, 'png', 'medium');
      const pixelCount = 745 * 1040;
      const expectedSize = pixelCount * 3.5;
      
      expect(size).toBeCloseTo(expectedSize, -3); // Within 1KB
    });

    it('should estimate JPEG file size', () => {
      const size = estimateFileSize(dimensions, 'jpg', 'high');
      expect(size).toBeLessThan(estimateFileSize(dimensions, 'png', 'high'));
    });

    it('should estimate PDF file size', () => {
      const size = estimateFileSize(dimensions, 'pdf', 'medium');
      expect(size).toBeGreaterThan(0);
    });

    it('should vary by compression level', () => {
      const highCompression = estimateFileSize(dimensions, 'png', 'high');
      const lowCompression = estimateFileSize(dimensions, 'png', 'low');
      
      expect(highCompression).toBeLessThan(lowCompression);
    });
  });

  describe('formatDimensions', () => {
    it('should format dimensions correctly', () => {
      const formatted = formatDimensions(745, 1040);
      expect(formatted).toBe('745 × 1040 pixels');
    });

    it('should handle zero dimensions', () => {
      const formatted = formatDimensions(0, 0);
      expect(formatted).toBe('0 × 0 pixels');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
    });

    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });
  });

  describe('generateQualityReport', () => {
    it('should generate comprehensive report for valid image', () => {
      const validation = {
        isValid: true,
        warnings: [],
        recommendations: [],
        estimatedDpi: 300,
      };
      
      const report = generateQualityReport(validation);
      
      expect(report).toContain('Print Quality Report');
      expect(report).toContain('DPI: 300');
      expect(report).toContain('SUITABLE FOR PRINTING');
    });

    it('should generate report with warnings and recommendations', () => {
      const validation = {
        isValid: false,
        warnings: ['Low resolution'],
        recommendations: ['Use higher quality image'],
        estimatedDpi: 150,
      };
      
      const report = generateQualityReport(validation);
      
      expect(report).toContain('NOT RECOMMENDED FOR PRINTING');
      expect(report).toContain('Warnings:');
      expect(report).toContain('• Low resolution');
      expect(report).toContain('Recommendations:');
      expect(report).toContain('• Use higher quality image');
    });
  });

  describe('calculateBleedArea', () => {
    it('should calculate bleed area with default values', () => {
      const bleedArea = calculateBleedArea();
      
      expect(bleedArea.width).toBe(MAGIC_CARD_DIMENSIONS.width + 6); // 3mm each side
      expect(bleedArea.height).toBe(MAGIC_CARD_DIMENSIONS.height + 6); // 3mm each side
      expect(bleedArea.bleedWidth).toBe(6);
      expect(bleedArea.bleedHeight).toBe(6);
    });

    it('should calculate bleed area with custom dimensions', () => {
      const customDimensions = { width: 100, height: 150 };
      const bleedArea = calculateBleedArea(customDimensions, 5);
      
      expect(bleedArea.width).toBe(110); // 100 + 10 (5mm each side)
      expect(bleedArea.height).toBe(160); // 150 + 10
      expect(bleedArea.bleedWidth).toBe(10);
      expect(bleedArea.bleedHeight).toBe(10);
    });
  });

  describe('mmToPoints and pointsToMM', () => {
    it('should convert millimeters to points', () => {
      const points = mmToPoints(25.4); // 1 inch
      expect(points).toBeCloseTo(72, 1); // 72 points per inch
    });

    it('should convert points to millimeters', () => {
      const mm = pointsToMM(72); // 72 points = 1 inch
      expect(mm).toBeCloseTo(25.4, 1); // 25.4mm per inch
    });

    it('should be inverse operations', () => {
      const original = 50;
      const converted = pointsToMM(mmToPoints(original));
      expect(converted).toBeCloseTo(original, 10);
    });
  });

  describe('getPrintQualityCategory', () => {
    it('should categorize excellent quality', () => {
      const category = getPrintQualityCategory(600);
      
      expect(category.category).toBe('excellent');
      expect(category.description).toContain('Professional quality');
      expect(category.color).toBe('#22c55e');
    });

    it('should categorize good quality', () => {
      const category = getPrintQualityCategory(300);
      
      expect(category.category).toBe('good');
      expect(category.description).toContain('Good quality');
      expect(category.color).toBe('#3b82f6');
    });

    it('should categorize acceptable quality', () => {
      const category = getPrintQualityCategory(200);
      
      expect(category.category).toBe('acceptable');
      expect(category.description).toContain('Acceptable quality');
      expect(category.color).toBe('#f59e0b');
    });

    it('should categorize poor quality', () => {
      const category = getPrintQualityCategory(100);
      
      expect(category.category).toBe('poor');
      expect(category.description).toContain('Poor quality');
      expect(category.color).toBe('#ef4444');
    });
  });

  describe('constants', () => {
    it('should have correct Magic card dimensions', () => {
      expect(MAGIC_CARD_DIMENSIONS.width).toBe(63);
      expect(MAGIC_CARD_DIMENSIONS.height).toBe(88);
      expect(MAGIC_CARD_DIMENSIONS.bleed).toBe(3);
    });

    it('should have appropriate DPI thresholds', () => {
      expect(DPI_THRESHOLDS.minimum).toBe(150);
      expect(DPI_THRESHOLDS.good).toBe(300);
      expect(DPI_THRESHOLDS.excellent).toBe(600);
      expect(DPI_THRESHOLDS.maximum).toBe(1200);
      
      // Thresholds should be in ascending order
      expect(DPI_THRESHOLDS.minimum).toBeLessThan(DPI_THRESHOLDS.good);
      expect(DPI_THRESHOLDS.good).toBeLessThan(DPI_THRESHOLDS.excellent);
      expect(DPI_THRESHOLDS.excellent).toBeLessThan(DPI_THRESHOLDS.maximum);
    });
  });

  describe('edge cases', () => {
    it('should handle extremely large dimensions', () => {
      const dpi = calculateDPI(10000, 14000);
      expect(dpi).toBeGreaterThan(0);
      expect(Number.isFinite(dpi)).toBe(true);
    });

    it('should handle extremely small dimensions', () => {
      const dpi = calculateDPI(1, 1);
      expect(dpi).toBeGreaterThan(0);
      expect(Number.isFinite(dpi)).toBe(true);
    });

    it('should handle invalid input gracefully', () => {
      const quality = assessPrintSuitability({
        width: -1,
        height: -1,
      });
      
      expect(quality.qualityScore).toBe(5); // Default file size score
      expect(quality.isPrintReady).toBe(false);
    });
  });
});