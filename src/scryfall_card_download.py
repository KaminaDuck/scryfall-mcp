import httpx
import os
import time
import argparse

def download_card_image(card_name):
    """
    Downloads the 'large' image for a given card name from Scryfall.
    """
    output_folder = ".local/scryfall_card_images"
    os.makedirs(output_folder, exist_ok=True)
    card_name_for_url = card_name.replace(" ", "+") # For URL encoding
    api_url = f"https://api.scryfall.com/cards/named?exact={card_name_for_url}"

    print(f"Fetching data for '{card_name}' from Scryfall...")
    try:
        with httpx.Client() as client:
            response = client.get(api_url)
            response.raise_for_status()
            card_data = response.json()

            large_image_url = card_data.get("image_uris", {}).get("large")

            if large_image_url:
                card_name_for_filename = card_name.replace(" ", "_").replace("//", "_") # For file names
                image_extension = os.path.splitext(large_image_url)[1]
                if "?" in large_image_url:
                    large_image_url_base = large_image_url.split("?")[0]
                    image_extension = os.path.splitext(large_image_url_base)[1] # Get extension from base URL
                image_filename = f"{card_name_for_filename}{image_extension}"
                image_filepath = os.path.join(output_folder, image_filename)

                print(f"Downloading large image for '{card_name}'...")
                image_response = client.get(large_image_url)
                image_response.raise_for_status()

                with open(image_filepath, 'wb') as img_file:
                    img_file.write(image_response.content)
                print(f"Saved to {image_filepath}")
            else:
                print(f"No large image found for '{card_name}'.")

    except httpx.HTTPError as e:
        print(f"Error fetching data or downloading image for '{card_name}': {e}")
    except json.JSONDecodeError:
        print(f"Error decoding JSON response for '{card_name}'.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download 'large' images for a list of card names from Scryfall.")
    parser.add_argument("card_names", nargs='+', help="List of card names to download images for.")
    args = parser.parse_args()

    for card_name in args.card_names:
        download_card_image(card_name)
        time.sleep(0.2) # Delay of 200ms between requests

    print("Download process complete.")