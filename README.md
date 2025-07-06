# Scryfall MCP Server

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

A Model Context Protocol (MCP) server that provides access to the Scryfall API for Magic: The Gathering card data. This server enables AI assistants and other MCP clients to search for cards, retrieve card information, download high-resolution images, and access comprehensive MTG data through a standardized interface.

Built with Node.js and TypeScript for modern performance and type safety.

## Features

- **Card Search**: Search for Magic: The Gathering cards using Scryfall's powerful search syntax
- **Card Details**: Retrieve detailed information about specific cards including prices, legality, and metadata
- **Image Downloads**: Download high-resolution card images and art crops with batch support
- **Database Operations**: Manage local SQLite card databases with integrity verification
- **Set Information**: Access information about MTG sets and expansions
- **Artwork Access**: Get high-quality card artwork and images in multiple formats
- **Advanced Filtering**: Use Scryfall's advanced search operators for precise queries
- **CLI Tools**: Command-line utilities for database management and card operations
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions

## Installation

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Install globally (optional):

```bash
npm install -g .
```

## Quick Start

### Running the Server

Start the MCP server:

```bash
npm start
```

Or in development mode:

```bash
npm run dev
```

### CLI Usage

The package includes comprehensive CLI tools:

```bash
# Initialize database
scryfall-mcp db init

# Search for cards
scryfall-mcp search cards "lightning bolt"

# Download cards interactively
scryfall-mcp search download "t:creature c:red"

# Database operations
scryfall-mcp bulk verify
scryfall-mcp bulk report
```

### Basic Usage

The server provides several tools that can be used by MCP clients:

#### Search for Cards

```javascript
// Search for Lightning Bolt cards
result = await mcp_search_cards("lightning bolt")

// Search for red creatures with converted mana cost 3
result = await mcp_search_cards("t:creature c:red cmc:3")

// Search for cards in a specific set
result = await mcp_search_cards("set:znr")
```

#### Download Card Images

```javascript
// Download a specific card image
result = await mcp_download_card("Lightning Bolt")

// Download from a specific set
result = await mcp_download_card("Lightning Bolt", "m10", "146")

// Force re-download
result = await mcp_download_card("Lightning Bolt", undefined, undefined, true)
```

#### Download Art Crops

```javascript
// Download art crop for a card
result = await mcp_download_art_crop("Lightning Bolt")

// Download art crop from specific printing
result = await mcp_download_art_crop("Lightning Bolt", "m10", "146")
```

#### Batch Operations

```javascript
// Download multiple cards
result = await mcp_batch_download(["Lightning Bolt", "Counterspell", "Giant Growth"])

// Download art crops for multiple cards
result = await mcp_batch_download_art_crops(["Lightning Bolt", "Counterspell"])
```

## Available Tools

### Search Tools

- **`mcp_search_cards(query)`**: Search for cards using Scryfall syntax
- **`mcp_get_card_artwork(card_id)`**: Get artwork URLs for a specific card
- **`mcp_get_card_artwork_by_name(card_name, set_code?)`**: Get artwork URLs by card name
- **`mcp_get_random_card_artwork()`**: Get artwork for a random card
- **`mcp_get_card_image_urls(card_id)`**: Get all image URLs for a card

### Download Tools

- **`mcp_download_card(card_name, set_code?, collector_number?, force?)`**: Download high-resolution card images
- **`mcp_download_art_crop(card_name, set_code?, collector_number?, force?)`**: Download art crop images
- **`mcp_batch_download(card_names, set_code?, force?)`**: Download multiple card images
- **`mcp_batch_download_art_crops(card_names, set_code?, force?)`**: Download multiple art crops

### Database Tools

- **`mcp_verify_database()`**: Verify database integrity and check for missing files
- **`mcp_scan_directory()`**: Scan directories for image files and add to database
- **`mcp_clean_database()`**: Clean database of missing file references
- **`mcp_database_report()`**: Generate comprehensive database report
- **`mcp_get_card_info(card_name, set_code?)`**: Get card info from local database
- **`mcp_search_database(query)`**: Search local database for cards
- **`mcp_remove_card(card_name, set_code?)`**: Remove card from database
- **`mcp_get_database_stats()`**: Get database statistics

## Available Resources

### Card Resources

- **`scryfall://cards/by-id/{card_id}`**: Get detailed card information by Scryfall ID
- **`scryfall://cards/by-name/{card_name}`**: Get detailed card information by name
- **`scryfall://cards/by-set/{set_code}/{collector_number}`**: Get card by set and number
- **`scryfall://cards/random`**: Get a random Magic: The Gathering card
- **`scryfall://cards/search?q={query}`**: Search for cards
- **`scryfall://cards/autocomplete?q={query}`**: Get card name suggestions
- **`scryfall://cards/{card_id}/prints`**: Get all printings of a card
- **`scryfall://cards/{card_id}/rulings`**: Get rulings for a card

### Database Resources

- **`database://stats`**: Get database statistics and information
- **`database://report`**: Get comprehensive database report
- **`database://cards/by-name/{card_name}`**: Get card info from local database
- **`database://cards/search?q={query}`**: Search local database for cards
- **`database://cards/by-set/{set_code}`**: Get all cards in a set from database
- **`database://cards/all`**: Get all cards from local database

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

```javascript
// Find all red creatures with power 4 or greater from recent sets
await mcp_search_cards("t:creature c:red pow>=4 year>=2020")

// Find all planeswalkers that cost 3 mana
await mcp_search_cards("t:planeswalker cmc:3")

// Find all cards with "flying" and "vigilance"
await mcp_search_cards("o:flying o:vigilance")

// Find all legendary creatures that can be commanders
await mcp_search_cards("t:legendary t:creature is:commander")

// Find all cards illustrated by a specific artist
await mcp_search_cards("a:\"Rebecca Guay\"")
```

</details>

## Configuration

The server uses the following default directories:

- **Card Images**: `~/.scryfall_mcp/card_images/`
- **Art Crops**: `~/.local/scryfall_images/`
- **Database**: `~/.local/scryfall_db.sqlite`

Configuration can be customized by modifying the `CONFIG` object in `src/config.ts`.

## Error Handling

All tools return structured responses with status indicators:

```typescript
{
    "status": "success" | "error",
    "message": "Description of result or error",
    "data": {...}  // Additional response data
}
```

## Requirements

- Node.js 18.0+
- TypeScript 5.3+
- SQLite3 (via better-sqlite3)

## Development

### Setting up Development Environment

```bash
git clone https://github.com/kaminaduck/scryfall-mcp.git
cd scryfall-mcp
npm install
```

### Running Tests

```bash
npm test
```

### Code Style

```bash
npm run lint
npm run typecheck
```

This project follows TypeScript best practices and includes comprehensive type definitions throughout the codebase.

## API Reference

### Tool Signatures

```typescript
function mcp_search_cards(query: string): Promise<ToolResponse>
function mcp_download_card(
  card_name: string, 
  set_code?: string, 
  collector_number?: string, 
  force?: boolean
): Promise<ToolResponse>
function mcp_download_art_crop(
  card_name: string, 
  set_code?: string, 
  collector_number?: string, 
  force?: boolean
): Promise<ToolResponse>
function mcp_batch_download(
  card_names: string[], 
  set_code?: string, 
  force?: boolean
): Promise<ToolResponse>
function mcp_get_card_artwork(card_id: string): Promise<ToolResponse>
function mcp_verify_database(): Promise<ToolResponse>
function mcp_scan_directory(): Promise<ToolResponse>
function mcp_clean_database(): Promise<ToolResponse>
function mcp_database_report(): Promise<ToolResponse>
```

### CLI Commands

```bash
# Database operations
scryfall-mcp db init                    # Initialize database
scryfall-mcp db list [--set <code>]     # List cards in database
scryfall-mcp db search <query>          # Search database
scryfall-mcp db stats                   # Show database statistics
scryfall-mcp db info <card_name>        # Get card information

# Bulk operations  
scryfall-mcp bulk verify [--verbose]    # Verify database integrity
scryfall-mcp bulk scan [--verbose]      # Scan directories for images
scryfall-mcp bulk clean [--yes]         # Clean missing records
scryfall-mcp bulk report [--verbose]    # Generate comprehensive report

# Search and download
scryfall-mcp search cards <query>       # Search for cards
scryfall-mcp search download <query>    # Interactive download
scryfall-mcp search random [--download] # Get random card
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Migration from Python Version

If you're upgrading from the Python version of this MCP server:

1. **Database Compatibility**: The SQLite database schema is fully compatible. Your existing card downloads and database will work without changes.

2. **Configuration**: Update paths in your MCP client configuration to point to the new Node.js binary.

3. **Performance**: The Node.js version provides better performance for concurrent operations and native fetch support.

4. **New Features**: Take advantage of new batch download capabilities and enhanced CLI tools.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

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
