#!/bin/bash

echo "Running Debug Extractor with increased memory allocation..."
echo ""
echo "Usage: ./debugExtractor.sh [URL] [pageType]"
echo "Example: ./debugExtractor.sh https://www.myntra.com/men-tshirts searchPage"
echo ""
echo "Note: This script uses --max-old-space-size=4096 to increase memory limit"
echo ""

URL=${1:-"https://www.myntra.com/men-tshirts"}
PAGETYPE=${2:-"searchPage"}

echo "Extracting from: $URL"
echo "Page type: $PAGETYPE"
echo ""

node --max-old-space-size=4096 --expose-gc scripts/debugExtractor.js "$URL" "$PAGETYPE"

echo ""
echo "Extraction complete."
