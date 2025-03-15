import httpx
import os
import json
import argparse # Import the argparse module

async def download_default_cards_json(bulk_data_name="Default Cards"):
    """
    Downloads the specified Scryfall bulk data JSON file and saves it to the .json folder.
    Uses the Scryfall API to get the dynamic download URL.

    Args:
        bulk_data_name (str, optional): The name of the Scryfall bulk data to download.
            Defaults to "Default Cards".  Available options include "Unique Artwork",
            "Default Cards", or "All Cards".
    """
    bulk_data_url = "https://api.scryfall.com/bulk-data"
    download_path = ".json"
    file_name = f"{bulk_data_name.replace(' ', '-').lower()}.json" # Dynamically create the file name
    output_file_path = os.path.join(download_path, file_name)

    # Create the .json directory if it doesn't exist
    if not os.path.exists(download_path):
        os.makedirs(download_path)

    try:
        async with httpx.AsyncClient() as client: # Use httpx AsyncClient for asynchronous requests
            bulk_data_response = await client.get(bulk_data_url) # Fetch the list of bulk data files
            bulk_data_response.raise_for_status()
            bulk_data = bulk_data_response.json()

            download_url = None
            for data_item in bulk_data['data']: # Find the specified bulk data entry in the list
                if data_item['name'] == bulk_data_name:
                    download_url = data_item['download_uri'] # Get the dynamic download URL
                    break

            if download_url:
                download_response = await client.get(download_url) # Download the  JSON using the dynamic URL
                download_response.raise_for_status()

                with open(output_file_path, 'wb') as f:
                    f.write(download_response.content)
                print(f"Successfully downloaded and saved to {output_file_path}")
            else:
                print(f"Could not find '{bulk_data_name}' data in Scryfall API response.")

    except httpx.RequestError as e:
        print(f"Request failed: {e}")
    except httpx.HTTPError as e:
        print(f"HTTP error: {e}")
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")


if __name__ == "__main__":
    import asyncio

    parser = argparse.ArgumentParser(description="Download Scryfall bulk data JSON.") # Create an argument parser
    parser.add_argument(
        "bulk_data_name",
        nargs="?", # Make the argument optional
        default="Default Cards",
        choices=["Unique Artwork", "Default Cards", "All Cards"],
        help="Name of the Scryfall bulk data to download. Defaults to 'Default Cards'. Options are: 'Unique Artwork', 'Default Cards', 'All Cards'."
    )
    args = parser.parse_args() # Parse the arguments

    asyncio.run(download_default_cards_json(args.bulk_data_name)) # Pass the argument from command line