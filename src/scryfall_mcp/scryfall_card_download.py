import httpx
import os
import time
import argparse
import json
from .db_manager import CardDatabase


def download_card_images(card_names, force_download=False, set_codes=None, collector_numbers=None):
    """
    Downloads 'large' images for a list of card names from Scryfall.
    Tracks progress and provides a summary at the end.
    Uses a database to track downloaded cards.
    
    Args:
        card_names: List of card names to download
        force_download: Whether to force download even if card exists in database
        set_codes: Optional list of set codes corresponding to card_names
        collector_numbers: Optional list of collector numbers corresponding to card_names
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
    
    print(f"Processing {total_cards} cards...")
    
    output_folder = os.path.expanduser('~/.scryfall_mcp/card_images')
    os.makedirs(output_folder, exist_ok=True)
    
    # Initialize the database
    with CardDatabase() as db:
        for index, card_name in enumerate(card_names, 1):
            set_code = set_codes[index-1]
            collector_number = collector_numbers[index-1]
            
            card_name_for_filename = card_name.replace(" ", "_").replace("//", "_")
            
            # Create a unique identifier for the card version
            card_version_id = f"{card_name}"
            if set_code and collector_number:
                card_version_id = f"{card_name}_{set_code}_{collector_number}"
            
            # Check if the card exists in the database
            if db.card_exists(card_version_id) and not force_download:
                print(f"[{index}/{total_cards}] Image for '{card_name}' ({set_code} #{collector_number}) already exists in database, skipping download...")
                skipped_count += 1
                continue  # Skip to the next card
            else:
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
                        
                        large_image_url = card_data.get("image_uris", {}).get("large")
                        
                        if large_image_url:
                            image_extension = os.path.splitext(large_image_url)[1]
                            if "?" in large_image_url:
                                large_image_url_base = large_image_url.split("?")[0]
                                image_extension = os.path.splitext(large_image_url_base)[1]
                            # Include set code and collector number in filename if available
                            if set_code and collector_number:
                                image_filename = f"{card_name_for_filename}_{set_code}_{collector_number}{image_extension}"
                            else:
                                image_filename = f"{card_name_for_filename}{image_extension}"
                            image_filepath = os.path.join(output_folder, image_filename)
                            
                            print(f"[{index}/{total_cards}] Downloading large image for '{card_name}'...")
                            image_response = client.get(large_image_url)
                            image_response.raise_for_status()
                            
                            with open(image_filepath, 'wb') as img_file:
                                img_file.write(image_response.content)
                            print(f"Saved to {image_filepath}")
                            
                            # Add the card to the database with the version identifier
                            db.add_card(
                                card_name=card_version_id,
                                filename=image_filename,
                                card_id=card_data.get("id"),
                                set_code=card_data.get("set"),
                                image_url=large_image_url
                            )
                            downloaded_count += 1
                        else:
                            print(f"[{index}/{total_cards}] No large image found for '{card_name}'.")
                            error_count += 1
                except httpx.HTTPError as e:
                    print(f"[{index}/{total_cards}] Error fetching data or downloading image for '{card_name}': {e}")
                    error_count += 1
                except Exception as e:
                    print(f"[{index}/{total_cards}] Unexpected error for '{card_name}': {e}")
                    error_count += 1
                
        time.sleep(0.2)  # Delay of 200ms between requests
    
    print("\nDownload process complete!")
    print(f"Total cards processed: {total_cards}")
    print(f"Images downloaded: {downloaded_count}")
    print(f"Images skipped (already existed): {skipped_count}")
    print(f"Errors encountered: {error_count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download 'large' images for a list of card names from Scryfall.")
    parser.add_argument("card_names", nargs='+', help="List of card names to download images for.")
    parser.add_argument("--force", "-f", action="store_true", help="Force download even if files already exist")
    args = parser.parse_args()

    download_card_images(args.card_names, force_download=args.force, set_codes=None, collector_numbers=None)
