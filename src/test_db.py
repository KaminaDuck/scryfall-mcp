#!/usr/bin/env python3
"""
Test script for the Scryfall card database using pytest.
"""

import os
import pytest
from db_manager import CardDatabase


@pytest.fixture
def test_db_path():
    """Fixture to provide the test database path."""
    return ".local/test_scryfall_db.sqlite"


@pytest.fixture
def test_cards():
    """Fixture to provide test card data."""
    return [
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


@pytest.fixture
def card_db(test_db_path):
    """
    Fixture to provide a clean test database for each test.
    
    This fixture:
    1. Removes any existing test database
    2. Creates a fresh database
    3. Yields the database for the test to use
    4. Cleans up after the test is complete
    """
    # Remove the test database if it exists
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    
    # Create a new database
    db = CardDatabase(test_db_path)
    
    # Yield the database for the test to use
    yield db
    
    # Clean up after the test
    db.close()
    if os.path.exists(test_db_path):
        os.remove(test_db_path)


def test_add_card(card_db, test_cards):
    """Test adding cards to the database."""
    # Add test cards
    for card in test_cards:
        card_db.add_card(**card)
    
    # Verify cards were added
    for card in test_cards:
        assert card_db.card_exists(card["card_name"]) is True


def test_card_exists(card_db, test_cards):
    """Test checking if cards exist in the database."""
    # Add test cards
    for card in test_cards:
        card_db.add_card(**card)
    
    # Check existing cards
    for card in test_cards:
        assert card_db.card_exists(card["card_name"]) is True
    
    # Check non-existing card
    assert card_db.card_exists("Island") is False


def test_get_card_info(card_db, test_cards):
    """Test retrieving card information from the database."""
    # Add test cards
    for card in test_cards:
        card_db.add_card(**card)
    
    # Get info for Black Lotus
    lotus_info = card_db.get_card_info("Black Lotus")
    
    # Verify card info
    assert lotus_info is not None
    assert lotus_info["card_name"] == "Black Lotus"
    assert lotus_info["filename"] == "Black_Lotus.jpg"
    assert lotus_info["card_id"] == "bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd"
    assert lotus_info["set_code"] == "lea"
    assert lotus_info["image_url"] == "https://example.com/black_lotus.jpg"


def test_get_all_cards(card_db, test_cards):
    """Test retrieving all cards from the database."""
    # Add test cards
    for card in test_cards:
        card_db.add_card(**card)
    
    # Get all cards
    all_cards = card_db.get_all_cards()
    
    # Verify all cards were retrieved
    assert len(all_cards) == len(test_cards)
    
    # Create a set of card names from the database
    db_card_names = {card["card_name"] for card in all_cards}
    
    # Create a set of card names from the test data
    test_card_names = {card["card_name"] for card in test_cards}
    
    # Verify all test card names are in the database
    assert test_card_names.issubset(db_card_names)


def test_remove_card(card_db, test_cards):
    """Test removing a card from the database."""
    # Add test cards
    for card in test_cards:
        card_db.add_card(**card)
    
    # Verify Counterspell exists
    assert card_db.card_exists("Counterspell") is True
    
    # Remove Counterspell
    removed = card_db.remove_card("Counterspell")
    
    # Verify removal was successful
    assert removed is True
    assert card_db.card_exists("Counterspell") is False
    
    # Verify other cards still exist
    assert card_db.card_exists("Black Lotus") is True
    assert card_db.card_exists("Lightning Bolt") is True
    
    # Verify card count
    all_cards = card_db.get_all_cards()
    assert len(all_cards) == len(test_cards) - 1


def test_remove_nonexistent_card(card_db):
    """Test removing a card that doesn't exist."""
    # Try to remove a card that doesn't exist
    removed = card_db.remove_card("Nonexistent Card")
    
    # Verify removal failed
    assert removed is False


def test_database_context_manager(test_db_path, test_cards):
    """Test using the database as a context manager."""
    # Remove the test database if it exists
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    
    # Use the database as a context manager
    with CardDatabase(test_db_path) as db:
        # Add a card
        db.add_card(**test_cards[0])
        
        # Verify the card exists
        assert db.card_exists(test_cards[0]["card_name"]) is True
    
    # Verify the database connection was closed
    # (We can't directly test this, but we can create a new connection)
    with CardDatabase(test_db_path) as db:
        # Verify the card still exists
        assert db.card_exists(test_cards[0]["card_name"]) is True
    
    # Clean up
    if os.path.exists(test_db_path):
        os.remove(test_db_path)