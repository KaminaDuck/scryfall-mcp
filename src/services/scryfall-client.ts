import fetch, { RequestInit, Response } from 'node-fetch';
import pLimit from 'p-limit';
import { z } from 'zod';
import { 
  Card, 
  CardIdentifier, 
  CardList, 
  CardListSchema, 
  CardSchema, 
  ErrorSchema,
  ScryfallError,
  SearchParams,
} from '../types/scryfall.js';
import { config } from '../config/index.js';

const API_BASE_URL = 'https://api.scryfall.com';
const USER_AGENT = 'scryfall-mcp/1.0.0';

export class ScryfallClient {
  private rateLimiter: ReturnType<typeof pLimit>;
  private lastRequestTime: number = 0;

  constructor() {
    this.rateLimiter = pLimit(config.scryfall.rateLimit);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < config.scryfall.requestDelay) {
      await this.delay(config.scryfall.requestDelay - timeSinceLastRequest);
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    this.lastRequestTime = Date.now();

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      await this.delay(retryAfter * 1000);
      return this.makeRequest(url, options);
    }

    return response;
  }

  private async parseResponse<T>(response: Response, schema: z.ZodSchema<T>): Promise<T> {
    const text = await response.text();
    
    if (!response.ok) {
      let error: ScryfallError;
      try {
        const parsed = JSON.parse(text);
        error = ErrorSchema.parse(parsed);
      } catch {
        error = {
          object: 'error',
          code: 'unknown_error',
          status: response.status,
          details: text || response.statusText,
        };
      }
      throw new Error(`Scryfall API error: ${error.details} (${error.code})`);
    }

    try {
      const data = JSON.parse(text);
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid response format: ${error.message}`);
      }
      throw error;
    }
  }

  async searchCards(params: SearchParams): Promise<CardList> {
    return this.rateLimiter(async () => {
      const url = new URL(`${API_BASE_URL}/cards/search`);
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          const apiKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          url.searchParams.append(apiKey, String(value));
        }
      });

      const response = await this.makeRequest(url.toString());
      return this.parseResponse(response, CardListSchema);
    });
  }

  async getCard(id: string): Promise<Card> {
    return this.rateLimiter(async () => {
      const url = `${API_BASE_URL}/cards/${id}`;
      const response = await this.makeRequest(url);
      return this.parseResponse(response, CardSchema);
    });
  }

  async getCardBySetAndNumber(set: string, collectorNumber: string, lang?: string): Promise<Card> {
    return this.rateLimiter(async () => {
      let url = `${API_BASE_URL}/cards/${set.toLowerCase()}/${collectorNumber}`;
      if (lang) {
        url += `/${lang}`;
      }
      const response = await this.makeRequest(url);
      return this.parseResponse(response, CardSchema);
    });
  }

  async getCardByName(name: string, options?: { exact?: boolean; set?: string }): Promise<Card> {
    return this.rateLimiter(async () => {
      const endpoint = options?.exact ? 'cards/named' : 'cards/named';
      const url = new URL(`${API_BASE_URL}/${endpoint}`);
      
      if (options?.exact) {
        url.searchParams.append('exact', name);
      } else {
        url.searchParams.append('fuzzy', name);
      }
      
      if (options?.set) {
        url.searchParams.append('set', options.set);
      }

      const response = await this.makeRequest(url.toString());
      return this.parseResponse(response, CardSchema);
    });
  }

  async getCollection(identifiers: CardIdentifier[]): Promise<CardList> {
    return this.rateLimiter(async () => {
      const url = `${API_BASE_URL}/cards/collection`;
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifiers }),
      });
      return this.parseResponse(response, CardListSchema);
    });
  }

  async autocomplete(query: string): Promise<string[]> {
    return this.rateLimiter(async () => {
      const url = new URL(`${API_BASE_URL}/cards/autocomplete`);
      url.searchParams.append('q', query);
      
      const response = await this.makeRequest(url.toString());
      const data = await response.json() as { object: string; total_values: number; data: string[] };
      
      if (data.object !== 'catalog' || !Array.isArray(data.data)) {
        throw new Error('Invalid autocomplete response format');
      }
      
      return data.data;
    });
  }

  async getRandom(): Promise<Card> {
    return this.rateLimiter(async () => {
      const url = `${API_BASE_URL}/cards/random`;
      const response = await this.makeRequest(url);
      return this.parseResponse(response, CardSchema);
    });
  }
}