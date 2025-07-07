import os
import sqlite3
import uuid
from pathlib import Path
from typing import List, Optional, Tuple
from config import get_database_path


class CardDatabase:
    """
    Manages a SQLite database for tracking downloaded Scryfall cards.
    """
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the database connection.
        
        Args:
            db_path: Path to the SQLite database file (defaults to config path)
        """
        # Use provided path or get from config
        if db_path is None:
            self.db_path = str(get_database_path())
        else:
            self.db_path = db_path
        
        # Ensure the directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        
        # Initialize the database schema if it doesn't exist
        self._init_db()
    
    def _init_db(self):
        """Create the necessary tables if they don't exist."""
        self.cursor.execute('''
        CREATE TABLE IF NOT EXISTS downloaded_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_name TEXT NOT NULL,
            filename TEXT NOT NULL,
            download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            card_id TEXT,
            set_code TEXT,
            image_url TEXT,
            file_id TEXT UNIQUE,
            UNIQUE(card_name)
        )
        ''')
        
        # Check if we need to migrate the database to support multiple versions
        self.cursor.execute("PRAGMA table_info(downloaded_cards)")
        columns = self.cursor.fetchall()
        has_unique_constraint = False
        
        for col in columns:
            if col[1] == 'card_name' and col[5] == 1:  # Check if card_name has a unique constraint
                has_unique_constraint = True
                break
        
        if has_unique_constraint:
            print("Migrating database to support multiple card versions...")
            # Create a new table without the unique constraint
            self.cursor.execute('''
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
            ''')
            
            # Copy data from old table to new table
            self.cursor.execute('''
            INSERT INTO downloaded_cards_new
            SELECT * FROM downloaded_cards
            ''')
            
            # Drop old table and rename new table
            self.cursor.execute('DROP TABLE downloaded_cards')
            self.cursor.execute('ALTER TABLE downloaded_cards_new RENAME TO downloaded_cards')
            
            print("Database migration completed.")
        
        # Check if file_id column exists, add if not
        self.cursor.execute("PRAGMA table_info(downloaded_cards)")
        columns = [col[1] for col in self.cursor.fetchall()]
        if 'file_id' not in columns:
            print("Adding file_id column to database...")
            self.cursor.execute('ALTER TABLE downloaded_cards ADD COLUMN file_id TEXT UNIQUE')
            
            # Generate file_ids for existing records
            self.cursor.execute('SELECT id FROM downloaded_cards')
            for row in self.cursor.fetchall():
                file_id = str(uuid.uuid4())
                self.cursor.execute(
                    'UPDATE downloaded_cards SET file_id = ? WHERE id = ?',
                    (file_id, row[0])
                )
            print("file_id column added successfully.")
        
        self.conn.commit()
    
    def card_exists(self, card_name: str) -> bool:
        """
        Check if a card has already been downloaded.
        
        Args:
            card_name: The name or version identifier of the card to check
            
        Returns:
            True if the card exists in the database, False otherwise
        """
        self.cursor.execute(
            "SELECT 1 FROM downloaded_cards WHERE card_name = ?",
            (card_name,)
        )
        return self.cursor.fetchone() is not None
    
    def add_card(self, card_name: str, filename: str, card_id: Optional[str] = None, 
                 set_code: Optional[str] = None, image_url: Optional[str] = None, 
                 file_id: Optional[str] = None) -> str:
        """
        Add a card to the database after downloading.
        
        Args:
            card_name: The name of the card
            filename: The filename where the card image is saved
            card_id: The Scryfall ID of the card (optional)
            set_code: The set code of the card (optional)
            image_url: The URL of the downloaded image (optional)
            file_id: The unique file ID (optional, will be generated if not provided)
        
        Returns:
            The file_id of the added card
        """
        if file_id is None:
            file_id = str(uuid.uuid4())
        
        self.cursor.execute('''
        INSERT OR REPLACE INTO downloaded_cards 
        (card_name, filename, card_id, set_code, image_url, file_id, download_date)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (card_name, filename, card_id, set_code, image_url, file_id))
        self.conn.commit()
        
        return file_id
    
    def get_card_info(self, card_name: str) -> Optional[sqlite3.Row]:
        """
        Get information about a downloaded card.
        
        Args:
            card_name: The name of the card to look up
            
        Returns:
            A Row object with card information or None if not found
        """
        self.cursor.execute(
            "SELECT * FROM downloaded_cards WHERE card_name = ?", 
            (card_name,)
        )
        return self.cursor.fetchone()
    
    def get_all_cards(self) -> List[sqlite3.Row]:
        """
        Get a list of all downloaded cards.
        
        Returns:
            A list of Row objects with card information
        """
        self.cursor.execute("SELECT * FROM downloaded_cards ORDER BY download_date DESC")
        return self.cursor.fetchall()
    
    def remove_card(self, card_name: str) -> bool:
        """
        Remove a card from the database.
        
        Args:
            card_name: The name of the card to remove
            
        Returns:
            True if a card was removed, False otherwise
        """
        self.cursor.execute("DELETE FROM downloaded_cards WHERE card_name = ?", (card_name,))
        rows_affected = self.cursor.rowcount
        self.conn.commit()
        return rows_affected > 0
    
    def get_card_by_file_id(self, file_id: str) -> Optional[sqlite3.Row]:
        """
        Get card information by file ID.
        
        Args:
            file_id: The unique file ID
            
        Returns:
            A Row object with card information or None if not found
        """
        self.cursor.execute(
            "SELECT * FROM downloaded_cards WHERE file_id = ?",
            (file_id,)
        )
        return self.cursor.fetchone()
    
    def get_file_path_by_id(self, file_id: str) -> Optional[str]:
        """
        Get the file path for a given file ID.
        
        Args:
            file_id: The unique file ID
            
        Returns:
            The file path or None if not found
        """
        self.cursor.execute(
            "SELECT filename FROM downloaded_cards WHERE file_id = ?",
            (file_id,)
        )
        result = self.cursor.fetchone()
        return result['filename'] if result else None
    
    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
