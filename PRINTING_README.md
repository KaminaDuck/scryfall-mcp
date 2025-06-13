# Card Printing System

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A cross-platform card printing system for Magic: The Gathering cards downloaded through the Scryfall API. This system supports direct printing to CUPS-compatible printers on macOS and Linux systems.

## Features

- **Cross-Platform Support**: Works on macOS and Linux systems using CUPS
- **Database Integration**: Prints cards directly from the local Scryfall database
- **Image Processing**: Automatic cropping, centering, and scaling for optimal card printing
- **Flexible Configuration**: Configurable printer settings, paper sizes, and print quality
- **Search Functionality**: Print cards by name or search pattern
- **Batch Printing**: Print multiple cards in a single operation
- **Print Management**: List available printers and configure default settings

## Installation

The printing system is included with the main Scryfall download project. Ensure you have the required dependencies:

```bash
# Install dependencies
uv sync

# Or with pip
pip install pillow>=10.0.0
```

### System Requirements

**macOS/Linux:**
- CUPS printing system installed and configured
- `lpr` and `lpstat` commands available
- At least one printer configured in the system

**Verify CUPS installation:**
```bash
# Check if CUPS commands are available
which lpr lpstat

# List available printers
lpstat -p
```

## Quick Start

### List Available Printers

```bash
python src/print_card.py --list-printers
```

### List Available Cards

```bash
python src/print_card.py --list-cards
```

### Configure Default Printer

```bash
python src/print_card.py --configure --printer "Canon_G3070_series" --paper "a4" --quality "high"
```

### Print Cards

```bash
# Print a specific card
python src/print_card.py --print "Lightning Bolt___art_crop"

# Print multiple cards
python src/print_card.py --print-multiple "Lightning Bolt___art_crop" "Black Lotus___art_crop"

# Print all cards matching a pattern
python src/print_card.py --search "lightning"

# Print with specific printer and multiple copies
python src/print_card.py --print "Black Lotus___art_crop" --printer "Canon_G3070_series" --copies 3
```

## Configuration

### Configuration File

The system uses a JSON configuration file located at `.local/print_settings.json`:

```json
{
  "printer": {
    "default_printer": "Canon_G3070_series",
    "paper_size": "a4",
    "orientation": "portrait",
    "quality": "high",
    "color_mode": "color"
  },
  "image_processing": {
    "crop_percentage_top": 0.07,
    "crop_percentage_bottom": 0.07,
    "crop_percentage_left_right": 0.07,
    "canvas_size": [750, 1050],
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
    "auto_crop": true,
    "print_borders": false,
    "scale_to_fit": true
  }
}
```

### Configuration Options

#### Printer Settings
- **default_printer**: Default printer name to use
- **paper_size**: `letter`, `a4`, or `legal`
- **orientation**: `portrait` or `landscape`
- **quality**: `draft`, `normal`, or `high`
- **color_mode**: `color`, `grayscale`, or `monochrome`

#### Image Processing
- **crop_percentage_***: Percentage to crop from each edge (0.0-1.0)
- **canvas_size**: Target canvas size in pixels [width, height]
- **dpi**: Target DPI for processed images
- **output_format**: Image format for processed files

#### Printing Options
- **auto_crop**: Automatically crop and center images before printing
- **print_borders**: Add borders around cards (not implemented)
- **scale_to_fit**: Scale images to fit the page

## Command Line Interface

### Usage

```bash
python src/print_card.py [OPTIONS]
```

### Options

#### Actions (mutually exclusive)
- `--list-cards`: List all cards available for printing
- `--list-printers`: List all available system printers
- `--print CARD_NAME`: Print a specific card by name
- `--print-multiple CARD_NAME [CARD_NAME ...]`: Print multiple cards
- `--search PATTERN`: Print all cards matching the search pattern
- `--configure`: Configure printer settings

#### Printing Options
- `--printer PRINTER_NAME`, `-p`: Printer to use (overrides default)
- `--copies N`, `-c`: Number of copies to print (default: 1)

#### Configuration Options (used with --configure)
- `--paper {letter,a4,legal}`: Paper size for printing
- `--quality {draft,normal,high}`: Print quality setting
- `--color {color,grayscale,monochrome}`: Color mode for printing

### Examples

```bash
# List all available cards
python src/print_card.py --list-cards

# List available printers
python src/print_card.py --list-printers

# Print a specific card
python src/print_card.py --print "Lightning Bolt___art_crop"

# Print multiple cards with 2 copies each
python src/print_card.py --print-multiple "Lightning Bolt___art_crop" "Counterspell___art_crop" --copies 2

# Print all cards containing "bolt" in the name
python src/print_card.py --search "bolt"

# Configure printer settings
python src/print_card.py --configure --printer "Canon_G3070_series" --paper a4 --quality high

# Print to a specific printer
python src/print_card.py --print "Black Lotus___art_crop" --printer "HP_LaserJet" --copies 3
```

## Architecture

### Module Structure

```
src/
├── print_card.py              # Main CLI interface
└── printing/
    ├── __init__.py            # Package initialization and factory functions
    ├── base_printer.py        # Abstract base class for printers
    ├── unix_printer.py        # Unix/Linux/macOS implementation
    └── config.py              # Configuration management
```

### Class Hierarchy

- **CardPrinter** (Abstract Base Class)
  - **UnixCardPrinter** (macOS/Linux implementation using CUPS)

### Key Components

#### CardPrinter (Abstract Base Class)
- Defines the interface for all printer implementations
- Provides common image processing functionality
- Handles cropping, centering, and scaling operations

#### UnixCardPrinter
- Implements printing for Unix-based systems (macOS, Linux)
- Uses CUPS printing system via `lpr` command
- Supports various print options and paper sizes

#### PrintConfig
- Manages configuration settings
- Supports dot-notation for nested settings
- Automatically loads and saves configuration files

## Image Processing

The system automatically processes card images before printing:

1. **Cropping**: Removes borders based on configurable percentages
2. **Scaling**: Scales images to fit the target canvas size
3. **Centering**: Centers the scaled image on a white canvas
4. **Format Conversion**: Converts to PNG for optimal printing

### Default Processing Settings

- **Top/Bottom Crop**: 7% of image height
- **Left/Right Crop**: 7% of image width
- **Canvas Size**: 750x1050 pixels (2.5" x 3.5" at 300 DPI)
- **Scaling**: 92% of canvas size for margins

## Integration with Scryfall Database

The printing system integrates seamlessly with the existing Scryfall database:

- **Card Lookup**: Finds cards by name in the local database
- **File Resolution**: Automatically locates image files
- **Search Support**: Supports pattern matching for card names
- **Batch Operations**: Processes multiple cards efficiently

## Troubleshooting

### Common Issues

#### "Required printing commands not found"
```bash
# Install CUPS on Ubuntu/Debian
sudo apt-get install cups cups-client

# Install CUPS on macOS (usually pre-installed)
# Check if CUPS is running
sudo launchctl list | grep cups
```

#### "No printers found"
```bash
# Add a printer using system preferences or command line
# macOS: System Preferences > Printers & Scanners
# Linux: Use system printer configuration tool

# Check printer status
lpstat -p
```

#### "Image file not found"
- Ensure cards are downloaded using the Scryfall download scripts
- Check that the database contains the correct file paths
- Verify that image files exist in `.local/scryfall_card_images/`

#### Print Quality Issues
- Adjust crop percentages in configuration
- Modify canvas size for different card dimensions
- Change print quality settings (draft/normal/high)

### Debug Mode

For debugging print issues, check the generated `lpr` commands in the output:

```bash
python src/print_card.py --print "Lightning Bolt___art_crop" --printer "Canon_G3070_series"
```

The system will show the exact `lpr` command being executed, which can help diagnose printer-specific issues.

## Contributing

Contributions are welcome! Areas for improvement:

1. **Windows Support**: Add Windows printer implementation
2. **PDF Generation**: Add PDF output option for offline printing
3. **Layout Options**: Support for multiple cards per page
4. **Print Preview**: Add preview functionality before printing
5. **Advanced Cropping**: More sophisticated image processing options

## License

This project is licensed under the Apache License 2.0 - see the main project LICENSE file for details.

## Support

For issues related to card printing:

1. Check that CUPS is properly installed and configured
2. Verify that your printer is accessible via `lpstat -p`
3. Ensure card images are downloaded and in the database
4. Check the configuration file for correct settings

For general project support, see the main README.md file.
