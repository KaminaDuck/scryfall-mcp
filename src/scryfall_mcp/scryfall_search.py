#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Scryfall Search

This module provides functionality to search for cards on Scryfall and download specific versions.
It supports downloading both full card images and art crops.
"""

import httpx
import argparse
import json
import sys
import time
from typing import List, Dict, Any, Optional
from .scryfall_card_download import download_card_images
from .scryfall_art_download import download_art_crops


def search_cards(search_term: str) -> List[Dict[str, Any]]:
    """
    Search for cards on Scryfall API based on a search term.
    Handles pagination to get all results.
    
    Args:
        search_term: The term to search for in card names
        
    Returns:
        A list of card data dictionaries matching the search
    """
    # URL encode the search term
    encoded_term = search_term.replace(" ", "+")
    
    # Use the Scryfall search API with the name parameter and unique:prints to get all printings
    search_url = f"https://api.scryfall.com/cards/search?q=name:{encoded_term}+unique:prints"
    
    all_cards = []
    
    try:
        with httpx.Client() as client:
            print(f"Searching Scryfall for cards with '{search_term}' in the name...")
            
            # Get the first page
            response = client.get(search_url)
            response.raise_for_status()
            data = response.json()
            
            if data.get("object") == "error":
                print(f"Error: {data.get('details')}")
                return []
            
            # Add the cards from the first page
            all_cards.extend(data.get("data", []))
            
            # Handle pagination if there are more pages
            while data.get("has_more", False):
                # Small delay to avoid rate limiting
                time.sleep(0.1)
                
                next_page_url = data.get("next_page")
                if not next_page_url:
                    break
                    
                print("Fetching additional results...")
                response = client.get(next_page_url)
                response.raise_for_status()
                data = response.json()
                
                if data.get("object") == "error":
                    print(f"Error fetching additional results: {data.get('details')}")
                    break
                    
                all_cards.extend(data.get("data", []))
            
            return all_cards
    except httpx.HTTPStatusError as e:
        # Check if it's a 404 error based on the exception message
        if "404" in str(e):
            print(f"No cards found with '{search_term}' in the name.")
        else:
            print(f"HTTP Error: {e}")
        return []
    except httpx.HTTPError as e:
        # Generic HTTP error
        print(f"HTTP Error: {e}")
        return []
    except Exception as e:
        print(f"Error searching for cards: {e}")
        return []


def group_cards_by_name_and_art(cards: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group cards by name and identify alternate artworks.
    
    Args:
        cards: List of card data from Scryfall API
        
    Returns:
        Dictionary with card names as keys and lists of card variants as values
    """
    card_groups = {}
    
    for card in cards:
        name = card.get("name", "Unknown")
        
        if name not in card_groups:
            card_groups[name] = []
            
        # Add a display name to help identify alternate arts
        set_name = card.get("set_name", "Unknown Set")
        set_code = card.get("set", "???").upper()
        collector_number = card.get("collector_number", "??")
        artist = card.get("artist", "Unknown Artist")
        
        # Add a display_name field to help with showing alternate arts
        card["display_name"] = f"{name} [{set_code} - {set_name}, #{collector_number}, Art: {artist}]"
            
        card_groups[name].append(card)
        
    return card_groups


def display_card_options(card_groups: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Display card options to the user and return a flattened list with indices.
    
    Args:
        card_groups: Dictionary of card names and their variants
        
    Returns:
        Flattened list of card options with display indices
    """
    if not card_groups:
        print("No cards found matching your search.")
        return []
        
    print("\nFound the following cards:")
    print("-" * 80)
    
    # Create a flattened list for selection
    all_options = []
    option_index = 1
    
    for name, variants in card_groups.items():
        # If there's only one variant, display it simply
        if len(variants) == 1:
            card = variants[0]
            set_name = card.get("set_name", "Unknown Set")
            set_code = card.get("set", "???").upper()
            
            print(f"{option_index}. {name} [{set_code} - {set_name}]")
            all_options.append(card)
            option_index += 1
        else:
            # If there are multiple variants, show them as sub-options with ALTERNATE ART highlighted
            print(f"\033[1m{name} - {len(variants)} versions available (ALTERNATE ARTS):\033[0m")
            
            for card in variants:
                set_name = card.get("set_name", "Unknown Set")
                set_code = card.get("set", "???").upper()
                collector_number = card.get("collector_number", "??")
                
                print(f"  {option_index}. {name} [{set_code} - {set_name}, #{collector_number}]")
                all_options.append(card)
                option_index += 1
                
        print("-" * 80)
    
    return all_options


def get_user_selection(options: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Get the user's selection from the displayed options.
    
    Args:
        options: List of card options with display indices
        
    Returns:
        The selected card data or None if selection was invalid
    """
    if not options:
        return None
        
    while True:
        try:
            choice = input("\nEnter the number of the card you want to download (or 'q' to quit): ")
            
            if choice.lower() in ('q', 'quit', 'exit'):
                return None
                
            choice_index = int(choice) - 1
            
            if 0 <= choice_index < len(options):
                return options[choice_index]
            else:
                print(f"Invalid selection. Please enter a number between 1 and {len(options)}.")
        except ValueError:
            print("Please enter a valid number or 'q' to quit.")


def main():
    """Main function to run the script."""
    parser = argparse.ArgumentParser(
        description="Search for Magic: The Gathering cards on Scryfall and download selected cards."
    )
    parser.add_argument("search_term", help="Term to search for in card names")
    parser.add_argument("--force", "-f", action="store_true", 
                        help="Force download even if card already exists in database")
    parser.add_argument("--art-crop", "-a", action="store_true",
                        help="Download art crop instead of full card image")
    
    args = parser.parse_args()
    
    # Search for cards matching the term
    cards = search_cards(args.search_term)
    
    if not cards:
        sys.exit(1)
    
    # Group cards by name and identify alternate artworks
    card_groups = group_cards_by_name_and_art(cards)
    
    # Display options to the user
    options = display_card_options(card_groups)
    
    # Get user selection
    selected_card = get_user_selection(options)
    
    if selected_card:
        # Get the specific card details
        card_name = selected_card.get("name")
        set_code = selected_card.get("set", "").upper()
        collector_number = selected_card.get("collector_number", "")
        
        # Check if we have a specific version (set + collector number)
        if set_code and collector_number:
            # Pass the specific version information to the download function
            if args.art_crop:
                print(f"\nDownloading art crop for '{card_name}' (Set: {set_code}, #{collector_number})...")
                download_art_crops(
                    [card_name],
                    force_download=args.force,
                    set_codes=[set_code],
                    collector_numbers=[collector_number]
                )
            else:
                print(f"\nDownloading full card image for '{card_name}' (Set: {set_code}, #{collector_number})...")
                download_card_images(
                    [card_name],
                    force_download=args.force,
                    set_codes=[set_code],
                    collector_numbers=[collector_number]
                )
            
            print(f"\nNote: If you want to reference this specific version in the future,")
            print(f"you can use the set code and collector number: {set_code} #{collector_number}")
        else:
            # Just download by name if we don't have specific version info
            if args.art_crop:
                print(f"\nDownloading art crop for '{card_name}'...")
                download_art_crops([card_name], force_download=args.force)
            else:
                print(f"\nDownloading full card image for '{card_name}'...")
                download_card_images([card_name], force_download=args.force)
    else:
        print("Download cancelled.")


if __name__ == "__main__":
    main()
