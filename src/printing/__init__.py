# SPDX-License-Identifier: Apache-2.0
# src.printing

"""
Cross-platform card printing module for Scryfall card images.

This module provides printing functionality for Magic: The Gathering cards
downloaded through the Scryfall API, with support for macOS and Linux systems.

Classes:
    CardPrinter: Abstract base class for card printing
    UnixCardPrinter: Unix/Linux/macOS implementation using CUPS
    PrintConfig: Configuration management for printing settings

Functions:
    get_printer: Factory function to get appropriate printer instance
    list_printers: List available system printers
"""

from .base_printer import CardPrinter
from .unix_printer import UnixCardPrinter
from .config import PrintConfig
import platform

def get_printer(config: PrintConfig = None) -> CardPrinter:
    """
    Factory function to get the appropriate printer implementation.
    
    Args:
        config: Print configuration settings
        
    Returns:
        CardPrinter instance for the current platform
        
    Raises:
        NotImplementedError: If platform is not supported
    """
    if config is None:
        config = PrintConfig()
    
    system = platform.system().lower()
    if system in ['darwin', 'linux']:
        return UnixCardPrinter(config)
    else:
        raise NotImplementedError(f"Printing not supported on {system}")

def list_printers():
    """
    List available system printers.
    
    Returns:
        List of available printer names
    """
    printer = get_printer()
    return printer.list_available_printers()
