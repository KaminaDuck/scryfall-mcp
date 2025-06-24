#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Scryfall MCP Server

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
from typing import Optional

def main() -> None:
    """
    Run the Scryfall MCP server.
    
    This function initializes and runs the Scryfall MCP server,
    which provides tools and resources for interacting with the Scryfall API.
    """
    from .server import server
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("scryfall-mcp")
    
    logger.info("[Setup] Starting Scryfall MCP server...")
    server.run()

# Export the main function for the console script entry point
__all__ = ["main"]
