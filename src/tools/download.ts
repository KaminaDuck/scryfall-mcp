import { cardDownloader } from '../lib/card-download.js';
import { artDownloader } from '../lib/art-download.js';
import { formatError } from '../lib/utils.js';
import { ToolResponse } from '../types.js';

export async function mcp_download_card(
  cardName: string,
  setCode?: string,
  collectorNumber?: string,
  force?: boolean
): Promise<ToolResponse> {
  try {
    if (!cardName || cardName.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card name is required'
      };
    }

    const results = await cardDownloader.downloadCardImages([cardName.trim()], {
      setCode,
      collectorNumber,
      force: force || false
    });

    const result = results[0];

    if (result.success) {
      return {
        status: 'success',
        message: result.message,
        filepath: result.filepath,
        data: {
          card_name: result.cardName,
          set_code: result.setCode,
          collector_number: result.collectorNumber,
          skipped: result.skipped || false
        }
      };
    } else {
      return {
        status: 'error',
        message: result.message || 'Download failed'
      };
    }

  } catch (error) {
    return {
      status: 'error',
      message: `Download failed: ${formatError(error)}`
    };
  }
}

export async function mcp_download_art_crop(
  cardName: string,
  setCode?: string,
  collectorNumber?: string,
  force?: boolean
): Promise<ToolResponse> {
  try {
    if (!cardName || cardName.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card name is required'
      };
    }

    const results = await artDownloader.downloadArtCrops([cardName.trim()], {
      setCode,
      collectorNumber,
      force: force || false
    });

    const result = results[0];

    if (result.success) {
      return {
        status: 'success',
        message: result.message,
        filepath: result.filepath,
        data: {
          card_name: result.cardName,
          set_code: result.setCode,
          collector_number: result.collectorNumber,
          skipped: result.skipped || false,
          metadata_path: result.metadataPath
        }
      };
    } else {
      return {
        status: 'error',
        message: result.message || 'Art crop download failed'
      };
    }

  } catch (error) {
    return {
      status: 'error',
      message: `Art crop download failed: ${formatError(error)}`
    };
  }
}

export async function mcp_batch_download(
  cardNames: string[],
  setCode?: string,
  force?: boolean
): Promise<ToolResponse> {
  try {
    if (!cardNames || cardNames.length === 0) {
      return {
        status: 'error',
        message: 'At least one card name is required'
      };
    }

    const cleanCardNames = cardNames.map(name => name.trim()).filter(name => name.length > 0);
    
    if (cleanCardNames.length === 0) {
      return {
        status: 'error',
        message: 'No valid card names provided'
      };
    }

    const results = await cardDownloader.downloadCardImages(cleanCardNames, {
      setCode,
      force: force || false
    });

    const progress = await cardDownloader.getDownloadProgress(results);

    return {
      status: 'success',
      message: `Batch download completed: ${progress.successful} successful, ${progress.failed} failed, ${progress.skipped} skipped`,
      data: {
        total: progress.total,
        successful: progress.successful,
        failed: progress.failed,
        skipped: progress.skipped,
        errors: progress.errors,
        results: results.map(result => ({
          card_name: result.cardName,
          success: result.success,
          message: result.message,
          filepath: result.filepath,
          skipped: result.skipped || false
        }))
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Batch download failed: ${formatError(error)}`
    };
  }
}

export async function mcp_batch_download_art_crops(
  cardNames: string[],
  setCode?: string,
  force?: boolean
): Promise<ToolResponse> {
  try {
    if (!cardNames || cardNames.length === 0) {
      return {
        status: 'error',
        message: 'At least one card name is required'
      };
    }

    const cleanCardNames = cardNames.map(name => name.trim()).filter(name => name.length > 0);
    
    if (cleanCardNames.length === 0) {
      return {
        status: 'error',
        message: 'No valid card names provided'
      };
    }

    const results = await artDownloader.downloadArtCrops(cleanCardNames, {
      setCode,
      force: force || false
    });

    const progress = await artDownloader.getArtDownloadProgress(results);

    return {
      status: 'success',
      message: `Batch art crop download completed: ${progress.successful} successful, ${progress.failed} failed, ${progress.skipped} skipped`,
      data: {
        total: progress.total,
        successful: progress.successful,
        failed: progress.failed,
        skipped: progress.skipped,
        errors: progress.errors,
        set_directories: progress.setDirectories,
        results: results.map(result => ({
          card_name: result.cardName,
          success: result.success,
          message: result.message,
          filepath: result.filepath,
          skipped: result.skipped || false
        }))
      }
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Batch art crop download failed: ${formatError(error)}`
    };
  }
}