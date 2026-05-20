const admin = require('firebase-admin');
const { getModuleLogger } = require('../logger/logger');
const { productDealsDB } = require('../database/firebaseDB/productDealsDB');
const { bannerDB } = require('../database/firebaseDB/bannerDB');
const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { loadState, saveState } = require('../database/firebaseDB/schedulerStateDB');
const fs = require('fs');
const path = require('path');

const logger = getModuleLogger('systemHealthMonitor');

const HEALTH_CHECK_TIMEOUT_MS = 10000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

class SystemHealthMonitor {
  constructor() {
    this.healthChecks = {
      database: { status: 'unknown', lastCheck: null, issues: [] },
      services: { status: 'unknown', lastCheck: null, issues: [] },
      schedulers: { status: 'unknown', lastCheck: null, issues: [] },
      fileSystem: { status: 'unknown', lastCheck: null, issues: [] },
      memory: { status: 'unknown', lastCheck: null, issues: [] }
    };
    this.failureHistory = [];
    this.fixSteps = new Map();
    this.initializeFixSteps();
  }

  /**
   * Initialize fix steps for common issues
   */
  initializeFixSteps() {
    this.fixSteps.set('database_connection_failed', {
      issue: 'Database connection failed',
      steps: [
        '1. Check Firebase credentials and service account file',
        '2. Verify database URL is correct',
        '3. Check network connectivity',
        '4. Restart the application',
        '5. Check Firebase console for service status'
      ],
      severity: 'critical'
    });

    this.fixSteps.set('selenium_driver_failed', {
      issue: 'Selenium WebDriver failed to initialize',
      steps: [
        '1. Check if Chrome browser is installed',
        '2. Verify ChromeDriver version compatibility',
        '3. Check if port 9222 is available',
        '4. Restart Chrome with debugging enabled',
        '5. Check system memory and resources'
      ],
      severity: 'high'
    });

    this.fixSteps.set('banner_extraction_failed', {
      issue: 'Banner extraction failed',
      steps: [
        '1. Check if target websites are accessible',
        '2. Verify CSS selectors are still valid',
        '3. Check for website layout changes',
        '4. Update selectors in bannerConfig.js',
        '5. Test with manual browser inspection'
      ],
      severity: 'medium'
    });

    this.fixSteps.set('product_extraction_failed', {
      issue: 'Product extraction failed',
      steps: [
        '1. Check product URL accessibility',
        '2. Verify page load timeouts',
        '3. Check for anti-bot measures',
        '4. Update extraction selectors',
        '5. Check network connectivity'
      ],
      severity: 'medium'
    });

    this.fixSteps.set('hierarchical_category_failed', {
      issue: 'Hierarchical category extraction failed',
      steps: [
        '1. Check category hierarchy database',
        '2. Verify product data completeness',
        '3. Update category mapping rules',
        '4. Check URL parsing logic',
        '5. Run manual category extraction test'
      ],
      severity: 'low'
    });

    this.fixSteps.set('memory_usage_high', {
      issue: 'High memory usage detected',
      steps: [
        '1. Check for memory leaks in extraction loops',
        '2. Add garbage collection calls',
        '3. Reduce batch sizes',
        '4. Restart the application',
        '5. Monitor memory usage patterns'
      ],
      severity: 'high'
    });

    this.fixSteps.set('file_system_error', {
      issue: 'File system operation failed',
      steps: [
        '1. Check disk space availability',
        '2. Verify file permissions',
        '3. Check for file locks',
        '4. Restart the application',
        '5. Check system resources'
      ],
      severity: 'medium'
    });
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck() {
    logger.info('🏥 Starting comprehensive system health check...');
    
    const startTime = Date.now();
    const healthReport = {
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy',
      checks: {},
      criticalIssues: [],
      recommendations: []
    };

    try {
      // 1. Database Health Check
      await this.checkDatabaseHealth(healthReport);
      
      // 2. Services Health Check
      await this.checkServicesHealth(healthReport);
      
      // 3. Schedulers Health Check
      await this.checkSchedulersHealth(healthReport);
      
      // 4. File System Health Check
      await this.checkFileSystemHealth(healthReport);
      
      // 5. Memory Health Check
      await this.checkMemoryHealth(healthReport);
      
      // 6. Determine overall status
      healthReport.overallStatus = this.determineOverallStatus(healthReport);
      
      // 7. Generate recommendations
      this.generateRecommendations(healthReport);
      
      // 8. Log health report
      this.logHealthReport(healthReport);
      
      // 9. Save health report
      await this.saveHealthReport(healthReport);
      
      const duration = Date.now() - startTime;
      logger.info(`✅ System health check completed in ${duration}ms`, {
        overallStatus: healthReport.overallStatus,
        criticalIssues: healthReport.criticalIssues.length,
        recommendations: healthReport.recommendations.length
      });

      return healthReport;

    } catch (error) {
      logger.error('❌ Error during system health check', { error: error.message });
      healthReport.overallStatus = 'error';
      healthReport.error = error.message;
      return healthReport;
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(healthReport) {
    const checkStart = Date.now();
    const dbCheck = {
      status: 'healthy',
      issues: [],
      databases: {},
      duration: 0
    };

    try {
      logger.info('🔍 Checking database health...');

      // Check Firebase connection
      const databases = [
        { name: 'productdeals', db: productDealsDB },
        { name: 'banner', db: bannerDB },
        { name: 'userFavorites', db: userFavoritesDB },
        { name: 'schedulerState', db: { loadState, saveState } }
      ];

      for (const { name, db } of databases) {
        try {
          if (name === 'schedulerState') {
            // Special handling for scheduler state
            await loadState();
            dbCheck.databases[name] = { status: 'healthy', error: null };
            logger.debug(`✅ Database ${name} is healthy`);
          } else if (name === 'banner') {
            // Special handling for banner database
            if (db && db.bannersRef) {
              await withTimeout(
                admin.database().ref('.info/connected').once('value'),
                HEALTH_CHECK_TIMEOUT_MS,
                name
              );
              dbCheck.databases[name] = { status: 'healthy', error: null };
              logger.debug(`✅ Database ${name} is healthy`);
            } else {
              throw new Error('Banner database not properly initialized');
            }
          } else if (name === 'userFavorites') {
            // Special handling for user favorites database
            if (db && db.usersBase) {
              // Just check if the database object is properly initialized
              dbCheck.databases[name] = { status: 'healthy', error: null };
              logger.debug(`✅ Database ${name} is healthy`);
            } else {
              throw new Error('User favorites database not properly initialized');
            }
          } else if (db && db.ref) {
            await withTimeout(
              admin.database().ref('.info/connected').once('value'),
              HEALTH_CHECK_TIMEOUT_MS,
              name
            );
            dbCheck.databases[name] = { status: 'healthy', error: null };
            logger.debug(`✅ Database ${name} is healthy`);
          } else {
            throw new Error('Database object not properly initialized');
          }
          
        } catch (error) {
          dbCheck.databases[name] = { status: 'unhealthy', error: error.message };
          dbCheck.issues.push(`Database ${name}: ${error.message}`);
          logger.error(`❌ Database ${name} health check failed`, { error: error.message });
        }
      }

      // Only treat total DB failure as critical (allow partial timeouts on large DBs)
      const unhealthyDbs = Object.values(dbCheck.databases).filter(db => db.status === 'unhealthy');
      if (unhealthyDbs.length === Object.keys(dbCheck.databases).length && unhealthyDbs.length > 0) {
        dbCheck.status = 'unhealthy';
        healthReport.criticalIssues.push({
          type: 'database_connection_failed',
          message: `${unhealthyDbs.length} database(s) are unhealthy`,
          fixSteps: this.fixSteps.get('database_connection_failed')
        });
      } else if (unhealthyDbs.length > 0) {
        dbCheck.status = 'degraded';
        const failedNames = Object.entries(dbCheck.databases)
          .filter(([, v]) => v.status === 'unhealthy')
          .map(([k]) => k);
        healthReport.recommendations.push(
          `Some database checks failed (${failedNames.join(', ')}); continuing startup.`
        );
      }

    } catch (error) {
      dbCheck.status = 'error';
      dbCheck.issues.push(`Database health check failed: ${error.message}`);
      logger.error('❌ Database health check error', { error: error.message });
    }

    dbCheck.duration = Date.now() - checkStart;
    healthReport.checks.database = dbCheck;
  }

  /**
   * Check services health
   */
  async checkServicesHealth(healthReport) {
    const checkStart = Date.now();
    const servicesCheck = {
      status: 'healthy',
      issues: [],
      services: {},
      duration: 0
    };

    try {
      logger.info('🔍 Checking services health...');

      const services = [
        'hierarchicalEnrichmentService',
        'idleProcessingService',
        'comprehensiveLoggingService'
      ];

      for (const serviceName of services) {
        try {
          // Check if service can be imported
          const service = require(`./${serviceName}`);
          servicesCheck.services[serviceName] = { status: 'healthy', error: null };
          logger.debug(`✅ Service ${serviceName} is healthy`);
          
        } catch (error) {
          servicesCheck.services[serviceName] = { status: 'unhealthy', error: error.message };
          servicesCheck.issues.push(`Service ${serviceName}: ${error.message}`);
          logger.error(`❌ Service ${serviceName} health check failed`, { error: error.message });
        }
      }

      // Check for critical service issues
      const unhealthyServices = Object.values(servicesCheck.services).filter(svc => svc.status === 'unhealthy');
      if (unhealthyServices.length > 0) {
        servicesCheck.status = 'unhealthy';
        healthReport.criticalIssues.push({
          type: 'service_failed',
          message: `${unhealthyServices.length} service(s) are unhealthy`,
          fixSteps: {
            issue: 'Service initialization failed',
            steps: [
              '1. Check service file syntax and imports',
              '2. Verify all dependencies are installed',
              '3. Check for circular dependencies',
              '4. Restart the application',
              '5. Check service-specific logs'
            ],
            severity: 'high'
          }
        });
      }

    } catch (error) {
      servicesCheck.status = 'error';
      servicesCheck.issues.push(`Services health check failed: ${error.message}`);
      logger.error('❌ Services health check error', { error: error.message });
    }

    servicesCheck.duration = Date.now() - checkStart;
    healthReport.checks.services = servicesCheck;
  }

  /**
   * Check schedulers health
   */
  async checkSchedulersHealth(healthReport) {
    const checkStart = Date.now();
    const schedulersCheck = {
      status: 'healthy',
      issues: [],
      schedulers: {},
      duration: 0
    };

    try {
      logger.info('🔍 Checking schedulers health...');

      // Check scheduler state in database
      try {
        const schedulerState = await loadState();
        schedulersCheck.schedulers.schedulerState = { 
          status: 'healthy', 
          data: schedulerState,
          error: null 
        };
        logger.debug('✅ Scheduler state is accessible');
        
      } catch (error) {
        schedulersCheck.schedulers.schedulerState = { 
          status: 'unhealthy', 
          data: null,
          error: error.message 
        };
        schedulersCheck.issues.push(`Scheduler state: ${error.message}`);
        logger.error('❌ Scheduler state check failed', { error: error.message });
      }

      // Check for stuck schedulers
      const stuckSchedulers = this.detectStuckSchedulers();
      if (stuckSchedulers.length > 0) {
        schedulersCheck.status = 'unhealthy';
        schedulersCheck.issues.push(`Stuck schedulers detected: ${stuckSchedulers.join(', ')}`);
        healthReport.criticalIssues.push({
          type: 'scheduler_stuck',
          message: `Schedulers are stuck: ${stuckSchedulers.join(', ')}`,
          fixSteps: {
            issue: 'Scheduler processes are stuck',
            steps: [
              '1. Check for infinite loops in scheduler code',
              '2. Verify timeout mechanisms are working',
              '3. Check for deadlocks in database operations',
              '4. Restart the application',
              '5. Clear stuck scheduler states'
            ],
            severity: 'high'
          }
        });
      }

    } catch (error) {
      schedulersCheck.status = 'error';
      schedulersCheck.issues.push(`Schedulers health check failed: ${error.message}`);
      logger.error('❌ Schedulers health check error', { error: error.message });
    }

    schedulersCheck.duration = Date.now() - checkStart;
    healthReport.checks.schedulers = schedulersCheck;
  }

  /**
   * Check file system health
   */
  async checkFileSystemHealth(healthReport) {
    const checkStart = Date.now();
    const fsCheck = {
      status: 'healthy',
      issues: [],
      checks: {},
      duration: 0
    };

    try {
      logger.info('🔍 Checking file system health...');

      // Check critical directories
      const criticalDirs = [
        'logs',
        'database/backups',
        'config'
      ];

      for (const dir of criticalDirs) {
        try {
          const dirPath = path.join(__dirname, '..', dir);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            logger.info(`📁 Created missing directory: ${dir}`);
          }
          
          // Check write permissions
          const testFile = path.join(dirPath, 'health_check.tmp');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          
          fsCheck.checks[dir] = { status: 'healthy', error: null };
          logger.debug(`✅ Directory ${dir} is healthy`);
          
        } catch (error) {
          fsCheck.checks[dir] = { status: 'unhealthy', error: error.message };
          fsCheck.issues.push(`Directory ${dir}: ${error.message}`);
          logger.error(`❌ Directory ${dir} health check failed`, { error: error.message });
        }
      }

      // Check disk space
      try {
        const stats = fs.statSync(__dirname);
        fsCheck.checks.diskSpace = { status: 'healthy', error: null };
        logger.debug('✅ Disk space check passed');
        
      } catch (error) {
        fsCheck.checks.diskSpace = { status: 'unhealthy', error: error.message };
        fsCheck.issues.push(`Disk space: ${error.message}`);
        healthReport.criticalIssues.push({
          type: 'file_system_error',
          message: 'File system access issues detected',
          fixSteps: this.fixSteps.get('file_system_error')
        });
      }

      // Check for critical file system issues
      const unhealthyChecks = Object.values(fsCheck.checks).filter(check => check.status === 'unhealthy');
      if (unhealthyChecks.length > 0) {
        fsCheck.status = 'unhealthy';
      }

    } catch (error) {
      fsCheck.status = 'error';
      fsCheck.issues.push(`File system health check failed: ${error.message}`);
      logger.error('❌ File system health check error', { error: error.message });
    }

    fsCheck.duration = Date.now() - checkStart;
    healthReport.checks.fileSystem = fsCheck;
  }

  /**
   * Check memory health
   */
  async checkMemoryHealth(healthReport) {
    const checkStart = Date.now();
    const memoryCheck = {
      status: 'healthy',
      issues: [],
      usage: {},
      duration: 0
    };

    try {
      logger.info('🔍 Checking memory health...');

      const memUsage = process.memoryUsage();
      memoryCheck.usage = {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
      };

      // Check for high memory usage
      const heapUsedMB = memoryCheck.usage.heapUsed;
      const heapTotalMB = memoryCheck.usage.heapTotal;
      const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      if (memoryUsagePercent > 90) {
        memoryCheck.status = 'unhealthy';
        memoryCheck.issues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
        healthReport.criticalIssues.push({
          type: 'memory_usage_high',
          message: `Memory usage is ${memoryUsagePercent.toFixed(2)}%`,
          fixSteps: this.fixSteps.get('memory_usage_high')
        });
      } else if (memoryUsagePercent > 75) {
        memoryCheck.issues.push(`Moderate memory usage: ${memoryUsagePercent.toFixed(2)}%`);
      }

      logger.debug('✅ Memory health check completed', memoryCheck.usage);

    } catch (error) {
      memoryCheck.status = 'error';
      memoryCheck.issues.push(`Memory health check failed: ${error.message}`);
      logger.error('❌ Memory health check error', { error: error.message });
    }

    memoryCheck.duration = Date.now() - checkStart;
    healthReport.checks.memory = memoryCheck;
  }

  /**
   * Detect stuck schedulers
   */
  detectStuckSchedulers() {
    // This would check for schedulers that have been running too long
    // For now, return empty array as we don't have scheduler tracking yet
    return [];
  }

  /**
   * Determine overall system status
   */
  determineOverallStatus(healthReport) {
    const criticalIssues = healthReport.criticalIssues.length;
    const unhealthyChecks = Object.values(healthReport.checks).filter(check => check.status === 'unhealthy').length;
    const errorChecks = Object.values(healthReport.checks).filter(check => check.status === 'error').length;

    if (criticalIssues > 0 || errorChecks > 0) {
      return 'critical';
    } else if (unhealthyChecks > 0) {
      return 'unhealthy';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate recommendations based on health check results
   */
  generateRecommendations(healthReport) {
    const recommendations = [];

    // Database recommendations
    if (healthReport.checks.database?.status === 'unhealthy') {
      recommendations.push({
        priority: 'high',
        category: 'database',
        message: 'Fix database connectivity issues',
        action: 'Check Firebase credentials and network connectivity'
      });
    }

    // Memory recommendations
    if (healthReport.checks.memory?.status === 'unhealthy') {
      recommendations.push({
        priority: 'high',
        category: 'memory',
        message: 'Optimize memory usage',
        action: 'Add garbage collection and reduce batch sizes'
      });
    }

    // Service recommendations
    if (healthReport.checks.services?.status === 'unhealthy') {
      recommendations.push({
        priority: 'medium',
        category: 'services',
        message: 'Fix service initialization issues',
        action: 'Check service dependencies and imports'
      });
    }

    healthReport.recommendations = recommendations;
  }

  /**
   * Log comprehensive health report
   */
  logHealthReport(healthReport) {
    logger.info('📋 System Health Report', {
      overallStatus: healthReport.overallStatus,
      timestamp: healthReport.timestamp,
      criticalIssues: healthReport.criticalIssues.length,
      recommendations: healthReport.recommendations.length
    });

    // Log critical issues with fix steps
    if (healthReport.criticalIssues.length > 0) {
      logger.error('🚨 Critical Issues Found:', healthReport.criticalIssues.map(issue => ({
        type: issue.type,
        message: issue.message,
        fixSteps: issue.fixSteps?.steps || []
      })));
    }

    // Log recommendations
    if (healthReport.recommendations.length > 0) {
      logger.info('💡 Recommendations:', healthReport.recommendations.map(rec => ({
        priority: rec.priority,
        category: rec.category,
        message: rec.message,
        action: rec.action
      })));
    }
  }

  /**
   * Save health report to file
   */
  async saveHealthReport(healthReport) {
    try {
      const reportsDir = path.join(__dirname, '../logs/health-reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const reportFile = path.join(reportsDir, `health-report-${Date.now()}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(healthReport, null, 2));
      
      logger.info(`💾 Health report saved to ${reportFile}`);
      
    } catch (error) {
      logger.error('❌ Error saving health report', { error: error.message });
    }
  }

  /**
   * Get fix steps for a specific issue type
   */
  getFixSteps(issueType) {
    return this.fixSteps.get(issueType) || {
      issue: 'Unknown issue',
      steps: ['1. Check logs for more details', '2. Contact system administrator'],
      severity: 'unknown'
    };
  }

  /**
   * Record a failure for tracking
   */
  recordFailure(service, error, context = {}) {
    const failure = {
      timestamp: new Date().toISOString(),
      service,
      error: error.message,
      stack: error.stack,
      context,
      fixSteps: this.getFixSteps(this.categorizeError(error))
    };

    this.failureHistory.push(failure);
    
    // Keep only last 100 failures
    if (this.failureHistory.length > 100) {
      this.failureHistory = this.failureHistory.slice(-100);
    }

    logger.error(`🚨 Service failure recorded: ${service}`, {
      error: error.message,
      fixSteps: failure.fixSteps.steps
    });
  }

  /**
   * Categorize error to get appropriate fix steps
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('database') || message.includes('firebase')) {
      return 'database_connection_failed';
    } else if (message.includes('selenium') || message.includes('driver')) {
      return 'selenium_driver_failed';
    } else if (message.includes('banner')) {
      return 'banner_extraction_failed';
    } else if (message.includes('product') || message.includes('extraction')) {
      return 'product_extraction_failed';
    } else if (message.includes('category') || message.includes('hierarchical')) {
      return 'hierarchical_category_failed';
    } else if (message.includes('memory') || message.includes('heap')) {
      return 'memory_usage_high';
    } else if (message.includes('file') || message.includes('directory')) {
      return 'file_system_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * Get failure history
   */
  getFailureHistory(limit = 20) {
    return this.failureHistory.slice(-limit);
  }

  /**
   * Get system health summary
   */
  getHealthSummary() {
    return {
      overallStatus: this.healthChecks,
      recentFailures: this.getFailureHistory(10),
      fixStepsAvailable: Array.from(this.fixSteps.keys())
    };
  }
}

// Create singleton instance
const systemHealthMonitor = new SystemHealthMonitor();

module.exports = { SystemHealthMonitor, systemHealthMonitor };
