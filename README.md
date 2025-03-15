# Scryfall Card Art Downloader

This project provides Python scripts to download card data and images from Scryfall.

## Scripts

### `json_download.py`

Downloads Scryfall bulk data JSON files and saves them to the `.json` folder.

**Functionality:**

- Fetches the dynamic download URL for bulk data from the Scryfall API
- Supports different bulk data types: "Default Cards", "Unique Artwork", or "All Cards"
- Downloads the JSON data and saves it to the `.local/json` directory
- Handles HTTP request errors and JSON decoding errors

**Usage:**

```bash
# Install dependencies
pip install httpx

# Download Default Cards (default option)
python src/json_download.py

# Or specify a different bulk data type
python src/json_download.py "Unique Artwork"
```

### `scryfall_art.py`

Reads a JSON file of card data and downloads art crop images for each card, organizing them by set.

**Functionality:**

- Reads card data from a provided JSON file
- For each card, retrieves the `art_crop` image URL
- Creates a folder structure `.local/scryfall_images/{set_name}` to organize images by set
- Downloads and saves art crop images as `.local/scryfall_images/{set_name}/{card_name}.{extension}`
- Also saves individual card data as JSON files alongside the images
- Includes error handling and rate limiting (200ms delay between requests)

**Usage:**

```bash
# Install dependencies
pip install httpx argparse

# Run the script with your JSON file
python src/scryfall_art.py .local/json/default-cards.json
```

### `scryfall_card_download.py`

Downloads high-resolution 'large' card images for specific cards by name.

**Functionality:**

- Takes one or more card names as command-line arguments
- Queries the Scryfall API for each card by exact name
- Downloads the 'large' image for each card
- Saves images to `.local/scryfall_card_images/` directory
- Includes error handling and rate limiting

**Usage:**

```bash
# Install dependencies
pip install httpx

# Download images for specific cards
python src/scryfall_card_download.py "Black Lotus" "Counterspell"
```

## Dependencies

- [httpx](https://www.python-httpx.org/): For making HTTP requests to the Scryfall API
- [argparse](https://docs.python.org/3/library/argparse.html): For parsing command-line arguments
- [os](https://docs.python.org/3/library/os.html): For file system operations
- [json](https://docs.python.org/3/library/json.html): For working with JSON data
- [time](https://docs.python.org/3/library/time.html): For implementing delays between requests

## Output

- **`.local/json/`**: Contains downloaded bulk data JSON files
- **`.local/scryfall_images/`**: Contains subfolders for each card set with art crop images and card data JSON files
- **`.local/scryfall_card_images/`**: Contains high-resolution 'large' card images downloaded by name

## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for more details.
