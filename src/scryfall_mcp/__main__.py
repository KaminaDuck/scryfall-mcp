#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""
Entrypoint for the Scryfall MCP package.

This module serves as the entrypoint when the package is run directly
using `python -m mcp` or when installed as an executable.
"""

from . import main

if __name__ == "__main__":
    main()
