#!/usr/bin/env node

const { systemHealthMonitor } = require('../services/systemHealthMonitor');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('systemHealthCheck');

async function main() {
  try {
    logger.info('🏥 Starting comprehensive system health check...');
    
    // Perform full system health check
    const healthReport = await systemHealthMonitor.performHealthCheck();
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('🏥 SYSTEM HEALTH REPORT');
    console.log('='.repeat(80));
    console.log(`📅 Timestamp: ${healthReport.timestamp}`);
    console.log(`🎯 Overall Status: ${healthReport.overallStatus.toUpperCase()}`);
    console.log(`⏱️  Check Duration: ${Object.values(healthReport.checks).reduce((sum, check) => sum + (check.duration || 0), 0)}ms`);
    
    // Display check results
    console.log('\n📋 CHECK RESULTS:');
    console.log('-'.repeat(50));
    
    Object.entries(healthReport.checks).forEach(([checkName, check]) => {
      const status = check.status === 'healthy' ? '✅' : check.status === 'unhealthy' ? '❌' : '⚠️';
      console.log(`${status} ${checkName.toUpperCase()}: ${check.status} (${check.duration}ms)`);
      
      if (check.issues && check.issues.length > 0) {
        check.issues.forEach(issue => {
          console.log(`   • ${issue}`);
        });
      }
    });
    
    // Display critical issues
    if (healthReport.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:');
      console.log('-'.repeat(50));
      
      healthReport.criticalIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.message}`);
        console.log(`   Type: ${issue.type}`);
        if (issue.fixSteps) {
          console.log(`   Fix Steps:`);
          issue.fixSteps.steps.forEach(step => {
            console.log(`     ${step}`);
          });
        }
        console.log('');
      });
    }
    
    // Display recommendations
    if (healthReport.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('-'.repeat(50));
      
      healthReport.recommendations.forEach((rec, index) => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`${priority} ${index + 1}. ${rec.message}`);
        console.log(`   Action: ${rec.action}`);
        console.log('');
      });
    }
    
    // Display failure history
    const recentFailures = systemHealthMonitor.getFailureHistory(5);
    if (recentFailures.length > 0) {
      console.log('\n📊 RECENT FAILURES:');
      console.log('-'.repeat(50));
      
      recentFailures.forEach((failure, index) => {
        console.log(`${index + 1}. ${failure.service} - ${failure.error}`);
        console.log(`   Time: ${failure.timestamp}`);
        if (failure.fixSteps) {
          console.log(`   Quick Fix: ${failure.fixSteps.steps[0]}`);
        }
        console.log('');
      });
    }
    
    // Display system summary
    console.log('\n📈 SYSTEM SUMMARY:');
    console.log('-'.repeat(50));
    console.log(`Total Products in Database: ${healthReport.checks.database?.databases?.productdeals ? 'Connected' : 'Unknown'}`);
    console.log(`Memory Usage: ${healthReport.checks.memory?.usage ? `${healthReport.checks.memory.usage.heapUsed}MB / ${healthReport.checks.memory.usage.heapTotal}MB` : 'Unknown'}`);
    console.log(`File System: ${healthReport.checks.fileSystem?.status || 'Unknown'}`);
    console.log(`Services: ${healthReport.checks.services?.status || 'Unknown'}`);
    
    // Final status
    console.log('\n' + '='.repeat(80));
    if (healthReport.overallStatus === 'healthy') {
      console.log('✅ SYSTEM IS HEALTHY - All checks passed successfully!');
    } else if (healthReport.overallStatus === 'unhealthy') {
      console.log('⚠️  SYSTEM HAS ISSUES - Review recommendations above');
    } else {
      console.log('🚨 SYSTEM IS CRITICAL - Immediate attention required!');
    }
    console.log('='.repeat(80));
    
    // Exit with appropriate code
    if (healthReport.overallStatus === 'critical') {
      process.exit(1);
    } else if (healthReport.overallStatus === 'unhealthy') {
      process.exit(2);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    logger.error('❌ Error during system health check', { error: error.message });
    console.log('\n❌ SYSTEM HEALTH CHECK FAILED');
    console.log(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  logger.error('❌ Unhandled error in main function', { error: error.message });
  process.exit(1);
});
