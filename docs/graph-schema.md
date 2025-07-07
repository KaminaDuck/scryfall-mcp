# Neo4j Graph Schema

This document describes the graph database schema used by the Scryfall MCP server to store Magic: The Gathering card data and relationships.

## Node Types

### Card Node

Represents a Magic: The Gathering card with all its metadata.

**Label:** `Card`

**Properties:**
- `id` (String, UUID): Unique Scryfall card identifier
- `oracleId` (String, UUID): Oracle identifier for card functionality
- `name` (String): Card name
- `set` (String): Set code (e.g., "lea", "leb")
- `setName` (String): Full set name
- `collectorNumber` (String): Collector number within the set
- `lang` (String): Language code
- `releasedAt` (String, ISO Date): Release date
- `manaCost` (String, Optional): Mana cost in {1}{W}{U} format
- `cmc` (Number): Converted mana cost
- `typeLine` (String): Type line (e.g., "Creature — Human Wizard")
- `oracleText` (String, Optional): Rules text
- `power` (String, Optional): Power value for creatures
- `toughness` (String, Optional): Toughness value for creatures
- `loyalty` (String, Optional): Starting loyalty for planeswalkers
- `colors` (Array[String]): Card colors ["W", "U", "B", "R", "G"]
- `colorIdentity` (Array[String]): Color identity for Commander format
- `rarity` (String): Rarity level
- `artist` (String, Optional): Artist name
- `flavorText` (String, Optional): Flavor text
- `scryfallUri` (String, URL): Scryfall page URL
- `layout` (String): Card layout type
- `createdAt` (String, ISO DateTime): When stored in database
- `updatedAt` (String, ISO DateTime): Last update timestamp

**Constraints:**
```cypher
CREATE CONSTRAINT card_id_unique IF NOT EXISTS FOR (c:Card) REQUIRE c.id IS UNIQUE
```

**Indexes:**
```cypher
CREATE INDEX card_name_idx IF NOT EXISTS FOR (c:Card) ON (c.name)
CREATE INDEX card_set_idx IF NOT EXISTS FOR (c:Card) ON (c.set)
CREATE INDEX card_oracle_id_idx IF NOT EXISTS FOR (c:Card) ON (c.oracleId)
```

### Image Node

Represents a downloaded card image file.

**Label:** `Image`

**Properties:**
- `id` (String): Composite ID format: `{cardId}-{variant}`
- `cardId` (String, UUID): Reference to parent card
- `variant` (String): Image variant type
- `filePath` (String): Local file system path
- `fileSize` (Number): File size in bytes
- `checksum` (String): SHA-256 hash for integrity
- `width` (Number, Optional): Image width in pixels
- `height` (Number, Optional): Image height in pixels
- `format` (String): File format ("jpg", "png")
- `downloadedAt` (String, ISO DateTime): Download timestamp
- `sourceUrl` (String, URL): Original Scryfall image URL

**Image Variants:**
- `small`: Small thumbnail (~146×204)
- `normal`: Standard size (~488×680)
- `large`: Large size (~672×936)
- `png`: High-resolution PNG
- `art_crop`: Art only, cropped
- `border_crop`: Full card with border

**Constraints:**
```cypher
CREATE CONSTRAINT image_id_unique IF NOT EXISTS FOR (i:Image) REQUIRE i.id IS UNIQUE
```

**Indexes:**
```cypher
CREATE INDEX image_card_id_idx IF NOT EXISTS FOR (i:Image) ON (i.cardId)
CREATE INDEX image_variant_idx IF NOT EXISTS FOR (i:Image) ON (i.variant)
```

### Set Node

Represents a Magic: The Gathering set or expansion.

**Label:** `Set`

**Properties:**
- `id` (String, UUID): Unique Scryfall set identifier
- `code` (String): Three-letter set code
- `name` (String): Full set name
- `setType` (String): Set type (core, expansion, etc.)
- `releasedAt` (String, ISO Date, Optional): Release date
- `cardCount` (Number): Total cards in set
- `digital` (Boolean): Whether set is digital-only
- `iconSvgUri` (String, URL, Optional): Set icon SVG URL
- `scryfallUri` (String, URL): Scryfall set page URL

**Constraints:**
```cypher
CREATE CONSTRAINT set_id_unique IF NOT EXISTS FOR (s:Set) REQUIRE s.id IS UNIQUE
```

**Indexes:**
```cypher
CREATE INDEX set_code_idx IF NOT EXISTS FOR (s:Set) ON (s.code)
```

## Relationships

### HAS_IMAGE

Connects a Card to its downloaded Images.

**From:** Card
**To:** Image
**Direction:** Card → Image

**Properties:** None

**Example:**
```cypher
(:Card {id: "550c74d4-1fcb-406a-b02a-639a760a4380"})-[:HAS_IMAGE]->(:Image {variant: "large"})
```

### BELONGS_TO

Connects a Card to its Set.

**From:** Card
**To:** Set
**Direction:** Card → Set

**Properties:** None

**Example:**
```cypher
(:Card {set: "lea"})-[:BELONGS_TO]->(:Set {code: "lea"})
```

### RELATED_TO (Future)

For connecting related cards (reprints, alternate versions).

**From:** Card
**To:** Card
**Direction:** Bidirectional

**Properties:**
- `relationshipType` (String): Type of relationship

### REPRINTED_IN (Future)

For tracking reprints across sets.

**From:** Card
**To:** Card
**Direction:** Original → Reprint

**Properties:**
- `reprintedAt` (String, ISO Date): Reprint date

## Common Queries

### Find Card with Images
```cypher
MATCH (c:Card {name: "Black Lotus"})-[:HAS_IMAGE]->(i:Image)
RETURN c, collect(i) as images
```

### Cards by Set
```cypher
MATCH (c:Card)-[:BELONGS_TO]->(s:Set {code: "lea"})
RETURN c, s
ORDER BY c.collectorNumber
```

### Available Image Variants for Card
```cypher
MATCH (c:Card {id: $cardId})-[:HAS_IMAGE]->(i:Image)
RETURN i.variant, i.filePath, i.fileSize
ORDER BY i.variant
```

### Search Cards by Name (Partial)
```cypher
MATCH (c:Card)
WHERE c.name CONTAINS $searchTerm
RETURN c
ORDER BY c.name
LIMIT 20
```

### Cards with Art Crop Images
```cypher
MATCH (c:Card)-[:HAS_IMAGE]->(i:Image {variant: "art_crop"})
RETURN c.name, c.set, i.filePath
ORDER BY c.name
```

### Database Statistics
```cypher
// Total cards
MATCH (c:Card) 
RETURN count(c) as totalCards

// Total images
MATCH (i:Image) 
RETURN count(i) as totalImages

// Images by variant
MATCH (i:Image) 
RETURN i.variant, count(i) as count
ORDER BY count DESC

// Cards by set
MATCH (c:Card) 
RETURN c.set, count(c) as count
ORDER BY count DESC
```

### Cleanup Orphaned Images
```cypher
MATCH (i:Image)
WHERE NOT EXISTS((:Card)-[:HAS_IMAGE]->(i))
DELETE i
```

## Performance Considerations

1. **Indexes**: All frequently queried properties have indexes
2. **Constraints**: Unique constraints prevent duplicates
3. **Composite Keys**: Image IDs use card ID + variant for uniqueness
4. **Batch Operations**: Use transactions for bulk imports
5. **Memory**: Configure Neo4j memory settings for dataset size

## Backup and Maintenance

### Regular Maintenance Queries

Check for orphaned nodes:
```cypher
// Orphaned images
MATCH (i:Image)
WHERE NOT EXISTS((:Card)-[:HAS_IMAGE]->(i))
RETURN count(i)

// Cards without sets
MATCH (c:Card)
WHERE NOT EXISTS((c)-[:BELONGS_TO]->(:Set))
RETURN count(c)
```

Data integrity checks:
```cypher
// Verify image file paths exist (application logic needed)
MATCH (i:Image)
RETURN i.filePath, i.checksum
// Check file system existence in application code
```