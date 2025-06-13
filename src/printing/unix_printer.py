# SPDX-License-Identifier: Apache-2.0
# src.printing.unix_printer

"""
Unix/Linux/macOS printer implementation using CUPS and lpr commands.

This module provides printing functionality for Unix-based systems including
macOS and Linux distributions, using the Common Unix Printing System (CUPS)
and standard lpr commands for direct printer communication.

Classes:
    UnixCardPrinter: Unix/Linux/macOS implementation of CardPrinter
"""

import os
import subprocess
import tempfile
from typing import List, Optional
from .base_printer import CardPrinter


class UnixCardPrinter(CardPrinter):
    """
    Unix/Linux/macOS implementation of card printing using CUPS.
    
    This implementation uses the lpr command and CUPS system for printing
    card images directly to printers on Unix-based systems.
    
    Attributes:
        config: Print configuration settings
    """
    
    def __init__(self, config):
        """
        Initialize the Unix card printer.
        
        Args:
            config: Print configuration settings
        """
        super().__init__(config)
        self._check_system_requirements()
    
    def _check_system_requirements(self) -> None:
        """
        Check if required system commands are available.
        
        Raises:
            RuntimeError: If required commands are not available
        """
        required_commands = ['lpr', 'lpstat']
        missing_commands = []
        
        for cmd in required_commands:
            try:
                subprocess.run(['which', cmd], check=True, capture_output=True)
            except subprocess.CalledProcessError:
                missing_commands.append(cmd)
        
        if missing_commands:
            raise RuntimeError(
                f"Required printing commands not found: {', '.join(missing_commands)}. "
                "Please ensure CUPS is installed and configured."
            )
    
    def list_available_printers(self) -> List[str]:
        """
        List all available printers using lpstat command.
        
        Returns:
            List of printer names available for printing
        """
        try:
            result = subprocess.run(
                ['lpstat', '-p'],
                capture_output=True,
                text=True,
                check=True
            )
            
            printers = []
            for line in result.stdout.split('\n'):
                if line.startswith('printer '):
                    # Extract printer name from "printer name is ..." format
                    parts = line.split()
                    if len(parts) >= 2:
                        printers.append(parts[1])
            
            return printers
            
        except subprocess.CalledProcessError as e:
            print(f"Error listing printers: {e}")
            return []
    
    def print_image(self, image_path: str, printer_name: Optional[str] = None, 
                   copies: int = 1) -> bool:
        """
        Print a single card image using lpr command.
        
        Args:
            image_path: Path to the image file to print
            printer_name: Name of the printer to use (None for default)
            copies: Number of copies to print
            
        Returns:
            True if printing was successful, False otherwise
        """
        if not os.path.exists(image_path):
            print(f"Error: Image file not found: {image_path}")
            return False
        
        # Prepare the processed image
        temp_dir = self.config.temp_directory
        os.makedirs(temp_dir, exist_ok=True)
        
        # Create a temporary file for the processed image
        with tempfile.NamedTemporaryFile(
            suffix='.png', 
            dir=temp_dir, 
            delete=False
        ) as temp_file:
            temp_image_path = temp_file.name
        
        try:
            # Process the image (crop and center)
            if self.config.get("printing.auto_crop", True):
                crop_settings = self.config.crop_settings
                self.crop_and_center_image(
                    image_path,
                    temp_image_path,
                    **crop_settings,
                    canvas_size=self.config.canvas_size,
                    dpi=self.config.get("image_processing.dpi", 300)
                )
            else:
                # Just copy the original image
                import shutil
                shutil.copy2(image_path, temp_image_path)
            
            # Build lpr command
            lpr_cmd = ['lpr']
            
            # Add printer name if specified
            if printer_name:
                lpr_cmd.extend(['-P', printer_name])
            elif self.config.default_printer:
                lpr_cmd.extend(['-P', self.config.default_printer])
            
            # Add number of copies
            if copies > 1:
                lpr_cmd.extend(['-#', str(copies)])
            
            # Add print options based on configuration
            paper_size = self.config.get("printer.paper_size", "letter")
            orientation = self.config.get("printer.orientation", "portrait")
            quality = self.config.get("printer.quality", "high")
            color_mode = self.config.get("printer.color_mode", "color")
            
            # Add paper size option
            if paper_size == "a4":
                lpr_cmd.extend(['-o', 'media=A4'])
            elif paper_size == "legal":
                lpr_cmd.extend(['-o', 'media=Legal'])
            elif paper_size == "custom":
                # Use custom dimensions from configuration
                width = self.config.get("printer.custom_width", 3.5)
                height = self.config.get("printer.custom_height", 2.5)
                lpr_cmd.extend(['-o', f'media=Custom.{width}x{height}in'])
            else:  # letter (default)
                lpr_cmd.extend(['-o', 'media=Letter'])
            
            # Add orientation
            if orientation == "landscape":
                lpr_cmd.extend(['-o', 'landscape'])
            
            # Add quality settings
            if quality == "draft":
                lpr_cmd.extend(['-o', 'print-quality=3'])
            elif quality == "high":
                lpr_cmd.extend(['-o', 'print-quality=5'])
            # normal quality is default (4)
            
            # Add color mode
            if color_mode == "grayscale":
                lpr_cmd.extend(['-o', 'ColorModel=Gray'])
            elif color_mode == "monochrome":
                lpr_cmd.extend(['-o', 'ColorModel=Gray', '-o', 'print-quality=3'])
            
            # Add scaling options for card printing
            if self.config.get("printing.scale_to_fit", True):
                lpr_cmd.extend(['-o', 'fit-to-page'])
            
            # Add the image file
            lpr_cmd.append(temp_image_path)
            
            # Execute the print command
            print(f"Printing {image_path} with command: {' '.join(lpr_cmd)}")
            result = subprocess.run(lpr_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"Successfully sent {image_path} to printer")
                return True
            else:
                print(f"Error printing {image_path}: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"Error processing or printing {image_path}: {e}")
            return False
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_image_path)
            except OSError:
                pass
    
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
        success_count = 0
        total_images = len(image_paths)
        
        print(f"Printing {total_images} images...")
        
        for i, image_path in enumerate(image_paths, 1):
            print(f"[{i}/{total_images}] Processing {os.path.basename(image_path)}")
            
            if self.print_image(image_path, printer_name, copies):
                success_count += 1
            else:
                print(f"Failed to print {image_path}")
        
        print(f"\nPrinting complete: {success_count}/{total_images} images printed successfully")
        return success_count == total_images
    
    def get_printer_status(self, printer_name: Optional[str] = None) -> dict:
        """
        Get the status of a specific printer or the default printer.
        
        Args:
            printer_name: Name of the printer to check (None for default)
            
        Returns:
            Dictionary containing printer status information
        """
        target_printer = printer_name or self.config.default_printer
        
        if not target_printer:
            return {"error": "No printer specified and no default printer configured"}
        
        try:
            result = subprocess.run(
                ['lpstat', '-p', target_printer],
                capture_output=True,
                text=True,
                check=True
            )
            
            status_info = {
                "printer": target_printer,
                "available": True,
                "status": "unknown"
            }
            
            # Parse the status output
            if "is idle" in result.stdout:
                status_info["status"] = "idle"
            elif "is printing" in result.stdout:
                status_info["status"] = "printing"
            elif "disabled" in result.stdout:
                status_info["status"] = "disabled"
                status_info["available"] = False
            
            return status_info
            
        except subprocess.CalledProcessError:
            return {
                "printer": target_printer,
                "available": False,
                "status": "not found"
            }
