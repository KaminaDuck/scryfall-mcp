#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Scryfall Art Downloader

This module downloads art crop images from Scryfall JSON data and organizes them by set.
It uses a database to track downloaded images for improved efficiency.

Key features:
- Reads card data from a provided JSON file
- Uses a database to track downloaded images
- Batch processes cards to reduce API calls
- Downloads and organizes art crop images by set
- Provides progress tracking and summary statistics
"""

import json
import httpx
import os
import time
import argparse
import sqlite3
from typing import List, Dict, Any, Optional, Tuple
from db_manager import CardDatabase


def load_cards_from_json(json_filepath: str) -> List[Dict[str, Any]]:
    """
    Load card data from a JSON file.
    
    Args:
        json_filepath: Path to the JSON file containing card data
        
    Returns:
        List of card data dictionaries
    """
    with open(json_filepath, 'r', encoding='utf-8') as f:
        cards_data = json.load(f)
    return cards_data


def prepare_download_list(cards_data: List[Dict[str, Any]], db: CardDatabase, force_download: bool = False) -> List[Dict[str, Any]]:
    """
    Prepare a list of cards that need to be downloaded by checking against the database.
    
    Args:
        cards_data: List of card data dictionaries
        db: Database connection
        force_download: Whether to force download even if card exists in database
        
    Returns:
        List of cards that need to be downloaded
    """
    download_list = []
    skipped_count = 0
    
    print(f"Checking database for {len(cards_data)} cards...")
    
    for card in cards_data:
        set_name = card.get("set_name", "unknown_set")
        card_name = card.get("name", "unknown_card")
        set_code = card.get("set", "")
        collector_number = card.get("collector_number", "")
        
        # Create a unique identifier for the card
        card_version_id = f"{card_name}_{set_code}_{collector_number}_art_crop"
        
        # Check if the card exists in the database
        if db.card_exists(card_version_id) and not force_download:
            skipped_count += 1
        else:
            # Only add cards with art_crop URLs to the download list
            if card.get("image_uris", {}).get("art_crop"):
                download_list.append(card)
    
    print(f"Found {len(download_list)} cards to download. Skipped {skipped_count} cards already in database.")
    return download_list


def download_art_crops_batch(cards_to_download: List[Dict[str, Any]], db: CardDatabase) -> Tuple[int, int]:
    """
    Download art crop images for a batch of cards.
    
    Args:
        cards_to_download: List of cards to download
        db: Database connection
        
    Returns:
        Tuple of (downloaded_count, error_count)
    """
    output_folder = ".local/scryfall_images"
    os.makedirs(output_folder, exist_ok=True)
    
    downloaded_count = 0
    error_count = 0
    
    total_cards = len(cards_to_download)
    
    for index, card in enumerate(cards_to_download, 1):
        set_name = card.get("set_name", "unknown_set").replace(" ", "_").replace(":", "_")
        card_name = card.get("name", "unknown_card").replace(" ", "_").replace("//", "_")
        set_code = card.get("set", "")
        collector_number = card.get("collector_number", "")
        art_crop_url = card.get("image_uris", {}).get("art_crop")
        
        # Create a unique identifier for the card
        card_version_id = f"{card.get('name', 'unknown_card')}_{set_code}_{collector_number}_art_crop"
        
        if art_crop_url:
            set_folder = os.path.join(output_folder, set_name)
            os.makedirs(set_folder, exist_ok=True)
            
            image_extension = os.path.splitext(art_crop_url)[1]
            # Remove query parameters from URL if present
            if "?" in art_crop_url:
                art_crop_url_base = art_crop_url.split("?")[0]
                image_extension = os.path.splitext(art_crop_url_base)[1]
            image_filename = f"{card_name}{image_extension}"
            image_filepath = os.path.join(set_folder, image_filename)
            
            print(f"[{index}/{total_cards}] Downloading {card_name} from {set_name}...")
            try:
                with httpx.Client() as client:
                    response = client.get(art_crop_url)
                    response.raise_for_status()
                    
                    with open(image_filepath, 'wb') as img_file:
                        img_file.write(response.content)
                
                # Add the card to the database
                db.add_card(
                    card_name=card_version_id,
                    filename=image_filepath,
                    card_id=card.get("id"),
                    set_code=set_code,
                    image_url=art_crop_url
                )
                
                print(f"Saved to {image_filepath}")
                downloaded_count += 1
                
                # Save card data to JSON file
                json_filename = f"{card_name}.json"
                json_filepath = os.path.join(set_folder, json_filename)
                with open(json_filepath, 'w', encoding='utf-8') as json_file:
                    json.dump(card, json_file, indent=4)
                
            except httpx.HTTPError as e:
                print(f"Error downloading {card_name}: {e}")
                error_count += 1
            
            # Add a small delay to avoid rate limiting
            time.sleep(0.2)
        else:
            print(f"[{index}/{total_cards}] No art_crop URL found for {card.get('name', 'unknown_card')}")
            error_count += 1
    
    return downloaded_count, error_count


def download_art_crops(json_filepath: str, force_download: bool = False, batch_size: int = 100) -> None:
    """
    Reads a JSON file, downloads art_crop images from Scryfall,
    and saves them to a folder structure. Uses a database to track downloads.
    
    Args:
        json_filepath: Path to the JSON file containing card data
        force_download: Whether to force download even if card exists in database
        batch_size: Number of cards to process in each batch
    """
    # Load cards from JSON
    cards_data = load_cards_from_json(json_filepath)
    total_cards = len(cards_data)
    
    print(f"Loaded {total_cards} cards from {json_filepath}")
    
    # Initialize the database
    with CardDatabase() as db:
        # Prepare the download list
        cards_to_download = prepare_download_list(cards_data, db, force_download)
        
        # Process cards in batches
        total_downloaded = 0
        total_errors = 0
        
        for i in range(0, len(cards_to_download), batch_size):
            batch = cards_to_download[i:i+batch_size]
            print(f"\nProcessing batch {i//batch_size + 1}/{(len(cards_to_download) + batch_size - 1)//batch_size}...")
            downloaded, errors = download_art_crops_batch(batch, db)
            total_downloaded += downloaded
            total_errors += errors
        
        # Calculate final statistics
        skipped_count = total_cards - len(cards_to_download)
        
        print("\nDownload complete!")
        print(f"Total cards processed: {total_cards}")
        print(f"Images downloaded: {total_downloaded}")
        print(f"Images skipped (already existed): {skipped_count}")
        print(f"Errors encountered: {total_errors}")


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description="Download art crops from Scryfall JSON data.")
    parser.add_argument("json_file", help="Path to the JSON file containing card data.")
    parser.add_argument("--force", "-f", action="store_true", help="Force download even if files already exist")
    parser.add_argument("--batch-size", "-b", type=int, default=100, help="Number of cards to process in each batch")
    args = parser.parse_args()
    
    download_art_crops(args.json_file, force_download=args.force, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
