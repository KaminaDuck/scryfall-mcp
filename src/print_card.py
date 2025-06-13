# SPDX-License-Identifier: Apache-2.0
# src.print_card

"""
Cross-platform card printing functionality for Scryfall card images.

This module provides a refactored printing system that integrates with the
existing Scryfall download project, supporting macOS and Linux systems
through CUPS printing system.

Functions:
    print_cards_from_database: Print cards from the local database
    print_cards_from_search: Print cards based on search criteria
    print_card_by_name: Print a specific card by name
    list_available_printers: List system printers
    configure_printer: Configure printer settings
    main: Command-line interface for card printing
"""

import os
import argparse
from typing import List, Optional
from db_manager import CardDatabase
from printing import get_printer, list_printers, PrintConfig


def print_cards_from_database(card_names: List[str], printer_name: Optional[str] = None, 
                             copies: int = 1, config: Optional[PrintConfig] = None) -> bool:
    """
    Print cards from the local database.
    
    Args:
        card_names: List of card names to print
        printer_name: Name of the printer to use (None for default)
        copies: Number of copies to print for each card
        config: Print configuration (uses default if None)
        
    Returns:
        True if all cards were printed successfully, False otherwise
    """
    if config is None:
        config = PrintConfig()
    
    printer = get_printer(config)
    
    with CardDatabase() as db:
        image_paths = []
        not_found = []
        
        for card_name in card_names:
            card_info = db.get_card_info(card_name)
            if card_info:
                # Check if filename already contains full path
                if card_info['filename'].startswith('.local/') or card_info['filename'].startswith('/'):
                    image_path = card_info['filename']
                else:
                    image_path = os.path.join(config.input_directory, card_info['filename'])
                if os.path.exists(image_path):
                    image_paths.append(image_path)
                else:
                    print(f"Warning: Image file not found for {card_name}: {image_path}")
                    not_found.append(card_name)
            else:
                print(f"Card not found in database: {card_name}")
                not_found.append(card_name)
        
        if not_found:
            print(f"Cards not available for printing: {', '.join(not_found)}")
        
        if image_paths:
            print(f"Printing {len(image_paths)} cards...")
            return printer.print_images(image_paths, printer_name, copies)
        else:
            print("No cards available to print.")
            return False


def print_card_by_name(card_name: str, printer_name: Optional[str] = None, 
                      copies: int = 1, config: Optional[PrintConfig] = None) -> bool:
    """
    Print a specific card by name.
    
    Args:
        card_name: Name of the card to print
        printer_name: Name of the printer to use (None for default)
        copies: Number of copies to print
        config: Print configuration (uses default if None)
        
    Returns:
        True if the card was printed successfully, False otherwise
    """
    return print_cards_from_database([card_name], printer_name, copies, config)


def print_cards_from_search(search_pattern: str, printer_name: Optional[str] = None,
                           copies: int = 1, config: Optional[PrintConfig] = None) -> bool:
    """
    Print cards based on a search pattern in the database.
    
    Args:
        search_pattern: Pattern to search for in card names
        printer_name: Name of the printer to use (None for default)
        copies: Number of copies to print for each card
        config: Print configuration (uses default if None)
        
    Returns:
        True if all matching cards were printed successfully, False otherwise
    """
    if config is None:
        config = PrintConfig()
    
    with CardDatabase() as db:
        all_cards = db.get_all_cards()
        matching_cards = [
            card['card_name'] for card in all_cards 
            if search_pattern.lower() in card['card_name'].lower()
        ]
        
        if matching_cards:
            print(f"Found {len(matching_cards)} cards matching '{search_pattern}':")
            for card in matching_cards:
                print(f"  - {card}")
            
            return print_cards_from_database(matching_cards, printer_name, copies, config)
        else:
            print(f"No cards found matching '{search_pattern}'")
            return False


def list_available_printers() -> List[str]:
    """
    List all available system printers.
    
    Returns:
        List of printer names
    """
    try:
        printers = list_printers()
        if printers:
            print("Available printers:")
            for printer in printers:
                print(f"  - {printer}")
        else:
            print("No printers found.")
        return printers
    except Exception as e:
        print(f"Error listing printers: {e}")
        return []


def configure_printer(printer_name: Optional[str] = None, 
                     paper_size: Optional[str] = None,
                     quality: Optional[str] = None,
                     color_mode: Optional[str] = None) -> None:
    """
    Configure printer settings and save to configuration file.
    
    Args:
        printer_name: Default printer name to set
        paper_size: Paper size (letter, a4, legal)
        quality: Print quality (draft, normal, high)
        color_mode: Color mode (color, grayscale, monochrome)
    """
    config = PrintConfig()
    
    if printer_name:
        config.default_printer = printer_name
        print(f"Set default printer to: {printer_name}")
    
    if paper_size:
        config.set("printer.paper_size", paper_size)
        print(f"Set paper size to: {paper_size}")
    
    if quality:
        config.set("printer.quality", quality)
        print(f"Set print quality to: {quality}")
    
    if color_mode:
        config.set("printer.color_mode", color_mode)
        print(f"Set color mode to: {color_mode}")
    
    config.save_config()
    print(f"Configuration saved to: {config.config_path}")


def show_database_cards() -> None:
    """Show all cards available in the database for printing."""
    with CardDatabase() as db:
        cards = db.get_all_cards()
        if cards:
            print(f"Cards available for printing ({len(cards)} total):")
            for card in cards:
                print(f"  - {card['card_name']} (downloaded: {card['download_date']})")
        else:
            print("No cards found in database. Download some cards first using the download scripts.")


def main():
    """Command-line interface for card printing functionality."""
    parser = argparse.ArgumentParser(
        description="Print Magic: The Gathering cards from the Scryfall database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --list-cards                    # Show all available cards
  %(prog)s --list-printers                 # Show available printers
  %(prog)s --print "Lightning Bolt"        # Print a specific card
  %(prog)s --print-multiple "Lightning Bolt" "Counterspell"  # Print multiple cards
  %(prog)s --search "bolt"                 # Print all cards matching "bolt"
  %(prog)s --configure --printer "HP_Printer" --paper a4     # Configure printer
        """
    )
    
    # Action arguments
    action_group = parser.add_mutually_exclusive_group(required=True)
    action_group.add_argument("--list-cards", action="store_true",
                             help="List all cards available for printing")
    action_group.add_argument("--list-printers", action="store_true",
                             help="List all available system printers")
    action_group.add_argument("--print", metavar="CARD_NAME",
                             help="Print a specific card by name")
    action_group.add_argument("--print-multiple", nargs="+", metavar="CARD_NAME",
                             help="Print multiple cards by name")
    action_group.add_argument("--search", metavar="PATTERN",
                             help="Print all cards matching the search pattern")
    action_group.add_argument("--configure", action="store_true",
                             help="Configure printer settings")
    
    # Printing options
    parser.add_argument("--printer", "-p", metavar="PRINTER_NAME",
                       help="Printer name to use (overrides default)")
    parser.add_argument("--copies", "-c", type=int, default=1, metavar="N",
                       help="Number of copies to print (default: 1)")
    
    # Configuration options (used with --configure)
    parser.add_argument("--paper", choices=["letter", "a4", "legal"],
                       help="Paper size for printing")
    parser.add_argument("--quality", choices=["draft", "normal", "high"],
                       help="Print quality setting")
    parser.add_argument("--color", choices=["color", "grayscale", "monochrome"],
                       help="Color mode for printing")
    
    args = parser.parse_args()
    
    try:
        if args.list_cards:
            show_database_cards()
        
        elif args.list_printers:
            list_available_printers()
        
        elif args.print:
            success = print_card_by_name(args.print, args.printer, args.copies)
            if not success:
                exit(1)
        
        elif args.print_multiple:
            success = print_cards_from_database(args.print_multiple, args.printer, args.copies)
            if not success:
                exit(1)
        
        elif args.search:
            success = print_cards_from_search(args.search, args.printer, args.copies)
            if not success:
                exit(1)
        
        elif args.configure:
            configure_printer(args.printer, args.paper, args.quality, args.color)
    
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        exit(1)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)


if __name__ == "__main__":
    main()
