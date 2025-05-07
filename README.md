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
- **Skips downloading images that already exist** to save time and bandwidth
- Provides progress tracking and a summary of downloaded/skipped images
- Includes error handling and rate limiting (200ms delay between requests)
- Supports a `--force` flag to re-download all images even if they already exist

**Usage:**

```bash
# Install dependencies
pip install httpx argparse

# Run the script with your JSON file
python src/scryfall_art.py .local/json/default-cards.json

# Force re-download of all images (even if they already exist)
python src/scryfall_art.py .local/json/default-cards.json --force
```

### `scryfall_card_download.py`

Downloads high-resolution 'large' card images for specific cards by name.

**Functionality:**

- Takes one or more card names as command-line arguments
- Queries the Scryfall API for each card by exact name
- Downloads the 'large' image for each card
- Saves images to `.local/scryfall_card_images/` directory
- **Skips downloading images that already exist** to save time and bandwidth
- Provides progress tracking and a summary of downloaded/skipped images
- Includes error handling and rate limiting
- Supports a `--force` flag to re-download all images even if they already exist

**Usage:**

```bash
# Install dependencies
pip install httpx

# Download images for specific cards
python src/scryfall_card_download.py "Black Lotus" "Counterspell"

# Force re-download of all images (even if they already exist)
python src/scryfall_card_download.py "Black Lotus" "Counterspell" --force
```

### `scryfall_search.py`

Searches for cards by name on Scryfall and allows users to select and download specific versions, including alternate artworks.

**Functionality:**

- Takes a search term as input and queries the Scryfall API
- Displays a list of all matching cards, highlighting alternate artworks as separate items
- Shows detailed information for each card version (set name, set code, collector number)
- Allows users to select a specific card version to download
- Downloads the selected card using the `scryfall_card_download.py` script
- Handles pagination for searches with many results
- Provides information about the specific version downloaded (set code and collector number)

**Usage:**

```bash
# Install dependencies
pip install httpx

# Search for cards with a specific term in their name
python src/scryfall_search.py "lightning bolt"

# Force re-download even if the card already exists in the database
python src/scryfall_search.py "black lotus" --force
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
- **`.local/scryfall_db.sqlite`**: SQLite database tracking downloaded cards

## Database Functionality

The project now includes a SQLite database to track downloaded cards, which helps prevent redundant downloads and provides a way to query your card collection.

### Database Schema

The database contains a single table `downloaded_cards` with the following columns:
- `id`: Unique identifier for the record
- `card_name`: Name of the card
- `filename`: Filename where the card image is saved
- `download_date`: Timestamp when the card was downloaded
- `card_id`: Scryfall ID of the card (if available)
- `set_code`: Set code of the card (if available)
- `image_url`: URL of the downloaded image (if available)

### Database Utilities

The `db_utils.py` script provides command-line utilities for managing the database:

```bash
# Initialize the database (automatically done when needed)
python src/db_utils.py init

# List all downloaded cards
python src/db_utils.py list

# List with sorting options
python src/db_utils.py list --sort name --order asc
python src/db_utils.py list --sort date --order desc
python src/db_utils.py list --sort set --order desc

# Limit the number of results
python src/db_utils.py list --limit 10

# Search for cards
python src/db_utils.py search "lotus"

# Remove a card from the database
python src/db_utils.py remove "Black Lotus"

# Show database statistics
python src/db_utils.py stats
```

### Integration with Card Download

The `scryfall_card_download.py` script now checks the database before downloading cards, which provides several benefits:
- Prevents redundant downloads even if files are moved or renamed
- Tracks additional metadata about downloaded cards
- Provides a queryable interface to your card collection

## Testing

The project includes pytest-based tests to ensure functionality works as expected.

### Running Tests Locally

```bash
# Install pytest and project dependencies
pip install -e ".[dev]"

# Run all tests
pytest

# Run specific test file
pytest src/test_db.py

# Run with verbose output
pytest -v
```

### Continuous Integration

This project uses GitHub Actions to automatically run tests on push and pull requests. The workflow:

1. Runs tests on multiple Python versions (3.8 to 3.12)
2. Installs all dependencies
3. Executes the pytest suite
4. Uploads test results as artifacts

The GitHub workflow configuration is located in `.github/workflows/pytest.yml`.

## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for more details.
