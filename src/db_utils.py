#!/usr/bin/env python3
"""
Utility script for managing the Scryfall card database.
"""

import argparse
import os
import sys
from datetime import datetime
from db_manager import CardDatabase


def init_db():
    """Initialize the database."""
    with CardDatabase() as db:
        print(f"Database initialized at {db.db_path}")


def list_cards(limit=None, sort_by="download_date", order="desc"):
    """List all cards in the database."""
    with CardDatabase() as db:
        cursor = db.conn.cursor()
        
        # Build the query
        query = "SELECT * FROM downloaded_cards"
        
        # Add sorting
        valid_sort_fields = ["card_name", "download_date", "set_code"]
        if sort_by not in valid_sort_fields:
            sort_by = "download_date"
        
        valid_orders = ["asc", "desc"]
        if order.lower() not in valid_orders:
            order = "desc"
        
        query += f" ORDER BY {sort_by} {order.upper()}"
        
        # Add limit
        if limit and limit > 0:
            query += f" LIMIT {limit}"
        
        cursor.execute(query)
        cards = cursor.fetchall()
        
        if not cards:
            print("No cards found in the database.")
            return
        
        print(f"Found {len(cards)} cards in the database:")
        print("-" * 80)
        print(f"{'Card Name':<40} {'Set':<10} {'Downloaded':<20} {'Filename':<30}")
        print("-" * 80)
        
        for card in cards:
            download_date = datetime.fromisoformat(card['download_date'].replace('Z', '+00:00'))
            formatted_date = download_date.strftime("%Y-%m-%d %H:%M:%S")
            print(f"{card['card_name']:<40} {card['set_code'] or 'N/A':<10} {formatted_date:<20} {card['filename']:<30}")


def search_cards(search_term):
    """Search for cards in the database."""
    with CardDatabase() as db:
        cursor = db.conn.cursor()
        cursor.execute(
            "SELECT * FROM downloaded_cards WHERE card_name LIKE ? ORDER BY card_name",
            (f"%{search_term}%",)
        )
        cards = cursor.fetchall()
        
        if not cards:
            print(f"No cards found matching '{search_term}'.")
            return
        
        print(f"Found {len(cards)} cards matching '{search_term}':")
        print("-" * 80)
        print(f"{'Card Name':<40} {'Set':<10} {'Downloaded':<20}")
        print("-" * 80)
        
        for card in cards:
            download_date = datetime.fromisoformat(card['download_date'].replace('Z', '+00:00'))
            formatted_date = download_date.strftime("%Y-%m-%d %H:%M:%S")
            print(f"{card['card_name']:<40} {card['set_code'] or 'N/A':<10} {formatted_date:<20}")


def remove_card(card_name):
    """Remove a card from the database."""
    with CardDatabase() as db:
        if db.remove_card(card_name):
            print(f"Card '{card_name}' removed from the database.")
        else:
            print(f"Card '{card_name}' not found in the database.")


def get_stats():
    """Get database statistics."""
    with CardDatabase() as db:
        cursor = db.conn.cursor()
        
        # Total cards
        cursor.execute("SELECT COUNT(*) as count FROM downloaded_cards")
        total_cards = cursor.fetchone()['count']
        
        # Cards by set
        cursor.execute("""
            SELECT set_code, COUNT(*) as count 
            FROM downloaded_cards 
            WHERE set_code IS NOT NULL 
            GROUP BY set_code 
            ORDER BY count DESC
        """)
        sets = cursor.fetchall()
        
        # Most recent downloads
        cursor.execute("""
            SELECT card_name, download_date 
            FROM downloaded_cards 
            ORDER BY download_date DESC 
            LIMIT 5
        """)
        recent = cursor.fetchall()
        
        print(f"Database Statistics:")
        print(f"Total cards: {total_cards}")
        
        if sets:
            print("\nCards by set:")
            for set_data in sets:
                print(f"  {set_data['set_code'] or 'Unknown'}: {set_data['count']} cards")
        
        if recent:
            print("\nMost recent downloads:")
            for card in recent:
                download_date = datetime.fromisoformat(card['download_date'].replace('Z', '+00:00'))
                formatted_date = download_date.strftime("%Y-%m-%d %H:%M:%S")
                print(f"  {card['card_name']} ({formatted_date})")


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description="Scryfall Card Database Utilities")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Init command
    init_parser = subparsers.add_parser("init", help="Initialize the database")
    
    # List command
    list_parser = subparsers.add_parser("list", help="List downloaded cards")
    list_parser.add_argument("--limit", "-l", type=int, help="Limit the number of results")
    list_parser.add_argument("--sort", "-s", choices=["name", "date", "set"], default="date", 
                            help="Sort by field (default: date)")
    list_parser.add_argument("--order", "-o", choices=["asc", "desc"], default="desc",
                            help="Sort order (default: desc)")
    
    # Search command
    search_parser = subparsers.add_parser("search", help="Search for cards")
    search_parser.add_argument("term", help="Search term")
    
    # Remove command
    remove_parser = subparsers.add_parser("remove", help="Remove a card from the database")
    remove_parser.add_argument("card_name", help="Name of the card to remove")
    
    # Stats command
    stats_parser = subparsers.add_parser("stats", help="Show database statistics")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Execute the appropriate command
    if args.command == "init":
        init_db()
    elif args.command == "list":
        sort_mapping = {"name": "card_name", "date": "download_date", "set": "set_code"}
        sort_by = sort_mapping.get(args.sort, "download_date")
        list_cards(args.limit, sort_by, args.order)
    elif args.command == "search":
        search_cards(args.term)
    elif args.command == "remove":
        remove_card(args.card_name)
    elif args.command == "stats":
        get_stats()


if __name__ == "__main__":
    main()