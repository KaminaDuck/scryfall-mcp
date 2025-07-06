# Scryfall Desktop Extension (DXT)

A Desktop Extension for integrating Scryfall API functionality into your MCP-compatible applications. Search, download, and manage Magic: The Gathering card data with ease.

## Features

- **Card Search**: Search for Magic cards using Scryfall's powerful search syntax
- **Image Downloads**: Download card images and art crops with intelligent caching
- **Local Database**: Maintain a local SQLite database of downloaded cards
- **Batch Operations**: Download multiple cards at once
- **Artwork Management**: Access and manage card artwork with various image formats
- **Database Tools**: Verify integrity, clean orphaned records, and generate reports

## Installation

### Option 1: Install from Release

1. Download the latest `scryfall-dxt.zip` from the releases page
2. In your MCP-compatible application (e.g., Claude Desktop), install the extension
3. The extension will be automatically configured and ready to use

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/scryfall-mcp.git
cd scryfall-mcp

# Install dependencies
npm install

# Build the extension
npm run build

# Package as DXT
npm run package
```

This creates `scryfall-dxt.zip` which can be installed in any MCP-compatible application.

## Configuration

The extension can be configured through your application's settings. Available options:

- **Rate Limit Delay**: Delay between API requests (50-1000ms, default: 100ms)
- **Max Concurrent Downloads**: Number of simultaneous downloads (1-10, default: 3)
- **Card Images Directory**: Where to store card images
- **Art Crops Directory**: Where to store art crop images
- **Database Path**: Location of the SQLite database
- **Verbose Logging**: Enable detailed logging for debugging

Default directories:
- Card Images: `~/.scryfall_mcp/card-images/`
- Art Crops: `~/.scryfall_mcp/art-crops/`
- Database: `~/.scryfall_mcp/scryfall.db`

## Available Tools

### Search & Information
- `mcp_search_cards`: Search for cards using Scryfall's search syntax
- `mcp_get_card_artwork`: Get artwork URLs by card ID
- `mcp_get_card_artwork_by_name`: Get artwork URLs by card name
- `mcp_get_random_card_artwork`: Get a random card's artwork
- `mcp_get_card_image_urls`: Get all image URLs for a card

### Download Operations
- `mcp_download_card`: Download a single card image
- `mcp_download_art_crop`: Download a card's art crop
- `mcp_batch_download`: Download multiple card images
- `mcp_batch_download_art_crops`: Download multiple art crops

### Database Management
- `mcp_verify_database`: Check database integrity
- `mcp_scan_directory`: Scan for new images
- `mcp_clean_database`: Remove orphaned records
- `mcp_database_report`: Generate comprehensive report
- `mcp_get_card_info`: Get card info from local database
- `mcp_search_database`: Search local database
- `mcp_remove_card`: Remove card from database
- `mcp_get_database_stats`: Get database statistics

## Usage Examples

### Search for Cards
```
Search for red dragons:
mcp_search_cards query:"type:dragon color:red"

Search for cards by name:
mcp_search_cards query:"Lightning Bolt"
```

### Download Cards
```
Download a specific card:
mcp_download_card card_name:"Lightning Bolt" set_code:"lea"

Download art crop:
mcp_download_art_crop card_name:"Black Lotus"

Batch download:
mcp_batch_download card_names:["Lightning Bolt", "Counterspell", "Dark Ritual"]
```

### Database Operations
```
Scan for new images:
mcp_scan_directory

Get database statistics:
mcp_get_database_stats

Search local database:
mcp_search_database query:"dragon"
```

## Prompts

The extension includes predefined prompts for common workflows:

1. **search_and_download**: Search for cards and download their images
   - Parameters: `query` (required), `limit` (optional)

2. **database_maintenance**: Perform database maintenance tasks
   - No parameters required

## Security

- The extension runs locally and only accesses the Scryfall API
- No authentication required (Scryfall API is public)
- All data is stored locally on your machine
- Network requests are limited to Scryfall's API endpoints

## Development

### Project Structure
```
scryfall-mcp/
├── manifest.json       # DXT manifest
├── src/               # TypeScript source code
│   ├── index.ts       # Entry point
│   ├── server.ts      # MCP server implementation
│   ├── config.ts      # Configuration
│   ├── lib/           # Core libraries
│   ├── tools/         # Tool implementations
│   └── resources/     # Resource handlers
├── dist/              # Compiled JavaScript
└── tests/             # Test files
```

### Building

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

### Testing the Extension

1. Build the extension: `npm run build`
2. Run in development mode: `npm run dev`
3. Test with MCP client or install in Claude Desktop

## Troubleshooting

### Common Issues

1. **Rate Limiting**: If you get rate limit errors, increase the rate limit delay in settings
2. **Storage Space**: Ensure you have enough disk space for downloading images
3. **Database Errors**: Run `mcp_verify_database` to check integrity

### Debug Mode

Enable verbose logging in the extension settings to see detailed operation logs.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Scryfall](https://scryfall.com) for their excellent API
- [Model Context Protocol](https://modelcontextprotocol.io) team
- Magic: The Gathering is © Wizards of the Coast