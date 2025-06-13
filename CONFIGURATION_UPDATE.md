# Scryfall Download Configuration Update

## Overview

The Scryfall download system has been updated to use a centralized configuration system that ensures all downloads are consistently stored in the `.local` directory with a well-organized structure.

## Changes Made

### 1. New Configuration System

Created `src/config.py` with a centralized `ScryfallConfig` class that manages all directory paths and settings:

- **Base Directory**: `.local/`
- **Card Images**: `.local/cards/`
- **Art Crops**: `.local/art_crops/{set_name}/`
- **JSON Data**: `.local/json/{set_name}/`
- **Database**: `.local/scryfall_db.sqlite`
- **Temporary Files**: `.local/temp/`

### 2. Updated Modules

All core modules have been updated to use the centralized configuration:

- `src/db_manager.py` - Uses config for database path
- `src/scryfall_card_download.py` - Uses config for card image directory
- `src/scryfall_art_download.py` - Uses config for art crop and JSON directories
- `src/scryfall_mcp/scryfall_mcp.py` - Uses config for all path references

### 3. New MCP Tool

Added `mcp_migrate_files()` tool to the MCP server that can migrate files from the old directory structure to the new one.

### 4. Migration Completed

Successfully migrated existing files:
- **14 card images** moved from `.local/scryfall_card_images/` to `.local/cards/`
- **2 art crops** moved from `.local/scryfall_images/` to `.local/art_crops/`
- Old directories automatically removed after successful migration

## Directory Structure

```
.local/
├── cards/                    # High-resolution card images
│   ├── Lightning_Bolt.jpg
│   ├── Black_Lotus.jpg
│   └── ...
├── art_crops/               # Art crop images organized by set
│   └── Vintage_Masters/
│       ├── black_lotus.jpg
│       └── ...
├── json/                    # JSON card data organized by set
│   └── {set_name}/
│       └── {card_name}.json
├── temp/                    # Temporary files
├── scryfall_db.sqlite      # Database file
└── ...
```

## Benefits

1. **Centralized Configuration**: All paths are managed in one place
2. **Consistent Structure**: All downloads follow the same organization
3. **Easy Maintenance**: Changes to directory structure only need to be made in one file
4. **Better Organization**: Clear separation between different types of files
5. **Future-Proof**: Easy to add new download types or modify paths

## MCP Server Tools

The MCP server now includes these tools for managing the new structure:

- `mcp_download_card()` - Downloads cards to `.local/cards/`
- `mcp_download_art_crop()` - Downloads art crops to `.local/art_crops/{set}/`
- `mcp_migrate_files()` - Migrates files from old to new structure
- `mcp_database_report()` - Shows configuration and file statistics
- All existing tools continue to work with the new structure

## Configuration Access

The configuration can be accessed programmatically:

```python
from src.config import config

# Get directory paths
cards_dir = config.cards_dir
art_crops_dir = config.art_crops_dir
database_path = config.database_path

# Get specific file paths
card_path = config.get_card_image_path("Lightning_Bolt.jpg")
art_path = config.get_art_crop_path("Vintage_Masters", "black_lotus.jpg")
json_path = config.get_json_path("Vintage_Masters", "black_lotus.json")

# Get all configuration as dictionary
config_dict = config.get_config_dict()
```

## Migration Status

✅ **Migration Complete**: All existing files have been successfully moved to the new structure with no errors.

The system is now fully operational with the new centralized configuration and `.local` directory structure.
