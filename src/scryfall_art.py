import json
import httpx
import os
import time
import argparse

def download_art_crops(json_filepath):
    """
    Reads a JSON file, downloads art_crop images from Scryfall,
    and saves them to a folder structure.
    """

    with open(json_filepath, 'r', encoding='utf-8') as f:
        cards_data = json.load(f)

    output_folder = "scryfall_images"
    os.makedirs(output_folder, exist_ok=True)

    for card in cards_data:
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

            print(f"Downloading {card_name} from {set_name}...")
            try:
                with httpx.Client() as client:
                    response = client.get(art_crop_url)
                    response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

                    with open(image_filepath, 'wb') as img_file:
                        img_file.write(response.content)
                print(f"Saved to {image_filepath}")

            except httpx.HTTPError as e:
                print(f"Error downloading {card_name}: {e}")

            time.sleep(0.2) # 200 milliseconds delay

            # Save card data to JSON file
            json_filename = f"{card_name}.json" # {{ edit_1 }}
            json_filepath = os.path.join(set_folder, json_filename) # {{ edit_1 }}
            with open(json_filepath, 'w', encoding='utf-8') as json_file: # {{ edit_1 }}
                json.dump(card, json_file, indent=4) # {{ edit_1 }}
            print(f"Card data saved to {json_filepath}") # {{ edit_1 }}


        else:
            print(f"No art_crop URL found for {card.get('name', 'unknown_card')}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download art crops from Scryfall JSON data.") # {{ edit_2 }}
    parser.add_argument("json_file", help="Path to the JSON file containing card data.") # {{ edit_3 }}
    args = parser.parse_args() # {{ edit_4 }}

    download_art_crops(args.json_file) # {{ edit_5 }}
    print("Download complete.")