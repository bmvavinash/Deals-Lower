import React, { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { executionAPI } from '../services/api';
import PipelineView from '../components/Execution/PipelineView';
import './ExecutionMonitor.css';

interface ExecutionStatus {
  currentExecution: {
    id: string;
    type: string;
    status: string;
    startTime: string;
    currentPlatform: string;
    currentCategory: string;
    totalProducts: number;
    totalProcessed: number;
    totalCreated: number;
    totalUpdated: number;
    platforms: Record<string, any>;
  } | null;
  telegramQueue: {
    pending: number;
    processing: number;
    channels: Record<string, any>;
  };
}

type ExecutionType = 'bulk_update' | 'telegram_bot';

const ExecutionMonitor: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [executionType, setExecutionType] = useState<ExecutionType>('bulk_update');
  
  // Cache both execution types
  const { data: bulkStatusData, refetch: refetchBulk } = useQuery(
    ['execution-status', 'bulk_update'],
    () => executionAPI.getStatus('bulk_update'),
    {
      refetchInterval: autoRefresh ? 2000 : false,
      enabled: true,
      staleTime: 1000, // Cache for 1 second
      cacheTime: 30000 // Keep in cache for 30 seconds
    }
  );

  const { data: telegramStatusData, refetch: refetchTelegram } = useQuery(
    ['execution-status', 'telegram_bot'],
    () => executionAPI.getStatus('telegram_bot'),
    {
      refetchInterval: autoRefresh ? 2000 : false,
      enabled: true,
      staleTime: 1000,
      cacheTime: 30000
    }
  );

  // Get current status based on selected type
  const statusData = executionType === 'bulk_update' ? bulkStatusData : telegramStatusData;
  const refetchStatus = executionType === 'bulk_update' ? refetchBulk : refetchTelegram;

  const { data: analyticsData } = useQuery(
    'execution-analytics',
    () => executionAPI.getAnalytics(),
    {
      refetchInterval: autoRefresh ? 10000 : false
    }
  );

  const status = (statusData?.data as any)?.data as ExecutionStatus | undefined;
  const analytics = (analyticsData?.data as any)?.data;

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetchStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refetchStatus]);

  const currentExec = status?.currentExecution;

  return (
    <div className="execution-monitor">
      <div className="monitor-header">
        <h1>Real-Time Execution Monitor</h1>
        <div className="header-controls">
          <div className="execution-type-tabs">
            <button
              className={`type-tab ${executionType === 'bulk_update' ? 'active' : ''}`}
              onClick={() => setExecutionType('bulk_update')}
            >
              📦 Bulk Update
            </button>
            <button
              className={`type-tab ${executionType === 'telegram_bot' ? 'active' : ''}`}
              onClick={() => setExecutionType('telegram_bot')}
            >
              📱 Telegram Bot
            </button>
          </div>
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

      {/* Current Execution */}
      {currentExec ? (
        <div className="current-execution">
          <div className="execution-header">
            <h2>🔄 Currently Executing ({executionType === 'bulk_update' ? 'Bulk Update' : 'Telegram Bot'})</h2>
            <span className={`status-badge ${currentExec.status}`}>
              {currentExec.status.toUpperCase()}
            </span>
          </div>

          <div className="execution-info">
            <div className="info-row">
              <span className="label">Execution ID:</span>
              <span className="value">{currentExec.id}</span>
            </div>
            <div className="info-row">
              <span className="label">Type:</span>
              <span className="value">{currentExec.type || executionType}</span>
            </div>
            <div className="info-row">
              <span className="label">Started:</span>
              <span className="value">
                {new Date(currentExec.startTime).toLocaleString()}
              </span>
            </div>
            {executionType === 'bulk_update' && (
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
            {executionType === 'telegram_bot' && currentExec.channel && (
              <div className="info-row">
                <span className="label">Channel:</span>
                <span className="value">{currentExec.channel}</span>
              </div>
            )}
          </div>

          {/* Progress Stats */}
          {executionType === 'bulk_update' ? (
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
          ) : (
            <div className="progress-stats">
              <div className="stat-card">
                <div className="stat-label">Messages Total</div>
                <div className="stat-value">{currentExec.messages?.total || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Messages Processed</div>
                <div className="stat-value success">{currentExec.messages?.processed || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Products Total</div>
                <div className="stat-value">{currentExec.products?.total || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Products Created</div>
                <div className="stat-value created">{currentExec.products?.created || 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Products Updated</div>
                <div className="stat-value updated">{currentExec.products?.updated || 0}</div>
              </div>
            </div>
          )}

          {/* Hierarchical Pipeline View - Only for bulk updates */}
          {executionType === 'bulk_update' && currentExec.platforms && Object.keys(currentExec.platforms).length > 0 && (
            <PipelineView execution={currentExec} />
          )}
          
          {/* Enhanced Platform/Category Summary - Show even if PipelineView is empty */}
          {executionType === 'bulk_update' && currentExec.platforms && Object.keys(currentExec.platforms).length > 0 && (
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
          )}

          {/* Telegram Bot Products by Platform */}
          {executionType === 'telegram_bot' && currentExec.products?.byPlatform && (
            <div className="telegram-platforms">
              <h3>Products by Platform</h3>
              <div className="platform-stats-grid">
                {Object.entries(currentExec.products.byPlatform).map(([platform, stats]: [string, any]) => (
                  <div key={platform} className="platform-stat-card">
                    <div className="platform-name">{platform}</div>
                    <div className="platform-stats">
                      <div>Total: {stats.total || 0}</div>
                      <div>Created: {stats.created || 0}</div>
                      <div>Updated: {stats.updated || 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="no-execution">
          <p>No active {executionType === 'bulk_update' ? 'bulk update' : 'telegram bot'} execution</p>
          <p className="subtext">
            {executionType === 'bulk_update' 
              ? 'Bulk updates will appear here when running'
              : 'Telegram bot executions will appear here when running'}
          </p>
        </div>
      )}

      {/* Telegram Queue Status */}
      {status?.telegramQueue && (
        <div className="telegram-queue">
          <h3>📱 Telegram Bot Queue</h3>
          <div className="queue-stats">
            <div className="queue-stat">
              <span className="queue-label">Pending:</span>
              <span className="queue-value pending">{status.telegramQueue.pending}</span>
            </div>
            <div className="queue-stat">
              <span className="queue-label">Processing:</span>
              <span className="queue-value processing">{status.telegramQueue.processing}</span>
            </div>
          </div>
          {status.telegramQueue.channels && Object.keys(status.telegramQueue.channels).length > 0 && (
            <div className="channels-list">
              <h4>Channels:</h4>
              {Object.entries(status.telegramQueue.channels).map(([channel, data]: [string, any]) => (
                <div key={channel} className="channel-item">
                  <span className="channel-name">{channel}</span>
                  <span className="channel-stats">
                    Pending: {data.pending || 0} | Processing: {data.processing || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics Summary */}
      {analytics && (
        <div className="analytics-summary">
          <h3>📊 Execution Analytics</h3>
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-label">Total Executions</div>
              <div className="analytics-value">{analytics.totalExecutions || 0}</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-label">Total Products</div>
              <div className="analytics-value">{analytics.totalProducts || 0}</div>
            </div>
          </div>

          {analytics.platformStats && Object.keys(analytics.platformStats).length > 0 && (
            <div className="platform-analytics">
              <h4>Platform Statistics</h4>
              <div className="platform-stats-table">
                <table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Executions</th>
                      <th>Total Products</th>
                      <th>Avg Products</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.platformStats).map(([platform, stats]: [string, any]) => (
                      <tr key={platform}>
                        <td>{platform}</td>
                        <td>{stats.executions || 0}</td>
                        <td>{stats.totalProducts || 0}</td>
                        <td>{stats.avgProducts || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutionMonitor;


