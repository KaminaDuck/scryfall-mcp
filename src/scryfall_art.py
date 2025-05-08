import json
import httpx
import os
import time
import argparse

def download_art_crops(json_filepath, force_download=False):
    """
    Reads a JSON file, downloads art_crop images from Scryfall,
    and saves them to a folder structure.
    """

    with open(json_filepath, 'r', encoding='utf-8') as f:
        cards_data = json.load(f)

    output_folder = ".local/scryfall_images"
    os.makedirs(output_folder, exist_ok=True)
    
    total_cards = len(cards_data)
    downloaded_count = 0
    skipped_count = 0
    error_count = 0
    
    print(f"Processing {total_cards} cards...")
    
    for index, card in enumerate(cards_data, 1):
        set_name = card.get("set_name", "unknown_set").replace(" ", "_").replace(":","_") # Replace spaces and : for folder names
        card_name = card.get("name", "unknown_card").replace(" ", "_").replace("//", "_") # Replace spaces and // for file names
        art_crop_url = card.get("image_uris", {}).get("art_crop")

        if art_crop_url:
            set_folder = os.path.join(output_folder, set_name)
            os.makedirs(set_folder, exist_ok=True)

            image_extension = os.path.splitext(art_crop_url)[1]
            # Remove query parameters from URL if present
            if "?" in art_crop_url:
                art_crop_url_base = art_crop_url.split("?")[0]
                image_extension = os.path.splitext(art_crop_url_base)[1] # Get extension from base URL
            image_filename = f"{card_name}{image_extension}"
            image_filepath = os.path.join(set_folder, image_filename)

            # Check if the image already exists (skip if exists and not forcing download)
            if os.path.exists(image_filepath) and not force_download:
                skipped_count += 1
                print(f"[{index}/{total_cards}] Image for {card_name} from {set_name} already exists, skipping download...")
            else:
                print(f"[{index}/{total_cards}] Downloading {card_name} from {set_name}...")
                try:
                    with httpx.Client() as client:
                        response = client.get(art_crop_url)
                        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

                        with open(image_filepath, 'wb') as img_file:
                            img_file.write(response.content)
                    print(f"Saved to {image_filepath}")
                    downloaded_count += 1

                except httpx.HTTPError as e:
                    print(f"Error downloading {card_name}: {e}")
                    error_count += 1

            time.sleep(0.2) # 200 milliseconds delay

            # Save card data to JSON file if it doesn't exist
            json_filename = f"{card_name}.json"
            json_filepath = os.path.join(set_folder, json_filename)
            if os.path.exists(json_filepath) and not force_download:
                print(f"[{index}/{total_cards}] Card data for {card_name} already exists, skipping...")
            else:
                with open(json_filepath, 'w', encoding='utf-8') as json_file:
                    json.dump(card, json_file, indent=4)
                print(f"Card data saved to {json_filepath}")


        else:
            print(f"[{index}/{total_cards}] No art_crop URL found for {card.get('name', 'unknown_card')}")
            error_count += 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download art crops from Scryfall JSON data.")
    parser.add_argument("json_file", help="Path to the JSON file containing card data.")
    parser.add_argument("--force", "-f", action="store_true", help="Force download even if files already exist")
    args = parser.parse_args()

    download_art_crops(args.json_file, force_download=args.force)
    print("\nDownload complete!")
    print(f"Total cards processed: {total_cards}")
    print(f"Images downloaded: {downloaded_count}")
    print(f"Images skipped (already existed): {skipped_count}")
    print(f"Errors encountered: {error_count}")