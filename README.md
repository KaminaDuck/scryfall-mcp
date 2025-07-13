# Scryfall MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node.js-18.0+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/scryfall-mcp-server.svg)](https://www.npmjs.com/package/scryfall-mcp-server)

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

Install the package from npm:

```bash
npm install -g scryfall-mcp-server
```

Or run directly with npx:

```bash
npx scryfall-mcp-server
```

Or install from source:

```bash
git clone https://github.com/kaminaduck/scryfall-mcp.git
cd scryfall-mcp
npm install
npm run build
```

## Quick Start

### Running the Server

Start the MCP server:

```bash
npx scryfall-mcp-server
```

Or if installed globally:

```bash
scryfall-mcp-server
```

For development:

```bash
npm run dev
```

### Basic Usage

The server provides several tools that can be used by MCP clients:

#### Search for Cards

```javascript
// Search for Lightning Bolt cards
const result = await mcpSearchCards("lightning bolt");

// Search for red creatures with converted mana cost 3
const result = await mcpSearchCards("t:creature c:red cmc:3");

// Search for cards in a specific set
const result = await mcpSearchCards("set:znr");
```

#### Download Card Images

```javascript
// Download a specific card image
const result = await mcpDownloadCard("Lightning Bolt");

// Download from a specific set
const result = await mcpDownloadCard("Lightning Bolt", "m10", "146");

// Force re-download
const result = await mcpDownloadCard("Lightning Bolt", undefined, undefined, true);
```

#### Download Art Crops

```javascript
// Download art crop for a card
const result = await mcpDownloadArtCrop("Lightning Bolt");

// Download art crop from specific printing
const result = await mcpDownloadArtCrop("Lightning Bolt", "m10", "146");
```

## Available Tools

### Search Tools

- **`mcp_search_cards(query)`**: Search for cards using Scryfall syntax
- **`mcp_get_card_artwork(card_id)`**: Get artwork URLs for a specific card

### Download Tools

- **`mcp_download_card(card_name, set_code?, collector_number?, force_download?)`**: Download high-resolution card images
  - Returns: `filepath`, `resource_uri` for accessing the downloaded image
- **`mcp_download_art_crop(card_name, set_code?, collector_number?, force_download?)`**: Download art crop images
  - Returns: `filepath`, `resource_uri` for the image, `metadata_uri` for JSON data

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

### Download Resources (NEW)

- **`resource://download/card/{file_id}`**: Access downloaded card images
- **`resource://download/art/{file_id}`**: Access downloaded art crop images
- **`resource://download/metadata/{file_id}`**: Access JSON metadata for downloaded cards

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

```javascript
// Find all red creatures with power 4 or greater from recent sets
await mcpSearchCards("t:creature c:red pow>=4 year>=2020");

// Find all planeswalkers that cost 3 mana
await mcpSearchCards("t:planeswalker cmc:3");

// Find all cards with "flying" and "vigilance"
await mcpSearchCards("o:flying o:vigilance");

// Find all legendary creatures that can be commanders
await mcpSearchCards("t:legendary t:creature is:commander");

// Find all cards illustrated by a specific artist
await mcpSearchCards("a:\"Rebecca Guay\"");
```

</details>

## Configuration

### File Storage

The server adapts its storage location based on the execution environment:

**MCP Mode** (when running as MCP server):
- Uses system temp directory or XDG cache directory
- Default: `/tmp/scryfall_downloads/` or `$XDG_CACHE_HOME/scryfall_mcp/`
- Configurable via `SCRYFALL_DATA_DIR` environment variable

**Standalone Mode** (when running scripts directly):
- Uses traditional home directory storage
- Card Images: `.local/scryfall_card_images/`
- Art Crops: `.local/scryfall_images/`
- Database: `.local/scryfall_database.db`

### Environment Variables

- **`SCRYFALL_DATA_DIR`**: Override the default storage directory
- **`MCP_ENABLE_FILE_DOWNLOADS`**: Enable file download functionality in MCP mode

### MCP Configuration (settings.json)

```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "npx",
      "args": ["scryfall-mcp-server"],
      "env": {
        "SCRYFALL_DATA_DIR": "/tmp/scryfall_downloads",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "scryfall-mcp-server",
      "env": {
        "SCRYFALL_DATA_DIR": "/tmp/scryfall_downloads",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

## Error Handling

All tools return structured responses with status indicators:

```typescript
interface ToolResponse {
  status: "success" | "error";
  message?: string;
  // Additional response data varies by tool
  [key: string]: any;
}
```

## Requirements

- Node.js 18.0+
- TypeScript 5.3+ (for development)
- @modelcontextprotocol/sdk >= 0.4.0

> **Note**: This package is distributed as an ES module. It requires Node.js 18+ with ES module support.

## Development

### Setting up Development Environment

```bash
git clone https://github.com/kaminaduck/scryfall-mcp.git
cd scryfall-mcp
npm install
```

### Building the Project

```bash
npm run build
```

### Running Tests

```bash
npm test
```

For watch mode:

```bash
npm run test:watch
```

### Code Quality

```bash
# Lint the code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Code Style

This project follows TypeScript and ESLint best practices with Prettier for consistent formatting. All code includes comprehensive JSDoc documentation.

### Project Configuration

This project uses ES modules (`"type": "module"` in package.json). Configuration files that must use CommonJS are named with `.cjs` extension:
- `.eslintrc.cjs` - ESLint configuration
- `jest.config.cjs` - Jest test configuration

The TypeScript configuration uses `NodeNext` module resolution for optimal ES module compatibility.

## API Reference

### Using as a Library

If you want to use this package programmatically as an ES module:

```javascript
import { scryfallClient } from 'scryfall-mcp-server/dist/scryfallClient.js';
import { downloadManager } from 'scryfall-mcp-server/dist/downloadManager.js';

// Search for cards
const cards = await scryfallClient.searchCards('lightning bolt');

// Download card images
const results = await downloadManager.downloadCardImages(['Lightning Bolt']);
```

### Tool Signatures

```typescript
async function mcpSearchCards(query: string): Promise<SearchResult>
async function mcpDownloadCard(
  cardName: string, 
  setCode?: string, 
  collectorNumber?: string, 
  forceDownload?: boolean
): Promise<DownloadResult>
async function mcpDownloadArtCrop(
  cardName: string, 
  setCode?: string,
  collectorNumber?: string,
  forceDownload?: boolean
): Promise<DownloadResult>
async function mcpGetCardArtwork(cardId: string): Promise<ArtworkResult>
async function mcpVerifyDatabase(): Promise<DatabaseResult>
async function mcpScanDirectory(directory: string, updateDb?: boolean): Promise<DatabaseResult>
async function mcpCleanDatabase(execute?: boolean): Promise<DatabaseResult>
async function mcpDatabaseReport(): Promise<DatabaseResult>
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
