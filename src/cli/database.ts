import { Command } from 'commander';
import { CardDatabase } from '../lib/database.js';
import { initializeDirectories } from '../config.js';
import { formatError } from '../lib/utils.js';

export const databaseCommands = new Command('db')
  .description('Database operations');

databaseCommands
  .command('init')
  .description('Initialize the database and directories')
  .action(async () => {
    try {
      initializeDirectories();
      const database = new CardDatabase();
      database.close();
      console.log('Database and directories initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', formatError(error));
      process.exit(1);
    }
  });

databaseCommands
  .command('list')
  .description('List all cards in the database')
  .option('-s, --set <setCode>', 'Filter by set code')
  .option('-l, --limit <number>', 'Limit number of results', '50')
  .action(async (options) => {
    try {
      const database = new CardDatabase();
      
      let cards;
      if (options.set) {
        cards = database.getCardsBySet(options.set);
      } else {
        cards = database.getAllCards();
      }
      
      const limit = parseInt(options.limit);
      const displayCards = cards.slice(0, limit);
      
      if (displayCards.length === 0) {
        console.log('No cards found');
        return;
      }
      
      console.log(`Showing ${displayCards.length} of ${cards.length} cards:`);
      console.log('');
      
      for (const card of displayCards) {
        console.log(`${card.card_name} [${card.set_code}]`);
        console.log(`  File: ${card.filename}`);
        console.log(`  Downloaded: ${card.download_date}`);
        console.log(`  ID: ${card.card_id}`);
        console.log('');
      }
      
      if (cards.length > limit) {
        console.log(`... and ${cards.length - limit} more cards`);
      }
      
      database.close();
    } catch (error) {
      console.error('Failed to list cards:', formatError(error));
      process.exit(1);
    }
  });

databaseCommands
  .command('search')
  .description('Search for cards in the database')
  .argument('<query>', 'Search query')
  .action(async (query) => {
    try {
      const database = new CardDatabase();
      const results = database.searchCards(query);
      database.close();
      
      if (results.length === 0) {
        console.log(`No cards found matching "${query}"`);
        return;
      }
      
      console.log(`Found ${results.length} cards matching "${query}":`);
      console.log('');
      
      for (const card of results) {
        console.log(`${card.card_name} [${card.set_code}]`);
        console.log(`  File: ${card.filename}`);
        console.log(`  Downloaded: ${card.download_date}`);
        console.log('');
      }
    } catch (error) {
      console.error('Search failed:', formatError(error));
      process.exit(1);
    }
  });

databaseCommands
  .command('remove')
  .description('Remove a card from the database')
  .argument('<cardName>', 'Name of the card to remove')
  .option('-s, --set <setCode>', 'Set code to specify which printing')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (cardName, options) => {
    try {
      const database = new CardDatabase();
      
      // Check if card exists
      const cardInfo = database.getCardInfo(cardName, options.set);
      if (!cardInfo) {
        console.log(`Card not found: ${cardName}${options.set ? ` in set ${options.set}` : ''}`);
        database.close();
        return;
      }
      
      // Confirmation
      if (!options.yes) {
        console.log(`Are you sure you want to remove "${cardInfo.card_name}" [${cardInfo.set_code}]? (y/N)`);
        
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        
        const answer = await new Promise<string>((resolve) => {
          rl.question('', (input) => {
            rl.close();
            resolve(input.toLowerCase());
          });
        });
        
        if (answer !== 'y' && answer !== 'yes') {
          console.log('Cancelled');
          database.close();
          return;
        }
      }
      
      const success = database.removeCard(cardName, options.set);
      database.close();
      
      if (success) {
        console.log(`Removed card: ${cardName}${options.set ? ` in set ${options.set}` : ''}`);
      } else {
        console.log('Failed to remove card (not found)');
      }
    } catch (error) {
      console.error('Failed to remove card:', formatError(error));
      process.exit(1);
    }
  });

databaseCommands
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      const database = new CardDatabase();
      const stats = database.getStatistics();
      const recordsBySet = database.getRecordsBySet();
      const recentDownloads = database.getRecentDownloads(5);
      database.close();
      
      console.log('Database Statistics:');
      console.log(`  Total cards: ${stats.totalCards}`);
      console.log(`  Unique cards: ${stats.uniqueCards}`);
      console.log(`  Total sets: ${stats.totalSets}`);
      console.log(`  Oldest download: ${stats.oldestDownload || 'N/A'}`);
      console.log(`  Newest download: ${stats.newestDownload || 'N/A'}`);
      console.log('');
      
      if (Object.keys(recordsBySet).length > 0) {
        console.log('Top sets by card count:');
        const topSets = Object.entries(recordsBySet)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        
        for (const [setCode, count] of topSets) {
          console.log(`  ${setCode}: ${count} cards`);
        }
        console.log('');
      }
      
      if (recentDownloads.length > 0) {
        console.log('Recent downloads:');
        for (const download of recentDownloads) {
          console.log(`  ${download.card_name} [${download.set_code}] - ${download.download_date}`);
        }
      }
    } catch (error) {
      console.error('Failed to get statistics:', formatError(error));
      process.exit(1);
    }
  });

databaseCommands
  .command('info')
  .description('Get information about a specific card')
  .argument('<cardName>', 'Name of the card')
  .option('-s, --set <setCode>', 'Set code to specify which printing')
  .action(async (cardName, options) => {
    try {
      const database = new CardDatabase();
      const cardInfo = database.getCardInfo(cardName, options.set);
      database.close();
      
      if (!cardInfo) {
        console.log(`Card not found: ${cardName}${options.set ? ` in set ${options.set}` : ''}`);
        return;
      }
      
      console.log('Card Information:');
      console.log(`  Name: ${cardInfo.card_name}`);
      console.log(`  Set: ${cardInfo.set_code}`);
      console.log(`  File: ${cardInfo.filename}`);
      console.log(`  Download Date: ${cardInfo.download_date}`);
      console.log(`  Card ID: ${cardInfo.card_id}`);
      console.log(`  Image URL: ${cardInfo.image_url}`);
    } catch (error) {
      console.error('Failed to get card info:', formatError(error));
      process.exit(1);
    }
  });