# Scryfall Card Art Downloader

This project provides two Python scripts to download card data from Scryfall and then download art crops for those cards.

## Scripts

### `json_download.py`

This script downloads the latest Scryfall Default Cards JSON file and saves it to the `.json` folder as `default-cards.json`.

**Functionality:**

- Fetches the dynamic download URL for the 'Default Cards' bulk data from the Scryfall API.
- Downloads the JSON data and saves it to `.json/default-cards.json`.
- Handles HTTP request errors and JSON decoding errors.

**Usage:**

1. Ensure you have `httpx` installed:
   ```bash
   pip install httpx
   ```
2. Run the script:
   ```bash
   python src/json_download.py
   ```

After running, you will find the `default-cards.json` file in the `.json` directory.

### `scryfall_art.py`

This script reads a JSON file (like the one downloaded by `json_download.py`) and downloads art crop images for each card. The images are saved into a folder structure based on the set name.

**Functionality:**

- Reads card data from a provided JSON file.
- For each card, it retrieves the `art_crop` image URL from the Scryfall data.
- Creates a folder structure `scryfall_images/{set_name}` to organize images by set.
- Downloads and saves art crop images as `scryfall_images/{set_name}/{card_name}.{extension}`.
- Includes error handling for download failures and rate limiting (200ms delay between requests).

**Usage:**

1. Ensure you have `httpx` and `argparse` installed:
   ```bash
   pip install httpx argparse
   ```
2. Run the script, providing the path to your JSON file:
   ```bash
   python src/scryfall_art.py path/to/your/cards.json
   ```
   For example, if you used `json_download.py`, you would run:
   ```bash
   python src/scryfall_art.py .json/default-cards.json
   ```

Images will be downloaded and saved in the `scryfall_images` folder.

## Dependencies

- [httpx](https://www.python-httpx.org/): For making HTTP requests to the Scryfall API.
- [argparse](https://docs.python.org/3/library/argparse.html): For parsing command-line arguments in `scryfall_art.py`.
- [os](https://docs.python.org/3/library/os.html): For interacting with the operating system, like creating directories.
- [json](https://docs.python.org/3/library/json.html): For working with JSON data.
- [time](https://docs.python.org/3/library/time.html): For implementing delays between requests to avoid rate limiting.

## Output

- **`.json/default-cards.json`**:  Output of `json_download.py`, containing the Scryfall Default Cards JSON data.
- **`scryfall_images/`**: Output folder for `scryfall_art.py`. Contains subfolders for each card set, and within those, the downloaded art crop images.

## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for more details.
