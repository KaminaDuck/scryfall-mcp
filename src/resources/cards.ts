import { scryfallAPI } from '../lib/scryfall-api.js';
import { formatError } from '../lib/utils.js';

export async function getCardById(cardId: string): Promise<object> {
  try {
    if (!cardId || cardId.trim().length === 0) {
      throw new Error('Card ID is required');
    }

    const card = await scryfallAPI.getCardById(cardId.trim());
    return card;

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw new Error(`Card not found with ID: ${cardId}`);
    }

    throw new Error(`Failed to retrieve card: ${errorMessage}`);
  }
}

export async function getCardByName(cardName: string, setCode?: string): Promise<object> {
  try {
    if (!cardName || cardName.trim().length === 0) {
      throw new Error('Card name is required');
    }

    const card = await scryfallAPI.getCardByName(cardName.trim(), setCode);
    return card;

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw new Error(`Card not found: ${cardName}${setCode ? ` in set ${setCode}` : ''}`);
    }

    throw new Error(`Failed to retrieve card: ${errorMessage}`);
  }
}

export async function getRandomCard(): Promise<object> {
  try {
    const card = await scryfallAPI.getRandomCard();
    return card;

  } catch (error) {
    throw new Error(`Failed to retrieve random card: ${formatError(error)}`);
  }
}

export async function getCardBySetAndNumber(setCode: string, collectorNumber: string): Promise<object> {
  try {
    if (!setCode || setCode.trim().length === 0) {
      throw new Error('Set code is required');
    }

    if (!collectorNumber || collectorNumber.trim().length === 0) {
      throw new Error('Collector number is required');
    }

    const card = await scryfallAPI.getCardBySetAndNumber(setCode.trim(), collectorNumber.trim());
    return card;

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw new Error(`Card not found: ${setCode} #${collectorNumber}`);
    }

    throw new Error(`Failed to retrieve card: ${errorMessage}`);
  }
}

export async function searchCards(query: string): Promise<object> {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    const cards = await scryfallAPI.searchCards(query.trim(), {
      unique: 'prints',
      order: 'name'
    });

    return {
      object: 'list',
      total_cards: cards.length,
      data: cards
    };

  } catch (error) {
    throw new Error(`Search failed: ${formatError(error)}`);
  }
}

export async function autocompleteCardName(query: string): Promise<object> {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error('Query is required');
    }

    const suggestions = await scryfallAPI.autocompleteCardName(query.trim());

    return {
      object: 'list',
      data: suggestions
    };

  } catch (error) {
    throw new Error(`Autocomplete failed: ${formatError(error)}`);
  }
}

export async function getCardPrintings(cardId: string): Promise<object> {
  try {
    if (!cardId || cardId.trim().length === 0) {
      throw new Error('Card ID is required');
    }

    const printings = await scryfallAPI.getCardPrintings(cardId.trim());

    return {
      object: 'list',
      total_cards: printings.length,
      data: printings
    };

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw new Error(`Card not found with ID: ${cardId}`);
    }

    throw new Error(`Failed to retrieve card printings: ${errorMessage}`);
  }
}

export async function getCardRulings(cardId: string): Promise<object> {
  try {
    if (!cardId || cardId.trim().length === 0) {
      throw new Error('Card ID is required');
    }

    const rulings = await scryfallAPI.getCardRulings(cardId.trim());

    return {
      object: 'list',
      data: rulings
    };

  } catch (error) {
    const errorMessage = formatError(error);
    
    // Handle specific error cases
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      throw new Error(`Card not found with ID: ${cardId}`);
    }

    throw new Error(`Failed to retrieve card rulings: ${errorMessage}`);
  }
}