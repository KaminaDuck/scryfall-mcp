#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Database Bulk Operations

This module provides utilities for bulk operations on the Scryfall card database,
such as checking for missing images, updating the database with existing files,
and other maintenance tasks.

Key features:
- Verify database integrity by checking if all referenced files exist
- Scan directories to add existing files to the database
- Bulk update database records
- Generate reports on database status
"""

import os
import argparse
import json
from typing import List, Dict, Any, Optional, Tuple
from .db_manager import CardDatabase


def verify_database_integrity(verbose: bool = False) -> Tuple[int, int]:
    """
    Verify database integrity by checking if all referenced files exist.
    
    Args:
        verbose: Whether to print detailed information
        
    Returns:
        Tuple of (total_records, missing_files)
    """
    with CardDatabase() as db:
        cards = db.get_all_cards()
        total_records = len(cards)
        missing_files = 0
        
        print(f"Verifying {total_records} database records...")
        
        for card in cards:
            filename = card['filename']
            if not os.path.exists(filename):
                missing_files += 1
                if verbose:
                    print(f"Missing file: {filename} for card {card['card_name']}")
        
        if missing_files == 0:
            print("All files referenced in the database exist.")
        else:
            print(f"Found {missing_files} missing files out of {total_records} records.")
        
        return total_records, missing_files


def scan_directory_for_images(directory: str, update_db: bool = False, verbose: bool = False) -> Tuple[int, int]:
    """
    Scan a directory for image files and optionally add them to the database.
    
    Args:
        directory: Directory to scan
        update_db: Whether to update the database with found files
        verbose: Whether to print detailed information
        
    Returns:
        Tuple of (total_files, added_to_db)
    """
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
        return 0, 0
    
    total_files = 0
    added_to_db = 0
    
    print(f"Scanning directory {directory} for image files...")
    
    with CardDatabase() as db:
        for root, _, files in os.walk(directory):
            for file in files:
                if file.lower().endswith(('.jpg', '.png', '.jpeg', '.gif')):
                    total_files += 1
                    filepath = os.path.join(root, file)
                    
                    # Try to extract card information from the filepath
                    try:
                        # Extract set name from directory
                        set_name = os.path.basename(root).replace("_", " ")
                        
                        # Extract card name from filename
                        card_name = os.path.splitext(file)[0].replace("_", " ")
                        
                        # Check if there's a corresponding JSON file with more info
                        json_filepath = os.path.join(root, f"{os.path.splitext(file)[0]}.json")
                        card_id = None
                        set_code = None
                        image_url = None
                        
                        if os.path.exists(json_filepath):
                            try:
                                with open(json_filepath, 'r', encoding='utf-8') as f:
                                    card_data = json.load(f)
                                    card_id = card_data.get("id")
                                    set_code = card_data.get("set")
                                    image_url = card_data.get("image_uris", {}).get("art_crop")
                                    # Use the actual card name from the JSON if available
                                    if "name" in card_data:
                                        card_name = card_data["name"]
                            except json.JSONDecodeError:
                                if verbose:
                                    print(f"Error parsing JSON file: {json_filepath}")
                        
                        # Create a unique identifier for the card
                        card_version_id = f"{card_name}_{set_code or ''}_{card_id or ''}_art_crop"
                        
                        if update_db:
                            if not db.card_exists(card_version_id):
                                db.add_card(
                                    card_name=card_version_id,
                                    filename=filepath,
                                    card_id=card_id,
                                    set_code=set_code,
                                    image_url=image_url
                                )
                                added_to_db += 1
                                if verbose:
                                    print(f"Added to database: {filepath}")
                            elif verbose:
                                print(f"Already in database: {filepath}")
                        elif verbose:
                            print(f"Found image: {filepath}")
                    except Exception as e:
                        if verbose:
                            print(f"Error processing {filepath}: {e}")
    
    print(f"Found {total_files} image files.")
    if update_db:
        print(f"Added {added_to_db} new records to the database.")
    
    return total_files, added_to_db


def clean_database(dry_run: bool = True, verbose: bool = False) -> int:
    """
    Clean the database by removing records for files that no longer exist.
    
    Args:
        dry_run: If True, only report what would be removed without making changes
        verbose: Whether to print detailed information
        
    Returns:
        Number of records that would be/were removed
    """
    with CardDatabase() as db:
        cards = db.get_all_cards()
        to_remove = []
        
        print(f"Checking {len(cards)} database records for missing files...")
        
        for card in cards:
            filename = card['filename']
            if not os.path.exists(filename):
                to_remove.append(card['card_name'])
                if verbose:
                    print(f"Will remove: {card['card_name']} (file: {filename})")
        
        if dry_run:
            print(f"Would remove {len(to_remove)} records from the database (dry run).")
        else:
            for card_name in to_remove:
                db.remove_card(card_name)
            print(f"Removed {len(to_remove)} records from the database.")
        
        return len(to_remove)


def generate_report() -> None:
    """Generate a comprehensive report on the database status."""
    with CardDatabase() as db:
        cards = db.get_all_cards()
        total_records = len(cards)
        
        # Count by set
        sets = {}
        for card in cards:
            set_code = card['set_code'] or 'Unknown'
            if set_code not in sets:
                sets[set_code] = 0
            sets[set_code] += 1
        
        # Check for missing files
        missing_files = 0
        for card in cards:
            if not os.path.exists(card['filename']):
                missing_files += 1
        
        # Print report
        print("\n=== Database Report ===")
        print(f"Total records: {total_records}")
        print(f"Missing files: {missing_files}")
        print("\nRecords by set:")
        for set_code, count in sorted(sets.items(), key=lambda x: x[1], reverse=True):
            print(f"  {set_code}: {count}")
        
        # Check image directories
        image_dir = ".local/scryfall_images"
        if os.path.exists(image_dir):
            set_dirs = [d for d in os.listdir(image_dir) if os.path.isdir(os.path.join(image_dir, d))]
            print(f"\nFound {len(set_dirs)} set directories in {image_dir}")
            
            # Count image files
            total_images = 0
            for set_dir in set_dirs:
                set_path = os.path.join(image_dir, set_dir)
                image_files = [f for f in os.listdir(set_path) 
                              if os.path.isfile(os.path.join(set_path, f)) and 
                              f.lower().endswith(('.jpg', '.png', '.jpeg', '.gif'))]
                total_images += len(image_files)
            
            print(f"Total image files: {total_images}")
            print(f"Database coverage: {total_records / total_images * 100:.2f}% of files are in the database")
        else:
            print(f"\nImage directory {image_dir} does not exist.")


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description="Scryfall Card Database Bulk Operations")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Verify command
    verify_parser = subparsers.add_parser("verify", help="Verify database integrity")
    verify_parser.add_argument("--verbose", "-v", action="store_true", help="Print detailed information")
    
    # Scan command
    scan_parser = subparsers.add_parser("scan", help="Scan directory for image files")
    scan_parser.add_argument("directory", help="Directory to scan")
    scan_parser.add_argument("--update", "-u", action="store_true", help="Update database with found files")
    scan_parser.add_argument("--verbose", "-v", action="store_true", help="Print detailed information")
    
    # Clean command
    clean_parser = subparsers.add_parser("clean", help="Clean database by removing records for missing files")
    clean_parser.add_argument("--execute", "-e", action="store_true", help="Actually remove records (default is dry run)")
    clean_parser.add_argument("--verbose", "-v", action="store_true", help="Print detailed information")
    
    # Report command
    report_parser = subparsers.add_parser("report", help="Generate a report on database status")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Execute the appropriate command
    if args.command == "verify":
        verify_database_integrity(args.verbose)
    elif args.command == "scan":
        scan_directory_for_images(args.directory, args.update, args.verbose)
    elif args.command == "clean":
        clean_database(not args.execute, args.verbose)
    elif args.command == "report":
        generate_report()


if __name__ == "__main__":
    main()
