// services/githubActionLogger.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const admin = require('firebase-admin');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('githubActionLogger');

class GithubActionLogger {
  constructor() {
    this.actionName = null;
    this.startTime = null;
    this.runId = process.env.GITHUB_RUN_ID || `local_${Date.now()}`;
    this.workflow = process.env.GITHUB_WORKFLOW || 'Manual/CLI';
    this.commitSha = process.env.GITHUB_SHA || 'N/A';
  }

  getDb() {
    try {
      if (admin.apps.length > 0) {
        return admin.database();
      }
    } catch (_) {}
    return null;
  }

  async startAction(actionName, metadata = {}) {
    this.actionName = actionName;
    this.startTime = Date.now();
    const isoStart = new Date(this.startTime).toISOString();

    logger.info(`[ACTION START] ${actionName}`, { runId: this.runId, metadata });

    const db = this.getDb();
    if (!db) return;

    try {
      const actionRef = db.ref(`executionTracking/githubActions/${actionName}`);
      await actionRef.set({
        name: actionName,
        status: 'running',
        source: 'github-actions',
        runId: this.runId,
        workflow: this.workflow,
        commitSha: this.commitSha,
        startTime: isoStart,
        lastHeartbeat: isoStart,
        metadata,
        summary: {
          productsExtracted: 0,
          productsCreated: 0,
          productsUpdated: 0,
          priceReducedCount: 0,
          missedDealsCount: 0,
          failedCount: 0
        },
        actionItems: []
      });
    } catch (err) {
      logger.warn(`Failed to write startAction log for ${actionName}`, { error: err.message });
    }
  }

  async completeAction(actionName, summary = {}, failedItems = []) {
    const db = this.getDb();
    const duration = this.startTime ? (Date.now() - this.startTime) : 0;
    const completedAt = new Date().toISOString();

    logger.info(`[ACTION COMPLETE] ${actionName}`, {
      durationMs: duration,
      summary,
      failedItemsCount: failedItems.length
    });

    const actionData = {
      name: actionName,
      status: 'completed',
      source: 'github-actions',
      runId: this.runId,
      workflow: this.workflow,
      commitSha: this.commitSha,
      startTime: this.startTime ? new Date(this.startTime).toISOString() : completedAt,
      completedAt,
      duration,
      summary: {
        productsExtracted: summary.extracted || summary.count || 0,
        productsCreated: summary.created || 0,
        productsUpdated: summary.updated || 0,
        priceReducedCount: summary.priceReducedCount || 0,
        missedDealsCount: summary.missedDealsCount || 0,
        failedCount: summary.failed || failedItems.length || 0,
        ...summary
      },
      actionItems: failedItems.map(item => {
        if (typeof item === 'string') return item;
        return { url: item.url || item.productUrl || '', reason: item.error || item.reason || 'Failed extraction' };
      }),
      localDaemonDelegated: failedItems.length > 0
    };

    if (db) {
      try {
        // 1. Update latest action log in Firebase
        await db.ref(`executionTracking/githubActions/${actionName}`).set(actionData);

        // 2. Add to execution history
        await db.ref('executionTracking/history').push({
          ...actionData,
          id: `gha_${actionName}_${Date.now()}`
        });

        // 3. Fallback: If any items failed or were missed, automatically enqueue for localDaemon!
        if (failedItems.length > 0) {
          const missedUrls = failedItems.map(item => typeof item === 'string' ? item : (item.url || item.productUrl)).filter(Boolean);
          if (missedUrls.length > 0) {
            const queueRef = db.ref('commandsQueue');
            const newCmdRef = queueRef.push();
            const cmdPayload = {
              id: newCmdRef.key,
              name: `Recover Missed Products: ${actionName}`,
              command: `node scripts/processMissedProducts.js "${actionName}" "${newCmdRef.key}"`,
              status: 'pending',
              role: 'bulk',
              source: 'github-actions-fallback',
              actionName,
              createdAt: completedAt,
              missedUrls: missedUrls.slice(0, 50),
              count: missedUrls.length,
              notes: `Enqueued automatically by GitHub Actions ${actionName} to recover ${missedUrls.length} missed items.`
            };
            await newCmdRef.set(cmdPayload);
            logger.info(`[LOCAL DAEMON FALLBACK] Enqueued ${missedUrls.length} missed items to commandsQueue`, {
              commandId: newCmdRef.key
            });
          }
        }
      } catch (dbErr) {
        logger.warn(`Failed to record action completion in Firebase: ${actionName}`, { error: dbErr.message });
      }
    }

    return actionData;
  }

  async failAction(actionName, error, failedItems = []) {
    const db = this.getDb();
    const duration = this.startTime ? (Date.now() - this.startTime) : 0;
    const completedAt = new Date().toISOString();

    logger.error(`[ACTION FAILED] ${actionName}: ${error.message || error}`);

    const actionData = {
      name: actionName,
      status: 'failed',
      source: 'github-actions',
      runId: this.runId,
      workflow: this.workflow,
      commitSha: this.commitSha,
      startTime: this.startTime ? new Date(this.startTime).toISOString() : completedAt,
      completedAt,
      duration,
      error: error.message || String(error),
      actionItems: failedItems.map(item => typeof item === 'string' ? item : (item.url || item.productUrl || ''))
    };

    if (db) {
      try {
        await db.ref(`executionTracking/githubActions/${actionName}`).set(actionData);
        await db.ref('executionTracking/history').push({
          ...actionData,
          id: `gha_fail_${actionName}_${Date.now()}`
        });

        // Enqueue fallback if items available
        if (failedItems.length > 0) {
          const missedUrls = failedItems.map(item => typeof item === 'string' ? item : (item.url || item.productUrl)).filter(Boolean);
          if (missedUrls.length > 0) {
            const queueRef = db.ref('commandsQueue');
            const newCmdRef = queueRef.push();
            await newCmdRef.set({
              id: newCmdRef.key,
              name: `Recover Failed Action: ${actionName}`,
              command: `node scripts/processMissedProducts.js "${actionName}" "${newCmdRef.key}"`,
              status: 'pending',
              role: 'bulk',
              source: 'github-actions-fallback',
              actionName,
              createdAt: completedAt,
              missedUrls: missedUrls.slice(0, 50),
              count: missedUrls.length,
              notes: `Enqueued automatically after action failure: ${error.message || error}`
            });
          }
        }
      } catch (dbErr) {
        logger.warn(`Failed to record failure in Firebase for ${actionName}`, { error: dbErr.message });
      }
    }

    return actionData;
  }
}

const githubActionLogger = new GithubActionLogger();

module.exports = {
  GithubActionLogger,
  githubActionLogger
};
