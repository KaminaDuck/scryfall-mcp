# Scryfall MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![PyPI](https://img.shields.io/pypi/v/scryfall-mcp.svg)](https://pypi.org/project/scryfall-mcp/)

A Model Context Protocol (MCP) server that provides access to the Scryfall API for Magic: The Gathering card data. This server enables AI assistants and other MCP clients to search for cards, retrieve card information, download high-resolution images, and access comprehensive MTG data through a standardized interface.

## Features

- **Card Search**: Search for Magic: The Gathering cards using Scryfall's powerful search syntax
- **Card Details**: Retrieve detailed information about specific cards including prices, legality, and metadata
- **Image Downloads**: Download high-resolution card images and art crops
- **Database Operations**: Manage local card databases with integrity verification
- **Set Information**: Access information about MTG sets and expansions
- **Artwork Access**: Get high-quality card artwork and images in multiple formats
- **Advanced Filtering**: Use Scryfall's advanced search operators for precise queries

## Installation

Install the package from PyPI:

```bash
pip install scryfall-mcp
```

Or install from source:

```bash
git clone https://github.com/kaminaduck/scryfall-mcp.git
cd scryfall-mcp
pip install -e .
```

## Quick Start

### Running the Server

Start the MCP server:

```bash
python -m mcp
```

Or run directly:

```python
from scryfall_mcp import main
main()
```

### Basic Usage

The server provides several tools that can be used by MCP clients:

#### Search for Cards

```python
# Search for Lightning Bolt cards
result = mcp_search_cards("lightning bolt")

# Search for red creatures with converted mana cost 3
result = mcp_search_cards("t:creature c:red cmc:3")

# Search for cards in a specific set
result = mcp_search_cards("set:znr")
```

#### Download Card Images

```python
# Download a specific card image
result = mcp_download_card("Lightning Bolt")

# Download from a specific set
result = mcp_download_card("Lightning Bolt", set_code="m10", collector_number="146")

# Force re-download
result = mcp_download_card("Lightning Bolt", force_download=True)
```

#### Download Art Crops

```python
# Download art crop for a card
result = mcp_download_art_crop("Lightning Bolt")

# Download art crop from specific printing
result = mcp_download_art_crop("Lightning Bolt", set_code="m10", collector_number="146")
```

## Available Tools

### Search Tools

- **`mcp_search_cards(query)`**: Search for cards using Scryfall syntax
- **`mcp_get_card_artwork(card_id)`**: Get artwork URLs for a specific card

### Download Tools

- **`mcp_download_card(card_name, set_code?, collector_number?, force_download?)`**: Download high-resolution card images
- **`mcp_download_art_crop(card_name, set_code?, collector_number?, force_download?)`**: Download art crop images

### Database Tools

- **`mcp_verify_database()`**: Verify database integrity
- **`mcp_scan_directory(directory, update_db?)`**: Scan directories for image files
- **`mcp_clean_database(execute?)`**: Clean database of missing file references
- **`mcp_database_report()`**: Generate comprehensive database report

## Available Resources

### Card Resources

- **`resource://card/{card_id}`**: Get detailed card information by Scryfall ID
- **`resource://card/name/{card_name}`**: Get detailed card information by name
- **`resource://random_card`**: Get a random Magic: The Gathering card

### Database Resources

- **`resource://database/stats`**: Get database statistics and information

## Search Syntax

The server supports Scryfall's powerful search syntax. Here are some examples:

| Query | Description |
|-------|-------------|
| `lightning bolt` | Cards with "lightning bolt" in the name |
| `t:creature` | All creature cards |
| `c:red` | All red cards |
| `cmc:3` | Cards with converted mana cost 3 |
| `set:znr` | Cards from Zendikar Rising |
| `r:mythic` | Mythic rare cards |
| `pow>=4` | Creatures with power 4 or greater |
| `o:"draw a card"` | Cards with "draw a card" in rules text |
| `is:commander` | Cards that can be commanders |
| `year:2023` | Cards printed in 2023 |

<details>
<summary>Advanced Search Examples</summary>

```python
# Find all red creatures with power 4 or greater from recent sets
mcp_search_cards("t:creature c:red pow>=4 year>=2020")

# Find all planeswalkers that cost 3 mana
mcp_search_cards("t:planeswalker cmc:3")

# Find all cards with "flying" and "vigilance"
mcp_search_cards("o:flying o:vigilance")

# Find all legendary creatures that can be commanders
mcp_search_cards("t:legendary t:creature is:commander")

# Find all cards illustrated by a specific artist
mcp_search_cards("a:\"Rebecca Guay\"")
```

</details>

## Configuration

The server uses the following default directories:

- **Card Images**: `.local/scryfall_card_images/`
- **Art Crops**: `.local/scryfall_images/`
- **Database**: Local SQLite database for tracking downloads

## Error Handling

All tools return structured responses with status indicators:

```python
{
    "status": "success" | "error",
    "message": "Description of result or error",
    "data": {...}  # Additional response data
}
```

## Requirements

- Python 3.12+
- httpx >= 0.28.1
- mcp[cli] >= 1.8.0

## Development

### Setting up Development Environment

```bash
git clone https://github.com/kaminaduck/scryfall-mcp.git
cd scryfall-mcp
pip install -e ".[dev]"
```

### Running Tests

```bash
pytest
```

### Code Style

This project follows PEP 8 style guidelines and includes comprehensive docstrings following the project's documentation standards.

## API Reference

### Tool Signatures

```python
def mcp_search_cards(query: str) -> Dict[str, Any]
def mcp_download_card(card_name: str, set_code: Optional[str] = None, 
                     collector_number: Optional[str] = None, 
                     force_download: bool = False) -> Dict[str, Any]
def mcp_download_art_crop(card_name: str, set_code: Optional[str] = None,
                         collector_number: Optional[str] = None,
                         force_download: bool = False) -> Dict[str, Any]
def mcp_get_card_artwork(card_id: str) -> Dict[str, Any]
def mcp_verify_database() -> Dict[str, Any]
def mcp_scan_directory(directory: str, update_db: bool = False) -> Dict[str, Any]
def mcp_clean_database(execute: bool = False) -> Dict[str, Any]
def mcp_database_report() -> Dict[str, Any]
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Scryfall](https://scryfall.com/) for providing the comprehensive Magic: The Gathering API
- [Model Context Protocol](https://modelcontextprotocol.io/) for the standardized interface
- The Magic: The Gathering community for their continued support

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/kaminaduck/scryfall-mcp/issues) page
2. Create a new issue with detailed information about your problem
3. Include relevant error messages and system information

---

**Note**: This is an unofficial tool and is not affiliated with Wizards of the Coast or Scryfall. Magic: The Gathering is a trademark of Wizards of the Coast LLC.
