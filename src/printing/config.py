# SPDX-License-Identifier: Apache-2.0
# src.printing.config

"""
Configuration management for card printing functionality.

This module handles configuration settings for card printing, including
printer preferences, image processing parameters, and output directories.

Classes:
    PrintConfig: Configuration management for printing settings
"""

import json
import os
from typing import Optional, Dict, Any, Tuple


class PrintConfig:
    """
    Configuration management for printing settings.
    
    Handles loading, saving, and managing configuration settings for
    card printing functionality including printer preferences and
    image processing parameters.
    
    Attributes:
        config_path: Path to the configuration file
        settings: Dictionary containing all configuration settings
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize print configuration.
        
        Args:
            config_path: Path to configuration file (uses default if None)
        """
        if config_path is None:
            config_path = os.path.join(".local", "print_settings.json")
        
        self.config_path = config_path
        self.settings = self._load_default_settings()
        self._load_config()
    
    def _load_default_settings(self) -> Dict[str, Any]:
        """
        Load default configuration settings.
        
        Returns:
            Dictionary containing default settings
        """
        return {
            "printer": {
                "default_printer": None,
                "paper_size": "custom",  # letter, a4, legal, custom
                "custom_width": 3.5,  # width in inches for custom paper size
                "custom_height": 2.5,  # height in inches for custom paper size
                "orientation": "portrait",  # portrait, landscape
                "quality": "high",  # draft, normal, high
                "color_mode": "color"  # color, grayscale, monochrome
            },
            "image_processing": {
                "crop_percentage_top": 0.07,
                "crop_percentage_bottom": 0.07,
                "crop_percentage_left_right": 0.07,
                "canvas_size": [750, 1050],  # width, height in pixels
                "dpi": 300,
                "output_format": "PNG"
            },
            "directories": {
                "input_images": ".local/scryfall_card_images",
                "output_images": ".local/scryfall_prints",
                "temp_directory": ".local/temp_prints"
            },
            "printing": {
                "copies_per_card": 1,
                "auto_crop": True,
                "print_borders": False,
                "scale_to_fit": True
            }
        }
    
    def _load_config(self) -> None:
        """Load configuration from file if it exists."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    loaded_settings = json.load(f)
                    # Merge loaded settings with defaults
                    self._merge_settings(self.settings, loaded_settings)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not load config from {self.config_path}: {e}")
                print("Using default settings.")
    
    def _merge_settings(self, default: Dict[str, Any], loaded: Dict[str, Any]) -> None:
        """
        Recursively merge loaded settings with default settings.
        
        Args:
            default: Default settings dictionary
            loaded: Loaded settings dictionary
        """
        for key, value in loaded.items():
            if key in default:
                if isinstance(default[key], dict) and isinstance(value, dict):
                    self._merge_settings(default[key], value)
                else:
                    default[key] = value
    
    def save_config(self) -> None:
        """Save current configuration to file."""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        try:
            with open(self.config_path, 'w') as f:
                json.dump(self.settings, f, indent=2)
        except IOError as e:
            print(f"Warning: Could not save config to {self.config_path}: {e}")
    
    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get a configuration value using dot notation.
        
        Args:
            key_path: Dot-separated path to the setting (e.g., "printer.default_printer")
            default: Default value if key is not found
            
        Returns:
            Configuration value or default
        """
        keys = key_path.split('.')
        value = self.settings
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        
        return value
    
    def set(self, key_path: str, value: Any) -> None:
        """
        Set a configuration value using dot notation.
        
        Args:
            key_path: Dot-separated path to the setting
            value: Value to set
        """
        keys = key_path.split('.')
        current = self.settings
        
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        
        current[keys[-1]] = value
    
    @property
    def default_printer(self) -> Optional[str]:
        """Get the default printer name."""
        return self.get("printer.default_printer")
    
    @default_printer.setter
    def default_printer(self, value: str) -> None:
        """Set the default printer name."""
        self.set("printer.default_printer", value)
    
    @property
    def input_directory(self) -> str:
        """Get the input images directory."""
        return self.get("directories.input_images", ".local/scryfall_card_images")
    
    @property
    def output_directory(self) -> str:
        """Get the output images directory."""
        return self.get("directories.output_images", ".local/scryfall_prints")
    
    @property
    def temp_directory(self) -> str:
        """Get the temporary directory for processing."""
        return self.get("directories.temp_directory", ".local/temp_prints")
    
    @property
    def canvas_size(self) -> Tuple[int, int]:
        """Get the canvas size for image processing."""
        size = self.get("image_processing.canvas_size", [750, 1050])
        return tuple(size)
    
    @property
    def crop_settings(self) -> Dict[str, float]:
        """Get crop settings for image processing."""
        return {
            "crop_percentage_top": self.get("image_processing.crop_percentage_top", 0.07),
            "crop_percentage_bottom": self.get("image_processing.crop_percentage_bottom", 0.07),
            "crop_percentage_left_right": self.get("image_processing.crop_percentage_left_right", 0.07)
        }
