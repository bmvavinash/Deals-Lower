#!/bin/bash
# Log checking commands for scheduler monitoring
# Usage: ./scripts/logCommands.sh [command] [options]

COMMAND=$1
OPTIONS=$2

case $COMMAND in
  "stats")
    echo "📊 Generating scheduler statistics..."
    node scripts/checkSchedulerLogs.js --hours=24
    ;;
  "monitor")
    echo "🔍 Starting real-time monitoring..."
    node scripts/checkSchedulerLogs.js --monitor
    ;;
  "errors")
    echo "❌ Checking for errors in last 24 hours..."
    node scripts/checkSchedulerLogs.js --hours=24 | grep -i "error"
    ;;
  "platform")
    if [ -z "$OPTIONS" ]; then
      echo "🏪 Usage: ./scripts/logCommands.sh platform [amazon|flipkart|ajio|myntra]"
      exit 1
    fi
    echo "🏪 Platform-specific statistics for $OPTIONS..."
    node scripts/checkSchedulerLogs.js --platform=$OPTIONS --hours=24
    ;;
  "detailed")
    echo "📋 Detailed scheduler report..."
    node scripts/checkSchedulerLogs.js --hours=48
    echo ""
    echo "📁 Checking log files..."
    ls -la logs/*.log
    ;;
  "reset")
    echo "🔄 Resetting statistics..."
    node -e "const { resetStats } = require('./scripts/enhancedLogging'); resetStats();"
    ;;
  *)
    echo "📚 Available commands:"
    echo "  stats     - Show scheduler statistics (last 24 hours)"
    echo "  monitor   - Real-time monitoring"
    echo "  errors    - Show errors from last 24 hours"
    echo "  platform  - Platform-specific stats (amazon, flipkart, ajio, myntra)"
    echo "  detailed  - Detailed report with log file info"
    echo "  reset     - Reset statistics"
    echo ""
    echo "Examples:"
    echo "  ./scripts/logCommands.sh stats"
    echo "  ./scripts/logCommands.sh platform amazon"
    echo "  ./scripts/logCommands.sh monitor"
    ;;
esac



