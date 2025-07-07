# Scryfall MCP Server API Usage

This document provides comprehensive usage examples for the Scryfall MCP server tools and resources.

## Available Tools

### 1. search_cards

Search for Magic: The Gathering cards using the Scryfall API.

**Input Parameters:**
- `query` (required): Search query string
- `unique` (optional): Uniqueness method (`cards`, `art`, `prints`)
- `order` (optional): Sort order (`name`, `set`, `released`, `rarity`, etc.)
- `dir` (optional): Sort direction (`auto`, `asc`, `desc`)
- `includeExtras` (optional): Include extra cards like tokens
- `page` (optional): Page number for pagination

**Example Usage:**
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

**Advanced Search Examples:**
```json
// Search by mana cost
{
  "name": "search_cards",
  "arguments": {
    "query": "cmc:0 t:artifact",
    "order": "name"
  }
}

// Search by set
{
  "name": "search_cards",
  "arguments": {
    "query": "set:lea rarity:rare",
    "order": "cmc"
  }
}

// Search by color
{
  "name": "search_cards",
  "arguments": {
    "query": "c:blue t:creature pow>=4",
    "order": "power"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_cards": 1,
    "has_more": false,
    "next_page": null,
    "cards": [
      {
        "id": "550c74d4-1fcb-406a-b02a-639a760a4380",
        "name": "Black Lotus",
        "set": "lea",
        "set_name": "Limited Edition Alpha",
        "collector_number": "232",
        "mana_cost": "",
        "cmc": 0,
        "type_line": "Artifact",
        "oracle_text": "{T}, Sacrifice Black Lotus: Add three mana of any one color.",
        "rarity": "rare",
        "artist": "Christopher Rush",
        "scryfall_uri": "https://scryfall.com/card/lea/232/black-lotus",
        "image_uris": {
          "small": "https://cards.scryfall.io/small/front/5/5/0.jpg",
          "normal": "https://cards.scryfall.io/normal/front/5/5/0.jpg",
          "large": "https://cards.scryfall.io/large/front/5/5/0.jpg",
          "art_crop": "https://cards.scryfall.io/art_crop/front/5/5/0.jpg"
        },
        "legalities": {
          "vintage": "restricted",
          "legacy": "banned"
        },
        "prices": {
          "usd": "25000.00"
        }
      }
    ]
  }
}
```

### 2. download_card_image

Download and store a card image locally with metadata tracking.

**Input Parameters:**
- `cardId` (required): Scryfall UUID of the card
- `variant` (optional, default: "large"): Image variant to download
- `face` (optional): For double-faced cards (`front`, `back`)

**Available Variants:**
- `small`: Small thumbnail (~146×204)
- `normal`: Standard size (~488×680)
- `large`: Large size (~672×936)
- `png`: High-resolution PNG
- `art_crop`: Art only, cropped
- `border_crop`: Full card with border

**Example Usage:**
```json
{
  "name": "download_card_image",
  "arguments": {
    "cardId": "550c74d4-1fcb-406a-b02a-639a760a4380",
    "variant": "art_crop"
  }
}
```

**Double-Faced Card Example:**
```json
{
  "name": "download_card_image",
  "arguments": {
    "cardId": "f2b9983e-20d4-4d12-9e2c-24b28d7f8979",
    "variant": "large",
    "face": "front"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "card_id": "550c74d4-1fcb-406a-b02a-639a760a4380",
    "card_name": "Black Lotus",
    "set": "lea",
    "collector_number": "232",
    "variant": "art_crop",
    "file_path": "/images/lea/232-Black_Lotus-art_crop.jpg",
    "file_size": 87432,
    "checksum": "a1b2c3d4e5f6...",
    "message": "Downloaded art_crop image for Black Lotus"
  }
}
```

### 3. get_card_details

Get detailed information about a specific card.

**Input Parameters:**
- `identifier` (required): Card identifier object with one of:
  - `{ "id": "uuid" }`: By Scryfall ID
  - `{ "name": "Card Name" }`: By exact name
  - `{ "name": "Card Name", "set": "code" }`: By name and set
  - `{ "collectorNumber": "123", "set": "code" }`: By collector number and set

**Examples:**
```json
// By Scryfall ID
{
  "name": "get_card_details",
  "arguments": {
    "identifier": {
      "id": "550c74d4-1fcb-406a-b02a-639a760a4380"
    }
  }
}

// By name and set
{
  "name": "get_card_details",
  "arguments": {
    "identifier": {
      "name": "Lightning Bolt",
      "set": "lea"
    }
  }
}

// By collector number
{
  "name": "get_card_details",
  "arguments": {
    "identifier": {
      "collectorNumber": "161",
      "set": "lea"
    }
  }
}
```

### 4. list_downloaded_cards

List cards that have been downloaded and stored locally.

**Input Parameters:**
- `set` (optional): Filter by set code
- `name` (optional): Filter by card name (partial match)
- `hasVariant` (optional): Filter by available image variant
- `limit` (optional, default: 20): Maximum results
- `offset` (optional, default: 0): Results to skip

**Examples:**
```json
// List all downloaded cards
{
  "name": "list_downloaded_cards",
  "arguments": {}
}

// Filter by set
{
  "name": "list_downloaded_cards",
  "arguments": {
    "set": "lea",
    "limit": 50
  }
}

// Cards with art crop images
{
  "name": "list_downloaded_cards",
  "arguments": {
    "hasVariant": "art_crop"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_results": 5,
    "cards": [
      {
        "id": "550c74d4-1fcb-406a-b02a-639a760a4380",
        "name": "Black Lotus",
        "set": "lea",
        "set_name": "Limited Edition Alpha",
        "collector_number": "232",
        "rarity": "rare",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "images": [
          {
            "variant": "large",
            "file_path": "/images/lea/232-Black_Lotus-large.jpg",
            "file_size": 234567,
            "checksum": "a1b2c3...",
            "format": "jpg",
            "downloaded_at": "2024-01-15T10:30:00Z"
          },
          {
            "variant": "art_crop",
            "file_path": "/images/lea/232-Black_Lotus-art_crop.jpg",
            "file_size": 87432,
            "checksum": "d4e5f6...",
            "format": "jpg",
            "downloaded_at": "2024-01-15T10:35:00Z"
          }
        ]
      }
    ]
  }
}
```

### 5. get_random_card

Get a random Magic: The Gathering card.

**Input Parameters:** None

**Example:**
```json
{
  "name": "get_random_card",
  "arguments": {}
}
```

### 6. autocomplete_card_name

Get autocomplete suggestions for card names.

**Input Parameters:**
- `query` (required): Partial card name

**Example:**
```json
{
  "name": "autocomplete_card_name",
  "arguments": {
    "query": "lightning"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "lightning",
    "suggestions": [
      "Lightning Bolt",
      "Lightning Strike",
      "Lightning Helix",
      "Chain Lightning"
    ]
  }
}
```

### 7. get_database_stats

Get statistics about the local card database.

**Input Parameters:** None

**Example:**
```json
{
  "name": "get_database_stats",
  "arguments": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCards": 150,
    "totalImages": 275,
    "totalSets": 8,
    "imagesByVariant": {
      "large": 120,
      "art_crop": 85,
      "normal": 45,
      "png": 25
    },
    "cardsBySet": {
      "lea": 45,
      "leb": 40,
      "m21": 35,
      "khm": 30
    }
  }
}
```

## Available Resources

Resources provide read-only access to data through URI-based requests.

### 1. card://[id]

Access individual card data by Scryfall ID.

**Example URI:** `card://550c74d4-1fcb-406a-b02a-639a760a4380`

**Response:**
```json
{
  "source": "local",
  "card": {
    "id": "550c74d4-1fcb-406a-b02a-639a760a4380",
    "name": "Black Lotus",
    "set": "lea",
    "mana_cost": "",
    "type_line": "Artifact",
    "oracle_text": "{T}, Sacrifice Black Lotus: Add three mana of any one color."
  },
  "images": [
    {
      "variant": "large",
      "file_path": "/images/lea/232-Black_Lotus-large.jpg",
      "file_size": 234567
    }
  ]
}
```

### 2. set://[code]

Access set information and cards by set code.

**Example URI:** `set://lea`

### 3. collection://downloaded

Access the collection of all downloaded cards.

**Example URI:** `collection://downloaded`

### 4. collection://images

Access the collection of all downloaded images.

**Example URI:** `collection://images`

### 5. stats://database

Access database statistics and metrics.

**Example URI:** `stats://database`

## Error Handling

All tools return responses in a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "context": {
    "additional": "debugging information"
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR`: Invalid input parameters
- `SCRYFALL_API_ERROR`: Scryfall API request failed
- `DATABASE_ERROR`: Database operation failed
- `IMAGE_DOWNLOAD_ERROR`: Image download failed
- `CONFIGURATION_ERROR`: Server configuration issue

## Usage Patterns

### Bulk Card Processing
```json
// 1. Search for cards
{
  "name": "search_cards",
  "arguments": {
    "query": "set:lea rarity:rare",
    "order": "name"
  }
}

// 2. Download images for each card
{
  "name": "download_card_image",
  "arguments": {
    "cardId": "card-id-from-search",
    "variant": "large"
  }
}

// 3. Check download status
{
  "name": "list_downloaded_cards",
  "arguments": {
    "set": "lea"
  }
}
```

### Art Collection Building
```json
// Download art crops for a specific artist
{
  "name": "search_cards",
  "arguments": {
    "query": "artist:\"Christopher Rush\"",
    "order": "released"
  }
}

// For each card, download art crop
{
  "name": "download_card_image",
  "arguments": {
    "cardId": "card-id",
    "variant": "art_crop"
  }
}
```

### Set Completion Tracking
```json
// Check what cards from a set are already downloaded
{
  "name": "list_downloaded_cards",
  "arguments": {
    "set": "khm"
  }
}

// Search for remaining cards in the set
{
  "name": "search_cards",
  "arguments": {
    "query": "set:khm",
    "order": "collector_number"
  }
}
```

## Configuration Requirements

Before using the MCP server, ensure the following environment variables are configured:

```env
# Required
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# Optional
IMAGE_STORAGE_PATH=./images
SCRYFALL_RATE_LIMIT=10
LOG_LEVEL=info
```

## Troubleshooting

### Common Issues

1. **Neo4j Connection Failed**
   - Verify Neo4j is running
   - Check connection credentials
   - Ensure database is accessible

2. **Image Download Failures**
   - Check internet connectivity
   - Verify Scryfall API availability
   - Ensure sufficient disk space

3. **Rate Limiting**
   - Scryfall limits to 10 requests/second
   - Server automatically handles rate limiting
   - Consider reducing concurrent requests

4. **Large File Downloads**
   - PNG images can be very large (>10MB)
   - Monitor disk space usage
   - Consider using smaller variants for bulk operations

### Performance Tips

1. **Use appropriate image variants** for your use case
2. **Batch operations** when possible
3. **Monitor database performance** with `get_database_stats`
4. **Clean up unused images** periodically
5. **Use pagination** for large result sets