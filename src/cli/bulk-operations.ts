import { Command } from 'commander';
import { databaseOperations } from '../lib/database-operations.js';
import { formatError, formatFileSize } from '../lib/utils.js';

export const bulkCommands = new Command('bulk')
  .description('Bulk database operations');

bulkCommands
  .command('verify')
  .description('Verify database integrity and check for missing files')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      console.log('Verifying database integrity...');
      
      const verification = await databaseOperations.verifyDatabaseIntegrity();
      
      console.log('Verification Results:');
      console.log(`  Total records: ${verification.totalRecords}`);
      console.log(`  Verified records: ${verification.verifiedRecords}`);
      console.log(`  Missing files: ${verification.missingFiles.length}`);
      console.log(`  Orphaned files: ${verification.orphanedFiles.length}`);
      console.log(`  Corrupted metadata: ${verification.corruptedMetadata.length}`);
      
      if (options.verbose) {
        if (verification.missingFiles.length > 0) {
          console.log('\nMissing files:');
          for (const file of verification.missingFiles) {
            console.log(`  ${file}`);
          }
        }
        
        if (verification.orphanedFiles.length > 0) {
          console.log('\nOrphaned files:');
          for (const file of verification.orphanedFiles) {
            console.log(`  ${file}`);
          }
        }
        
        if (verification.corruptedMetadata.length > 0) {
          console.log('\nCorrupted metadata files:');
          for (const file of verification.corruptedMetadata) {
            console.log(`  ${file}`);
          }
        }
      }
      
      if (verification.missingFiles.length > 0 || verification.orphanedFiles.length > 0) {
        console.log('\nRun "scryfall-mcp bulk clean" to remove records for missing files');
        console.log('Run "scryfall-mcp bulk scan" to add orphaned files to database');
      }
    } catch (error) {
      console.error('Verification failed:', formatError(error));
      process.exit(1);
    }
  });

bulkCommands
  .command('scan')
  .description('Scan directories for images and add them to the database')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      console.log('Scanning directories for images...');
      
      const scanResult = await databaseOperations.scanDirectoryForImages();
      
      console.log('Scan Results:');
      console.log(`  Total files processed: ${scanResult.totalFiles}`);
      console.log(`  Records added: ${scanResult.addedRecords}`);
      console.log(`  Files skipped: ${scanResult.skippedFiles.length}`);
      console.log(`  Error files: ${scanResult.errorFiles.length}`);
      
      if (options.verbose) {
        if (scanResult.skippedFiles.length > 0) {
          console.log('\nSkipped files (already in database):');
          for (const file of scanResult.skippedFiles.slice(0, 20)) {
            console.log(`  ${file}`);
          }
          if (scanResult.skippedFiles.length > 20) {
            console.log(`  ... and ${scanResult.skippedFiles.length - 20} more`);
          }
        }
        
        if (scanResult.errorFiles.length > 0) {
          console.log('\nError files:');
          for (const file of scanResult.errorFiles) {
            console.log(`  ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Scan failed:', formatError(error));
      process.exit(1);
    }
  });

bulkCommands
  .command('clean')
  .description('Clean database by removing records for missing files')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      // First verify to show what will be cleaned
      const verification = await databaseOperations.verifyDatabaseIntegrity();
      
      if (verification.missingFiles.length === 0) {
        console.log('No missing files found. Database is clean.');
        return;
      }
      
      console.log(`Found ${verification.missingFiles.length} records with missing files`);
      
      if (options.verbose) {
        console.log('\nFiles that will be removed from database:');
        for (const file of verification.missingFiles.slice(0, 20)) {
          console.log(`  ${file}`);
        }
        if (verification.missingFiles.length > 20) {
          console.log(`  ... and ${verification.missingFiles.length - 20} more`);
        }
      }
      
      // Confirmation
      if (!options.yes) {
        console.log(`\nAre you sure you want to remove ${verification.missingFiles.length} records? (y/N)`);
        
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
          return;
        }
      }
      
      console.log('Cleaning database...');
      
      const cleanupResult = await databaseOperations.cleanDatabase();
      
      console.log('Cleanup Results:');
      console.log(`  Records cleaned: ${cleanupResult.cleanedRecords}`);
      console.log(`  Files removed from database: ${cleanupResult.removedFiles.length}`);
      console.log(`  Errors: ${cleanupResult.errors.length}`);
      
      if (options.verbose && cleanupResult.errors.length > 0) {
        console.log('\nErrors:');
        for (const error of cleanupResult.errors) {
          console.log(`  ${error}`);
        }
      }
    } catch (error) {
      console.error('Clean failed:', formatError(error));
      process.exit(1);
    }
  });

bulkCommands
  .command('report')
  .description('Generate comprehensive database report')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      console.log('Generating database report...');
      
      const report = await databaseOperations.generateDatabaseReport();
      
      console.log('Database Report:');
      console.log(`  Total records: ${report.totalRecords}`);
      console.log(`  Unique cards: ${report.statistics.uniqueCards}`);
      console.log(`  Total sets: ${report.statistics.totalSets}`);
      console.log(`  Missing files: ${report.missingFiles.length}`);
      console.log(`  Total file size: ${formatFileSize(report.statistics.totalFileSize)}`);
      console.log(`  Average file size: ${formatFileSize(report.statistics.averageFileSize)}`);
      console.log('');
      
      console.log('Directory Structure:');
      console.log(`  Card Images: ${report.directoryStructure.cardImages.totalFiles} files (${formatFileSize(report.directoryStructure.cardImages.totalSize)})`);
      console.log(`  Art Crops: ${report.directoryStructure.artCrops.totalFiles} files (${formatFileSize(report.directoryStructure.artCrops.totalSize)})`);
      console.log(`  Art Crop Sets: ${report.directoryStructure.artCrops.setDirectories.length} directories`);
      console.log('');
      
      if (options.verbose) {
        console.log('Top sets by card count:');
        const topSets = Object.entries(report.recordsBySet)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15);
        
        for (const [setCode, count] of topSets) {
          console.log(`  ${setCode}: ${count} cards`);
        }
        console.log('');
        
        if (report.recentDownloads.length > 0) {
          console.log('Recent downloads:');
          for (const download of report.recentDownloads.slice(0, 10)) {
            console.log(`  ${download.card_name} [${download.set_code}] - ${download.download_date}`);
          }
          console.log('');
        }
        
        if (report.directoryStructure.artCrops.setDirectories.length > 0) {
          console.log('Art crop set directories:');
          for (const dir of report.directoryStructure.artCrops.setDirectories.slice(0, 10)) {
            console.log(`  ${dir}`);
          }
          if (report.directoryStructure.artCrops.setDirectories.length > 10) {
            console.log(`  ... and ${report.directoryStructure.artCrops.setDirectories.length - 10} more`);
          }
        }
      }
      
      if (report.missingFiles.length > 0) {
        console.log(`\nWarning: ${report.missingFiles.length} files are missing`);
        console.log('Run "scryfall-mcp bulk verify --verbose" for details');
      }
    } catch (error) {
      console.error('Report generation failed:', formatError(error));
      process.exit(1);
    }
  });