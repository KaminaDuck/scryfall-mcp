#!/usr/bin/env python3
"""
Test script for the Scryfall card database.
"""

import os
from db_manager import CardDatabase


def run_tests():
    """Run tests for the database functionality."""
    print("Running database tests...")
    
    # Use a test database file
    test_db_path = ".local/test_scryfall_db.sqlite"
    
    # Remove the test database if it exists
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    
    # Create a new database
    with CardDatabase(test_db_path) as db:
        print(f"Created test database at {test_db_path}")
        
        # Test adding cards
        print("\nAdding test cards...")
        test_cards = [
            {
                "card_name": "Black Lotus",
                "filename": "Black_Lotus.jpg",
                "card_id": "bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd",
                "set_code": "lea",
                "image_url": "https://example.com/black_lotus.jpg"
            },
            {
                "card_name": "Counterspell",
                "filename": "Counterspell.jpg",
                "card_id": "c5de7c20-0a2c-4424-bf15-76a6e0a69aae",
                "set_code": "mmq",
                "image_url": "https://example.com/counterspell.jpg"
            },
            {
                "card_name": "Lightning Bolt",
                "filename": "Lightning_Bolt.jpg",
                "card_id": "e3285e6b-3e79-4d7c-bf96-d920f973b122",
                "set_code": "m10",
                "image_url": "https://example.com/lightning_bolt.jpg"
            }
        ]
        
        for card in test_cards:
            db.add_card(**card)
            print(f"Added {card['card_name']}")
        
        # Test checking if cards exist
        print("\nChecking if cards exist...")
        for card_name in ["Black Lotus", "Counterspell", "Lightning Bolt", "Island"]:
            exists = db.card_exists(card_name)
            print(f"'{card_name}' exists: {exists}")
        
        # Test getting card info
        print("\nGetting card info...")
        lotus_info = db.get_card_info("Black Lotus")
        if lotus_info:
            print(f"Black Lotus info: {dict(lotus_info)}")
        
        # Test getting all cards
        print("\nGetting all cards...")
        all_cards = db.get_all_cards()
        print(f"Found {len(all_cards)} cards:")
        for card in all_cards:
            print(f"- {card['card_name']} ({card['set_code']})")
        
        # Test removing a card
        print("\nRemoving a card...")
        removed = db.remove_card("Counterspell")
        print(f"Removed Counterspell: {removed}")
        
        # Verify removal
        exists = db.card_exists("Counterspell")
        print(f"'Counterspell' exists after removal: {exists}")
        
        # Test getting all cards after removal
        all_cards = db.get_all_cards()
        print(f"Found {len(all_cards)} cards after removal:")
        for card in all_cards:
            print(f"- {card['card_name']} ({card['set_code']})")
    
    print("\nAll tests completed!")


if __name__ == "__main__":
    run_tests()