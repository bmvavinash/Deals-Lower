#!/usr/bin/env node

/**
 * Scheduler State Management Script
 * Allows you to view, update, and manage scheduler state in the database
 * Usage: node scripts/manageSchedulerState.js [command] [options]
 */

const { 
  loadState, 
  saveState,
  loadPreviousState,
  savePreviousState,
  updateSchedulerDuration,
  updateSchedulerTriggerDuration,
  getStateSummary,
  getPreviousStateSummary,
  resetState,
  resetPreviousState,
  backupCurrentStateToPrevious,
  setActiveStatus
} = require('../database/firebaseDB/schedulerStateDB');

const { getModuleLogger } = require('../logger/logger');
const logger = getModuleLogger('manageSchedulerState');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const options = args.slice(1);

async function showHelp() {
  console.log(`
📊 Scheduler State Management Commands

Current State Commands:
  view                    - View current scheduler state
  summary                 - Show state summary
  duration [hours]        - Update scheduler duration (e.g., duration 3)
  active [true|false]     - Set active status
  reset                   - Reset current state (use with caution)

Previous State Commands:
  view-previous           - View previous scheduler state
  summary-previous        - Show previous state summary
  duration-previous [hours] - Update previous scheduler trigger duration
  reset-previous          - Reset previous state (use with caution)

Utility Commands:
  backup                  - Backup current state to previous state
  compare                 - Compare current vs previous state
  help                    - Show this help message

Examples:
  node scripts/manageSchedulerState.js view
  node scripts/manageSchedulerState.js duration 4
  node scripts/manageSchedulerState.js active false
  node scripts/manageSchedulerState.js compare
  node scripts/manageSchedulerState.js backup
`);
}

async function viewCurrentState() {
  try {
    const state = await loadState();
    console.log('\n📊 Current Scheduler State:');
    console.log('='.repeat(50));
    console.log(`Last Updated: ${state.lastUpdated || 'Never'}`);
    console.log(`Scheduler Duration: ${state.schedulerDuration / (60 * 60 * 1000)} hours`);
    console.log(`Last Bulk Run: ${state.lastBulkRun || 'Never'}`);
    console.log(`Total Runs: ${state.totalRuns}`);
    console.log(`Total Products Processed: ${state.totalProductsProcessed}`);
    console.log(`Active: ${state.isActive}`);
    console.log(`Version: ${state.version}`);
    console.log(`Created: ${state.createdAt}`);
    console.log(`Updated: ${state.updatedAt}`);
    
    if (state.lastError) {
      console.log(`\n❌ Last Error: ${state.lastError.message}`);
      console.log(`   Timestamp: ${state.lastError.timestamp}`);
    }
    
    if (Object.keys(state.platformStates).length > 0) {
      console.log('\n🏪 Platform States:');
      Object.entries(state.platformStates).forEach(([platform, platformState]) => {
        console.log(`   ${platform}: ${platformState.lastUpdated || 'Never'}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to view current state:', error.message);
  }
}

async function viewPreviousState() {
  try {
    const previousState = await loadPreviousState();
    console.log('\n📊 Previous Scheduler State:');
    console.log('='.repeat(50));
    console.log(`Last Updated Scheduler: ${previousState.lastUpdatedScheduler || 'Never'}`);
    console.log(`Scheduler Trigger Duration: ${previousState.schedulerTriggerDuration / (60 * 60 * 1000)} hours`);
    console.log(`Previous Bulk Run: ${previousState.previousBulkRun || 'Never'}`);
    console.log(`Previous Total Runs: ${previousState.previousTotalRuns}`);
    console.log(`Previous Products Processed: ${previousState.previousProductsProcessed}`);
    console.log(`Version: ${previousState.version}`);
    console.log(`Created: ${previousState.createdAt}`);
    console.log(`Updated: ${previousState.updatedAt}`);
    
    if (previousState.previousError) {
      console.log(`\n❌ Previous Error: ${previousState.previousError.message}`);
      console.log(`   Timestamp: ${previousState.previousError.timestamp}`);
    }
    
    if (Object.keys(previousState.previousPlatformStates).length > 0) {
      console.log('\n🏪 Previous Platform States:');
      Object.entries(previousState.previousPlatformStates).forEach(([platform, platformState]) => {
        console.log(`   ${platform}: ${platformState.lastUpdatedScheduler || 'Never'}`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to view previous state:', error.message);
  }
}

async function updateDuration(hours) {
  try {
    const durationMs = hours * 60 * 60 * 1000;
    const success = await updateSchedulerDuration(durationMs);
    
    if (success) {
      console.log(`✅ Scheduler duration updated to ${hours} hours`);
    } else {
      console.log('❌ Failed to update scheduler duration');
    }
  } catch (error) {
    console.error('❌ Error updating duration:', error.message);
  }
}

async function updatePreviousDuration(hours) {
  try {
    const durationMs = hours * 60 * 60 * 1000;
    const success = await updateSchedulerTriggerDuration(durationMs);
    
    if (success) {
      console.log(`✅ Previous scheduler trigger duration updated to ${hours} hours`);
    } else {
      console.log('❌ Failed to update previous scheduler trigger duration');
    }
  } catch (error) {
    console.error('❌ Error updating previous duration:', error.message);
  }
}

async function setActive(isActive) {
  try {
    const success = await setActiveStatus(isActive === 'true');
    
    if (success) {
      console.log(`✅ Scheduler active status set to ${isActive}`);
    } else {
      console.log('❌ Failed to set active status');
    }
  } catch (error) {
    console.error('❌ Error setting active status:', error.message);
  }
}

async function showSummary() {
  try {
    const summary = await getStateSummary();
    console.log('\n📊 Current State Summary:');
    console.log('='.repeat(50));
    console.log(`Last Updated: ${summary.lastUpdated || 'Never'}`);
    console.log(`Scheduler Duration: ${summary.schedulerDuration / (60 * 60 * 1000)} hours`);
    console.log(`Total Runs: ${summary.totalRuns}`);
    console.log(`Total Products Processed: ${summary.totalProductsProcessed}`);
    console.log(`Has Error: ${summary.hasError}`);
    console.log(`Platform Count: ${summary.platformCount}`);
    console.log(`Next Update Time: ${summary.nextUpdateTime}`);
    console.log(`Time Since Last Update: ${Math.round(summary.timeSinceLastUpdate / (60 * 1000))} minutes`);
    console.log(`Active: ${summary.isActive}`);
  } catch (error) {
    console.error('❌ Failed to get summary:', error.message);
  }
}

async function showPreviousSummary() {
  try {
    const summary = await getPreviousStateSummary();
    console.log('\n📊 Previous State Summary:');
    console.log('='.repeat(50));
    console.log(`Last Updated Scheduler: ${summary.lastUpdatedScheduler || 'Never'}`);
    console.log(`Scheduler Trigger Duration: ${summary.schedulerTriggerDuration / (60 * 60 * 1000)} hours`);
    console.log(`Previous Total Runs: ${summary.previousTotalRuns}`);
    console.log(`Previous Products Processed: ${summary.previousProductsProcessed}`);
    console.log(`Has Previous Error: ${summary.hasPreviousError}`);
    console.log(`Platform Count: ${summary.platformCount}`);
    console.log(`Updated: ${summary.updatedAt}`);
  } catch (error) {
    console.error('❌ Failed to get previous summary:', error.message);
  }
}

async function compareStates() {
  try {
    const currentSummary = await getStateSummary();
    const previousSummary = await getPreviousStateSummary();
    
    console.log('\n🔄 Current vs Previous State Comparison:');
    console.log('='.repeat(60));
    console.log(`Current Duration: ${currentSummary.schedulerDuration / (60 * 60 * 1000)} hours`);
    console.log(`Previous Duration: ${previousSummary.schedulerTriggerDuration / (60 * 60 * 1000)} hours`);
    console.log(`Current Total Runs: ${currentSummary.totalRuns}`);
    console.log(`Previous Total Runs: ${previousSummary.previousTotalRuns}`);
    console.log(`Current Products Processed: ${currentSummary.totalProductsProcessed}`);
    console.log(`Previous Products Processed: ${previousSummary.previousProductsProcessed}`);
    console.log(`Current Active: ${currentSummary.isActive}`);
    console.log(`Current Last Updated: ${currentSummary.lastUpdated || 'Never'}`);
    console.log(`Previous Last Updated: ${previousSummary.lastUpdatedScheduler || 'Never'}`);
  } catch (error) {
    console.error('❌ Failed to compare states:', error.message);
  }
}

async function backupState() {
  try {
    const success = await backupCurrentStateToPrevious();
    
    if (success) {
      console.log('✅ Current state backed up to previous state');
    } else {
      console.log('❌ Failed to backup state');
    }
  } catch (error) {
    console.error('❌ Error backing up state:', error.message);
  }
}

async function resetCurrentState() {
  try {
    console.log('⚠️  WARNING: This will reset the current scheduler state!');
    console.log('Type "yes" to confirm:');
    
    // In a real implementation, you'd want to use readline for input
    // For now, we'll just show the warning
    console.log('❌ Reset cancelled (interactive confirmation not implemented)');
    console.log('To reset, manually call: resetState()');
  } catch (error) {
    console.error('❌ Error resetting state:', error.message);
  }
}

// Main command handler
async function main() {
  switch (command) {
    case 'view':
      await viewCurrentState();
      break;
    case 'view-previous':
      await viewPreviousState();
      break;
    case 'summary':
      await showSummary();
      break;
    case 'summary-previous':
      await showPreviousSummary();
      break;
    case 'duration':
      if (options[0]) {
        await updateDuration(parseInt(options[0]));
      } else {
        console.log('❌ Please provide duration in hours (e.g., duration 3)');
      }
      break;
    case 'duration-previous':
      if (options[0]) {
        await updatePreviousDuration(parseInt(options[0]));
      } else {
        console.log('❌ Please provide duration in hours (e.g., duration-previous 3)');
      }
      break;
    case 'active':
      if (options[0]) {
        await setActive(options[0]);
      } else {
        console.log('❌ Please provide active status (true or false)');
      }
      break;
    case 'compare':
      await compareStates();
      break;
    case 'backup':
      await backupState();
      break;
    case 'reset':
      await resetCurrentState();
      break;
    case 'help':
    case '--help':
    case '-h':
      await showHelp();
      break;
    default:
      console.log('❌ Unknown command. Use "help" to see available commands.');
      await showHelp();
  }
}

// Run the command
main().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});




