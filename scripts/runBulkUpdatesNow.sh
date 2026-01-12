#!/bin/bash

# Shell script to run bulk updates immediately on Linux/Mac
# This script provides easy access to common bulk update operations

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo -e "   Immediate Bulk Update Runner (Linux/Mac)"
echo -e "==========================================${NC}"
echo

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed or not in PATH${NC}"
    echo "Please install Node.js and try again"
    exit 1
fi

# Change to the script directory
cd "$(dirname "$0")"

# Check if the main script exists
if [ ! -f "runBulkUpdatesNow.js" ]; then
    echo -e "${RED}ERROR: runBulkUpdatesNow.js not found in current directory${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo -e "${GREEN}Node.js version:${NC}"
node --version
echo

show_menu() {
    echo -e "${BLUE}=========================================="
    echo -e "   Bulk Update Options"
    echo -e "==========================================${NC}"
    echo
    echo "1. Run ALL platforms (Full bulk update)"
    echo "2. Run Amazon only"
    echo "3. Run Flipkart only"
    echo "4. Run Myntra only"
    echo "5. Run Ajio only"
    echo "6. Run Amazon Electronics only"
    echo "7. Run Amazon Fashion only"
    echo "8. Run Amazon Home & Kitchen only"
    echo "9. Custom platform and category"
    echo "10. Dry run (show what would be executed)"
    echo "11. Help"
    echo "0. Exit"
    echo
}

run_all() {
    echo
    echo -e "${YELLOW}Running ALL platforms bulk update...${NC}"
    echo "This may take a long time (1-3 hours depending on data volume)"
    echo
    read -p "Are you sure? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        node runBulkUpdatesNow.js
    fi
}

run_amazon() {
    echo
    echo -e "${YELLOW}Running Amazon bulk update...${NC}"
    node runBulkUpdatesNow.js amazon
}

run_flipkart() {
    echo
    echo -e "${YELLOW}Running Flipkart bulk update...${NC}"
    node runBulkUpdatesNow.js flipkart
}

run_myntra() {
    echo
    echo -e "${YELLOW}Running Myntra bulk update...${NC}"
    node runBulkUpdatesNow.js myntra
}

run_ajio() {
    echo
    echo -e "${YELLOW}Running Ajio bulk update...${NC}"
    node runBulkUpdatesNow.js ajio
}

run_amazon_electronics() {
    echo
    echo -e "${YELLOW}Running Amazon Electronics bulk update...${NC}"
    node runBulkUpdatesNow.js amazon electronics
}

run_amazon_fashion() {
    echo
    echo -e "${YELLOW}Running Amazon Fashion bulk update...${NC}"
    node runBulkUpdatesNow.js amazon fashion
}

run_amazon_home() {
    echo
    echo -e "${YELLOW}Running Amazon Home & Kitchen bulk update...${NC}"
    node runBulkUpdatesNow.js amazon home-kitchen
}

run_custom() {
    echo
    echo -e "${BLUE}Custom bulk update options:${NC}"
    echo
    read -p "Enter platform (amazon, flipkart, myntra, ajio): " platform
    read -p "Enter category (or leave blank for all categories): " category
    read -p "Enter target database (deals, productdeals, test) [deals]: " targetdb
    read -p "Enter source type (website, telegram, api) [website]: " sourcetype

    # Set defaults
    targetdb=${targetdb:-deals}
    sourcetype=${sourcetype:-website}

    if [ -z "$category" ]; then
        echo
        echo -e "${YELLOW}Running $platform bulk update...${NC}"
        node runBulkUpdatesNow.js "$platform" --target-db "$targetdb" --source-type "$sourcetype"
    else
        echo
        echo -e "${YELLOW}Running $platform $category bulk update...${NC}"
        node runBulkUpdatesNow.js "$platform" "$category" --target-db "$targetdb" --source-type "$sourcetype"
    fi
}

run_dry() {
    echo
    echo -e "${YELLOW}Running dry run for Amazon...${NC}"
    node runBulkUpdatesNow.js --dry-run amazon
    echo
    echo -e "${YELLOW}Running dry run for all platforms...${NC}"
    node runBulkUpdatesNow.js --dry-run
}

run_help() {
    echo
    node runBulkUpdatesNow.js --help
    echo
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter your choice (0-11): " choice

    case $choice in
        1) run_all ;;
        2) run_amazon ;;
        3) run_flipkart ;;
        4) run_myntra ;;
        5) run_ajio ;;
        6) run_amazon_electronics ;;
        7) run_amazon_fashion ;;
        8) run_amazon_home ;;
        9) run_custom ;;
        10) run_dry ;;
        11) run_help ;;
        0) 
            echo
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Please try again.${NC}"
            echo
            ;;
    esac

    echo
    echo -e "${BLUE}=========================================="
    echo -e "   Operation completed"
    echo -e "==========================================${NC}"
    echo
    read -p "Run another operation? (y/N): " again
    if [[ ! $again =~ ^[Yy]$ ]]; then
        echo
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
    fi
    echo
done


