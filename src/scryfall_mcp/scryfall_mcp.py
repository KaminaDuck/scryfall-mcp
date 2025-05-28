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
from scryfall_art_download import download_art_crops
from scryfall_search import search_cards, group_cards_by_name_and_art
from db_manager import CardDatabase
from db_bulk_operations import verify_database_integrity, scan_directory_for_images, clean_database

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
def mcp_download_art_crop(card_name: str, set_code: Optional[str] = None, collector_number: Optional[str] = None, force_download: bool = False) -> Dict[str, Any]:
    """
    Download an art crop image of a specific Magic: The Gathering card.
    
    Args:
        card_name: The name of the card to download
        set_code: Optional set code to specify a particular printing (e.g., "m10", "znr")
        collector_number: Optional collector number to specify a particular printing
        force_download: Whether to force download even if the card already exists
        
    Returns:
        A dictionary containing information about the downloaded art crop
    """
    logger.info(f"[API] Downloading art crop: {card_name} (Set: {set_code}, Number: {collector_number})")
    
    try:
        # Prepare the parameters for download
        set_codes = [set_code] if set_code else None
        collector_numbers = [collector_number] if collector_number else None
        
        # Download the art crop
        download_art_crops(
            [card_name],
            force_download=force_download,
            set_codes=set_codes,
            collector_numbers=collector_numbers
        )
        
        # Create a unique identifier for the card version
        card_version_id = f"{card_name}_art_crop"
        if set_code and collector_number:
            card_version_id = f"{card_name}_{set_code}_{collector_number}_art_crop"
        
        # Check if the card exists in the database
        with CardDatabase() as db:
            card_info = db.get_card_info(card_version_id)
            
            if card_info:
                return {
                    "status": "success",
                    "message": f"Art crop for '{card_name}' downloaded successfully",
                    "filepath": card_info['filename'],
                    "card_name": card_name,
                    "set_code": set_code,
                    "collector_number": collector_number
                }
            else:
                return {
                    "status": "error",
                    "message": f"Failed to download art crop for '{card_name}'. Not found in database after download attempt."
                }
    
    except Exception as e:
        logger.error(f"[Error] Failed to download art crop: {str(e)}")
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

@server.tool()
def mcp_verify_database() -> Dict[str, Any]:
    """
    Verify database integrity by checking if all referenced files exist.
    
    Returns:
        A dictionary containing the verification results
    """
    logger.info("[API] Verifying database integrity")
    
    try:
        total_records, missing_files = verify_database_integrity(verbose=False)
        
        return {
            "status": "success",
            "total_records": total_records,
            "missing_files": missing_files,
            "integrity": missing_files == 0
        }
    
    except Exception as e:
        logger.error(f"[Error] Failed to verify database: {str(e)}")
        return {"status": "error", "message": str(e)}

@server.tool()
def mcp_scan_directory(directory: str, update_db: bool = False) -> Dict[str, Any]:
    """
    Scan a directory for image files and optionally add them to the database.
    
    Args:
        directory: Directory to scan
        update_db: Whether to update the database with found files
        
    Returns:
        A dictionary containing the scan results
    """
    logger.info(f"[API] Scanning directory: {directory} (update_db: {update_db})")
    
    try:
        total_files, added_to_db = scan_directory_for_images(directory, update_db, verbose=False)
        
        return {
            "status": "success",
            "total_files": total_files,
            "added_to_db": added_to_db,
            "directory": directory
        }
    
    except Exception as e:
        logger.error(f"[Error] Failed to scan directory: {str(e)}")
        return {"status": "error", "message": str(e)}

@server.tool()
def mcp_clean_database(execute: bool = False) -> Dict[str, Any]:
    """
    Clean the database by removing records for files that no longer exist.
    
    Args:
        execute: If True, actually remove records; if False, only report what would be removed
        
    Returns:
        A dictionary containing the cleaning results
    """
    logger.info(f"[API] Cleaning database (execute: {execute})")
    
    try:
        to_remove = clean_database(dry_run=not execute, verbose=False)
        
        return {
            "status": "success",
            "records_removed": to_remove if execute else 0,
            "records_to_remove": to_remove,
            "executed": execute
        }
    
    except Exception as e:
        logger.error(f"[Error] Failed to clean database: {str(e)}")
        return {"status": "error", "message": str(e)}

@server.tool()
def mcp_database_report() -> Dict[str, Any]:
    """
    Generate a comprehensive report on the database status.
    
    Returns:
        A dictionary containing the database report
    """
    logger.info("[API] Generating database report")
    
    try:
        # We'll need to capture the output of generate_report() since it prints to stdout
        # For now, we'll just get the data directly
        with CardDatabase() as db:
            cards = db.get_all_cards()
            total_records = len(cards)
            
            # Count by set
            sets = {}
            for card in cards:
                set_code = card['set_code'] or 'Unknown'
                if set_code not in sets:
                    sets[set_code] = 0
                sets[set_code] += 1
            
            # Check for missing files
            missing_files = 0
            for card in cards:
                if not os.path.exists(card['filename']):
                    missing_files += 1
            
            # Check image directories
            image_dir = ".local/scryfall_images"
            set_dirs = []
            total_images = 0
            
            if os.path.exists(image_dir):
                set_dirs = [d for d in os.listdir(image_dir) if os.path.isdir(os.path.join(image_dir, d))]
                
                # Count image files
                for set_dir in set_dirs:
                    set_path = os.path.join(image_dir, set_dir)
                    image_files = [f for f in os.listdir(set_path) 
                                if os.path.isfile(os.path.join(set_path, f)) and 
                                f.lower().endswith(('.jpg', '.png', '.jpeg', '.gif'))]
                    total_images += len(image_files)
            
            return {
                "status": "success",
                "total_records": total_records,
                "missing_files": missing_files,
                "sets": {set_code: count for set_code, count in sets.items()},
                "set_directories": len(set_dirs),
                "total_images": total_images,
                "database_coverage": round(total_records / total_images * 100, 2) if total_images > 0 else 0
            }
    
    except Exception as e:
        logger.error(f"[Error] Failed to generate database report: {str(e)}")
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

@server.resource(uri="resource://card/name/{card_name}")
def card_by_name(card_name: str) -> Tuple[str, str]:
    """
    Get detailed information about a specific Magic: The Gathering card by name.
    
    Args:
        card_name: The name of the card
        
    Returns:
        The card data as JSON
    """
    logger.info(f"[Resource] Getting card data for name: {card_name}")
    
    try:
        # Fetch the card data from Scryfall
        card_name_for_url = card_name.replace(" ", "+")
        url = f"https://api.scryfall.com/cards/named?exact={card_name_for_url}"
        
        with httpx.Client() as client:
            response = client.get(url)
            response.raise_for_status()
            card_data = response.json()
        
        return json.dumps(card_data, indent=2), "application/json"
    
    except Exception as e:
        logger.error(f"[Error] Failed to get card resource by name: {str(e)}")
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

@server.resource(uri="resource://database/stats")
def database_stats() -> Tuple[str, str]:
    """
    Get statistics about the card database.
    
    Returns:
        Database statistics as JSON
    """
    logger.info("[Resource] Getting database statistics")
    
    try:
        with CardDatabase() as db:
            cards = db.get_all_cards()
            total_records = len(cards)
            
            # Count by set
            sets = {}
            for card in cards:
                set_code = card['set_code'] or 'Unknown'
                if set_code not in sets:
                    sets[set_code] = 0
                sets[set_code] += 1
            
            # Most recent downloads
            recent = []
            for card in sorted(cards, key=lambda x: x['download_date'], reverse=True)[:5]:
                recent.append({
                    "card_name": card['card_name'],
                    "download_date": card['download_date']
                })
            
            stats = {
                "total_records": total_records,
                "sets": {set_code: count for set_code, count in sorted(sets.items(), key=lambda x: x[1], reverse=True)},
                "recent_downloads": recent
            }
            
            return json.dumps(stats, indent=2), "application/json"
    
    except Exception as e:
        logger.error(f"[Error] Failed to get database stats: {str(e)}")
        return json.dumps({"status": "error", "message": str(e)}), "application/json"

if __name__ == "__main__":
    logger.info("[Setup] Starting Scryfall MCP server...")
    server.run()
