#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Scryfall Art Download

This module provides functionality to download art crop images for specific cards.
It uses the database to track downloaded images for improved efficiency.

Key features:
- Downloads art crop images for specific cards
- Uses a database to track downloaded images
- Organizes images by set
- Provides progress tracking and summary statistics
"""

import httpx
import os
import time
import json
from typing import List, Optional
from .db_manager import CardDatabase


def download_art_crops(
    card_names: List[str], 
    force_download: bool = False,
    set_codes: Optional[List[str]] = None,
    collector_numbers: Optional[List[str]] = None
) -> None:
    """
    Download art crop images for specific cards.
    
    Args:
        card_names: List of card names to download
        force_download: If True, download even if the card already exists in database
        set_codes: Optional list of set codes to specify exact printings
        collector_numbers: Optional list of collector numbers to specify exact printings
    """
    # Initialize set_codes and collector_numbers if not provided
    if set_codes is None:
        set_codes = [None] * len(card_names)
    if collector_numbers is None:
        collector_numbers = [None] * len(card_names)
    
    total_cards = len(card_names)
    downloaded_count = 0
    skipped_count = 0
    error_count = 0
    
    print(f"Processing {total_cards} cards for art crop download...")
    
    output_folder = ".local/scryfall_images"
    os.makedirs(output_folder, exist_ok=True)
    
    # Initialize the database
    with CardDatabase() as db:
        for index, card_name in enumerate(card_names, 1):
            set_code = set_codes[index-1]
            collector_number = collector_numbers[index-1]
            
            # Create a unique identifier for the card version
            card_version_id = f"{card_name}_art_crop"
            if set_code and collector_number:
                card_version_id = f"{card_name}_{set_code}_{collector_number}_art_crop"
            
            # Check if the card exists in the database
            if db.card_exists(card_version_id) and not force_download:
                print(f"[{index}/{total_cards}] Art crop for '{card_name}' ({set_code} #{collector_number}) already exists in database, skipping download...")
                skipped_count += 1
                continue  # Skip to the next card
            
            try:
                # Use the specific set/collector number endpoint if provided
                if set_code and collector_number:
                    api_url = f"https://api.scryfall.com/cards/{set_code.lower()}/{collector_number}"
                    print(f"[{index}/{total_cards}] Fetching specific version: {set_code} #{collector_number}")
                else:
                    card_name_for_url = card_name.replace(" ", "+")
                    api_url = f"https://api.scryfall.com/cards/named?exact={card_name_for_url}"
                
                print(f"[{index}/{total_cards}] Fetching data for '{card_name}' from Scryfall...")
                with httpx.Client() as client:
                    response = client.get(api_url)
                    response.raise_for_status()
                    card_data = response.json()
                    
                    # Get the art crop URL
                    art_crop_url = card_data.get("image_uris", {}).get("art_crop")
                    
                    if art_crop_url:
                        # Create a folder for the set
                        set_name = card_data.get("set_name", "unknown_set").replace(" ", "_").replace(":", "_")
                        set_folder = os.path.join(output_folder, set_name)
                        os.makedirs(set_folder, exist_ok=True)
                        
                        # Prepare the filename
                        card_name_for_filename = card_name.replace(" ", "_").replace("//", "_")
                        image_extension = os.path.splitext(art_crop_url)[1]
                        if "?" in art_crop_url:
                            art_crop_url_base = art_crop_url.split("?")[0]
                            image_extension = os.path.splitext(art_crop_url_base)[1]
                        
                        # Include set code and collector number in filename if available
                        if set_code and collector_number:
                            image_filename = f"{card_name_for_filename}_{set_code}_{collector_number}{image_extension}"
                        else:
                            image_filename = f"{card_name_for_filename}{image_extension}"
                        
                        image_filepath = os.path.join(set_folder, image_filename)
                        
                        print(f"[{index}/{total_cards}] Downloading art crop for '{card_name}'...")
                        image_response = client.get(art_crop_url)
                        image_response.raise_for_status()
                        
                        with open(image_filepath, 'wb') as img_file:
                            img_file.write(image_response.content)
                        print(f"Saved to {image_filepath}")
                        
                        # Add the card to the database with the version identifier
                        db.add_card(
                            card_name=card_version_id,
                            filename=image_filepath,
                            card_id=card_data.get("id"),
                            set_code=card_data.get("set"),
                            image_url=art_crop_url
                        )
                        downloaded_count += 1
                        
                        # Save card data to JSON file
                        json_filename = f"{card_name_for_filename}.json"
                        json_filepath = os.path.join(set_folder, json_filename)
                        with open(json_filepath, 'w', encoding='utf-8') as json_file:
                            json.dump(card_data, json_file, indent=4)
                    else:
                        print(f"[{index}/{total_cards}] No art crop found for '{card_name}'.")
                        error_count += 1
            except httpx.HTTPError as e:
                print(f"[{index}/{total_cards}] Error fetching data or downloading image for '{card_name}': {e}")
                error_count += 1
            except Exception as e:
                print(f"[{index}/{total_cards}] Unexpected error for '{card_name}': {e}")
                error_count += 1
            
            time.sleep(0.2)  # Delay of 200ms between requests
    
    print("\nArt crop download process complete!")
    print(f"Total cards processed: {total_cards}")
    print(f"Art crops downloaded: {downloaded_count}")
    print(f"Art crops skipped (already existed): {skipped_count}")
    print(f"Errors encountered: {error_count}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Download art crop images for specific cards from Scryfall.")
    parser.add_argument("card_names", nargs='+', help="List of card names to download art crops for.")
    parser.add_argument("--force", "-f", action="store_true", help="Force download even if files already exist")
    parser.add_argument("--set", "-s", nargs='+', help="Set codes for specific printings (must match number of card names)")
    parser.add_argument("--collector", "-c", nargs='+', help="Collector numbers for specific printings (must match number of card names)")
    
    args = parser.parse_args()
    
    # Validate that set codes and collector numbers match the number of card names if provided
    if args.set and len(args.set) != len(args.card_names):
        print("Error: Number of set codes must match number of card names")
        exit(1)
    if args.collector and len(args.collector) != len(args.card_names):
        print("Error: Number of collector numbers must match number of card names")
        exit(1)
    
    download_art_crops(
        args.card_names, 
        force_download=args.force, 
        set_codes=args.set, 
        collector_numbers=args.collector
    )
