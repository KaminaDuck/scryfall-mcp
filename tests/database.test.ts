/**
 * Database functionality tests.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { CardDatabase } from '../src/database.js';

describe('CardDatabase', () => {
  let db: CardDatabase;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(tmpdir(), `test-${Date.now()}.db`);
    db = new CardDatabase();
    await db.init(testDbPath);
  });

  afterEach(async () => {
    if (db) {
      db.close();
    }
    try {
      await rm(testDbPath, { force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Database initialization', () => {
    it('should initialize database with proper schema', () => {
      expect(db).toBeDefined();
      expect(db.getDatabase()).toBeDefined();
    });

    it('should create tables on initialization', () => {
      const tables = db.getDatabase()
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      
      expect(tables.some(t => t.name === 'downloaded_cards')).toBe(true);
    });
  });

  describe('Card operations', () => {
    it('should add and retrieve a card', () => {
      const fileId = db.addCard(
        'Lightning Bolt',
        '/test/path/lightning_bolt.jpg',
        'card-123',
        'lea',
        'https://example.com/image.jpg'
      );

      expect(fileId).toBeDefined();
      expect(typeof fileId).toBe('string');

      const cardInfo = db.getCardInfo('Lightning Bolt');
      expect(cardInfo).toBeDefined();
      expect(cardInfo!.card_name).toBe('Lightning Bolt');
      expect(cardInfo!.filename).toBe('/test/path/lightning_bolt.jpg');
      expect(cardInfo!.card_id).toBe('card-123');
      expect(cardInfo!.set_code).toBe('lea');
      expect(cardInfo!.file_id).toBe(fileId);
    });

    it('should check if card exists', () => {
      expect(db.cardExists('Lightning Bolt')).toBe(false);

      db.addCard('Lightning Bolt', '/test/path/lightning_bolt.jpg');

      expect(db.cardExists('Lightning Bolt')).toBe(true);
    });

    it('should remove a card', () => {
      db.addCard('Lightning Bolt', '/test/path/lightning_bolt.jpg');
      expect(db.cardExists('Lightning Bolt')).toBe(true);

      const removed = db.removeCard('Lightning Bolt');
      expect(removed).toBe(true);
      expect(db.cardExists('Lightning Bolt')).toBe(false);
    });

    it('should get card by file ID', () => {
      const fileId = db.addCard('Lightning Bolt', '/test/path/lightning_bolt.jpg');
      
      const cardInfo = db.getCardByFileId(fileId);
      expect(cardInfo).toBeDefined();
      expect(cardInfo!.card_name).toBe('Lightning Bolt');
      expect(cardInfo!.file_id).toBe(fileId);
    });

    it('should get file path by ID', () => {
      const fileId = db.addCard('Lightning Bolt', '/test/path/lightning_bolt.jpg');
      
      const filePath = db.getFilePathById(fileId);
      expect(filePath).toBe('/test/path/lightning_bolt.jpg');
    });

    it('should get all cards', () => {
      db.addCard('Lightning Bolt', '/test/path/lightning_bolt.jpg');
      db.addCard('Counterspell', '/test/path/counterspell.jpg');

      const allCards = db.getAllCards();
      expect(allCards).toHaveLength(2);
      expect(allCards.some(c => c.card_name === 'Lightning Bolt')).toBe(true);
      expect(allCards.some(c => c.card_name === 'Counterspell')).toBe(true);
    });
  });

  describe('File ID handling', () => {
    it('should generate unique file IDs', () => {
      const fileId1 = db.addCard('Card 1', '/test/path/card1.jpg');
      const fileId2 = db.addCard('Card 2', '/test/path/card2.jpg');

      expect(fileId1).not.toBe(fileId2);
      expect(fileId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(fileId2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should accept custom file ID', () => {
      const customFileId = 'custom-file-id-123';
      const returnedFileId = db.addCard(
        'Lightning Bolt',
        '/test/path/lightning_bolt.jpg',
        undefined,
        undefined,
        undefined,
        customFileId
      );

      expect(returnedFileId).toBe(customFileId);

      const cardInfo = db.getCardByFileId(customFileId);
      expect(cardInfo).toBeDefined();
      expect(cardInfo!.file_id).toBe(customFileId);
    });
  });
});