import Database from 'better-sqlite3';
import { CONFIG, ensureDirectoryExists } from '../config.js';
import { DatabaseCard } from '../types.js';
import { join } from 'path';

export class CardDatabase {
  private db: Database.Database;

  constructor(dbPath: string = CONFIG.DATABASE_PATH) {
    // Ensure the directory exists
    ensureDirectoryExists(join(dbPath, '..'));
    
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create the table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloaded_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_name TEXT NOT NULL,
        filename TEXT NOT NULL,
        download_date TEXT NOT NULL,
        card_id TEXT NOT NULL,
        set_code TEXT NOT NULL,
        image_url TEXT NOT NULL
      )
    `);

    // Check if the unique constraint exists and remove it if it does
    const indexInfo = this.db.prepare("PRAGMA index_list(downloaded_cards)").all();
    
    // Check for unique constraint on card_name
    const hasUniqueConstraint = indexInfo.some((idx: any) => 
      idx.unique === 1 && idx.name.includes('card_name')
    );

    if (hasUniqueConstraint) {
      // Recreate table without unique constraint
      this.db.exec(`
        BEGIN TRANSACTION;
        
        CREATE TABLE downloaded_cards_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          card_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          download_date TEXT NOT NULL,
          card_id TEXT NOT NULL,
          set_code TEXT NOT NULL,
          image_url TEXT NOT NULL
        );
        
        INSERT INTO downloaded_cards_new (card_name, filename, download_date, card_id, set_code, image_url)
        SELECT card_name, filename, download_date, card_id, set_code, image_url
        FROM downloaded_cards;
        
        DROP TABLE downloaded_cards;
        ALTER TABLE downloaded_cards_new RENAME TO downloaded_cards;
        
        COMMIT;
      `);
    }

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_card_name ON downloaded_cards(card_name);
      CREATE INDEX IF NOT EXISTS idx_card_id ON downloaded_cards(card_id);
      CREATE INDEX IF NOT EXISTS idx_set_code ON downloaded_cards(set_code);
      CREATE INDEX IF NOT EXISTS idx_download_date ON downloaded_cards(download_date);
    `);
  }

  cardExists(cardName: string, setCode?: string, collectorNumber?: string): boolean {
    let query = 'SELECT COUNT(*) as count FROM downloaded_cards WHERE card_name = ?';
    const params: any[] = [cardName];

    if (setCode) {
      query += ' AND set_code = ?';
      params.push(setCode);
    }

    if (collectorNumber) {
      query += ' AND filename LIKE ?';
      params.push(`%${collectorNumber}%`);
    }

    const result = this.db.prepare(query).get(...params) as { count: number };
    return result.count > 0;
  }

  addCard(card: Omit<DatabaseCard, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO downloaded_cards (card_name, filename, download_date, card_id, set_code, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      card.card_name,
      card.filename,
      card.download_date,
      card.card_id,
      card.set_code,
      card.image_url
    );

    return result.lastInsertRowid as number;
  }

  getCardInfo(cardName: string, setCode?: string): DatabaseCard | null {
    let query = 'SELECT * FROM downloaded_cards WHERE card_name = ?';
    const params: any[] = [cardName];

    if (setCode) {
      query += ' AND set_code = ?';
      params.push(setCode);
    }

    query += ' ORDER BY download_date DESC LIMIT 1';

    const result = this.db.prepare(query).get(...params) as DatabaseCard | undefined;
    return result || null;
  }

  getAllCards(): DatabaseCard[] {
    const result = this.db.prepare('SELECT * FROM downloaded_cards ORDER BY download_date DESC').all() as DatabaseCard[];
    return result;
  }

  getCardsBySet(setCode: string): DatabaseCard[] {
    const result = this.db.prepare('SELECT * FROM downloaded_cards WHERE set_code = ? ORDER BY card_name').all(setCode) as DatabaseCard[];
    return result;
  }

  removeCard(cardName: string, setCode?: string): boolean {
    let query = 'DELETE FROM downloaded_cards WHERE card_name = ?';
    const params: any[] = [cardName];

    if (setCode) {
      query += ' AND set_code = ?';
      params.push(setCode);
    }

    const result = this.db.prepare(query).run(...params);
    return result.changes > 0;
  }

  removeCardById(id: number): boolean {
    const result = this.db.prepare('DELETE FROM downloaded_cards WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getTotalCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM downloaded_cards').get() as { count: number };
    return result.count;
  }

  getRecordsBySet(): Record<string, number> {
    const result = this.db.prepare(`
      SELECT set_code, COUNT(*) as count 
      FROM downloaded_cards 
      GROUP BY set_code 
      ORDER BY count DESC
    `).all() as Array<{ set_code: string; count: number }>;

    const recordsBySet: Record<string, number> = {};
    for (const row of result) {
      recordsBySet[row.set_code] = row.count;
    }
    return recordsBySet;
  }

  getRecentDownloads(limit: number = 10): Array<{ card_name: string; download_date: string; set_code: string }> {
    const result = this.db.prepare(`
      SELECT card_name, download_date, set_code 
      FROM downloaded_cards 
      ORDER BY download_date DESC 
      LIMIT ?
    `).all(limit) as Array<{ card_name: string; download_date: string; set_code: string }>;

    return result;
  }

  searchCards(query: string): DatabaseCard[] {
    const searchQuery = `%${query}%`;
    const result = this.db.prepare(`
      SELECT * FROM downloaded_cards 
      WHERE card_name LIKE ? 
      ORDER BY card_name
    `).all(searchQuery) as DatabaseCard[];

    return result;
  }

  close(): void {
    this.db.close();
  }

  backup(backupPath: string): void {
    this.db.backup(backupPath);
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  // Batch operations
  addCards(cards: Array<Omit<DatabaseCard, 'id'>>): number[] {
    const stmt = this.db.prepare(`
      INSERT INTO downloaded_cards (card_name, filename, download_date, card_id, set_code, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    return this.transaction(() => {
      const results: number[] = [];
      for (const card of cards) {
        const result = stmt.run(
          card.card_name,
          card.filename,
          card.download_date,
          card.card_id,
          card.set_code,
          card.image_url
        );
        results.push(result.lastInsertRowid as number);
      }
      return results;
    });
  }

  // Cleanup methods
  removeOrphanedRecords(existingFiles: string[]): number {
    const fileSet = new Set(existingFiles);
    const allCards = this.getAllCards();
    
    return this.transaction(() => {
      let removedCount = 0;
      for (const card of allCards) {
        if (!fileSet.has(card.filename)) {
          this.removeCardById(card.id);
          removedCount++;
        }
      }
      return removedCount;
    });
  }

  // Statistics
  getStatistics(): {
    totalCards: number;
    uniqueCards: number;
    totalSets: number;
    oldestDownload: string | null;
    newestDownload: string | null;
  } {
    const totalCards = this.getTotalCount();
    
    const uniqueCardsResult = this.db.prepare(`
      SELECT COUNT(DISTINCT card_name) as count FROM downloaded_cards
    `).get() as { count: number };
    
    const totalSetsResult = this.db.prepare(`
      SELECT COUNT(DISTINCT set_code) as count FROM downloaded_cards
    `).get() as { count: number };
    
    const dateRangeResult = this.db.prepare(`
      SELECT MIN(download_date) as oldest, MAX(download_date) as newest FROM downloaded_cards
    `).get() as { oldest: string | null; newest: string | null };

    return {
      totalCards,
      uniqueCards: uniqueCardsResult.count,
      totalSets: totalSetsResult.count,
      oldestDownload: dateRangeResult.oldest,
      newestDownload: dateRangeResult.newest,
    };
  }
}