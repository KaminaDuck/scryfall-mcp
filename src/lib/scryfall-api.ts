import { CONFIG } from '../config.js';
import { 
  ScryfallCard, 
  ScryfallSearchResponse, 
  ScryfallCardSchema, 
  ScryfallSearchResponseSchema,
  SearchOptions 
} from '../types.js';
import { sleep, retryWithBackoff, formatError } from './utils.js';

export class ScryfallAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ScryfallAPIError';
  }
}

export class ScryfallAPI {
  private baseUrl: string;
  private rateLimit: number;

  constructor(baseUrl: string = CONFIG.SCRYFALL_API_BASE, rateLimit: number = CONFIG.RATE_LIMIT_DELAY) {
    this.baseUrl = baseUrl;
    this.rateLimit = rateLimit;
  }

  private async makeRequest<T>(endpoint: string, schema?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'scryfall-mcp/1.0.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(CONFIG.TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.details) {
            errorMessage = errorData.details;
          }
        } catch {
          // Use the raw error text if JSON parsing fails
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new ScryfallAPIError(errorMessage, response.status);
      }

      const data = await response.json();
      
      // Validate response with schema if provided
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          throw new ScryfallAPIError(`Invalid response format: ${result.error.message}`);
        }
        return result.data;
      }

      return data as T;
    } catch (error) {
      if (error instanceof ScryfallAPIError) {
        throw error;
      }
      throw new ScryfallAPIError(`Request failed: ${formatError(error)}`);
    }
  }

  private async applyRateLimit(): Promise<void> {
    if (this.rateLimit > 0) {
      await sleep(this.rateLimit);
    }
  }

  async searchCards(query: string, options: Partial<SearchOptions> = {}): Promise<ScryfallCard[]> {
    const allCards: ScryfallCard[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        ...Object.fromEntries(
          Object.entries(options).map(([key, value]) => [key, String(value)])
        ),
      });

      const endpoint = `/cards/search?${params.toString()}`;
      
      try {
        const response = await retryWithBackoff(
          () => this.makeRequest<ScryfallSearchResponse>(endpoint, ScryfallSearchResponseSchema),
          CONFIG.MAX_RETRIES
        );

        allCards.push(...response.data);
        hasMore = response.has_more;
        page++;

        // Rate limiting between requests
        if (hasMore) {
          await this.applyRateLimit();
        }
      } catch (error) {
        if (error instanceof ScryfallAPIError && error.status === 404) {
          // No cards found
          break;
        }
        throw error;
      }
    }

    return allCards;
  }

  async getCardById(id: string): Promise<ScryfallCard> {
    const endpoint = `/cards/${id}`;
    
    return await retryWithBackoff(
      () => this.makeRequest<ScryfallCard>(endpoint, ScryfallCardSchema),
      CONFIG.MAX_RETRIES
    );
  }

  async getCardByName(name: string, setCode?: string): Promise<ScryfallCard> {
    const params = new URLSearchParams({ exact: name });
    if (setCode) {
      params.append('set', setCode);
    }

    const endpoint = `/cards/named?${params.toString()}`;
    
    return await retryWithBackoff(
      () => this.makeRequest<ScryfallCard>(endpoint, ScryfallCardSchema),
      CONFIG.MAX_RETRIES
    );
  }

  async getCardBySetAndNumber(setCode: string, collectorNumber: string): Promise<ScryfallCard> {
    const endpoint = `/cards/${setCode}/${collectorNumber}`;
    
    return await retryWithBackoff(
      () => this.makeRequest<ScryfallCard>(endpoint, ScryfallCardSchema),
      CONFIG.MAX_RETRIES
    );
  }

  async getRandomCard(): Promise<ScryfallCard> {
    const endpoint = '/cards/random';
    
    return await retryWithBackoff(
      () => this.makeRequest<ScryfallCard>(endpoint, ScryfallCardSchema),
      CONFIG.MAX_RETRIES
    );
  }

  async autocompleteCardName(query: string): Promise<string[]> {
    const params = new URLSearchParams({ q: query });
    const endpoint = `/cards/autocomplete?${params.toString()}`;
    
    const response = await retryWithBackoff(
      () => this.makeRequest<{ data: string[] }>(endpoint),
      CONFIG.MAX_RETRIES
    );

    return response.data;
  }

  async getCardPrintings(id: string): Promise<ScryfallCard[]> {
    const endpoint = `/cards/${id}/prints`;
    
    const response = await retryWithBackoff(
      () => this.makeRequest<ScryfallSearchResponse>(endpoint, ScryfallSearchResponseSchema),
      CONFIG.MAX_RETRIES
    );

    return response.data;
  }

  async getCardRulings(id: string): Promise<Array<{ source: string; published_at: string; comment: string }>> {
    const endpoint = `/cards/${id}/rulings`;
    
    const response = await retryWithBackoff(
      () => this.makeRequest<{ data: Array<{ source: string; published_at: string; comment: string }> }>(endpoint),
      CONFIG.MAX_RETRIES
    );

    return response.data;
  }

  // Bulk data methods
  async getBulkData(): Promise<Array<{ type: string; download_uri: string; updated_at: string; name: string }>> {
    const endpoint = '/bulk-data';
    
    const response = await retryWithBackoff(
      () => this.makeRequest<{ data: Array<{ type: string; download_uri: string; updated_at: string; name: string }> }>(endpoint),
      CONFIG.MAX_RETRIES
    );

    return response.data;
  }

  // Set information
  async getSets(): Promise<Array<{ code: string; name: string; released_at: string; set_type: string }>> {
    const endpoint = '/sets';
    
    const response = await retryWithBackoff(
      () => this.makeRequest<{ data: Array<{ code: string; name: string; released_at: string; set_type: string }> }>(endpoint),
      CONFIG.MAX_RETRIES
    );

    return response.data;
  }

  async getSet(setCode: string): Promise<{ code: string; name: string; released_at: string; set_type: string; card_count: number }> {
    const endpoint = `/sets/${setCode}`;
    
    return await retryWithBackoff(
      () => this.makeRequest<{ code: string; name: string; released_at: string; set_type: string; card_count: number }>(endpoint),
      CONFIG.MAX_RETRIES
    );
  }

  // Helper methods for working with card images
  getImageUris(card: ScryfallCard): {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  } | null {
    if (card.image_uris) {
      return card.image_uris;
    }
    
    // For double-faced cards, return the front face image URIs
    if (card.card_faces && card.card_faces[0]?.image_uris) {
      return card.card_faces[0].image_uris;
    }
    
    return null;
  }

  getAllImageUris(card: ScryfallCard): Array<{
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  }> {
    const imageUris = [];
    
    if (card.image_uris) {
      imageUris.push(card.image_uris);
    }
    
    if (card.card_faces) {
      for (const face of card.card_faces) {
        if (face.image_uris) {
          imageUris.push(face.image_uris);
        }
      }
    }
    
    return imageUris;
  }

  // Download image helper
  async downloadImage(url: string): Promise<Buffer> {
    await this.applyRateLimit();
    
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'scryfall-mcp/1.0.0',
          },
          signal: AbortSignal.timeout(CONFIG.TIMEOUT),
        });
        
        if (!response.ok) {
          throw new ScryfallAPIError(`Failed to download image: HTTP ${res.status}`);
        }
        
        return res;
      },
      CONFIG.MAX_RETRIES
    );

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }
}

// Export a default instance
export const scryfallAPI = new ScryfallAPI();