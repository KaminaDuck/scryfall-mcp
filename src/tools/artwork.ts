import { scryfallAPI } from '../lib/scryfall-api.js';
import { formatError } from '../lib/utils.js';
import { ToolResponse, CardArtwork } from '../types.js';

export async function mcp_get_card_artwork(cardId: string): Promise<ToolResponse> {
  try {
    if (!cardId || cardId.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card ID is required'
      };
    }

    const card = await scryfallAPI.getCardById(cardId.trim());

    // Extract artwork URLs
    const artwork: CardArtwork = {
      card_id: card.id,
      card_name: card.name,
      image_uris: null,
      card_faces: undefined
    };

    if (card.image_uris) {
      artwork.image_uris = card.image_uris;
    } else if (card.card_faces) {
      artwork.card_faces = card.card_faces.map((face: any) => ({
        image_uris: face.image_uris || null
      }));
    }

    // Check if we have any image URIs
    if (!artwork.image_uris && (!artwork.card_faces || artwork.card_faces.every(face => !face.image_uris))) {
      return {
        status: 'error',
        message: `No artwork available for card: ${card.name}`
      };
    }

    return {
      status: 'success',
      message: `Retrieved artwork for ${card.name}`,
      data: artwork
    };

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        status: 'error',
        message: `Card not found with ID: ${cardId}`
      };
    }

    return {
      status: 'error',
      message: `Failed to retrieve artwork: ${errorMessage}`
    };
  }
}

export async function mcp_get_card_artwork_by_name(
  cardName: string,
  setCode?: string
): Promise<ToolResponse> {
  try {
    if (!cardName || cardName.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card name is required'
      };
    }

    const card = await scryfallAPI.getCardByName(cardName.trim(), setCode);

    // Extract artwork URLs
    const artwork: CardArtwork = {
      card_id: card.id,
      card_name: card.name,
      image_uris: null,
      card_faces: undefined
    };

    if (card.image_uris) {
      artwork.image_uris = card.image_uris;
    } else if (card.card_faces) {
      artwork.card_faces = card.card_faces.map((face: any) => ({
        image_uris: face.image_uris || null
      }));
    }

    // Check if we have any image URIs
    if (!artwork.image_uris && (!artwork.card_faces || artwork.card_faces.every(face => !face.image_uris))) {
      return {
        status: 'error',
        message: `No artwork available for card: ${card.name}`
      };
    }

    return {
      status: 'success',
      message: `Retrieved artwork for ${card.name}`,
      data: artwork
    };

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        status: 'error',
        message: `Card not found: ${cardName}${setCode ? ` in set ${setCode}` : ''}`
      };
    }

    return {
      status: 'error',
      message: `Failed to retrieve artwork: ${errorMessage}`
    };
  }
}

export async function mcp_get_random_card_artwork(): Promise<ToolResponse> {
  try {
    const card = await scryfallAPI.getRandomCard();

    // Extract artwork URLs
    const artwork: CardArtwork = {
      card_id: card.id,
      card_name: card.name,
      image_uris: null,
      card_faces: undefined
    };

    if (card.image_uris) {
      artwork.image_uris = card.image_uris;
    } else if (card.card_faces) {
      artwork.card_faces = card.card_faces.map((face: any) => ({
        image_uris: face.image_uris || null
      }));
    }

    // Check if we have any image URIs
    if (!artwork.image_uris && (!artwork.card_faces || artwork.card_faces.every(face => !face.image_uris))) {
      return {
        status: 'error',
        message: `No artwork available for random card: ${card.name}`
      };
    }

    return {
      status: 'success',
      message: `Retrieved artwork for random card: ${card.name}`,
      data: artwork
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Failed to retrieve random card artwork: ${formatError(error)}`
    };
  }
}

export async function mcp_get_card_image_urls(cardId: string): Promise<ToolResponse> {
  try {
    if (!cardId || cardId.trim().length === 0) {
      return {
        status: 'error',
        message: 'Card ID is required'
      };
    }

    const card = await scryfallAPI.getCardById(cardId.trim());

    // Get all image URIs (including card faces)
    const allImageUris = scryfallAPI.getAllImageUris(card);

    if (allImageUris.length === 0) {
      return {
        status: 'error',
        message: `No images available for card: ${card.name}`
      };
    }

    // Format the response to match the Python implementation
    const imageUrls = allImageUris.map((imageUri, index) => ({
      face: index + 1,
      small: imageUri.small,
      normal: imageUri.normal,
      large: imageUri.large,
      png: imageUri.png,
      art_crop: imageUri.art_crop,
      border_crop: imageUri.border_crop
    }));

    return {
      status: 'success',
      message: `Retrieved ${imageUrls.length} image set(s) for ${card.name}`,
      data: {
        card_id: card.id,
        card_name: card.name,
        layout: card.layout,
        image_urls: imageUrls
      }
    };

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        status: 'error',
        message: `Card not found with ID: ${cardId}`
      };
    }

    return {
      status: 'error',
      message: `Failed to retrieve image URLs: ${errorMessage}`
    };
  }
}