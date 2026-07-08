import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { executionAPI } from '../services/api';
import PipelineView from '../components/Execution/PipelineView';
import './ExecutionMonitor.css';

interface Execution {
  id: string;
  type: string;
  scriptName?: string;
  saleName?: string;
  status: string;
  sourceType?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  currentPlatform?: string;
  currentCategory?: string;
  totalProducts?: number;
  totalProcessed?: number;
  totalCreated?: number;
  totalUpdated?: number;
  platforms?: Record<string, any>;
  messages?: { total: number; processed: number; failed: number };
  products?: { total: number; processed: number; created: number; updated: number; failed: number; byPlatform?: Record<string, any> };
  checkedFavoritesCount?: number;
  notificationsSent?: number;
  processedUrls?: number;
  extractedBanners?: number;
  summary?: any;
  errors?: string[];
  logs?: string[];
  host?: {
    hostname: string;
    username: string;
    platform: string;
    ips: string;
    envType: string;
  };
  client?: {
    ip: string;
    origin: string;
    userAgent: string;
  };
}

interface ExecutionStatus {
  currentExecution: Execution | null;
  telegramQueue: {
    pending: number;
    processing: number;
    channels: Record<string, any>;
  };
  platformQueue: any[];
  categoryQueue: any[];
  queue?: any[];
}

const formatDuration = (ms?: number) => {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins}m ${remainingSecs}s`;
};

const getTypeName = (type: string, run?: Execution) => {
  switch (type) {
    case 'bulk_update':
      return '📦 Bulk Update';
    case 'telegram_bot':
      return '📱 Telegram Bot';
    case 'favorites_check':
      return '❤️ Favorites Check';
    case 'db_update':
      return `💾 TB Update (${run?.scriptName || 'Script'})`;
    case 'sale_scraper':
      return `📡 Sails Grapper (${run?.saleName || 'Sale'})`;
    default:
      return type;
  }
};

const getSummaryText = (run: Execution) => {
  switch (run.type) {
    case 'bulk_update':
      return `Processed ${run.totalProcessed || 0}/${run.totalProducts || 0} products (+${run.totalCreated || 0} created, ~${run.totalUpdated || 0} updated)`;
    case 'telegram_bot':
      return `Messages: ${run.messages?.processed || 0} processed | Products: ${run.products?.processed || 0} (+${run.products?.created || 0} created)`;
    case 'favorites_check':
      const fs = run.summary || {};
      return `Checked ${fs.usersCount || 0} users, sent ${fs.totalNotifications || 0} notifications (Price drops: ${fs.priceTracking || 0}, Stock: ${fs.lowStock || 0})`;
    case 'db_update':
      const ds = run.summary || {};
      return `Script: "${run.scriptName}" | Modified: ${ds.processedCount !== undefined ? ds.processedCount : (ds.staleUrlsCount || 0)} records`;
    case 'sale_scraper':
      return `URLs: ${run.processedUrls || 0}/${run.totalUrls || 0} | Extracted ${run.extractedBanners || 0} banners`;
    default:
      return run.summary ? JSON.stringify(run.summary) : 'N/A';
  }
};

const ExecutionMonitor: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>('all');

  // Manual trigger states
  const [bulkSource, setBulkSource] = useState('website');
  const [bulkDb, setBulkDb] = useState('productdeals');
  const [favSource, setFavSource] = useState('api');
  const [saleName, setSaleName] = useState('Mega Sale Scrape');
  const [salePlatform, setSalePlatform] = useState('flipkart');
  const [saleCategory, setSaleCategory] = useState('electronics');
  const [saleUrls, setSaleUrls] = useState('https://www.flipkart.com/offers-list/deals-of-the-day');
  const [forceParallel, setForceParallel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleTrigger = async (type: string) => {
    setIsSubmitting(true);
    setTriggerMessage(null);
    try {
      let params: any = {};
      if (type === 'bulk_update') {
        params = { sourceType: bulkSource, targetDb: bulkDb };
      } else if (type === 'favorites_check') {
        params = { sourceType: favSource };
      } else if (type === 'sale_scraper') {
        const urlList = saleUrls.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
        if (urlList.length === 0) {
          throw new Error('Please enter at least one URL to scrape.');
        }
        params = {
          saleName,
          platform: salePlatform,
          category: saleCategory,
          urls: urlList
        };
      }

      const res = await executionAPI.triggerTask(type, params, forceParallel);
      setTriggerMessage({
        text: (res.data as any)?.message || 'Task triggered successfully.',
        type: 'success'
      });
      
      setTimeout(() => setTriggerMessage(null), 5000);
      refetchStatus();
    } catch (error: any) {
      setTriggerMessage({
        text: error.response?.data?.error || error.message || 'Failed to trigger task.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await executionAPI.cancelTask(taskId);
      refetchStatus();
    } catch (error: any) {
      console.error('Failed to cancel task', error);
    }
  };
  
  // Realtime active execution status
  const { data: statusData, refetch: refetchStatus } = useQuery(
    'execution-status-all',
    () => executionAPI.getStatus('all'),
    {
      refetchInterval: autoRefresh ? 2000 : false,
      staleTime: 1000,
      cacheTime: 30000
    }
  );

  // History query
  const { data: historyDataResponse, refetch: refetchHistory } = useQuery(
    'execution-history-all',
    () => executionAPI.getHistory(100), // Request up to 100 recent entries
    {
      refetchInterval: autoRefresh ? 5000 : false
    }
  );

  // Analytics query
  const { data: analyticsData } = useQuery(
    'execution-analytics-all',
    () => executionAPI.getAnalytics(),
    {
      refetchInterval: autoRefresh ? 10000 : false
    }
  );

  const status = (statusData?.data as any)?.data as ExecutionStatus | undefined;
  const historyList = (historyDataResponse?.data as any)?.data as Execution[] | undefined;
  const analytics = (analyticsData?.data as any)?.data;

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetchStatus();
        refetchHistory();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetchStatus, refetchHistory]);

  const currentExec = status?.currentExecution;

  // Filter history based on selected tab
  const filteredHistory = historyList?.filter((run) => {
    if (selectedTab === 'all') return true;
    return run.type === selectedTab;
  }) || [];

  return (
    <div className="execution-monitor">
      <div className="monitor-header">
        <h1>Real-Time Execution Monitor</h1>
        <div className="header-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (2s)
          </label>
        </div>
      </div>

      {/* Currently Running Banner */}
      {currentExec ? (
        <div className="current-execution">
          <div className="execution-header">
            <h2>
              <span className="pulse-dot"></span> 
              Currently Executing: {getTypeName(currentExec.type, currentExec)}
            </h2>
            <span className={`status-badge ${currentExec.status}`}>
              {currentExec.status.toUpperCase()}
            </span>
          </div>

          <div className="execution-info">
            <div className="info-grid">
              <div className="info-row">
                <span className="label">Execution ID:</span>
                <span className="value">{currentExec.id}</span>
              </div>
              <div className="info-row">
                <span className="label">Source Run From:</span>
                <span className="value source-badge">{currentExec.sourceType || 'cli'}</span>
              </div>
              <div className="info-row">
                <span className="label">Started Time:</span>
                <span className="value">
                  {new Date(currentExec.startTime).toLocaleString()}
                </span>
              </div>
              {currentExec.host && (
                <div className="info-row">
                  <span className="label">Running Host:</span>
                  <span className="value host-info-label">
                    🖥️ <strong>{currentExec.host.envType}</strong> ({currentExec.host.hostname} / {currentExec.host.username})
                  </span>
                </div>
              )}
              {currentExec.client && currentExec.client.ip !== 'N/A' && (
                <div className="info-row">
                  <span className="label">Triggered Client:</span>
                  <span className="value client-info-label">
                    🌐 {currentExec.client.ip} ({currentExec.client.origin})
                  </span>
                </div>
              )}
              {currentExec.type === 'bulk_update' && (
                <>
                  <div className="info-row">
                    <span className="label">Current Platform:</span>
                    <span className="value platform">{currentExec.currentPlatform || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Current Category:</span>
                    <span className="value category">{currentExec.currentCategory || 'N/A'}</span>
                  </div>
                </>
              )}
              {currentExec.type === 'db_update' && currentExec.scriptName && (
                <div className="info-row">
                  <span className="label">Script Name:</span>
                  <span className="value script-name">{currentExec.scriptName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Counters based on type */}
          {currentExec.type === 'bulk_update' && (
            <div className="progress-stats">
              <div className="stat-card">
                <div className="stat-label">Total Products</div>
                <div className="stat-value">{currentExec.totalProducts || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Processed</div>
                <div className="stat-value success">{currentExec.totalProcessed || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Created</div>
                <div className="stat-value created">{currentExec.totalCreated || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Updated</div>
                <div className="stat-value updated">{currentExec.totalUpdated || 0}</div>
              </div>
            </div>
          )}

          {currentExec.type === 'telegram_bot' && (
            <div className="progress-stats">
              <div className="stat-card">
                <div className="stat-label">Messages Received</div>
                <div className="stat-value">{currentExec.messages?.total || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Processed</div>
                <div className="stat-value success">{currentExec.messages?.processed || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Products Found</div>
                <div className="stat-value">{currentExec.products?.total || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Products Created</div>
                <div className="stat-value created">{currentExec.products?.created || 0}</div>
              </div>
            </div>
          )}

          {currentExec.type === 'favorites_check' && (
            <div className="progress-stats">
              <div className="stat-card">
                <div className="stat-label">Status</div>
                <div className="stat-value created">Checking Favorites...</div>
              </div>
            </div>
          )}

          {/* Hierarchical Platform / Category summary for bulk updates */}
          {currentExec.type === 'bulk_update' && currentExec.platforms && Object.keys(currentExec.platforms).length > 0 && (
            <>
              <PipelineView execution={currentExec} />
              <div className="platform-category-summary">
                <h3>📊 Platform & Category Progress</h3>
                <div className="platforms-list">
                  {Object.entries(currentExec.platforms).map(([platform, platformData]: [string, any]) => (
                    <div key={platform} className="platform-card">
                      <div className="platform-header">
                        <span className="platform-icon">🌐</span>
                        <span className="platform-name">{platform.toUpperCase()}</span>
                        <span className="platform-status">
                          {platformData.totalProcessed || 0} / {platformData.totalProducts || 0} products
                        </span>
                      </div>
                      {platformData.categories && Object.keys(platformData.categories).length > 0 ? (
                        <div className="categories-list">
                          {Object.entries(platformData.categories).map(([category, categoryData]: [string, any]) => (
                            <div key={category} className="category-item">
                              <span className="category-icon">📁</span>
                              <span className="category-name">{category}</span>
                              <span className="category-stats">
                                {categoryData.processed || 0} / {categoryData.totalProducts || 0} products
                                {categoryData.created > 0 && <span className="stat-badge created">+{categoryData.created}</span>}
                                {categoryData.updated > 0 && <span className="stat-badge updated">~{categoryData.updated}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-categories">
                          <span className="category-icon">⏳</span>
                          <span>Categories will appear as they are processed...</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="no-execution-banner">
          <span className="idle-icon">💤</span>
          <div className="idle-details">
            <h3>System Idle</h3>
            <p>All schedulers and local updates are finished. Ready for next manual/automatic run.</p>
          </div>
        </div>
      )}

      {/* Task Queue Visualization */}
      {status?.queue && status.queue.length > 0 && (
        <div className="queue-panel">
          <div className="queue-title">
            <span>⏳ Background Task Queue ({status.queue.length} Pending)</span>
          </div>
          <div className="queue-items-list">
            {status.queue.map((task: any, index: number) => (
              <div key={task.id} className="queue-item-row">
                <div className="queue-item-details">
                  <span className={`queue-badge ${task.status === 'running' ? 'running' : ''}`}>
                    {task.status === 'running' ? '⚡ Running' : `#${index + 1} Queued`}
                  </span>
                  <span className="queue-meta">
                    Type: <strong>{getTypeName(task.type)}</strong> | 
                    Triggered from: <strong>{task.client?.origin || 'System'}</strong> | 
                    Enqueued: <strong>{new Date(task.enqueuedAt).toLocaleTimeString()}</strong>
                  </span>
                </div>
                {task.status !== 'running' && (
                  <button className="queue-cancel-btn" onClick={() => handleCancelTask(task.id)}>
                    ❌ Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Trigger Panel depending on Selected Tab */}
      {selectedTab !== 'all' && (
        <div className="trigger-control-panel">
          <h3>⚡ Manual Trigger: {getTypeName(selectedTab)}</h3>
          
          {triggerMessage && (
            <div className={`status-badge ${triggerMessage.type === 'success' ? 'completed' : 'failed'} mb-3`} style={{ display: 'inline-block' }}>
              {triggerMessage.text}
            </div>
          )}

          <div className="trigger-form">
            {selectedTab === 'bulk_update' && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Source Type</label>
                  <select value={bulkSource} onChange={(e) => setBulkSource(e.target.value)}>
                    <option value="website">Website (Scraper)</option>
                    <option value="api">API Triggered</option>
                    <option value="cli">CLI Script</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Database</label>
                  <select value={bulkDb} onChange={(e) => setBulkDb(e.target.value)}>
                    <option value="productdeals">Product Deals (Production)</option>
                    <option value="testdeals">Test Deals (Staging)</option>
                  </select>
                </div>
              </div>
            )}

            {selectedTab === 'favorites_check' && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Source Type</label>
                  <select value={favSource} onChange={(e) => setFavSource(e.target.value)}>
                    <option value="api">API Monitor Web</option>
                    <option value="scheduler">Scheduler Clock</option>
                  </select>
                </div>
              </div>
            )}

            {selectedTab === 'sale_scraper' && (
              <div className="trigger-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Sale Name</label>
                    <input 
                      type="text" 
                      value={saleName} 
                      onChange={(e) => setSaleName(e.target.value)} 
                      placeholder="Mega Sale Scrape"
                    />
                  </div>
                  <div className="form-group">
                    <label>Scraping Platform</label>
                    <select value={salePlatform} onChange={(e) => setSalePlatform(e.target.value)}>
                      <option value="flipkart">Flipkart</option>
                      <option value="amazon">Amazon</option>
                      <option value="ajio">Ajio</option>
                      <option value="myntra">Myntra</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Product Category</label>
                    <input 
                      type="text" 
                      value={saleCategory} 
                      onChange={(e) => setSaleCategory(e.target.value)} 
                      placeholder="electronics"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>URLs to Scrape (one per line)</label>
                  <textarea 
                    rows={3} 
                    value={saleUrls} 
                    onChange={(e) => setSaleUrls(e.target.value)}
                    placeholder="https://www.flipkart.com/..."
                  />
                </div>
              </div>
            )}

            {selectedTab === 'telegram_bot' && (
              <p className="text-muted" style={{ margin: 0, fontSize: '13px' }}>
                Triggering the Telegram Bot starts checking real-time messages and channel feeds in the background.
              </p>
            )}

            {selectedTab === 'db_update' && (
              <p className="text-muted" style={{ margin: 0, fontSize: '13px' }}>
                Triggering the Database update scans for stale product listings and refreshes current details automatically.
              </p>
            )}

            <div className="form-grid mt-2">
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={forceParallel} 
                    onChange={(e) => setForceParallel(e.target.checked)}
                  />
                  Force Run in Parallel (Only if running locally - Bypasses sequential queue)
                </label>
              </div>
            </div>

            <button 
              className="trigger-btn" 
              onClick={() => handleTrigger(selectedTab)}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ Triggering...' : `🚀 Start ${getTypeName(selectedTab)}`}
            </button>
          </div>
        </div>
      )}

      {/* Tabs / Filter Controls */}
      <div className="runs-history-section">
        <div className="runs-history-header">
          <h2>Runs History</h2>
          <div className="execution-tabs">
            <button className={`tab-btn ${selectedTab === 'all' ? 'active' : ''}`} onClick={() => setSelectedTab('all')}>
              🔄 All Runs
            </button>
            <button className={`tab-btn ${selectedTab === 'bulk_update' ? 'active' : ''}`} onClick={() => setSelectedTab('bulk_update')}>
              📦 Bulk Updates
            </button>
            <button className={`tab-btn ${selectedTab === 'telegram_bot' ? 'active' : ''}`} onClick={() => setSelectedTab('telegram_bot')}>
              📱 Telegram Bots
            </button>
            <button className={`tab-btn ${selectedTab === 'favorites_check' ? 'active' : ''}`} onClick={() => setSelectedTab('favorites_check')}>
              ❤️ Favorites
            </button>
            <button className={`tab-btn ${selectedTab === 'db_update' ? 'active' : ''}`} onClick={() => setSelectedTab('db_update')}>
              💾 TB Updates
            </button>
            <button className={`tab-btn ${selectedTab === 'sale_scraper' ? 'active' : ''}`} onClick={() => setSelectedTab('sale_scraper')}>
              📡 Sails Grappers
            </button>
          </div>
        </div>

        {/* History Grid Table */}
        {filteredHistory.length > 0 ? (
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Execution Type</th>
                  <th>Source</th>
                  <th>Machine (Host)</th>
                  <th>Trigger IP / Origin</th>
                  <th>Status</th>
                  <th>Time Range</th>
                  <th>Duration</th>
                  <th>Impact Summary / Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((run) => (
                  <tr key={run.id} className={`history-row ${run.status}`}>
                    <td className="run-id">{run.id.split('_')[1] || run.id}</td>
                    <td className="run-type">
                      <span className={`type-tag-indicator ${run.type}`}>
                        {getTypeName(run.type, run)}
                      </span>
                    </td>
                    <td className="run-source">
                      <span className="source-tag">{run.sourceType || 'cli'}</span>
                    </td>
                    <td className="run-host">
                      {run.host ? (
                        <div className="host-cell">
                          <span className="host-env">{run.host.envType}</span>
                          <span className="host-name">{run.host.hostname}</span>
                        </div>
                      ) : (
                        <span className="text-muted">N/A</span>
                      )}
                    </td>
                    <td className="run-client">
                      {run.client ? (
                        <div className="client-cell">
                          <span className="client-ip">{run.client.ip}</span>
                          <span className="client-origin">{run.client.origin}</span>
                        </div>
                      ) : (
                        <span className="text-muted">N/A</span>
                      )}
                    </td>
                    <td className="run-status">
                      <span className={`status-tag ${run.status}`}>
                        {run.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="run-time">
                      <div className="time-col">
                        <span>{new Date(run.startTime).toLocaleString()}</span>
                        {run.endTime && <span className="end-time">Finished: {new Date(run.endTime).toLocaleTimeString()}</span>}
                      </div>
                    </td>
                    <td className="run-duration">{formatDuration(run.duration)}</td>
                    <td className="run-summary">{getSummaryText(run)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-history-state">
            <span className="empty-icon">📂</span>
            <p>No runs history found for the selected type</p>
          </div>
        )}
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <div className="analytics-summary mt-4">
          <h3>📊 Execution Analytics (Recent 10 runs)</h3>
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-label">Total Executions</div>
              <div className="analytics-value">{analytics.totalExecutions || 0}</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-label">Total Products Evaluated</div>
              <div className="analytics-value">{analytics.totalProducts || 0}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionMonitor;
