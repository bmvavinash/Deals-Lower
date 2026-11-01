// services/databaseHealthService.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { getModuleLogger } = require('../logger/logger');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { sendTelegramAlert } = require('./abnormalPriceAlertService');
const config = require('../config/config');

const logger = getModuleLogger('databaseHealthService');

/**
 * Service to assess Firebase Realtime Database health, storage, egress estimation,
 * and age distribution, with Telegram alert dispatch.
 */
class DatabaseHealthService {
  /**
   * Performs an end-to-end health check of the Firebase Realtime Database
   */
  async getDatabaseHealth() {
    const startTime = Date.now();
    logger.info('Starting Database Health Assessment...');

    const DB_Name = config.DATABASE_CONFIG.DB1_NAME || 'lowerdealhub';
    const shallowBaseUrl = DB_Name === 'lowerdealhub'
      ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
      : `https://${DB_Name}-default-rtdb.firebaseio.com`;

    // 1. Fetch shallow keys of main collections to measure record counts
    let allProductKeys = [];
    let dealsKeys = [];
    let bannersKeys = [];
    let commandsQueueKeys = [];
    let latencyMs = 0;

    try {
      const pingStart = Date.now();
      const productRes = await fetch(`${shallowBaseUrl}/productdeals.json?shallow=true`);
      latencyMs = Date.now() - pingStart;

      if (productRes.ok) {
        const productObj = await productRes.json();
        allProductKeys = Object.keys(productObj || {});
      }

      const dealsRes = await fetch(`${shallowBaseUrl}/deals.json?shallow=true`);
      if (dealsRes.ok) dealsKeys = Object.keys((await dealsRes.json()) || {});

      const bannersRes = await fetch(`${shallowBaseUrl}/banners.json?shallow=true`);
      if (bannersRes.ok) bannersKeys = Object.keys((await bannersRes.json()) || {});

      const cmdRes = await fetch(`${shallowBaseUrl}/commandsQueue.json?shallow=true`);
      if (cmdRes.ok) commandsQueueKeys = Object.keys((await cmdRes.json()) || {});
    } catch (err) {
      logger.error('Failed to query shallow collection keys:', { error: err.message });
    }

    // 2. Measure sample product size (to calculate accurate storage on disk)
    let avgProductBytes = 2477; // default fallback ~2.42 KB
    let totalSampleBytes = 0;
    const sampleSize = Math.min(25, allProductKeys.length);
    const sampleKeys = allProductKeys.slice(0, sampleSize);

    for (const key of sampleKeys) {
      try {
        const snap = await productDealsDB.productdealsRef.child(key).once('value');
        const val = snap.val();
        if (val) {
          totalSampleBytes += Buffer.byteLength(JSON.stringify(val), 'utf8');
        }
      } catch (_) {}
    }
    if (sampleKeys.length > 0 && totalSampleBytes > 0) {
      avgProductBytes = Math.round(totalSampleBytes / sampleKeys.length);
    }

    const estimatedProductDealsStorageMB = Number(((avgProductBytes * allProductKeys.length) / (1024 * 1024)).toFixed(2));
    // Estimate total DB storage including other nodes (~1.3x multiplier)
    const estimatedTotalStorageMB = Number((estimatedProductDealsStorageMB * 1.35).toFixed(2));
    const storageLimitMB = 1024; // 1 GB free tier limit
    const storagePercent = Number(((estimatedTotalStorageMB / storageLimitMB) * 100).toFixed(1));

    // 3. Egress / Bandwidth Estimation
    // Shallow keys download is ~1.8 MB; 12 products per run is ~0.03 MB
    const shallowQueryBytes = 1.8 * 1024 * 1024;
    const batchFetchBytes = 12 * avgProductBytes;
    const egressPerRunMB = Number(((shallowQueryBytes + batchFetchBytes) / (1024 * 1024)).toFixed(2));
    
    // Scheduled every 30 mins = 48 runs/day * 30 days = 1440 runs/month
    const monthlyRuns = 1440;
    const estimatedMonthlyEgressGB = Number(((egressPerRunMB * monthlyRuns) / 1024).toFixed(2));
    const freeTierEgressLimitGB = 10;
    const egressPercent = Number(((estimatedMonthlyEgressGB / freeTierEgressLimitGB) * 100).toFixed(1));

    // 4. Memory / RAM Usage
    const mem = process.memoryUsage();
    const ramUsage = {
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      cloudLimitMB: 512 // Render free container limit
    };

    // 5. Sample product age distribution
    const ageStats = await this.sampleProductAges(allProductKeys);

    // 6. Overall Health Status
    let status = 'HEALTHY';
    const warnings = [];

    if (storagePercent > 80) {
      status = 'WARNING';
      warnings.push(`Storage usage is high: ${storagePercent}% of 1 GB free limit.`);
    }
    if (egressPercent > 80) {
      status = 'WARNING';
      warnings.push(`Monthly egress estimate is high: ${egressPercent}% of 10 GB free limit.`);
    }
    if (ramUsage.rssMB > 400) {
      status = 'WARNING';
      warnings.push(`Process memory high: ${ramUsage.rssMB} MB (approaching 512 MB Render ceiling).`);
    }

    const healthData = {
      status,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      databaseName: DB_Name,
      latencyMs,
      records: {
        totalProducts: allProductKeys.length,
        hotDeals: dealsKeys.length,
        banners: bannersKeys.length,
        queuedCommands: commandsQueueKeys.length
      },
      storage: {
        avgProductSizeBytes: avgProductBytes,
        productDealsMB: estimatedProductDealsStorageMB,
        estimatedTotalStorageMB,
        limitMB: storageLimitMB,
        usedPercent: storagePercent
      },
      egress: {
        perRunMB: egressPerRunMB,
        estimatedMonthlyGB: estimatedMonthlyEgressGB,
        freeTierLimitGB: freeTierEgressLimitGB,
        usedPercent: egressPercent
      },
      ram: ramUsage,
      ageDistribution: ageStats,
      warnings
    };

    return healthData;
  }

  /**
   * Samples product keys to calculate accurate age distribution
   */
  async sampleProductAges(allKeys, targetSample = 200) {
    if (!allKeys || allKeys.length === 0) return {};

    const step = Math.max(1, Math.floor(allKeys.length / targetSample));
    const sampleKeys = [];
    for (let i = 0; i < allKeys.length && sampleKeys.length < targetSample; i += step) {
      sampleKeys.push(allKeys[i]);
    }

    const now = Date.now();
    const H2 = 2 * 3600 * 1000;
    const D1 = 24 * 3600 * 1000;
    const D7 = 7 * D1;
    const M1 = 30 * D1;
    const M6 = 180 * D1;
    const Y1 = 365 * D1;

    const stats = {
      missingUpdatedAt: 0,
      within2h: 0,
      within1d: 0,
      within7d: 0,
      within1m: 0,
      within6m: 0,
      within1y: 0,
      olderThan1y: 0,
      sampleSize: sampleKeys.length
    };

    const chunkSize = 20;
    for (let i = 0; i < sampleKeys.length; i += chunkSize) {
      const chunk = sampleKeys.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (key) => {
        try {
          const snap = await productDealsDB.productdealsRef.child(key).child('updatedAt').once('value');
          const val = snap.val();
          if (!val) {
            stats.missingUpdatedAt++;
            return;
          }
          const diff = now - new Date(val).getTime();
          if (isNaN(diff)) stats.missingUpdatedAt++;
          else if (diff <= H2) stats.within2h++;
          else if (diff <= D1) stats.within1d++;
          else if (diff <= D7) stats.within7d++;
          else if (diff <= M1) stats.within1m++;
          else if (diff <= M6) stats.within6m++;
          else if (diff <= Y1) stats.within1y++;
          else stats.olderThan1y++;
        } catch (_) {}
      }));
    }

    return stats;
  }

  /**
   * Formats and dispatches a comprehensive health report directly to Telegram (@notifyavi)
   */
  async sendTelegramHealthReport(customChatId = '@notifyavi') {
    const health = await this.getDatabaseHealth();
    const statusEmoji = health.status === 'HEALTHY' ? '🟢' : health.status === 'WARNING' ? '🟡' : '🔴';

    const message = [
      `${statusEmoji} *Firebase RTDB Health Audit*`,
      `📅 *Date:* \`${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\``,
      `🗄️ *Database:* \`${health.databaseName}\` (Latency: \`${health.latencyMs}ms\`)`,
      '',
      `📊 *Collection Records:*`,
      `• Products: *${health.records.totalProducts.toLocaleString()}* items`,
      `• Hot Deals: *${health.records.hotDeals}* active`,
      `• Banners: *${health.records.banners}* entries`,
      `• Queued Commands: *${health.records.queuedCommands}* pending`,
      '',
      `💾 *Storage Health (Free 1 GB Ceiling):*`,
      `• Avg Product Size: \`${health.storage.avgProductSizeBytes} bytes\` (~2.4 KB)`,
      `• Total Storage: *${health.storage.estimatedTotalStorageMB} MB* / 1,024 MB (*${health.storage.usedPercent}%*)`,
      '',
      `🌐 *Download Egress (Free 10 GB/mo Ceiling):*`,
      `• Per 30m Run: \`${health.egress.perRunMB} MB\` (with shallow optimization)`,
      `• Est. Monthly Egress: *${health.egress.estimatedMonthlyGB} GB* / 10 GB (*${health.egress.usedPercent}%*)`,
      '',
      `🧠 *Process Memory / RAM:*`,
      `• Heap Used: \`${health.ram.heapUsedMB} MB\` / Heap: \`${health.ram.heapTotalMB} MB\``,
      `• RSS: \`${health.ram.rssMB} MB\` (Render budget: 512 MB)`,
      '',
      `⏳ *Product Age Breakdown (Sample ${health.ageDistribution.sampleSize}):*`,
      `• Within 24 Hours: *${Math.round((health.ageDistribution.within1d / health.ageDistribution.sampleSize) * 100)}%*`,
      `• Within 7 Days: *${Math.round((health.ageDistribution.within7d / health.ageDistribution.sampleSize) * 100)}%*`,
      `• 1 to 6 Months: *${Math.round((health.ageDistribution.within6m / health.ageDistribution.sampleSize) * 100)}%*`,
      `• > 1 Year / Missing: *${Math.round(((health.ageDistribution.olderThan1y + health.ageDistribution.missingUpdatedAt) / health.ageDistribution.sampleSize) * 100)}%*`,
      health.warnings.length > 0 ? `\n⚠️ *Warnings:*\n${health.warnings.map(w => '• ' + w).join('\n')}` : ''
    ].filter(Boolean).join('\n');

    logger.info('Dispatching health report to Telegram...', { customChatId });
    const sendResult = await sendTelegramAlert(message);
    return { health, sendResult };
  }
}

const databaseHealthService = new DatabaseHealthService();
module.exports = { databaseHealthService, DatabaseHealthService };
