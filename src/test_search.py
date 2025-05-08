#!/usr/bin/env python3
"""
Test script for the Scryfall search functionality using pytest.
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from io import StringIO
import sys

from scryfall_search import (
    search_cards,
    group_cards_by_name_and_art,
    display_card_options,
    get_user_selection
)


@pytest.fixture
def sample_cards():
    """Fixture to provide sample card data for testing."""
    return [
        {
            "name": "Lightning Bolt",
            "set": "m10",
            "set_name": "Magic 2010",
            "collector_number": "146",
            "artist": "Christopher Moeller",
            "id": "e3285e6b-3e79-4d7c-bf96-d920f973b122"
        },
        {
            "name": "Lightning Bolt",
            "set": "a25",
            "set_name": "Masters 25",
            "collector_number": "141",
            "artist": "Christopher Moeller",
            "id": "f5d3a155-5c5d-4c5a-8a18-07a89a2c2cee"
        },
        {
            "name": "Counterspell",
            "set": "mmq",
            "set_name": "Mercadian Masques",
            "collector_number": "69",
            "artist": "Mark Zug",
            "id": "c5de7c20-0a2c-4424-bf15-76a6e0a69aae"
        }
    ]


@pytest.fixture
def mock_scryfall_response():
    """Fixture to provide a mock Scryfall API response."""
    return {
        "object": "list",
        "data": [
            {
                "name": "Lightning Bolt",
                "set": "m10",
                "set_name": "Magic 2010",
                "collector_number": "146",
                "artist": "Christopher Moeller",
                "id": "e3285e6b-3e79-4d7c-bf96-d920f973b122"
            }
        ],
        "has_more": False
    }


@pytest.fixture
def mock_scryfall_paginated_response():
    """Fixture to provide a mock paginated Scryfall API response."""
    first_page = {
        "object": "list",
        "data": [
            {
                "name": "Lightning Bolt",
                "set": "m10",
                "set_name": "Magic 2010",
                "collector_number": "146",
                "artist": "Christopher Moeller",
                "id": "e3285e6b-3e79-4d7c-bf96-d920f973b122"
            }
        ],
        "has_more": True,
        "next_page": "https://api.scryfall.com/cards/search?page=2&q=name:lightning"
    }
    
    second_page = {
        "object": "list",
        "data": [
            {
                "name": "Lightning Bolt",
                "set": "a25",
                "set_name": "Masters 25",
                "collector_number": "141",
                "artist": "Christopher Moeller",
                "id": "f5d3a155-5c5d-4c5a-8a18-07a89a2c2cee"
            }
        ],
        "has_more": False
    }
    
    return (first_page, second_page)


def test_search_cards_success(mock_scryfall_response):
    """Test successful card search."""
    with patch('httpx.Client') as mock_client:
        mock_response = MagicMock()
        mock_response.json.return_value = mock_scryfall_response
        mock_response.raise_for_status.return_value = None
        
        mock_client.return_value.__enter__.return_value.get.return_value = mock_response
        
        result = search_cards("Lightning Bolt")
        
        assert len(result) == 1
        assert result[0]["name"] == "Lightning Bolt"
        assert result[0]["set"] == "m10"


def test_search_cards_pagination(mock_scryfall_paginated_response):
    """Test card search with pagination."""
    first_page, second_page = mock_scryfall_paginated_response
    
    with patch('httpx.Client') as mock_client:
        mock_response1 = MagicMock()
        mock_response1.json.return_value = first_page
        mock_response1.raise_for_status.return_value = None
        
        mock_response2 = MagicMock()
        mock_response2.json.return_value = second_page
        mock_response2.raise_for_status.return_value = None
        
        mock_client_instance = mock_client.return_value.__enter__.return_value
        mock_client_instance.get.side_effect = [mock_response1, mock_response2]
        
        result = search_cards("Lightning")
        
        assert len(result) == 2
        assert result[0]["name"] == "Lightning Bolt"
        assert result[0]["set"] == "m10"
        assert result[1]["name"] == "Lightning Bolt"
        assert result[1]["set"] == "a25"


def test_search_cards_error():
    """Test card search with API error."""
    with patch('httpx.Client') as mock_client:
        mock_client_instance = mock_client.return_value.__enter__.return_value
        mock_client_instance.get.side_effect = Exception("API Error")
        
        result = search_cards("NonexistentCard")
        
        assert result == []


def test_search_cards_no_results():
    """Test card search with no results."""
    with patch('httpx.Client') as mock_client:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "object": "error",
            "details": "No cards found matching your query."
        }
        mock_response.raise_for_status.return_value = None
        
        mock_client_instance = mock_client.return_value.__enter__.return_value
        mock_client_instance.get.return_value = mock_response
        
        result = search_cards("NonexistentCard")
        
        assert result == []


def test_group_cards_by_name_and_art(sample_cards):
    """Test grouping cards by name and art."""
    result = group_cards_by_name_and_art(sample_cards)
    
    assert len(result) == 2  # Two unique card names
    assert "Lightning Bolt" in result
    assert "Counterspell" in result
    assert len(result["Lightning Bolt"]) == 2  # Two versions of Lightning Bolt
    assert len(result["Counterspell"]) == 1  # One version of Counterspell
    
    # Check that display_name was added
    assert "display_name" in result["Lightning Bolt"][0]
    assert "M10" in result["Lightning Bolt"][0]["display_name"]
    assert "Christopher Moeller" in result["Lightning Bolt"][0]["display_name"]


def test_display_card_options(sample_cards):
    """Test displaying card options."""
    card_groups = group_cards_by_name_and_art(sample_cards)
    
    # Capture stdout
    captured_output = StringIO()
    sys.stdout = captured_output
    
    options = display_card_options(card_groups)
    
    # Reset stdout
    sys.stdout = sys.__stdout__
    
    output = captured_output.getvalue()
    
    assert len(options) == 3  # Total of 3 card versions
    assert "Lightning Bolt" in output
    assert "ALTERNATE ARTS" in output  # Should show alternate art notice
    assert "Counterspell" in output
    assert "1." in output  # Should show option numbers
    assert "2." in output
    assert "3." in output


def test_display_card_options_empty():
    """Test displaying card options with empty input."""
    # Capture stdout
    captured_output = StringIO()
    sys.stdout = captured_output
    
    options = display_card_options({})
    
    # Reset stdout
    sys.stdout = sys.__stdout__
    
    output = captured_output.getvalue()
    
    assert options == []
    assert "No cards found" in output


def test_get_user_selection():
    """Test getting user selection."""
    options = [
        {"name": "Lightning Bolt", "set": "m10"},
        {"name": "Counterspell", "set": "mmq"}
    ]
    
    # Mock user input
    with patch('builtins.input', return_value="1"):
        result = get_user_selection(options)
        
        assert result == options[0]
    
    # Test with invalid input then valid input
    with patch('builtins.input', side_effect=["invalid", "2"]):
        result = get_user_selection(options)
        
        assert result == options[1]
    
    # Test with quit command
    with patch('builtins.input', return_value="q"):
        result = get_user_selection(options)
        
        assert result is None


def test_get_user_selection_empty():
    """Test getting user selection with empty options."""
    result = get_user_selection([])
    
    assert result is None