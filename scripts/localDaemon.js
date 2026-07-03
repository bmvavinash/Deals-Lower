/**
 * Hybrid Local Daemon Service for DealsOptimised
 * 
 * This service runs locally on the administrator's computer(s)/server(s).
 * Features:
 * 1. Supports distributed execution roles: start with --role [bulk|bot|favorites|db|banners|all]
 *    to run multiple local systems in parallel.
 * 2. Fetches dynamic schedule intervals from Firebase Realtime DB (/schedulerConfig) and
 *    reschedules cron jobs automatically if updated.
 * 3. Handles offline triggering safety: ignores and expires commands older than 30 minutes to
 *    prevent a massive execution backlog when starting the daemon.
 */

const admin = require('firebase-admin');
const { exec } = require('child_process');
const path = require('path');
const cron = require('node-cron');
const constants = require('../config/constants');
const config = require('../config/config');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('local-daemon');

// 1. Parse command-line arguments
let runnerRole = 'all';
let processStaleCommands = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--role' || args[i] === '-r') && args[i + 1]) {
    runnerRole = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--force-stale') {
    processStaleCommands = true;
  }
}

logger.info('====================================================');
logger.info('🌟 DEALS OPTIMISED - HYBRID LOCAL DAEMON ACTIVE 🌟');
logger.info(`Execution Role: ${runnerRole.toUpperCase()}`);
logger.info(`Force Run Stale Triggers: ${processStaleCommands}`);
logger.info('====================================================');

// Initialize Firebase Admin SDK
const dbname = constants.postingTypesConfig[constants.type].DB;
const DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
const serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);

if (!admin.apps.length) {
  const databaseURL = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

const db = admin.database();
const queueRef = db.ref('commandsQueue');
const configRef = db.ref('schedulerConfig');

/**
 * Starts listening to the Firebase command queue
 */
function startCommandListener() {
  logger.info(`🚀 Queue listener started for role: [${runnerRole.toUpperCase()}]`);

  queueRef.orderByChild('status').equalTo('pending').on('child_added', async (snapshot) => {
    const key = snapshot.key;
    const commandData = snapshot.val();

    if (!commandData) return;

    // 1. Filter command by role (skip if this runner represents another role)
    const commandRole = commandData.role || 'all';
    if (runnerRole !== 'all' && commandRole !== runnerRole) {
      logger.debug(`Skipping command ${commandData.id} (requires: ${commandRole}, we are: ${runnerRole})`);
      return;
    }

    // 2. Cooldown check / Expiration check for offline triggers
    const createdAt = new Date(commandData.createdAt).getTime();
    const now = Date.now();
    const expirationThresholdMs = 30 * 60 * 1000; // 30 minutes
    
    if (!processStaleCommands && (now - createdAt > expirationThresholdMs)) {
      logger.warn(`⚠️ Skipping stale trigger command ${commandData.id} (queued at ${commandData.createdAt}, older than 30 mins)`);
      try {
        await queueRef.child(key).update({
          status: 'expired',
          expiredAt: new Date().toISOString(),
          notes: 'Runner daemon was offline when triggered. Stale command expired automatically.'
        });
      } catch (err) {
        logger.error(`Failed to mark command as expired: ${key}`, err);
      }
      return;
    }

    logger.info(`📥 Pulling queued execution request: "${commandData.name}" (${commandData.id})`);

    // Lock the command instantly to avoid duplicate runner pickup
    try {
      await queueRef.child(key).update({
        status: 'running',
        startedAt: new Date().toISOString(),
        executorId: 'local-runner-' + runnerRole
      });
    } catch (err) {
      logger.error(`Failed to lock command ${key}:`, err);
      return;
    }

    logger.info(`⚙️ Running command: "${commandData.command}"`);

    // Execute script locally
    const child = exec(commandData.command, { cwd: path.join(__dirname, '../') }, async (error, stdout, stderr) => {
      const completedAt = new Date().toISOString();
      
      if (error) {
        logger.error(`❌ Local command run failed: "${commandData.name}"`, error);
        await queueRef.child(key).update({
          status: 'failed',
          error: error.message,
          stderr: stderr || '',
          stdout: stdout || '',
          completedAt
        });
        return;
      }

      logger.info(`✅ Local command completed successfully: "${commandData.name}"`);
      await queueRef.child(key).update({
        status: 'completed',
        stdout: stdout || '',
        stderr: stderr || '',
        completedAt
      });
    });

    // Output logs directly to terminal so capthas / actions can be observed
    child.stdout.on('data', (data) => console.log(`[EXEC LOG] ${data.toString().trim()}`));
    child.stderr.on('data', (data) => console.error(`[EXEC ERR] ${data.toString().trim()}`));
  });
}

/**
 * Dynamic Schedulers Manager
 */
let activeCronJobs = new Map();

function getCronExpression(intervalInHours) {
  const hours = parseInt(intervalInHours, 10);
  if (isNaN(hours) || hours <= 0 || hours >= 24) {
    return '0 * * * *'; // Default to every hour
  }
  return `0 */${hours} * * *`;
}

function rescheduleJobs(schedulerConfig) {
  logger.info('🔄 Updating scheduled cron configurations from database...');

  // Stop all active cron jobs first
  for (const [name, job] of activeCronJobs) {
    job.stop();
    logger.info(`Stopped cron schedule: ${name}`);
  }
  activeCronJobs.clear();

  // Evaluate dynamic schedule rules
  const isActiveDeals = schedulerConfig.isActiveDealsPeriod === true || schedulerConfig.isActiveDealsPeriod === 'true';
  const bulkInterval = isActiveDeals ? 1 : (schedulerConfig.bulkUpdatesInterval || 3);
  const botInterval = isActiveDeals ? 1 : (schedulerConfig.telegramBotInterval || 3);
  const favoritesInterval = schedulerConfig.favoritesInterval || 1; // Always every hour
  const dbInterval = schedulerConfig.dbUpdatesInterval || 2;
  const bannersInterval = schedulerConfig.bannersInterval || 4;

  logger.info(`Schedules Updated - Active Deals Mode: ${isActiveDeals}`);
  logger.info(`Intervals - Bulk: ${bulkInterval}h, Bot: ${botInterval}h, Favorites: ${favoritesInterval}h, DB Updates: ${dbInterval}h, Banners: ${bannersInterval}h`);

  const triggerLocalJob = (jobName, commandLine) => {
    logger.info(`⏰ Triggering scheduled cron job: "${jobName}"`);
    exec(commandLine, { cwd: path.join(__dirname, '../') }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Cron job "${jobName}" execution failed:`, error.message);
        return;
      }
      logger.info(`Cron job "${jobName}" completed successfully.`);
    });
  };

  // 1. Bulk updates scheduler (Role: bulk)
  if (runnerRole === 'all' || runnerRole === 'bulk') {
    const cronExpr = getCronExpression(bulkInterval);
    const job = cron.schedule(cronExpr, () => {
      triggerLocalJob('Bulk Updates', 'node scripts/runBatchProducts.js website');
    });
    activeCronJobs.set('bulk', job);
    logger.info(`[Bulk Updates] scheduled on cron: "${cronExpr}"`);
  }

  // 2. Telegram bot scheduler (Role: bot)
  if (runnerRole === 'all' || runnerRole === 'bot') {
    const cronExpr = getCronExpression(botInterval);
    const job = cron.schedule(cronExpr, () => {
      triggerLocalJob('Telegram Bot Processing', 'node run_telegram_bot.js');
    });
    activeCronJobs.set('bot', job);
    logger.info(`[Telegram Bot] scheduled on cron: "${cronExpr}"`);
  }

  // 3. Favorites scheduler (Role: favorites)
  if (runnerRole === 'all' || runnerRole === 'favorites') {
    const cronExpr = getCronExpression(favoritesInterval);
    const job = cron.schedule(cronExpr, () => {
      triggerLocalJob('Favorites Service', 'node scripts/runFavoritesService.js');
    });
    activeCronJobs.set('favorites', job);
    logger.info(`[Favorites Service] scheduled on cron: "${cronExpr}"`);
  }

  // 4. DB updates scheduler (Role: db)
  if (runnerRole === 'all' || runnerRole === 'db') {
    const cronExpr = getCronExpression(dbInterval);
    const job = cron.schedule(cronExpr, () => {
      triggerLocalJob('Stale DB Updates', 'node scripts/updateStaleProducts.js');
    });
    activeCronJobs.set('db', job);
    logger.info(`[Stale DB Updates] scheduled on cron: "${cronExpr}"`);
  }

  // 5. Banners scheduler (Role: banners)
  if (runnerRole === 'all' || runnerRole === 'banners') {
    const cronExpr = getCronExpression(bannersInterval);
    const job = cron.schedule(cronExpr, () => {
      triggerLocalJob('Banners Extraction', 'node scripts/automateBannerExtraction.js');
    });
    activeCronJobs.set('banners', job);
    logger.info(`[Banners Extraction] scheduled on cron: "${cronExpr}"`);
  }
}

/**
 * Initializes listeners for dynamic scheduling config
 */
function startConfigListener() {
  logger.info('🚀 Setting up Firebase configuration listener for dynamic scheduling...');
  
  configRef.on('value', (snapshot) => {
    const configData = snapshot.val() || {};
    
    // Set default config if empty
    if (Object.keys(configData).length === 0) {
      logger.info('Firebase schedulerConfig is empty. Writing default configurations...');
      const defaults = {
        bulkUpdatesInterval: 3,
        telegramBotInterval: 3,
        favoritesInterval: 1,
        dbUpdatesInterval: 2,
        bannersInterval: 4,
        isActiveDealsPeriod: false,
        updatedAt: new Date().toISOString()
      };
      configRef.set(defaults);
      rescheduleJobs(defaults);
    } else {
      rescheduleJobs(configData);
    }
  });
}

function main() {
  startCommandListener();
  startConfigListener();
}

// Start the daemon
main();

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('Stopping local daemon...');
  queueRef.off();
  configRef.off();
  for (const [name, job] of activeCronJobs) {
    job.stop();
  }
  process.exit(0);
});
