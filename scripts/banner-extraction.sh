#!/bin/bash

# Banner Extraction Automation Script for Linux/Mac
# Usage: ./banner-extraction.sh [command]

# Set project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Set log file
LOG_FILE="logs/banner-extraction.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create logs directory if it doesn't exist
mkdir -p logs

# Log function
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    log "ERROR: Node.js is not installed or not in PATH"
    exit 1
fi

# Get command from arguments
COMMAND=${1:-extract}

# Log start
log "Starting banner extraction automation..."

# Run the appropriate command
case $COMMAND in
    "extract")
        log "Running banner extraction..."
        node scripts/automateBannerExtraction.js extract
        if [ $? -ne 0 ]; then
            log "ERROR: Banner extraction failed"
            exit 1
        fi
        ;;
    "cleanup")
        log "Running banner cleanup..."
        node scripts/automateBannerExtraction.js cleanup
        ;;
    "health")
        log "Running health check..."
        node scripts/automateBannerExtraction.js health
        ;;
    "full")
        log "Running full automation cycle..."
        node scripts/automateBannerExtraction.js full
        ;;
    "help")
        echo
        echo "Banner Extraction Automation for Linux/Mac"
        echo
        echo "Usage: ./banner-extraction.sh [command]"
        echo
        echo "Commands:"
        echo "  extract    Run banner extraction only"
        echo "  cleanup    Run banner cleanup only"
        echo "  health     Run health check only"
        echo "  full       Run full automation cycle"
        echo "  help       Show this help"
        echo
        echo "Examples:"
        echo "  ./banner-extraction.sh extract"
        echo "  ./banner-extraction.sh full"
        echo "  ./banner-extraction.sh health"
        echo
        echo "For scheduling with cron:"
        echo "  # Edit crontab: crontab -e"
        echo "  # Run extraction every hour:"
        echo "  0 * * * * cd /path/to/project && ./banner-extraction.sh extract"
        echo "  # Run full cycle daily at 2 AM:"
        echo "  0 2 * * * cd /path/to/project && ./banner-extraction.sh full"
        echo "  # Health check every 6 hours:"
        echo "  0 */6 * * * cd /path/to/project && ./banner-extraction.sh health"
        echo
        ;;
    *)
        log "ERROR: Unknown command '$COMMAND'"
        log "Use './banner-extraction.sh help' for usage information"
        exit 1
        ;;
esac

log "Banner automation completed successfully"
exit 0 