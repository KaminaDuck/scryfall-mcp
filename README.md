# Scryfall MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/node.js-18.0+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/@kaminaduck/scryfall-mcp-server.svg)](https://www.npmjs.com/package/@kaminaduck/scryfall-mcp-server)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue.svg)](https://github.com/kaminaduck/scryfall-mcp)

A Model Context Protocol (MCP) server that provides access to the Scryfall API for Magic: The Gathering card data. This server enables AI assistants and other MCP clients to search for cards, retrieve card information, download high-resolution images, and access comprehensive MTG data through a standardized interface.

## Quick Setup for Claude Desktop

### Option 1: NPM Package (Recommended - Works on all platforms)

1. **Install globally**:
   ```bash
   # Linux/macOS/Windows
   npm install -g @kaminaduck/scryfall-mcp-server
   ```

2. **Add to Claude Desktop settings** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "scryfall-server": {
         "command": "scryfall-mcp-server",
         "env": {
           "MCP_SERVER_NAME": "scryfall-server",
           "MCP_ENABLE_FILE_DOWNLOADS": "true"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop** - the server should now be available!

### Option 2: From Source

1. **Clone and build**:
   ```bash
   git clone https://github.com/kaminaduck/scryfall-mcp.git
   cd scryfall-mcp
   npm install && npm run build
   ```

2. **Add to Claude Desktop settings** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "scryfall-server": {
         "command": "node",
         "args": ["/full/path/to/scryfall-mcp/dist/index.js"],
         "env": {
           "MCP_SERVER_NAME": "scryfall-server",
           "MCP_ENABLE_FILE_DOWNLOADS": "true"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop** - the server should now be available!

## Features

- **Card Search**: Search for Magic: The Gathering cards using Scryfall's powerful search syntax
- **Card Details**: Retrieve detailed information about specific cards including prices, legality, and metadata
- **Image Downloads**: Download high-resolution card images and art crops
- **Database Operations**: Manage local card databases with integrity verification
- **Set Information**: Access information about MTG sets and expansions
- **Artwork Access**: Get high-quality card artwork and images in multiple formats
- **Advanced Filtering**: Use Scryfall's advanced search operators for precise queries

## Installation

### Option 1: NPM Package (Recommended)

Install the package from npm:

```bash
npm install -g @kaminaduck/scryfall-mcp-server
```

Or run directly with npx:

```bash
npx @kaminaduck/scryfall-mcp-server
```

### Option 2: Install from Source

```bash
git clone https://github.com/kaminaduck/scryfall-mcp.git
cd scryfall-mcp
npm install
npm run build
```

**Important**: The build process creates an executable binary at `dist/index.js` and automatically sets execute permissions.

## Quick Start

### Running the Server

If installed globally:

```bash
scryfall-mcp-server
```

Using npx (no installation required):

```bash
npx @kaminaduck/scryfall-mcp-server
```

From source code (after building):

```bash
./dist/index.js
# or
node dist/index.js
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

### Claude Desktop Configuration

To use this MCP server with Claude Desktop, add the following to your Claude Desktop settings file.

#### Option 1: Global NPM Installation (Recommended)

If you installed the package globally with `npm install -g @kaminaduck/scryfall-mcp-server`:

```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "scryfall-mcp-server",
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

#### Option 2: Using NPX (No Installation Required)

**⚠️ Windows Users:** NPX may have environment variable expansion issues with Claude Desktop. If you encounter errors, use Option 1 (Global Installation) or Option 2b (Windows Wrapper) instead.

```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "npx",
      "args": ["@kaminaduck/scryfall-mcp-server"],
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

#### Option 2b: Using Windows Wrapper (Recommended for Windows)

For Windows users experiencing environment variable issues with NPX:

```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "scryfall-mcp-server-windows",
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

First install the package globally to get the wrapper:
```cmd
npm install -g @kaminaduck/scryfall-mcp-server
```

#### Option 3: From Source (Node.js)

If you built from source, use the absolute path to your built project:

```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "node",
      "args": ["/full/path/to/scryfall-mcp/dist/index.js"],
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

#### Option 4: From Source (Direct Binary)

```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "/full/path/to/scryfall-mcp/dist/index.js",
      "env": {
        "MCP_SERVER_NAME": "scryfall-server", 
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

**Important**: For source options, replace `/full/path/to/scryfall-mcp` with the actual path where you cloned the repository.

#### Claude Desktop Settings File Locations

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

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

## Troubleshooting

### Common Claude Desktop Issues

#### "Server transport closed unexpectedly"

This error typically occurs when:

1. **Binary is not executable**: Ensure the binary has execute permissions:
   ```bash
   chmod +x dist/index.js
   ```

2. **Incorrect path in configuration**: Verify the path in your Claude Desktop settings points to the correct location:
   ```bash
   # Check if the file exists and is executable
   ls -la /full/path/to/scryfall-mcp/dist/index.js
   ```

3. **Missing Node.js**: If using the direct binary option, ensure the shebang line can find Node.js:
   ```bash
   which node
   # Should return a path like /usr/bin/node or /usr/local/bin/node
   ```

#### Windows-Specific Issues

**Environment Variable Expansion Error with NPX**

If you see errors like:
```
npm error path C:\Users\Username\AppData\Local\AnthropicClaude\app-0.11.6\${APPDATA}
npm error enoent ENOENT: no such file or directory, lstat '...\${APPDATA}'
```

This occurs because Claude Desktop on Windows has trouble expanding environment variables when using npx. **Solutions in order of preference:**

**Solution 1: Use Global Installation (Recommended for Windows)**
```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "scryfall-mcp-server",
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

First install globally:
```cmd
npm install -g @kaminaduck/scryfall-mcp-server
```

**Solution 2: Use Node.js with Global Package Path**
```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "node",
      "args": ["%APPDATA%\\npm\\node_modules\\@kaminaduck\\scryfall-mcp-server\\dist\\index.js"],
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

Note: Replace `%APPDATA%` with your actual AppData path (usually `C:\\Users\\Username\\AppData\\Roaming`) if environment variable expansion doesn't work.

**Solution 3: Use Full Path NPX**
```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": ["@kaminaduck/scryfall-mcp-server"],
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

**Solution 4: Use PowerShell Wrapper**
```json
{
  "mcpServers": {
    "scryfall-server": {
      "command": "powershell",
      "args": ["-Command", "npx @kaminaduck/scryfall-mcp-server"],
      "env": {
        "MCP_SERVER_NAME": "scryfall-server",
        "MCP_ENABLE_FILE_DOWNLOADS": "true"
      }
    }
  }
}
```

#### "Command not found" or "Permission denied"

1. **For NPM installations**: Ensure the package is installed correctly:
   ```bash
   npm install -g @kaminaduck/scryfall-mcp-server
   which scryfall-mcp-server
   ```

2. **For NPX usage**: Try the full package name:
   ```json
   {
     "command": "npx",
     "args": ["@kaminaduck/scryfall-mcp-server"]
   }
   ```

3. **For source builds**: Use full absolute paths and verify the binary exists:
   ```bash
   ls -la /full/path/to/scryfall-mcp/dist/index.js
   ```

4. **Try the Node.js option** instead of direct binary execution:
   ```json
   {
     "command": "node",
     "args": ["/full/path/to/scryfall-mcp/dist/index.js"]
   }
   ```

#### "Module not found" errors

1. **Ensure all dependencies are installed**:
   ```bash
   cd /path/to/scryfall-mcp
   npm install
   ```

2. **Rebuild the project** if you pulled new changes:
   ```bash
   npm run build
   chmod +x dist/index.js
   ```

#### Circular Dependency Issues

If you encounter npm resolution errors related to circular dependencies:

1. **Check for self-references in package.json**:
   - The package should not depend on itself
   - Remove any entries like `"@kaminaduck/scryfall-mcp-server": "^1.0.x"` from dependencies

2. **Clear npm cache and reinstall**:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Use a fresh npm installation**:
   ```bash
   npm uninstall -g @kaminaduck/scryfall-mcp-server
   npm install -g @kaminaduck/scryfall-mcp-server
   ```

#### Enhanced ENOENT Error Troubleshooting

If you see detailed ENOENT errors with unresolved environment variables:

**Error Pattern:**
```
npm error path C:\Users\Username\AppData\Local\AnthropicClaude\app-0.11.6\${APPDATA}
npm error errno -4058
npm error enoent ENOENT: no such file or directory, lstat '...\${APPDATA}'
```

**Root Cause:** Claude Desktop on Windows is not expanding environment variables properly when using npx.

**Solutions:**

1. **Use global installation instead of npx** (most reliable):
   ```cmd
   npm install -g @kaminaduck/scryfall-mcp-server
   ```
   
   Then use this Claude Desktop configuration:
   ```json
   {
     "mcpServers": {
       "scryfall-server": {
         "command": "scryfall-mcp-server",
         "env": {
           "MCP_SERVER_NAME": "scryfall-server",
           "MCP_ENABLE_FILE_DOWNLOADS": "true"
         }
       }
     }
   }
   ```

2. **Set explicit environment variables** in Claude Desktop config:
   ```json
   {
     "mcpServers": {
       "scryfall-server": {
         "command": "scryfall-mcp-server",
         "env": {
           "MCP_SERVER_NAME": "scryfall-server",
           "MCP_ENABLE_FILE_DOWNLOADS": "true",
           "SCRYFALL_DATA_DIR": "C:\\Users\\%USERNAME%\\Documents\\scryfall_data"
         }
       }
     }
   }
   ```
   
   Replace `%USERNAME%` with your actual Windows username.

3. **Use PowerShell wrapper** to handle environment variable expansion:
   ```json
   {
     "mcpServers": {
       "scryfall-server": {
         "command": "powershell",
         "args": ["-Command", "npx @kaminaduck/scryfall-mcp-server"],
         "env": {
           "MCP_SERVER_NAME": "scryfall-server",
           "MCP_ENABLE_FILE_DOWNLOADS": "true"
         }
       }
     }
   }
   ```

#### Windows Directory Permissions and APPDATA Issues

**Setting up proper directory permissions on Windows:**

1. **Check directory permissions** for common paths:
   ```cmd
   icacls "%APPDATA%" /T /C
   icacls "%LOCALAPPDATA%" /T /C
   icacls "%USERPROFILE%\Documents" /T /C
   ```

2. **Grant full permissions** to your user account if needed:
   ```cmd
   icacls "%APPDATA%\scryfall_mcp" /grant "%USERNAME%:F" /T
   ```

3. **Create directories manually** if automatic creation fails:
   ```cmd
   mkdir "%APPDATA%\scryfall_mcp"
   mkdir "%USERPROFILE%\Documents\scryfall_data"
   ```

**Handling APPDATA path issues:**

1. **Verify APPDATA environment variable**:
   ```cmd
   echo %APPDATA%
   echo %LOCALAPPDATA%
   echo %USERPROFILE%
   ```
   
   These should return actual paths, not `${APPDATA}` literals.

2. **Manual path configuration** if environment variables fail:
   ```json
   {
     "mcpServers": {
       "scryfall-server": {
         "command": "scryfall-mcp-server",
         "env": {
           "MCP_SERVER_NAME": "scryfall-server",
           "MCP_ENABLE_FILE_DOWNLOADS": "true",
           "SCRYFALL_DATA_DIR": "C:\\Users\\[YourUsername]\\AppData\\Roaming\\scryfall_mcp"
         }
       }
     }
   }
   ```
   
   Replace `[YourUsername]` with your actual Windows username.

3. **Alternative storage locations** for Windows:
   ```json
   {
     "env": {
       "SCRYFALL_DATA_DIR": "C:\\ProgramData\\scryfall_mcp"
     }
   }
   ```
   
   Or use Documents folder:
   ```json
   {
     "env": {
       "SCRYFALL_DATA_DIR": "C:\\Users\\[YourUsername]\\Documents\\scryfall_data"
     }
   }
   ```

**Windows-specific antivirus considerations:**

- Some antivirus software may block npm package execution
- Add exclusions for:
  - `%APPDATA%\npm\`
  - `%LOCALAPPDATA%\npm\`
  - Your Node.js installation directory
  - The Claude Desktop application directory

#### "Storage directory" errors

1. **Set a custom storage directory** in your Claude Desktop configuration:
   ```json
   {
     "env": {
       "SCRYFALL_DATA_DIR": "/tmp/scryfall_downloads",
       "MCP_ENABLE_FILE_DOWNLOADS": "true"
     }
   }
   ```

2. **Ensure the directory is writable**:
   ```bash
   mkdir -p /tmp/scryfall_downloads
   chmod 755 /tmp/scryfall_downloads
   ```

## Windows Quick Setup Script

Windows users can use the provided setup script for automatic configuration:

```powershell
# Download and run setup
npm install -g @kaminaduck/scryfall-mcp-server
scryfall-mcp-server-windows --setup

# Or run setup manually after cloning
git clone https://github.com/kaminaduck/scryfall-mcp.git
cd scryfall-mcp
npm install
npm run setup:windows
```

The setup script will:
- Create necessary directories
- Set environment variables
- Test permissions
- Generate Claude Desktop configuration
- Provide troubleshooting information

See the [Windows Setup Guide](docs/WINDOWS_SETUP.md) for detailed Windows-specific configuration and troubleshooting.

**Quick Windows Fix:**
If you're experiencing `${APPDATA}` expansion errors:
1. Install globally: `npm install -g @kaminaduck/scryfall-mcp-server`
2. Use global command in Claude Desktop config: `"command": "scryfall-mcp-server"`

### Testing Your Configuration

Before adding the server to Claude Desktop, test it manually:

#### For NPM Installation:

**Linux/macOS:**
1. **Test global installation**:
   ```bash
   which scryfall-mcp-server
   # Should return a path to the binary
   ```

2. **Test server startup**:
   ```bash
   timeout 3s scryfall-mcp-server
   # Server should start silently (normal MCP behavior)
   ```

3. **Test with environment variables**:
   ```bash
   MCP_SERVER_NAME="scryfall-server" timeout 3s scryfall-mcp-server
   # Should detect MCP mode and validate storage
   ```

**Windows:**
1. **Test global installation**:
   ```cmd
   where scryfall-mcp-server
   REM Should return a path to the binary
   ```

2. **Test server startup**:
   ```cmd
   timeout /t 3 /nobreak && taskkill /f /im scryfall-mcp-server.exe 2>nul || scryfall-mcp-server
   REM Server should start silently (normal MCP behavior)
   ```

3. **Test with environment variables**:
   ```cmd
   set MCP_SERVER_NAME=scryfall-server && timeout /t 3 /nobreak && taskkill /f /im scryfall-mcp-server.exe 2>nul || scryfall-mcp-server
   REM Should detect MCP mode and validate storage
   ```

#### For NPX Usage:

**Linux/macOS:**
1. **Test npx execution**:
   ```bash
   timeout 3s npx @kaminaduck/scryfall-mcp-server
   # Should download and run the package
   ```

**Windows:**
1. **Test npx execution** (may fail due to environment issues):
   ```cmd
   timeout /t 3 /nobreak && taskkill /f /im node.exe 2>nul || npx @kaminaduck/scryfall-mcp-server
   REM May show environment variable expansion errors - this is expected
   ```

#### For Source Build:

1. **Test the binary directly**:
   ```bash
   cd /path/to/scryfall-mcp
   timeout 3s ./dist/index.js
   # Should start and show "Scryfall MCP server is running"
   ```

2. **Test with environment variables**:
   ```bash
   MCP_SERVER_NAME="scryfall-server" timeout 3s ./dist/index.js
   # Should detect MCP mode and validate storage
   ```

#### Universal MCP Protocol Test:

3. **Test a simple MCP request** (works with any method):
   ```bash
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | scryfall-mcp-server
   # Should return a JSON response with available tools
   ```

### Debugging Tips

1. **Check Claude Desktop logs** for specific error messages
2. **Use absolute paths** for all file references
3. **Test the server standalone** before configuring it with Claude Desktop
4. **Verify Node.js version** is 18.0 or higher: `node --version`
5. **Check file permissions** on the project directory and binary

### Getting Help

If you continue to experience issues:

1. **Verify your configuration** matches the examples exactly
2. **Check the logs** for specific error messages
3. **Test the server manually** using the commands above
4. **Open an issue** with your configuration and error messages

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

If you want to use this package programmatically as an ES module from the built source:

```javascript
import { scryfallClient } from './dist/scryfallClient.js';
import { downloadManager } from './dist/downloadManager.js';

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
