# Scryfall MCP Server

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.7.3-blue.svg)

A Model Context Protocol (MCP) server that provides LLMs with access to the Scryfall API for Magic: The Gathering card data, image downloading, and metadata storage in a Neo4j graph database.

## Features

- 🔍 **Card Search**: Search MTG cards using Scryfall's powerful query syntax
- 🖼️ **Image Download**: Download and store card images in multiple variants
- 📊 **Graph Database**: Store card metadata and relationships in Neo4j
- 🚀 **MCP Integration**: Full Model Context Protocol support for LLM integration
- ⚡ **Rate Limiting**: Respect Scryfall's API rate limits automatically
- 🔄 **Caching**: Intelligent caching to avoid duplicate downloads
- 📈 **Analytics**: Database statistics and usage metrics

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Neo4j database (local or remote)
- npm or yarn package manager

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/scryfall-mcp.git
   cd scryfall-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Neo4j credentials
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

## Configuration

Create a `.env` file from the example template:

```env
# Neo4j Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here

# Image Storage Configuration
IMAGE_STORAGE_PATH=./images

# Scryfall API Configuration
SCRYFALL_RATE_LIMIT=10
SCRYFALL_REQUEST_DELAY=100

# Logging Configuration
LOG_LEVEL=info
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEO4J_URI` | Yes | `bolt://localhost:7687` | Neo4j connection URI |
| `NEO4J_USERNAME` | Yes | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | Yes | - | Neo4j password |
| `IMAGE_STORAGE_PATH` | No | `./images` | Directory for downloaded images |
| `SCRYFALL_RATE_LIMIT` | No | `10` | Requests per second limit |
| `SCRYFALL_REQUEST_DELAY` | No | `100` | Delay between requests (ms) |
| `LOG_LEVEL` | No | `info` | Logging level (debug, info, warn, error) |

## Usage

### MCP Tools

The server provides several tools for LLM integration:

#### search_cards
Search for Magic: The Gathering cards using Scryfall's query syntax.

```json
{
  "name": "search_cards",
  "arguments": {
    "query": "Black Lotus",
    "unique": "prints",
    "order": "released"
  }
}
```

#### download_card_image
Download and store card images locally with metadata tracking.

```json
{
  "name": "download_card_image",
  "arguments": {
    "cardId": "550c74d4-1fcb-406a-b02a-639a760a4380",
    "variant": "art_crop"
  }
}
```

#### list_downloaded_cards
List cards that have been downloaded and stored locally.

```json
{
  "name": "list_downloaded_cards",
  "arguments": {
    "set": "lea",
    "limit": 50
  }
}
```

### Image Variants

Available image variants for download:

- `small`: Small thumbnail (~146×204)
- `normal`: Standard size (~488×680)  
- `large`: Large size (~672×936)
- `png`: High-resolution PNG
- `art_crop`: Art only, cropped
- `border_crop`: Full card with border

### Search Query Examples

The server supports Scryfall's full search syntax:

```
# Basic searches
"Lightning Bolt"
"set:lea rarity:rare"
"cmc:0 t:artifact"

# Advanced searches  
"c:blue t:creature pow>=4"
"artist:\"Christopher Rush\""
"year:1993 reserved:true"
```

## Development

### Project Structure

```
src/
├── config/          # Configuration management
├── mcp/            # MCP server implementation
│   ├── server.ts   # Main MCP server
│   ├── tools.ts    # Tool definitions
│   └── resources.ts # Resource definitions
├── services/       # Core services
│   ├── scryfall-client.ts    # Scryfall API client
│   ├── image-downloader.ts   # Image download service
│   └── graph-service.ts      # Neo4j database service
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Application entry point
```

### Scripts

```bash
# Development
npm run dev          # Start with hot reload
npm run build        # Build TypeScript
npm run typecheck    # Type checking only

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

### Building from Source

1. **Clone and install:**
   ```bash
   git clone https://github.com/yourusername/scryfall-mcp.git
   cd scryfall-mcp
   npm install
   ```

2. **Set up Neo4j:**
   ```bash
   # Using Docker
   docker run -d \
     --name neo4j \
     -p 7474:7474 -p 7687:7687 \
     -e NEO4J_AUTH=neo4j/yourpassword \
     neo4j:latest
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

## API Documentation

### Tools

For detailed information about available tools and their parameters, see [API Usage Documentation](./docs/api-usage.md).

### Graph Schema

For information about the Neo4j graph database schema, see [Graph Schema Documentation](./docs/graph-schema.md).

### Resources

The server provides the following MCP resources:

- `card://[id]` - Individual card data
- `set://[code]` - Set information  
- `collection://downloaded` - Downloaded cards collection
- `collection://images` - Downloaded images collection
- `stats://database` - Database statistics

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- services/scryfall-client.test.ts
npm test -- mcp/tools.test.ts

# Generate coverage report
npm run test:coverage
```

### Test Structure

```
test/
├── services/       # Service layer tests
│   ├── scryfall-client.test.ts
│   └── graph-service.test.ts
└── mcp/           # MCP layer tests
    └── tools.test.ts
```

## Troubleshooting

### Common Issues

**Neo4j Connection Failed**
- Verify Neo4j is running on the specified port
- Check username/password in `.env` file
- Ensure Neo4j accepts connections from your host

**Image Download Failures**
- Check internet connectivity
- Verify Scryfall API is accessible
- Ensure sufficient disk space in image directory

**Rate Limiting Errors**
- The server automatically handles Scryfall's rate limits
- If you encounter persistent rate limiting, try reducing `SCRYFALL_RATE_LIMIT`

**Memory Issues with Large Images**
- PNG images can be very large (>10MB each)
- Monitor disk space usage
- Consider using smaller variants for bulk operations

### Performance Optimization

1. **Use appropriate image variants** for your use case
2. **Configure Neo4j memory settings** for your dataset size
3. **Monitor database performance** using the `get_database_stats` tool
4. **Use batch operations** when downloading multiple images
5. **Regular maintenance** of the Neo4j database

### Logging

Adjust log levels in your `.env` file:

```env
LOG_LEVEL=debug  # For detailed debugging
LOG_LEVEL=info   # For standard operation
LOG_LEVEL=warn   # For warnings only
LOG_LEVEL=error  # For errors only
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Run linting (`npm run lint`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint configuration provided
- Write tests for new features
- Update documentation as needed

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Scryfall](https://scryfall.com/) for providing the excellent MTG API
- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP specification
- [Neo4j](https://neo4j.com/) for the graph database technology
- The Magic: The Gathering community for inspiration

## Links

- [Scryfall API Documentation](https://scryfall.com/docs/api)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)