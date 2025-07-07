#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
MCP Server for Scryfall

This module provides an MCP server for interacting with the Scryfall API,
allowing users to search for cards, download high-resolution card images,
download art crops, perform database operations, and more.

Key features:
- Search for cards using Scryfall syntax
- Download card data and images
- Download and optimize card artwork
- Perform database operations
- Access detailed card information
"""

import logging
import os
import sys
from typing import Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main() -> None:
    """
    Run the Scryfall MCP server.
    
    This function initializes and runs the Scryfall MCP server,
    which provides tools and resources for interacting with the Scryfall API.
    """
    # Initialize configuration system
    from config import get_storage_directory, ensure_directory_permissions, is_mcp_mode
    
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("scryfall-mcp")
    
    # Check storage directory permissions if in MCP mode
    if is_mcp_mode():
        storage_dir = get_storage_directory()
        logger.info(f"[Setup] Using storage directory: {storage_dir}")
        
        if not ensure_directory_permissions(storage_dir):
            logger.warning(f"[Setup] Warning: Cannot write to storage directory: {storage_dir}")
            logger.warning("[Setup] File downloads may fail. Consider setting SCRYFALL_DATA_DIR to a writable location.")
    
    # Import and run the server
    from .scryfall_mcp import server
    
    logger.info("[Setup] Starting Scryfall MCP server...")
    server.run()
