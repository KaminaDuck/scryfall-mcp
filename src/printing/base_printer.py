# SPDX-License-Identifier: Apache-2.0
# src.printing.base_printer

"""
Abstract base class for card printing functionality.

This module defines the interface that all printer implementations must follow,
providing a consistent API for printing Magic: The Gathering cards across
different operating systems.

Classes:
    CardPrinter: Abstract base class for card printing implementations
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from PIL import Image


class CardPrinter(ABC):
    """
    Abstract base class for card printing implementations.
    
    This class defines the interface that all printer implementations must
    follow, ensuring consistent behavior across different platforms.
    
    Attributes:
        config: Print configuration settings
    """
    
    def __init__(self, config):
        """
        Initialize the card printer.
        
        Args:
            config: Print configuration settings
        """
        self.config = config
    
    @abstractmethod
    def list_available_printers(self) -> List[str]:
        """
        List all available printers on the system.
        
        Returns:
            List of printer names available for printing
        """
        pass
    
    @abstractmethod
    def print_image(self, image_path: str, printer_name: Optional[str] = None, 
                   copies: int = 1) -> bool:
        """
        Print a single card image.
        
        Args:
            image_path: Path to the image file to print
            printer_name: Name of the printer to use (None for default)
            copies: Number of copies to print
            
        Returns:
            True if printing was successful, False otherwise
        """
        pass
    
    @abstractmethod
    def print_images(self, image_paths: List[str], printer_name: Optional[str] = None,
                    copies: int = 1) -> bool:
        """
        Print multiple card images.
        
        Args:
            image_paths: List of paths to image files to print
            printer_name: Name of the printer to use (None for default)
            copies: Number of copies to print for each image
            
        Returns:
            True if all images were printed successfully, False otherwise
        """
        pass
    
    def crop_and_center_image(self, image_path: str, output_path: str,
                             crop_percentage_top: float = 0.07,
                             crop_percentage_bottom: float = 0.07,
                             crop_percentage_left_right: float = 0.07,
                             canvas_size: Tuple[int, int] = (750, 1050),
                             dpi: int = 300) -> None:
        """
        Crop the image, scale it, and center it on a rectangular canvas.
        
        Args:
            image_path: Path to the input image
            output_path: Path where the processed image will be saved
            crop_percentage_top: Percentage to crop from top
            crop_percentage_bottom: Percentage to crop from bottom
            crop_percentage_left_right: Percentage to crop from left and right
            canvas_size: Target canvas size in pixels (width, height)
            dpi: Target DPI for the output image
        """
        # Reduce canvas size by 8% for scaling
        canvas_width, canvas_height = canvas_size
        canvas_width = int(canvas_width * 0.92)
        canvas_height = int(canvas_height * 0.92)

        # Open the image
        img = Image.open(image_path)
        img_width, img_height = img.size

        # Crop the image by the specified percentages
        crop_left_right = int(img_width * crop_percentage_left_right)
        crop_top = int(img_height * crop_percentage_top)
        crop_bottom = int(img_height * crop_percentage_bottom)
        img = img.crop((crop_left_right, crop_top, img_width - crop_left_right, img_height - crop_bottom))

        # Calculate the scaling factor to fit the image within the canvas
        scale_x = canvas_width / img.width
        scale_y = canvas_height / img.height
        scale = min(scale_x, scale_y)

        # Scale the image
        new_width = int(img.width * scale)
        new_height = int(img.height * scale)
        img = img.resize((new_width, new_height), Image.LANCZOS)

        # Create a blank white canvas
        canvas = Image.new("RGB", (int(canvas_width), int(canvas_height)), (255, 255, 255))

        # Center the scaled image on the canvas
        x_offset = (canvas_width - new_width) // 2
        y_offset = (canvas_height - new_height) // 2
        canvas.paste(img, (int(x_offset), int(y_offset)))

        # Save the final image
        canvas.save(output_path, "PNG")
        print(f"Saved cropped and centered image to {output_path}")
