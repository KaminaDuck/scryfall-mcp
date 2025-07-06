import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, existsSync } from 'fs';
import { CardDatabase } from '../src/lib/database.js';

describe('CardDatabase', () => {
  let testDbPath: string;
  let database: CardDatabase;

  beforeEach(() => {
    // Create a temporary database for each test
    testDbPath = join(tmpdir(), `test-scryfall-${Date.now()}.sqlite`);
    database = new CardDatabase(testDbPath);
  });

  afterEach(() => {
    // Clean up
    database.close();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  test('should initialize database with correct schema', () => {
    expect(database).toBeDefined();
    expect(database.getTotalCount()).toBe(0);
  });

  test('should add and retrieve cards', () => {
    const testCard = {
      card_name: 'Lightning Bolt',
      filename: 'lightning_bolt_lea_001.jpg',
      download_date: new Date().toISOString(),
      card_id: 'test-card-id',
      set_code: 'lea',
      image_url: 'https://example.com/image.jpg'
    };

    const id = database.addCard(testCard);
    expect(id).toBeGreaterThan(0);

    const retrieved = database.getCardInfo('Lightning Bolt');
    expect(retrieved).toBeDefined();
    expect(retrieved?.card_name).toBe('Lightning Bolt');
    expect(retrieved?.set_code).toBe('lea');
  });

  test('should check if card exists', () => {
    const testCard = {
      card_name: 'Lightning Bolt',
      filename: 'lightning_bolt_lea_001.jpg',
      download_date: new Date().toISOString(),
      card_id: 'test-card-id',
      set_code: 'lea',
      image_url: 'https://example.com/image.jpg'
    };

    expect(database.cardExists('Lightning Bolt')).toBe(false);
    
    database.addCard(testCard);
    
    expect(database.cardExists('Lightning Bolt')).toBe(true);
    expect(database.cardExists('Lightning Bolt', 'lea')).toBe(true);
    expect(database.cardExists('Lightning Bolt', 'leb')).toBe(false);
  });

  test('should remove cards', () => {
    const testCard = {
      card_name: 'Lightning Bolt',
      filename: 'lightning_bolt_lea_001.jpg',
      download_date: new Date().toISOString(),
      card_id: 'test-card-id',
      set_code: 'lea',
      image_url: 'https://example.com/image.jpg'
    };

    database.addCard(testCard);
    expect(database.cardExists('Lightning Bolt')).toBe(true);

    const removed = database.removeCard('Lightning Bolt');
    expect(removed).toBe(true);
    expect(database.cardExists('Lightning Bolt')).toBe(false);
  });

  test('should search cards', () => {
    const cards = [
      {
        card_name: 'Lightning Bolt',
        filename: 'lightning_bolt_lea_001.jpg',
        download_date: new Date().toISOString(),
        card_id: 'test-card-id-1',
        set_code: 'lea',
        image_url: 'https://example.com/image1.jpg'
      },
      {
        card_name: 'Lightning Strike',
        filename: 'lightning_strike_m19_001.jpg',
        download_date: new Date().toISOString(),
        card_id: 'test-card-id-2',
        set_code: 'm19',
        image_url: 'https://example.com/image2.jpg'
      },
      {
        card_name: 'Shock',
        filename: 'shock_m19_002.jpg',
        download_date: new Date().toISOString(),
        card_id: 'test-card-id-3',
        set_code: 'm19',
        image_url: 'https://example.com/image3.jpg'
      }
    ];

    for (const card of cards) {
      database.addCard(card);
    }

    const lightningResults = database.searchCards('Lightning');
    expect(lightningResults).toHaveLength(2);
    expect(lightningResults.map(c => c.card_name)).toContain('Lightning Bolt');
    expect(lightningResults.map(c => c.card_name)).toContain('Lightning Strike');

    const shockResults = database.searchCards('Shock');
    expect(shockResults).toHaveLength(1);
    expect(shockResults[0].card_name).toBe('Shock');
  });

  test('should get statistics', () => {
    const cards = [
      {
        card_name: 'Lightning Bolt',
        filename: 'lightning_bolt_lea_001.jpg',
        download_date: '2023-01-01T00:00:00.000Z',
        card_id: 'test-card-id-1',
        set_code: 'lea',
        image_url: 'https://example.com/image1.jpg'
      },
      {
        card_name: 'Lightning Bolt',
        filename: 'lightning_bolt_leb_001.jpg',
        download_date: '2023-01-02T00:00:00.000Z',
        card_id: 'test-card-id-2',
        set_code: 'leb',
        image_url: 'https://example.com/image2.jpg'
      },
      {
        card_name: 'Shock',
        filename: 'shock_m19_002.jpg',
        download_date: '2023-01-03T00:00:00.000Z',
        card_id: 'test-card-id-3',
        set_code: 'm19',
        image_url: 'https://example.com/image3.jpg'
      }
    ];

    for (const card of cards) {
      database.addCard(card);
    }

    const stats = database.getStatistics();
    expect(stats.totalCards).toBe(3);
    expect(stats.uniqueCards).toBe(2);
    expect(stats.totalSets).toBe(3);
    expect(stats.oldestDownload).toBe('2023-01-01T00:00:00.000Z');
    expect(stats.newestDownload).toBe('2023-01-03T00:00:00.000Z');
  });

  test('should get records by set', () => {
    const cards = [
      {
        card_name: 'Lightning Bolt',
        filename: 'lightning_bolt_lea_001.jpg',
        download_date: new Date().toISOString(),
        card_id: 'test-card-id-1',
        set_code: 'lea',
        image_url: 'https://example.com/image1.jpg'
      },
      {
        card_name: 'Lightning Bolt',
        filename: 'lightning_bolt_leb_001.jpg',
        download_date: new Date().toISOString(),
        card_id: 'test-card-id-2',
        set_code: 'leb',
        image_url: 'https://example.com/image2.jpg'
      },
      {
        card_name: 'Shock',
        filename: 'shock_lea_002.jpg',
        download_date: new Date().toISOString(),
        card_id: 'test-card-id-3',
        set_code: 'lea',
        image_url: 'https://example.com/image3.jpg'
      }
    ];

    for (const card of cards) {
      database.addCard(card);
    }

    const recordsBySet = database.getRecordsBySet();
    expect(recordsBySet['lea']).toBe(2);
    expect(recordsBySet['leb']).toBe(1);
  });

  test('should handle transactions', () => {
    const cards = [
      {
        card_name: 'Card 1',
        filename: 'card1.jpg',
        download_date: new Date().toISOString(),
        card_id: 'id1',
        set_code: 'set1',
        image_url: 'url1'
      },
      {
        card_name: 'Card 2',
        filename: 'card2.jpg',
        download_date: new Date().toISOString(),
        card_id: 'id2',
        set_code: 'set1',
        image_url: 'url2'
      }
    ];

    const result = database.transaction(() => {
      const ids = [];
      for (const card of cards) {
        ids.push(database.addCard(card));
      }
      return ids;
    });

    expect(result).toHaveLength(2);
    expect(database.getTotalCount()).toBe(2);
  });

  test('should batch add cards', () => {
    const cards = [
      {
        card_name: 'Card 1',
        filename: 'card1.jpg',
        download_date: new Date().toISOString(),
        card_id: 'id1',
        set_code: 'set1',
        image_url: 'url1'
      },
      {
        card_name: 'Card 2',
        filename: 'card2.jpg',
        download_date: new Date().toISOString(),
        card_id: 'id2',
        set_code: 'set1',
        image_url: 'url2'
      }
    ];

    const ids = database.addCards(cards);
    expect(ids).toHaveLength(2);
    expect(database.getTotalCount()).toBe(2);
  });
});