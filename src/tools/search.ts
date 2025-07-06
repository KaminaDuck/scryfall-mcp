import { scryfallAPI } from '../lib/scryfall-api.js';
import { groupCardsByNameAndArt, formatError } from '../lib/utils.js';
import { ToolResponse } from '../types.js';

export async function mcp_search_cards(query: string): Promise<ToolResponse> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        status: 'error',
        message: 'Query parameter is required'
      };
    }

    const cards = await scryfallAPI.searchCards(query.trim(), {
      unique: 'prints',
      order: 'name'
    });

    if (cards.length === 0) {
      return {
        status: 'success',
        message: 'No cards found',
        count: 0,
        cards: {}
      };
    }

    // Group cards by name and art
    const groupedCards = groupCardsByNameAndArt(cards);
    
    // Format the response to match the Python implementation
    const formattedCards: Record<string, any> = {};
    
    for (const [, cardList] of Object.entries(groupedCards)) {
      const firstCard = cardList[0];
      const cardName = firstCard.name;
      
      formattedCards[cardName] = {
        name: cardName,
        variations: cardList.map(card => ({
          id: card.id,
          set: card.set,
          set_name: card.set_name,
          collector_number: card.collector_number,
          rarity: card.rarity,
          image_uris: card.image_uris || (card.card_faces?.[0]?.image_uris || null),
          prices: card.prices,
          scryfall_uri: card.scryfall_uri
        }))
      };
    }

    return {
      status: 'success',
      message: `Found ${cards.length} cards across ${Object.keys(formattedCards).length} unique names`,
      count: cards.length,
      cards: formattedCards
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Search failed: ${formatError(error)}`
    };
  }
}