"""Configuration module for Scryfall MCP server and standalone scripts."""

import os
import tempfile
from pathlib import Path
from typing import Optional


def is_mcp_mode() -> bool:
    """Detect if running in MCP mode."""
    # Check for MCP-specific environment variables or execution context
    return os.environ.get('MCP_SERVER_NAME') is not None or \
           os.environ.get('MCP_ENABLE_FILE_DOWNLOADS') is not None


def get_storage_directory(subdirectory: Optional[str] = None) -> Path:
    """
    Get the appropriate storage directory based on execution mode.
    
    Args:
        subdirectory: Optional subdirectory name within the storage directory
        
    Returns:
        Path object for the storage directory
    """
    # Check for environment variable override
    if 'SCRYFALL_DATA_DIR' in os.environ:
        base_dir = Path(os.environ['SCRYFALL_DATA_DIR'])
    elif is_mcp_mode():
        # In MCP mode, use temp directory or XDG cache
        xdg_cache = os.environ.get('XDG_CACHE_HOME')
        if xdg_cache:
            base_dir = Path(xdg_cache) / 'scryfall_mcp'
        else:
            base_dir = Path(tempfile.gettempdir()) / 'scryfall_downloads'
    else:
        # Standalone mode - use traditional .local directory
        base_dir = Path.home() / '.local'
    
    # Add subdirectory if specified
    if subdirectory:
        storage_dir = base_dir / subdirectory
    else:
        storage_dir = base_dir
    
    # Ensure directory exists
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    return storage_dir


def get_card_images_directory() -> Path:
    """Get the directory for card images."""
    if is_mcp_mode():
        return get_storage_directory('scryfall_card_images')
    else:
        return get_storage_directory('scryfall_card_images')


def get_art_crops_directory() -> Path:
    """Get the directory for art crops."""
    if is_mcp_mode():
        return get_storage_directory('scryfall_images')
    else:
        return get_storage_directory('scryfall_images')


def get_database_path() -> Path:
    """Get the path for the database file."""
    return get_storage_directory() / 'scryfall_database.db'


def ensure_directory_permissions(directory: Path) -> bool:
    """
    Check if we have write permissions to a directory.
    
    Args:
        directory: Path to check
        
    Returns:
        True if we can write to the directory, False otherwise
    """
    try:
        # Try to create a test file
        test_file = directory / '.permission_test'
        test_file.touch()
        test_file.unlink()
        return True
    except (OSError, PermissionError):
        return False


def get_file_path(base_dir: Path, filename: str) -> Path:
    """
    Generate a file path within the base directory.
    
    Args:
        base_dir: Base directory path
        filename: Name of the file
        
    Returns:
        Full path to the file
    """
    return base_dir / filename