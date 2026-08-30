import React, { useState } from 'react';
import { LogEntry } from '../../types/log';
import { logsAPI } from '../../services/api';
import './LogViewer.css';

interface LogViewerProps {
  logs: LogEntry[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  // Track fixing state per log ID or index: key is either log.id or index
  const [fixStates, setFixStates] = useState<
    Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message?: string }>
  >({});

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'error': return 'log-error';
      case 'warn': return 'log-warn';
      case 'info': return 'log-info';
      case 'debug': return 'log-debug';
      default: return '';
    }
  };

  // Helper to extract and resolve fixable details from a log entry
  const getFixableDetails = (log: LogEntry) => {
    const productUrl = log.productUrl || log.url || log.recoverySource || log.sourceUrl;
    const productCode = log.productCode || log.asin || log.id || log.key;
    const storeType = log.storeType || log.platform;

    // Check if we have explicit values in metadata
    if (productUrl && productCode && typeof productUrl === 'string' && typeof productCode === 'string' && !productUrl.startsWith('logs\\')) {
      return {
        productUrl,
        productCode,
        storeType: storeType || (productUrl.includes('flipkart') ? 'Flipkart' : 'Amazon')
      };
    }

    // Try parsing from message text
    const textToSearch = `${log.message || ''} ${log.raw || ''}`;
    const urlMatch = textToSearch.match(/https?:\/\/[^\s"']+/);
    if (urlMatch) {
      const url = urlMatch[0];
      let code = '';
      let platform = '';

      if (url.includes('amazon.')) {
        const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
        code = asinMatch ? asinMatch[1] : '';
        platform = 'Amazon';
      } else if (url.includes('flipkart.')) {
        const pidMatch = url.match(/[?&]pid=([^&]+)/i);
        code = pidMatch ? pidMatch[1] : '';
        platform = 'Flipkart';
      } else if (url.includes('ajio.')) {
        const codeMatch = url.match(/\/p\/([A-Z0-9]+)/i);
        code = codeMatch ? codeMatch[1] : '';
        platform = 'Ajio';
      } else if (url.includes('myntra.')) {
        const codeMatch = url.match(/\/([0-9]+)\/buy/i);
        code = codeMatch ? codeMatch[1] : '';
        platform = 'Myntra';
      }

      if (url && code) {
        return { productUrl: url, productCode: code, storeType: platform || 'Amazon' };
      }
    }

    return null;
  };

  const handleFixIt = async (logKey: string, details: { productUrl: string; productCode: string; storeType: string }, log: LogEntry) => {
    setFixStates(prev => ({
      ...prev,
      [logKey]: { status: 'loading' }
    }));

    try {
      const response = await logsAPI.fix({
        productCode: details.productCode,
        productUrl: details.productUrl,
        storeType: details.storeType,
        targetDb: log.targetDb || 'deals',
        issue: log.validationReason || log.message
      });

      if (response.data && response.data.success) {
        setFixStates(prev => ({
          ...prev,
          [logKey]: {
            status: response.data.isStillMissing ? 'error' : 'success',
            message: response.data.message
          }
        }));
      } else {
        throw new Error(response.data?.message || 'Unknown backend error');
      }
    } catch (err: any) {
      setFixStates(prev => ({
        ...prev,
        [logKey]: {
          status: 'error',
          message: err.response?.data?.message || err.message || 'Connection failed'
        }
      }));
    }
  };

  // Determine which missing attribute badges to show
  const getMissingBadges = (log: LogEntry) => {
    const badges: string[] = [];
    const text = (log.message || '').toLowerCase();
    
    if (log.attributesFailed && Array.isArray(log.attributesFailed)) {
      return log.attributesFailed;
    }

    if (text.includes('price')) badges.push('price');
    if (text.includes('image') || text.includes('photo')) badges.push('photo');
    if (text.includes('brand')) badges.push('brand');
    if (text.includes('title')) badges.push('title');
    if (text.includes('affiliate link')) badges.push('affiliate link');

    return badges;
  };

  return (
    <div className="log-viewer-container">
      <div className="log-list-wrapper">
        {logs.map((log, idx) => {
          const logKey = log.id || `idx-${idx}`;
          const fixDetails = getFixableDetails(log);
          const fixState = fixStates[logKey] || { status: 'idle' };
          const missingBadges = getMissingBadges(log);
          const logCategory = log.category || 'General';

          return (
            <div key={logKey} className={`log-card ${getLevelClass(log.level)}`}>
              <div className="log-card-header">
                <div className="header-meta-group">
                  <span className={`badge-level ${log.level}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="badge-module">
                    {log.module || log.moduleName || 'GENERAL'}
                  </span>
                  {logCategory && (
                    <span className="badge-category" title="Category Group">
                      📂 {logCategory}
                    </span>
                  )}
                  {fixDetails?.storeType && (
                    <span className={`badge-store ${fixDetails.storeType.toLowerCase()}`}>
                      🛒 {fixDetails.storeType}
                    </span>
                  )}
                </div>
                <span className="log-time-stamp">
                  {new Date(log.timestamp || log.date || Date.now()).toLocaleString()}
                </span>
              </div>

              <div className="log-card-body">
                <p className="log-msg-text">{log.message || log.raw}</p>
                
                {missingBadges.length > 0 && (
                  <div className="missing-badges-list">
                    {missingBadges.map((badge, bIdx) => (
                      <span key={bIdx} className="badge-missing">
                        ⚠️ Missing {badge.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}

                {log.error && (
                  <div className="error-trace-container">
                    <strong>Error Trace:</strong>
                    <pre>{log.error}</pre>
                  </div>
                )}

                {fixDetails && (
                  <div className="fix-details-panel">
                    <div className="product-details-summary">
                      <span><strong>Code:</strong> {fixDetails.productCode}</span>
                      <a href={fixDetails.productUrl} target="_blank" rel="noopener noreferrer" className="product-url-link">
                        Open Product Link ↗
                      </a>
                    </div>

                    <div className="fix-action-wrapper">
                      {fixState.status === 'idle' && (
                        <button
                          onClick={() => handleFixIt(logKey, fixDetails, log)}
                          className="btn-fix-it"
                        >
                          🛠️ Fix It
                        </button>
                      )}

                      {fixState.status === 'loading' && (
                        <div className="fix-loading-indicator">
                          <span className="spinner-mini"></span>
                          <span>Retriggering Selenium Scraping...</span>
                        </div>
                      )}

                      {fixState.status === 'success' && (
                        <div className="fix-status-success">
                          ✅ {fixState.message || 'Fixed and updated successfully!'}
                        </div>
                      )}

                      {fixState.status === 'error' && (
                        <div className="fix-status-error-panel">
                          <div className="fix-status-error">
                            ❌ {fixState.message || 'Fix action failed.'}
                          </div>
                          <button
                            onClick={() => handleFixIt(logKey, fixDetails, log)}
                            className="btn-retry-fix"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LogViewer;
