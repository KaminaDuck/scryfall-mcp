import { Command } from 'commander';
import { scryfallAPI } from '../lib/scryfall-api.js';
import { cardDownloader } from '../lib/card-download.js';
import { artDownloader } from '../lib/art-download.js';
import { formatError } from '../lib/utils.js';

export const searchCommands = new Command('search')
  .description('Search and download Magic: The Gathering cards');

searchCommands
  .command('cards')
  .description('Search for cards')
  .argument('<query>', 'Search query (e.g., "Lightning Bolt", "c:red", "type:creature")')
  .option('-l, --limit <number>', 'Limit number of results', '25')
  .option('-u, --unique <type>', 'Unique type: cards, art, prints', 'prints')
  .option('-o, --order <order>', 'Sort order: name, set, released, rarity, etc.', 'name')
  .action(async (query, options) => {
    try {
      console.log(`Searching for "${query}"...`);
      
      const cards = await scryfallAPI.searchCards(query, {
        unique: options.unique as any,
        order: options.order as any
      });
      
      if (cards.length === 0) {
        console.log('No cards found');
        return;
      }
      
      const limit = Math.min(parseInt(options.limit), cards.length);
      const displayCards = cards.slice(0, limit);
      
      console.log(`Found ${cards.length} cards, showing ${displayCards.length}:`);
      console.log('');
      
      for (let i = 0; i < displayCards.length; i++) {
        const card = displayCards[i];
        console.log(`${i + 1}. ${card.name} [${card.set.toUpperCase()}#${card.collector_number}]`);
        console.log(`   ${card.type_line}`);
        if (card.mana_cost) {
          console.log(`   ${card.mana_cost}`);
        }
        if (card.oracle_text) {
          const shortText = card.oracle_text.length > 100 
            ? card.oracle_text.substring(0, 100) + '...'
            : card.oracle_text;
          console.log(`   ${shortText}`);
        }
        console.log('');
      }
      
      if (cards.length > limit) {
        console.log(`... and ${cards.length - limit} more cards`);
      }
    } catch (error) {
      console.error('Search failed:', formatError(error));
      process.exit(1);
    }
  });

searchCommands
  .command('download')
  .description('Search and interactively download cards')
  .argument('<query>', 'Search query')
  .option('-s, --set <setCode>', 'Limit to specific set')
  .option('-a, --art-crop', 'Download art crops instead of full images')
  .option('-f, --force', 'Force download even if already exists')
  .option('--auto', 'Download all results without prompting')
  .action(async (query, options) => {
    try {
      console.log(`Searching for "${query}"...`);
      
      const searchOptions: any = {
        unique: 'prints',
        order: 'name'
      };
      
      let searchQuery = query;
      if (options.set) {
        searchQuery += ` set:${options.set}`;
      }
      
      const cards = await scryfallAPI.searchCards(searchQuery, searchOptions);
      
      if (cards.length === 0) {
        console.log('No cards found');
        return;
      }
      
      console.log(`Found ${cards.length} cards`);
      
      if (!options.auto && cards.length > 20) {
        console.log('Large result set. Consider using --auto flag or adding more specific search terms.');
        console.log('Showing first 20 results for selection:');
      }
      
      const displayCards = options.auto ? cards : cards.slice(0, 20);
      
      if (!options.auto) {
        console.log('');
        for (let i = 0; i < displayCards.length; i++) {
          const card = displayCards[i];
          console.log(`${i + 1}. ${card.name} [${card.set.toUpperCase()}#${card.collector_number}]`);
        }
        console.log('');
        
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        
        console.log('Enter card numbers to download (e.g., "1,3,5" or "all" or "none"):');
        const selection = await new Promise<string>((resolve) => {
          rl.question('> ', (input) => {
            rl.close();
            resolve(input.trim());
          });
        });
        
        if (selection.toLowerCase() === 'none') {
          console.log('No cards selected');
          return;
        }
        
        let selectedCards: typeof cards;
        if (selection.toLowerCase() === 'all') {
          selectedCards = cards;
        } else {
          const indices = selection
            .split(',')
            .map(s => parseInt(s.trim()) - 1)
            .filter(i => i >= 0 && i < displayCards.length);
          
          if (indices.length === 0) {
            console.log('No valid selections');
            return;
          }
          
          selectedCards = indices.map(i => displayCards[i]);
        }
        
        console.log(`\nDownloading ${selectedCards.length} cards...`);
        await downloadCards(selectedCards, options);
      } else {
        console.log(`\nDownloading all ${cards.length} cards...`);
        await downloadCards(cards, options);
      }
    } catch (error) {
      console.error('Search and download failed:', formatError(error));
      process.exit(1);
    }
  });

async function downloadCards(cards: any[], options: any) {
  const cardNames = cards.map(card => card.name);
  
  try {
    let results;
    
    if (options.artCrop) {
      results = await artDownloader.batchDownloadArtCrops(
        cardNames,
        { force: options.force },
        (progress) => {
          console.log(`[${progress.current}/${progress.total}] ${progress.cardName}`);
        }
      );
      
      const summary = await artDownloader.getArtDownloadProgress(results);
      console.log('\nDownload Summary:');
      console.log(`  Successful: ${summary.successful}`);
      console.log(`  Failed: ${summary.failed}`);
      console.log(`  Skipped: ${summary.skipped}`);
      console.log(`  Set directories created: ${summary.setDirectories.length}`);
    } else {
      results = await cardDownloader.batchDownload(
        cardNames,
        { force: options.force },
        (progress) => {
          console.log(`[${progress.current}/${progress.total}] ${progress.cardName}`);
        }
      );
      
      const summary = await cardDownloader.getDownloadProgress(results);
      console.log('\nDownload Summary:');
      console.log(`  Successful: ${summary.successful}`);
      console.log(`  Failed: ${summary.failed}`);
      console.log(`  Skipped: ${summary.skipped}`);
    }
    
    if (results.some(r => !r.success)) {
      console.log('\nErrors occurred during download:');
      for (const result of results) {
        if (!result.success) {
          console.log(`  ${result.cardName || 'Unknown'}: ${result.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Download failed:', formatError(error));
    process.exit(1);
  }
}

searchCommands
  .command('random')
  .description('Get a random card')
  .option('-d, --download', 'Download the card image')
  .option('-a, --art-crop', 'Download art crop instead of full image')
  .option('-f, --force', 'Force download even if already exists')
  .action(async (options) => {
    try {
      console.log('Getting random card...');
      
      const card = await scryfallAPI.getRandomCard();
      
      console.log(`Random Card: ${card.name} [${card.set.toUpperCase()}#${card.collector_number}]`);
      console.log(`Type: ${card.type_line}`);
      if (card.mana_cost) {
        console.log(`Mana Cost: ${card.mana_cost}`);
      }
      if (card.oracle_text) {
        console.log(`Text: ${card.oracle_text}`);
      }
      console.log(`Set: ${card.set_name}`);
      console.log(`Rarity: ${card.rarity}`);
      console.log(`Scryfall URI: ${card.scryfall_uri}`);
      
      if (options.download) {
        console.log('\nDownloading...');
        
        if (options.artCrop) {
          const result = await artDownloader.downloadArtCrops([card.name], {
            setCode: card.set,
            collectorNumber: card.collector_number,
            force: options.force
          });
          
          if (result[0].success) {
            console.log(`Art crop downloaded: ${result[0].filepath}`);
          } else {
            console.error(`Download failed: ${result[0].message}`);
          }
        } else {
          const result = await cardDownloader.downloadCardImages([card.name], {
            setCode: card.set,
            collectorNumber: card.collector_number,
            force: options.force
          });
          
          if (result[0].success) {
            console.log(`Card downloaded: ${result[0].filepath}`);
          } else {
            console.error(`Download failed: ${result[0].message}`);
          }
        }
      }
    } catch (error) {
      console.error('Random card failed:', formatError(error));
      process.exit(1);
    }
  });