#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Scryfall MCP Server

This module provides an MCP server for interacting with the Scryfall API,
allowing users to search for cards, download high-resolution card images,
and specify which printing of a card to download.
"""

import logging
import os
import sys
import json
from typing import Dict, List, Optional, Any, Union, Tuple

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server import FastMCP
from mcp.types import Tool, Resource
import httpx
from scryfall_card_download import download_card_images
from scryfall_search import search_cards, group_cards_by_name_and_art

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("scryfall-mcp")

# Create the MCP server
server = FastMCP(name="scryfall-server")

@server.tool()
def mcp_search_cards(query: str) -> Dict[str, Any]:
    """
    Search for Magic: The Gathering cards using the Scryfall API.
    
    Args:
        query: The search query to use (e.g., "lightning bolt", "t:creature c:red")
        
    Returns:
        A dictionary containing the search results grouped by card name
    """
    logger.info(f"[API] Searching for cards with query: {query}")
    
    try:
        # Search for cards
        cards = search_cards(query)
        
        if not cards:
            logger.warning(f"[API] No cards found for query: {query}")
            return {"status": "success", "count": 0, "cards": {}}
        
        # Group cards by name and identify alternate artworks
        card_groups = group_cards_by_name_and_art(cards)
        
        # Create a simplified response structure
        result = {
            "status": "success",
            "count": len(cards),
            "cards": {}
        }
        
        # Process each card group
        for name, variants in card_groups.items():
            result["cards"][name] = []
            
            for card in variants:
                # Extract the essential information for each card variant
                card_info = {
                    "name": card.get("name"),
                    "set": card.get("set"),
                    "set_name": card.get("set_name"),
                    "collector_number": card.get("collector_number"),
                    "rarity": card.get("rarity"),
                    "artist": card.get("artist"),
                    "display_name": card.get("display_name"),
                    "id": card.get("id"),
                    "scryfall_uri": card.get("scryfall_uri"),
                    "image_uris": card.get("image_uris", {})
                }
                
                result["cards"][name].append(card_info)
        
        logger.info(f"[API] Found {len(cards)} cards for query: {query}")
        return result
    
    except Exception as e:
        logger.error(f"[Error] Failed to search cards: {str(e)}")
        return {"status": "error", "message": str(e)}

@server.tool()
def mcp_download_card(card_name: str, set_code: Optional[str] = None, collector_number: Optional[str] = None, force_download: bool = False) -> Dict[str, Any]:
    """
    Download a high-resolution image of a specific Magic: The Gathering card.
    
    Args:
        card_name: The name of the card to download
        set_code: Optional set code to specify a particular printing (e.g., "m10", "znr")
        collector_number: Optional collector number to specify a particular printing
        force_download: Whether to force download even if the card already exists
        
    Returns:
        A dictionary containing information about the downloaded card
    """
    logger.info(f"[API] Downloading card: {card_name} (Set: {set_code}, Number: {collector_number})")
    
    try:
        # Prepare the parameters for download
        set_codes = [set_code] if set_code else None
        collector_numbers = [collector_number] if collector_number else None
        
        # Download the card image
        download_card_images(
            [card_name],
            force_download=force_download,
            set_codes=set_codes,
            collector_numbers=collector_numbers
        )
        
        # Determine the filename based on the parameters
        card_name_for_filename = card_name.replace(" ", "_").replace("//", "_")
        if set_code and collector_number:
            image_filename = f"{card_name_for_filename}_{set_code}_{collector_number}.jpg"
        else:
            image_filename = f"{card_name_for_filename}.jpg"
        
        image_filepath = os.path.join(".local/scryfall_card_images", image_filename)
        
        # Check if the file exists
        if os.path.exists(image_filepath):
            return {
                "status": "success",
                "message": f"Card '{card_name}' downloaded successfully",
                "filepath": image_filepath,
                "card_name": card_name,
                "set_code": set_code,
                "collector_number": collector_number
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to download card '{card_name}'. File not found after download attempt."
            }
    
    except Exception as e:
        logger.error(f"[Error] Failed to download card: {str(e)}")
        return {"status": "error", "message": str(e)}

@server.tool()
def mcp_get_card_artwork(card_id: str) -> Dict[str, Any]:
    """
    Get the artwork for a specific Magic: The Gathering card.
    
    Args:
        card_id: The Scryfall ID of the card
        
    Returns:
        A dictionary containing the artwork URLs for the card
    """
    logger.info(f"[API] Getting artwork for card ID: {card_id}")
    
    try:
        # Fetch the card data from Scryfall
        url = f"https://api.scryfall.com/cards/{card_id}"
        
        with httpx.Client() as client:
            response = client.get(url)
            response.raise_for_status()
            card_data = response.json()
        
        # Extract the image URIs
        image_uris = card_data.get("image_uris", {})
        
        if not image_uris:
            # Handle double-faced cards
            if "card_faces" in card_data and len(card_data["card_faces"]) > 0:
                # Get the front face image
                image_uris = card_data["card_faces"][0].get("image_uris", {})
        
        if not image_uris:
            return {
                "status": "error",
                "message": f"No artwork found for card ID: {card_id}"
            }
        
        # Create a response with the artwork URLs
        return {
            "status": "success",
            "card_name": card_data.get("name"),
            "artist": card_data.get("artist"),
            "set": card_data.get("set"),
            "set_name": card_data.get("set_name"),
            "collector_number": card_data.get("collector_number"),
            "artwork": {
                "small": image_uris.get("small"),
                "normal": image_uris.get("normal"),
                "large": image_uris.get("large"),
                "png": image_uris.get("png"),
                "art_crop": image_uris.get("art_crop"),
                "border_crop": image_uris.get("border_crop")
            }
        }
    
    except Exception as e:
        logger.error(f"[Error] Failed to get card artwork: {str(e)}")
        return {"status": "error", "message": str(e)}

@server.resource(uri="resource://card/{card_id}")
def card_by_id(card_id: str) -> Tuple[str, str]:
    """
    Get detailed information about a specific Magic: The Gathering card.
    
    Args:
        card_id: The Scryfall ID of the card
        
    Returns:
        The card data as JSON
    """
    logger.info(f"[Resource] Getting card data for ID: {card_id}")
    
    try:
        # Fetch the card data from Scryfall
        url = f"https://api.scryfall.com/cards/{card_id}"
        
        with httpx.Client() as client:
            response = client.get(url)
            response.raise_for_status()
            card_data = response.json()
        
        return json.dumps(card_data, indent=2), "application/json"
    
    except Exception as e:
        logger.error(f"[Error] Failed to get card resource: {str(e)}")
        return json.dumps({"status": "error", "message": str(e)}), "application/json"

@server.resource(uri="resource://random_card")
def random_card() -> Tuple[str, str]:
    """
    Get a random Magic: The Gathering card.
    
    Returns:
        Random card data as JSON
    """
    logger.info("[Resource] Getting a random card")
    
    try:
        # Fetch a random card from Scryfall
        url = "https://api.scryfall.com/cards/random"
        
        with httpx.Client() as client:
            response = client.get(url)
            response.raise_for_status()
            card_data = response.json()
        
        return json.dumps(card_data, indent=2), "application/json"
    
    except Exception as e:
        logger.error(f"[Error] Failed to get random card: {str(e)}")
        return json.dumps({"status": "error", "message": str(e)}), "application/json"

if __name__ == "__main__":
    logger.info("[Setup] Starting Scryfall MCP server...")
    server.run()
