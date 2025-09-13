#!/usr/bin/env node

/**
 * Script to check scheduler logs and statistics
 * Usage: node scripts/checkSchedulerLogs.js [--hours=24] [--platform=all]
 */

const fs = require('fs');
const path = require('path');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('schedulerStats');

// Parse command line arguments
const args = process.argv.slice(2);
let hours = 24;
let platform = 'all';

args.forEach(arg => {
  if (arg.startsWith('--hours=')) {
    hours = parseInt(arg.split('=')[1]) || 24;
  }
  if (arg.startsWith('--platform=')) {
    platform = arg.split('=')[1];
  }
});

// Log file paths
const logDir = path.join(__dirname, '..', 'logs');
const telegramLogPath = path.join(logDir, 'telegram.log');
const schedulerLogPath = path.join(logDir, 'scheduler.log');
const firebaseLogPath = path.join(logDir, 'firebaseUpdate.log');

function parseLogFile(filePath, hours) {
  if (!fs.existsSync(filePath)) {
    return { triggers: 0, products: { created: 0, updated: 0, noChanges: 0 }, errors: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  let triggers = 0;
  let products = { created: 0, updated: 0, noChanges: 0 };
  let errors = 0;

  lines.forEach(line => {
    try {
      const logEntry = JSON.parse(line);
      const logTime = new Date(logEntry.timestamp);
      
      if (logTime < cutoffTime) return;

      // Count scheduler triggers
      if (logEntry.message && logEntry.message.includes('Bulk update started')) {
        triggers++;
      }

      // Count product operations
      if (logEntry.message && logEntry.message.includes('Product updated successfully')) {
        products.updated++;
      }
      if (logEntry.message && logEntry.message.includes('New product created')) {
        products.created++;
      }
      if (logEntry.message && logEntry.message.includes('No changes detected')) {
        products.noChanges++;
      }

      // Count errors
      if (logEntry.level === 'error' || logEntry.message?.includes('Error')) {
        errors++;
      }
    } catch (e) {
      // Skip non-JSON lines
    }
  });

  return { triggers, products, errors };
}

function generateReport() {
  console.log(`\n📊 SCHEDULER STATISTICS (Last ${hours} hours)`);
  console.log('='.repeat(50));

  // Parse all log files
  const telegramStats = parseLogFile(telegramLogPath, hours);
  const schedulerStats = parseLogFile(schedulerLogPath, hours);
  const firebaseStats = parseLogFile(firebaseLogPath, hours);

  // Combine stats
  const totalTriggers = telegramStats.triggers + schedulerStats.triggers;
  const totalCreated = telegramStats.products.created + schedulerStats.products.created + firebaseStats.products.created;
  const totalUpdated = telegramStats.products.updated + schedulerStats.products.updated + firebaseStats.products.updated;
  const totalNoChanges = telegramStats.products.noChanges + schedulerStats.products.noChanges + firebaseStats.products.noChanges;
  const totalErrors = telegramStats.errors + schedulerStats.errors + firebaseStats.errors;

  console.log(`🔄 Scheduler Triggers: ${totalTriggers}`);
  console.log(`✅ Products Created: ${totalCreated}`);
  console.log(`🔄 Products Updated: ${totalUpdated}`);
  console.log(`⏭️  No Changes (Skipped): ${totalNoChanges}`);
  console.log(`❌ Errors: ${totalErrors}`);

  if (totalTriggers > 0) {
    console.log(`\n📈 Efficiency Metrics:`);
    console.log(`   - Products per trigger: ${((totalCreated + totalUpdated) / totalTriggers).toFixed(2)}`);
    console.log(`   - Update success rate: ${((totalUpdated / (totalUpdated + totalNoChanges)) * 100).toFixed(1)}%`);
    console.log(`   - Error rate: ${((totalErrors / totalTriggers) * 100).toFixed(1)}%`);
  }

  // Platform-specific stats
  if (platform !== 'all') {
    console.log(`\n🏪 Platform: ${platform.toUpperCase()}`);
    // Add platform-specific parsing if needed
  }

  console.log('\n' + '='.repeat(50));
}

// Real-time monitoring
function startRealTimeMonitoring() {
  console.log('🔍 Starting real-time monitoring (Press Ctrl+C to stop)...\n');
  
  let lastStats = { triggers: 0, created: 0, updated: 0, errors: 0 };
  
  setInterval(() => {
    const currentStats = parseLogFile(telegramLogPath, 1); // Last 1 hour
    const delta = {
      triggers: currentStats.triggers - lastStats.triggers,
      created: currentStats.products.created - lastStats.created,
      updated: currentStats.products.updated - lastStats.updated,
      errors: currentStats.errors - lastStats.errors
    };

    if (delta.triggers > 0 || delta.created > 0 || delta.updated > 0 || delta.errors > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] +${delta.triggers} triggers, +${delta.created} created, +${delta.updated} updated, +${delta.errors} errors`);
    }

    lastStats = currentStats;
  }, 30000); // Check every 30 seconds
}

// Main execution
if (args.includes('--monitor')) {
  startRealTimeMonitoring();
} else {
  generateReport();
}

module.exports = { generateReport, parseLogFile };



