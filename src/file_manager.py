"""File management utilities for the Scryfall MCP server."""

import os
import uuid
import mimetypes
from pathlib import Path
from typing import Optional, Dict, Tuple
from db_manager import CardDatabase


class FileManager:
    """Manages file operations and security for the MCP server."""
    
    def __init__(self, db: Optional[CardDatabase] = None):
        """
        Initialize the file manager.
        
        Args:
            db: Optional CardDatabase instance (will create one if not provided)
        """
        self.db = db
        self._owns_db = db is None
        if self._owns_db:
            self.db = CardDatabase()
    
    def generate_file_id(self) -> str:
        """Generate a unique file ID."""
        return str(uuid.uuid4())
    
    def get_file_path(self, file_id: str) -> Optional[Path]:
        """
        Get the file path for a given file ID.
        
        Args:
            file_id: The unique file ID
            
        Returns:
            Path object if found, None otherwise
        """
        file_path = self.db.get_file_path_by_id(file_id)
        if file_path:
            path = Path(file_path)
            # Security check: ensure the path exists and is a file
            if path.exists() and path.is_file():
                return path
        return None
    
    def get_mime_type(self, file_path: Path) -> str:
        """
        Determine the MIME type of a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            MIME type string
        """
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type:
            return mime_type
        
        # Default MIME types for common extensions
        extension = file_path.suffix.lower()
        mime_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.json': 'application/json',
            '.txt': 'text/plain'
        }
        
        return mime_map.get(extension, 'application/octet-stream')
    
    def read_file_content(self, file_id: str) -> Optional[Tuple[bytes, str]]:
        """
        Read file content by file ID.
        
        Args:
            file_id: The unique file ID
            
        Returns:
            Tuple of (file content, mime type) or None if not found
        """
        file_path = self.get_file_path(file_id)
        if not file_path:
            return None
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            mime_type = self.get_mime_type(file_path)
            return content, mime_type
        except (OSError, IOError):
            return None
    
    def register_file(self, file_path: Path, card_name: str, 
                     card_id: Optional[str] = None,
                     set_code: Optional[str] = None,
                     image_url: Optional[str] = None) -> str:
        """
        Register a file in the database and return its file ID.
        
        Args:
            file_path: Path to the file
            card_name: Name of the card
            card_id: Scryfall card ID (optional)
            set_code: Set code (optional)
            image_url: Image URL (optional)
            
        Returns:
            The generated file ID
        """
        file_id = self.generate_file_id()
        self.db.add_card(
            card_name=card_name,
            filename=str(file_path),
            card_id=card_id,
            set_code=set_code,
            image_url=image_url,
            file_id=file_id
        )
        return file_id
    
    def cleanup_temp_files(self, directory: Path, max_age_hours: int = 24) -> int:
        """
        Clean up old temporary files.
        
        Args:
            directory: Directory to clean
            max_age_hours: Maximum age in hours for files to keep
            
        Returns:
            Number of files deleted
        """
        import time
        
        if not directory.exists():
            return 0
        
        deleted_count = 0
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        for file_path in directory.rglob('*'):
            if file_path.is_file():
                file_age = current_time - file_path.stat().st_mtime
                if file_age > max_age_seconds:
                    try:
                        file_path.unlink()
                        deleted_count += 1
                    except (OSError, PermissionError):
                        pass
        
        return deleted_count
    
    def validate_resource_access(self, resource_type: str, file_id: str) -> bool:
        """
        Validate that a resource access is allowed.
        
        Args:
            resource_type: Type of resource (e.g., 'card', 'art', 'metadata')
            file_id: The file ID to access
            
        Returns:
            True if access is allowed, False otherwise
        """
        # Ensure file_id is a valid UUID format
        try:
            uuid.UUID(file_id)
        except ValueError:
            return False
        
        # Check if the file exists in the database
        return self.get_file_path(file_id) is not None
    
    def get_resource_info(self, file_id: str) -> Optional[Dict[str, str]]:
        """
        Get information about a resource.
        
        Args:
            file_id: The file ID
            
        Returns:
            Dictionary with resource information or None
        """
        card_info = self.db.get_card_by_file_id(file_id)
        if not card_info:
            return None
        
        file_path = Path(card_info['filename'])
        
        return {
            'card_name': card_info['card_name'],
            'filename': file_path.name,
            'mime_type': self.get_mime_type(file_path),
            'download_date': card_info['download_date'],
            'set_code': card_info['set_code'] or '',
            'card_id': card_info['card_id'] or ''
        }
    
    def close(self):
        """Close the database connection if we own it."""
        if self._owns_db and self.db:
            self.db.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()