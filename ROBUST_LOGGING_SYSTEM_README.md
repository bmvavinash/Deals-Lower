# 🏥 Robust Logging & Health Monitoring System

## Overview

This comprehensive logging and health monitoring system provides detailed tracking, error detection, and automated fix recommendations across all services in the DealsOptimised application.

## 🎯 Key Features

### 1. **System Health Monitor** (`services/systemHealthMonitor.js`)
- **Comprehensive Health Checks**: Database, services, schedulers, file system, and memory
- **Automated Fix Steps**: Pre-defined solutions for common issues
- **Failure Tracking**: Records and categorizes all system failures
- **Real-time Monitoring**: Continuous health status tracking

### 2. **Enhanced Service Logging**
- **Operation Tracking**: Unique operation IDs for tracing requests
- **Performance Metrics**: Duration tracking for all operations
- **Error Context**: Detailed error information with fix steps
- **Batch Processing**: Progress tracking for bulk operations

### 3. **Hierarchical Enrichment Service** (`services/hierarchicalEnrichmentService.js`)
- **Missing Data Detection**: Identifies products with incomplete information
- **Intelligent Prioritization**: Processes products by priority and missing fields
- **Comprehensive Logging**: Tracks every step of the enrichment process
- **Health Integration**: Uses system health monitor for error handling

## 🚀 Usage

### System Health Check
```bash
# Run comprehensive system health check
node scripts/systemHealthCheck.js

# Check hierarchical data status
node scripts/checkHierarchicalData.js

# Run hierarchical enrichment
node scripts/enrichMissingHierarchy.js
```

### Health Check Results
The system provides detailed reports including:
- **Overall Status**: healthy, unhealthy, or critical
- **Critical Issues**: Problems requiring immediate attention
- **Recommendations**: Actionable steps to fix issues
- **Performance Metrics**: Duration and success rates
- **Failure History**: Recent system failures with context

## 🔧 Fix Steps for Common Issues

### Database Connection Failed
1. Check Firebase credentials and service account file
2. Verify database URL is correct
3. Check network connectivity
4. Restart the application
5. Check Firebase console for service status

### Selenium WebDriver Failed
1. Check if Chrome browser is installed
2. Verify ChromeDriver version compatibility
3. Check if port 9222 is available
4. Restart Chrome with debugging enabled
5. Check system memory and resources

### Banner Extraction Failed
1. Check if target websites are accessible
2. Verify CSS selectors are still valid
3. Check for website layout changes
4. Update selectors in bannerConfig.js
5. Test with manual browser inspection

### Product Extraction Failed
1. Check product URL accessibility
2. Verify page load timeouts
3. Check for anti-bot measures
4. Update extraction selectors
5. Check network connectivity

### Hierarchical Category Failed
1. Check category hierarchy database
2. Verify product data completeness
3. Update category mapping rules
4. Check URL parsing logic
5. Run manual category extraction test

### Memory Usage High
1. Check for memory leaks in extraction loops
2. Add garbage collection calls
3. Reduce batch sizes
4. Restart the application
5. Monitor memory usage patterns

### File System Error
1. Check disk space availability
2. Verify file permissions
3. Check for file locks
4. Restart the application
5. Check system resources

## 📊 Logging Levels

### INFO Level
- Application startup and shutdown
- Successful operations completion
- Health check results
- Performance metrics

### DEBUG Level
- Detailed operation steps
- Individual product processing
- Batch progress updates
- Internal state changes

### WARN Level
- Non-critical issues
- Performance degradation
- Missing optional data
- Retry attempts

### ERROR Level
- Operation failures
- Service unavailability
- Data corruption
- System exceptions

## 🏗️ Architecture

### Health Monitoring Flow
```
Application Start → Initial Health Check → Service Initialization → 
Continuous Monitoring → Error Detection → Fix Steps → Recovery
```

### Logging Flow
```
Operation Start → Progress Tracking → Error Handling → 
Fix Steps → Recovery → Completion Logging
```

### Failure Tracking
```
Error Occurrence → Categorization → Fix Steps Lookup → 
Context Recording → Health Report Update → Recommendation Generation
```

## 📁 File Structure

```
services/
├── systemHealthMonitor.js          # Main health monitoring service
├── hierarchicalEnrichmentService.js # Enhanced enrichment with logging
├── idleProcessingService.js        # Idle time processing with health checks
└── comprehensiveLoggingService.js  # Centralized logging utilities

scripts/
├── systemHealthCheck.js           # Standalone health check script
├── checkHierarchicalData.js       # Data analysis script
└── enrichMissingHierarchy.js      # Manual enrichment script

logs/
├── health-reports/                # Health check reports
├── missingDetails.json           # Missing data tracking
└── application-*.log             # Application logs
```

## 🔍 Monitoring Dashboard

### Health Status Indicators
- 🟢 **Healthy**: All systems operational
- 🟡 **Unhealthy**: Some issues detected, non-critical
- 🔴 **Critical**: Major issues requiring immediate attention

### Key Metrics
- **Success Rate**: Percentage of successful operations
- **Response Time**: Average operation duration
- **Error Rate**: Frequency of failures
- **Memory Usage**: Current memory consumption
- **Database Connectivity**: Connection status

## 🚨 Alert System

### Critical Alerts
- Database connection failures
- WebDriver initialization errors
- Memory usage exceeding 90%
- File system access issues

### Warning Alerts
- High memory usage (75-90%)
- Service initialization issues
- Network connectivity problems
- Performance degradation

## 📈 Performance Optimization

### Batch Processing
- Processes products in small batches (5 at a time)
- Includes delays between batches to prevent overload
- Tracks progress and success rates

### Memory Management
- Regular garbage collection calls
- Monitors memory usage patterns
- Alerts when usage exceeds thresholds

### Error Recovery
- Automatic retry mechanisms
- Graceful degradation
- Fallback strategies

## 🔧 Configuration

### Health Check Intervals
- Initial check: On application startup
- Continuous monitoring: During operations
- Final check: On application shutdown

### Log Retention
- Health reports: Saved to `logs/health-reports/`
- Application logs: Rotated daily
- Missing details: Persistent tracking

### Error Thresholds
- Memory usage: 75% warning, 90% critical
- Database timeouts: 30 seconds
- Operation timeouts: 5 minutes

## 🎯 Best Practices

### For Developers
1. Always use structured logging with context
2. Include operation IDs for tracing
3. Provide fix steps for errors
4. Monitor performance metrics
5. Test health checks regularly

### For Operations
1. Monitor health reports daily
2. Address critical issues immediately
3. Review failure patterns
4. Update fix steps as needed
5. Maintain system resources

## 🚀 Future Enhancements

### Planned Features
- Real-time dashboard
- Automated alert notifications
- Performance trend analysis
- Predictive failure detection
- Integration with external monitoring tools

### Monitoring Improvements
- Custom health check endpoints
- Service-specific metrics
- User behavior tracking
- Resource utilization optimization

## 📞 Support

For issues with the logging system:
1. Check the health reports in `logs/health-reports/`
2. Review application logs for detailed error information
3. Use the provided fix steps for common issues
4. Run system health checks to identify problems
5. Contact system administrator for critical issues

---

**Note**: This robust logging system ensures comprehensive monitoring and quick issue resolution, maintaining high system reliability and performance.
