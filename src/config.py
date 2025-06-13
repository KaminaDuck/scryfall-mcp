#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Configuration Module

This module provides centralized configuration for the Scryfall download system,
including directory paths, database settings, and other configurable options.

Key features:
- Centralized directory path management
- Consistent configuration across all modules
- Easy maintenance and modification of paths
"""

import os
from pathlib import Path
from typing import Dict, Any


class ScryfallConfig:
    """
    Centralized configuration for the Scryfall download system.
    
    This class manages all directory paths and configuration settings
    to ensure consistency across the entire application.
    """
    
    def __init__(self, base_dir: str = ".local"):
        """
        Initialize the configuration with the base directory.
        
        Args:
            base_dir: The base directory for all downloads and data storage
        """
        self.base_dir = Path(base_dir)
        
        # Ensure base directory exists
        self.base_dir.mkdir(exist_ok=True)
        
        # Define subdirectories
        self._directories = {
            'cards': self.base_dir / 'cards',
            'art_crops': self.base_dir / 'art_crops', 
            'database': self.base_dir / 'scryfall_db.sqlite',
            'temp': self.base_dir / 'temp',
            'json': self.base_dir / 'json'
        }
        
        # Create all directories
        self._ensure_directories()
    
    def _ensure_directories(self) -> None:
        """Create all necessary directories if they don't exist."""
        for key, path in self._directories.items():
            if key != 'database':  # Skip database file
                path.mkdir(exist_ok=True)
    
    @property
    def cards_dir(self) -> Path:
        """Directory for high-resolution card images."""
        return self._directories['cards']
    
    @property
    def art_crops_dir(self) -> Path:
        """Directory for art crop images."""
        return self._directories['art_crops']
    
    @property
    def database_path(self) -> Path:
        """Path to the SQLite database file."""
        return self._directories['database']
    
    @property
    def temp_dir(self) -> Path:
        """Directory for temporary files."""
        return self._directories['temp']
    
    @property
    def json_dir(self) -> Path:
        """Directory for JSON card data files."""
        return self._directories['json']
    
    def get_card_image_path(self, filename: str) -> Path:
        """
        Get the full path for a card image file.
        
        Args:
            filename: The filename of the card image
            
        Returns:
            Full path to the card image file
        """
        return self.cards_dir / filename
    
    def get_art_crop_path(self, set_name: str, filename: str) -> Path:
        """
        Get the full path for an art crop image file.
        
        Args:
            set_name: The name of the set (used as subdirectory)
            filename: The filename of the art crop image
            
        Returns:
            Full path to the art crop image file
        """
        set_dir = self.art_crops_dir / set_name
        set_dir.mkdir(exist_ok=True)
        return set_dir / filename
    
    def get_json_path(self, set_name: str, filename: str) -> Path:
        """
        Get the full path for a JSON card data file.
        
        Args:
            set_name: The name of the set (used as subdirectory)
            filename: The filename of the JSON file
            
        Returns:
            Full path to the JSON file
        """
        set_dir = self.json_dir / set_name
        set_dir.mkdir(exist_ok=True)
        return set_dir / filename
    
    def migrate_from_old_structure(self) -> Dict[str, Any]:
        """
        Migrate files from the old directory structure to the new one.
        
        Returns:
            Dictionary with migration results
        """
        migration_results = {
            'cards_moved': 0,
            'art_crops_moved': 0,
            'errors': []
        }
        
        # Migrate card images from old location
        old_cards_dir = self.base_dir / 'scryfall_card_images'
        if old_cards_dir.exists():
            try:
                for file_path in old_cards_dir.iterdir():
                    if file_path.is_file():
                        new_path = self.cards_dir / file_path.name
                        file_path.rename(new_path)
                        migration_results['cards_moved'] += 1
                
                # Remove old directory if empty
                if not any(old_cards_dir.iterdir()):
                    old_cards_dir.rmdir()
            except Exception as e:
                migration_results['errors'].append(f"Error migrating cards: {str(e)}")
        
        # Migrate art crops from old location
        old_art_dir = self.base_dir / 'scryfall_images'
        if old_art_dir.exists():
            try:
                for set_dir in old_art_dir.iterdir():
                    if set_dir.is_dir():
                        new_set_dir = self.art_crops_dir / set_dir.name
                        new_set_dir.mkdir(exist_ok=True)
                        
                        for file_path in set_dir.iterdir():
                            if file_path.is_file():
                                new_path = new_set_dir / file_path.name
                                file_path.rename(new_path)
                                migration_results['art_crops_moved'] += 1
                        
                        # Remove old set directory if empty
                        if not any(set_dir.iterdir()):
                            set_dir.rmdir()
                
                # Remove old directory if empty
                if not any(old_art_dir.iterdir()):
                    old_art_dir.rmdir()
            except Exception as e:
                migration_results['errors'].append(f"Error migrating art crops: {str(e)}")
        
        return migration_results
    
    def get_config_dict(self) -> Dict[str, str]:
        """
        Get configuration as a dictionary for serialization.
        
        Returns:
            Dictionary containing all configuration paths
        """
        return {
            'base_dir': str(self.base_dir),
            'cards_dir': str(self.cards_dir),
            'art_crops_dir': str(self.art_crops_dir),
            'database_path': str(self.database_path),
            'temp_dir': str(self.temp_dir),
            'json_dir': str(self.json_dir)
        }


# Global configuration instance
config = ScryfallConfig()
