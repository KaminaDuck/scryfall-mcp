/**
 * Database management for tracking downloaded Scryfall cards.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getDatabasePath } from './config.js';
import { logger } from './logger.js';

export interface CardRecord {
  id: number;
  card_name: string;
  filename: string;
  download_date: string;
  card_id: string | null;
  set_code: string | null;
  image_url: string | null;
  file_id: string;
}

export class CardDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || '';
    this.db = null as any; // Will be initialized in init()
  }

  /**
   * Initialize the database connection and schema.
   */
  async init(dbPath?: string): Promise<void> {
    try {
      // Use provided path or get from config
      if (dbPath) {
        this.dbPath = dbPath;
      } else if (!this.dbPath) {
        this.dbPath = await getDatabasePath();
      }

      // Ensure the directory exists
      await mkdir(dirname(this.dbPath), { recursive: true });

      // Create database connection with better error handling
      try {
        this.db = new Database(this.dbPath);
        logger.info(`Database connection established: ${this.dbPath}`);
      } catch (dbError: any) {
        throw new Error(`Failed to create database connection at ${this.dbPath}: ${dbError.message || dbError}`);
      }
      
      // Initialize the database schema
      await this.initDb();
      
      // Verify database integrity after initialization
      await this.checkDatabaseIntegrity();
      
    } catch (error: any) {
      logger.error(`Database initialization failed: ${error.message}`);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Create the necessary tables if they don't exist.
   */
  private async initDb(): Promise<void> {
    try {
      // Create the main table with proper schema matching Python version
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS downloaded_cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          card_name TEXT NOT NULL,
          filename TEXT NOT NULL,
          download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          card_id TEXT,
          set_code TEXT,
          image_url TEXT,
          file_id TEXT UNIQUE
        )
      `);

      logger.info("Database table created/verified successfully");

      // Check if we need to migrate the database to support multiple versions
      const tableInfo = this.db.prepare("PRAGMA table_info(downloaded_cards)").all() as any[];
      let hasOldUniqueConstraint = false;

      // Check for old schema where card_name had unique constraint
      const indices = this.db.prepare("PRAGMA index_list(downloaded_cards)").all() as any[];
      for (const index of indices) {
        if (index.unique === 1) {
          const indexInfo = this.db.prepare(`PRAGMA index_info(${index.name})`).all() as any[];
          for (const col of indexInfo) {
            if (col.name === 'card_name') {
              hasOldUniqueConstraint = true;
              break;
            }
          }
        }
      }

      if (hasOldUniqueConstraint) {
        logger.info("Migrating database to support multiple card versions...");
        
        try {
          // Create a new table without the card_name unique constraint
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS downloaded_cards_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              card_name TEXT NOT NULL,
              filename TEXT NOT NULL,
              download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              card_id TEXT,
              set_code TEXT,
              image_url TEXT,
              file_id TEXT UNIQUE
            )
          `);

          // Copy data from old table to new table
          this.db.exec(`
            INSERT INTO downloaded_cards_new (id, card_name, filename, download_date, card_id, set_code, image_url, file_id)
            SELECT id, card_name, filename, download_date, card_id, set_code, image_url, file_id FROM downloaded_cards
          `);

          // Drop old table and rename new table
          this.db.exec('DROP TABLE downloaded_cards');
          this.db.exec('ALTER TABLE downloaded_cards_new RENAME TO downloaded_cards');

          logger.info("Database migration completed successfully.");
        } catch (migrationError: any) {
          logger.error(`Database migration failed: ${migrationError.message}`);
          throw new Error(`Database migration failed: ${migrationError.message}`);
        }
      }

      // Check if file_id column exists, add if not
      const columns = tableInfo.map(col => col.name);
      if (!columns.includes('file_id')) {
        logger.info("Adding file_id column to database...");
        
        try {
          this.db.exec('ALTER TABLE downloaded_cards ADD COLUMN file_id TEXT UNIQUE');

          // Generate file_ids for existing records
          const existingCards = this.db.prepare('SELECT id FROM downloaded_cards WHERE file_id IS NULL').all() as { id: number }[];
          const updateStmt = this.db.prepare('UPDATE downloaded_cards SET file_id = ? WHERE id = ?');

          for (const card of existingCards) {
            const fileId = uuidv4();
            updateStmt.run(fileId, card.id);
          }

          logger.info("file_id column added successfully.");
        } catch (columnError: any) {
          logger.error(`Failed to add file_id column: ${columnError.message}`);
          throw new Error(`Failed to add file_id column: ${columnError.message}`);
        }
      }

      // Ensure all existing records have file_ids
      const missingFileIds = this.db.prepare('SELECT id FROM downloaded_cards WHERE file_id IS NULL').all() as { id: number }[];
      if (missingFileIds.length > 0) {
        logger.info(`Generating file_ids for ${missingFileIds.length} existing records...`);
        const updateStmt = this.db.prepare('UPDATE downloaded_cards SET file_id = ? WHERE id = ?');
        
        for (const card of missingFileIds) {
          const fileId = uuidv4();
          updateStmt.run(fileId, card.id);
        }
      }
      
    } catch (error: any) {
      logger.error(`Database schema initialization failed: ${error.message}`);
      throw new Error(`Database schema initialization failed: ${error.message}`);
    }
  }

  /**
   * Check database integrity and repair common issues.
   */
  async checkDatabaseIntegrity(): Promise<void> {
    try {
      // Run SQLite integrity check
      const integrityResult = this.db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
      
      if (integrityResult.integrity_check !== 'ok') {
        logger.error(`Database integrity check failed: ${integrityResult.integrity_check}`);
        throw new Error(`Database integrity check failed: ${integrityResult.integrity_check}`);
      }

      // Check for duplicate file_ids
      const duplicateFileIds = this.db.prepare(`
        SELECT file_id, COUNT(*) as count 
        FROM downloaded_cards 
        WHERE file_id IS NOT NULL 
        GROUP BY file_id 
        HAVING COUNT(*) > 1
      `).all() as { file_id: string; count: number }[];

      if (duplicateFileIds.length > 0) {
        logger.warn(`Found ${duplicateFileIds.length} duplicate file_ids, fixing...`);
        
        for (const duplicate of duplicateFileIds) {
          const records = this.db.prepare('SELECT id FROM downloaded_cards WHERE file_id = ? ORDER BY id').all(duplicate.file_id) as { id: number }[];
          
          // Keep the first record, update others with new file_ids
          for (let i = 1; i < records.length; i++) {
            const record = records[i];
            if (record) {
              const newFileId = uuidv4();
              this.db!.prepare('UPDATE downloaded_cards SET file_id = ? WHERE id = ?').run(newFileId, record.id);
            }
          }
        }
        
        logger.info("Duplicate file_ids resolved.");
      }

      // Check for missing file_ids
      const missingFileIds = this.db.prepare('SELECT COUNT(*) as count FROM downloaded_cards WHERE file_id IS NULL').get() as { count: number };
      
      if (missingFileIds.count > 0) {
        logger.warn(`Found ${missingFileIds.count} records without file_ids, fixing...`);
        
        const records = this.db.prepare('SELECT id FROM downloaded_cards WHERE file_id IS NULL').all() as { id: number }[];
        const updateStmt = this.db.prepare('UPDATE downloaded_cards SET file_id = ? WHERE id = ?');
        
        for (const record of records) {
          const newFileId = uuidv4();
          updateStmt.run(newFileId, record.id);
        }
        
        logger.info("Missing file_ids resolved.");
      }

      logger.info("Database integrity check completed successfully.");
      
    } catch (error: any) {
      logger.error(`Database integrity check failed: ${error.message}`);
      throw new Error(`Database integrity check failed: ${error.message}`);
    }
  }

  /**
   * Repair database by removing orphaned records and fixing common issues.
   */
  async repairDatabase(): Promise<{ recordsRemoved: number; issuesFixed: number }> {
    try {
      let recordsRemoved = 0;
      let issuesFixed = 0;

      // Remove records with empty filenames
      const emptyFilenames = this.db.prepare('DELETE FROM downloaded_cards WHERE filename IS NULL OR filename = ""').run();
      recordsRemoved += emptyFilenames.changes;

      // Remove records with empty card names
      const emptyCardNames = this.db.prepare('DELETE FROM downloaded_cards WHERE card_name IS NULL OR card_name = ""').run();
      recordsRemoved += emptyCardNames.changes;

      // Fix missing download_date
      const missingDates = this.db.prepare('UPDATE downloaded_cards SET download_date = CURRENT_TIMESTAMP WHERE download_date IS NULL').run();
      issuesFixed += missingDates.changes;

      // Vacuum database to reclaim space
      this.db.exec('VACUUM');

      logger.info(`Database repair completed: ${recordsRemoved} records removed, ${issuesFixed} issues fixed`);
      
      return { recordsRemoved, issuesFixed };
      
    } catch (error: any) {
      logger.error(`Database repair failed: ${error.message}`);
      throw new Error(`Database repair failed: ${error.message}`);
    }
  }

  /**
   * Check if a card has already been downloaded.
   */
  cardExists(cardName: string): boolean {
    const stmt = this.db.prepare("SELECT 1 FROM downloaded_cards WHERE card_name = ?");
    const result = stmt.get(cardName);
    return result !== undefined;
  }

  /**
   * Add a card to the database after downloading.
   */
  addCard(
    cardName: string,
    filename: string,
    cardId?: string,
    setCode?: string,
    imageUrl?: string,
    fileId?: string
  ): string {
    const finalFileId = fileId || uuidv4();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO downloaded_cards 
      (card_name, filename, card_id, set_code, image_url, file_id, download_date)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(cardName, filename, cardId || null, setCode || null, imageUrl || null, finalFileId);
    
    return finalFileId;
  }

  /**
   * Get information about a downloaded card.
   */
  getCardInfo(cardName: string): CardRecord | undefined {
    const stmt = this.db.prepare("SELECT * FROM downloaded_cards WHERE card_name = ?");
    return stmt.get(cardName) as CardRecord | undefined;
  }

  /**
   * Get a list of all downloaded cards.
   */
  getAllCards(): CardRecord[] {
    const stmt = this.db.prepare("SELECT * FROM downloaded_cards ORDER BY download_date DESC");
    return stmt.all() as CardRecord[];
  }

  /**
   * Remove a card from the database.
   */
  removeCard(cardName: string): boolean {
    const stmt = this.db.prepare("DELETE FROM downloaded_cards WHERE card_name = ?");
    const result = stmt.run(cardName);
    return result.changes > 0;
  }

  /**
   * Get card information by file ID.
   */
  getCardByFileId(fileId: string): CardRecord | undefined {
    const stmt = this.db.prepare("SELECT * FROM downloaded_cards WHERE file_id = ?");
    return stmt.get(fileId) as CardRecord | undefined;
  }

  /**
   * Get the file path for a given file ID.
   */
  getFilePathById(fileId: string): string | undefined {
    const stmt = this.db.prepare("SELECT filename FROM downloaded_cards WHERE file_id = ?");
    const result = stmt.get(fileId) as { filename: string } | undefined;
    return result?.filename;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  /**
   * Get the underlying database instance for advanced operations.
   */
  getDatabase(): Database.Database {
    return this.db;
  }
}

/**
 * Create a database instance with automatic initialization.
 */
export async function createCardDatabase(dbPath?: string): Promise<CardDatabase> {
  const db = new CardDatabase(dbPath);
  await db.init();
  return db;
}