import httpx
import os
import json

async def download_default_cards_json():
    """
    Downloads the latest Scryfall Default Cards JSON file and saves it to the .json folder.
    Uses the Scryfall API to get the dynamic download URL.
    """
    bulk_data_url = "https://api.scryfall.com/bulk-data"
    download_path = ".json"
    file_name = "default-cards.json"
    output_file_path = os.path.join(download_path, file_name)

    # Create the .json directory if it doesn't exist
    if not os.path.exists(download_path):
        os.makedirs(download_path)

    try:
        async with httpx.AsyncClient() as client: # Use httpx AsyncClient for asynchronous requests
            bulk_data_response = await client.get(bulk_data_url) # Fetch the list of bulk data files
            bulk_data_response.raise_for_status()
            bulk_data = bulk_data_response.json()

            default_cards_url = None
            for data_item in bulk_data['data']: # Find the 'Default Cards' entry in the list
                if data_item['name'] == 'Default Cards':
                    default_cards_url = data_item['download_uri'] # Get the dynamic download URL
                    break

            if default_cards_url:
                download_response = await client.get(default_cards_url) # Download the Default Cards JSON using the dynamic URL
                download_response.raise_for_status()

                with open(output_file_path, 'wb') as f:
                    f.write(download_response.content)
                print(f"Successfully downloaded and saved to {output_file_path}")
            else:
                print("Could not find 'Default Cards' data in Scryfall API response.")

    except httpx.RequestError as e:
        print(f"Request failed: {e}")
    except httpx.HTTPError as e:
        print(f"HTTP error: {e}")
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(download_default_cards_json())