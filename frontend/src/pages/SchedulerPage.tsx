import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { schedulerAPI, executionAPI } from '../services/api';
import './SchedulerPage.css';

interface HeartbeatData {
  isDaemonAlive: boolean;
  secondsSinceLastHeartbeat: number;
  secondsSinceLastScriptUpdate: number;
  isRunningScriptStuck: boolean;
  heartbeat?: {
    pid: number;
    hostname: string;
    platform: string;
    memoryUsage?: {
      rss: string;
      heapTotal: string;
      heapUsed: string;
    };
  };
}

interface SchedulerConfig {
  intervals: {
    bulk: string;
    bot: string;
    favorites: string;
    staleCheck: string;
    banners: string;
  };
  activeDealsMode: boolean;
}

interface LogsData {
  fileName: string;
  availableFiles: any[];
  lines: Array<{
    timestamp: string;
    level: string;
    message: string;
    moduleName?: string;
  }>;
}

const SchedulerPage: React.FC = () => {
  const queryClient = useQueryClient();

  // State definitions
  const [isRestartingDaemon, setIsRestartingDaemon] = useState(false);
  const [selectedLogFile, setSelectedLogFile] = useState<string>('');
  const [logsSearchQuery, setLogsSearchQuery] = useState<string>('');
  
  // Form state for scheduler config
  const [bulkInterval, setBulkInterval] = useState('3');
  const [botInterval, setBotInterval] = useState('3');
  const [bannersInterval, setBannersInterval] = useState('4');
  const [staleInterval, setStaleInterval] = useState('2');
  const [activeDealsMode, setActiveDealsMode] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveMsg, setConfigSaveMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // React Query status/history hook
  const { data: statusData, refetch: refetchStatus } = useQuery('scheduler-status', schedulerAPI.getStatus, {
    refetchInterval: 10000
  });
  const { data: historyData } = useQuery('scheduler-history', () => schedulerAPI.getHistory(30));

  // Heartbeat query (polls every 10s)
  const { data: heartbeatResponse, refetch: refetchHeartbeat } = useQuery(
    'daemon-heartbeat',
    () => executionAPI.getHeartbeat().then(res => (res.data as any)?.data as HeartbeatData),
    {
      refetchInterval: 10000
    }
  );

  // Logs query (polls every 10s)
  const { data: logsResponse, refetch: refetchLogs } = useQuery(
    ['daemon-logs', selectedLogFile],
    () => executionAPI.getLogs(selectedLogFile).then(res => (res.data as any)?.data as LogsData),
    {
      refetchInterval: 10000
    }
  );

  // Scheduler Config query
  const { data: configResponse } = useQuery(
    'scheduler-config-data',
    () => executionAPI.getSchedulerConfig().then(res => (res.data as any)?.data as SchedulerConfig),
    {
      onSuccess: (data) => {
        if (data && data.intervals) {
          setBulkInterval(data.intervals.bulk || '3');
          setBotInterval(data.intervals.bot || '3');
          setBannersInterval(data.intervals.banners || '4');
          setStaleInterval(data.intervals.staleCheck || '2');
          setActiveDealsMode(!!data.activeDealsMode);
        }
      }
    }
  );

  const pauseMutation = useMutation(schedulerAPI.pause, {
    onSuccess: () => queryClient.invalidateQueries('scheduler-status')
  });

  const resumeMutation = useMutation(schedulerAPI.resume, {
    onSuccess: () => queryClient.invalidateQueries('scheduler-status')
  });

  const triggerMutation = useMutation(schedulerAPI.trigger, {
    onSuccess: () => {
      queryClient.invalidateQueries('scheduler-status');
      queryClient.invalidateQueries('scheduler-history');
    }
  });

  // Daemon control actions
  const handleRestartDaemon = async () => {
    if (!window.confirm('Are you sure you want to trigger a restart signal for the local runner daemon? This will terminate the active process and spin up a new instance.')) return;
    try {
      setIsRestartingDaemon(true);
      const res = await executionAPI.restartDaemon();
      if ((res.data as any)?.success) {
        alert('Daemon restart signal sent successfully!');
        refetchHeartbeat();
      } else {
        alert(`Failed to restart daemon: ${(res.data as any)?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error('Error restarting daemon:', e);
      alert(`Error: ${e.message}`);
    } finally {
      setIsRestartingDaemon(false);
    }
  };

  // Save config details
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigSaveMsg(null);
    try {
      const res = await executionAPI.saveSchedulerConfig({
        intervals: {
          bulk: bulkInterval,
          bot: botInterval,
          banners: bannersInterval,
          staleCheck: staleInterval
        },
        activeDealsMode: activeDealsMode
      });
      if ((res.data as any)?.success) {
        setConfigSaveMsg({ text: 'Cron configurations saved successfully!', type: 'success' });
        setTimeout(() => setConfigSaveMsg(null), 5000);
      } else {
        throw new Error((res.data as any)?.error || 'Failed to save config.');
      }
    } catch (err: any) {
      setConfigSaveMsg({ text: err.message || 'Error saving settings.', type: 'error' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const status = statusData?.data?.data;
  const isPaused = status?.isPaused;
  const isRunning = status?.isRunning;
  const heartbeat = heartbeatResponse;
  const logsData = logsResponse;

  // Set default selected log file once loaded
  useEffect(() => {
    if (logsData?.fileName && !selectedLogFile) {
      setSelectedLogFile(logsData.fileName);
    }
  }, [logsData?.fileName, selectedLogFile]);

  // Filter logs locally
  const filteredLogLines = logsData?.lines?.filter(line => {
    if (!logsSearchQuery) return true;
    const query = logsSearchQuery.toLowerCase();
    return (
      line.message?.toLowerCase().includes(query) ||
      line.level?.toLowerCase().includes(query) ||
      line.moduleName?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <div className="scheduler-page">
      <div className="scheduler-header-section">
        <h1>Scheduler & Daemon Monitor</h1>
        <p className="page-subtitle">Configure cron intervals, monitor execution status, read terminal log streams, and manage the runner daemon.</p>
      </div>

      {/* Heartbeat Monitoring Card */}
      <div className={`daemon-heartbeat-card ${heartbeat?.isDaemonAlive ? 'alive' : 'offline'}`}>
        <div className="heartbeat-main">
          <div className="heartbeat-info-block">
            <div className="heartbeat-badge-container">
              <span className={`pulse-indicator ${heartbeat?.isDaemonAlive ? 'alive' : 'offline'}`}></span>
              <h3>Local Daemon: {heartbeat?.isDaemonAlive ? 'Active & Healthy' : 'Offline / Unresponsive'}</h3>
            </div>
            {heartbeat?.isDaemonAlive && heartbeat?.heartbeat && (
              <div className="daemon-meta">
                <span>PID: <strong>{heartbeat.heartbeat.pid}</strong></span>
                <span>Host: <strong>{heartbeat.heartbeat.hostname}</strong> ({heartbeat.heartbeat.platform})</span>
                <span>Last ticked: <strong>{heartbeat.secondsSinceLastHeartbeat}s ago</strong></span>
              </div>
            )}
          </div>
          <button
            onClick={handleRestartDaemon}
            disabled={isRestartingDaemon}
            className={`daemon-restart-btn ${heartbeat?.isDaemonAlive ? 'primary' : 'error'}`}
          >
            {isRestartingDaemon ? 'Signalling...' : heartbeat?.isDaemonAlive ? 'Force Restart Daemon' : 'Start/Revive Daemon'}
          </button>
        </div>

        {heartbeat?.isDaemonAlive && heartbeat?.heartbeat?.memoryUsage && (
          <div className="daemon-memory-stats">
            <div className="memory-item">
              <span className="mem-label">RSS Memory</span>
              <span className="mem-val">{heartbeat.heartbeat.memoryUsage.rss}</span>
            </div>
            <div className="memory-item">
              <span className="mem-label">Heap Total</span>
              <span className="mem-val">{heartbeat.heartbeat.memoryUsage.heapTotal}</span>
            </div>
            <div className="memory-item">
              <span className="mem-label">Heap Used</span>
              <span className="mem-val">{heartbeat.heartbeat.memoryUsage.heapUsed}</span>
            </div>
          </div>
        )}
      </div>

      {/* Watchdog Hang Alert Banner */}
      {heartbeat?.isRunningScriptStuck && (
        <div className="watchdog-alert-banner">
          <span className="alert-icon">⚠️</span>
          <div className="alert-details">
            <h4>Watchdog Alert: Hanging Execution Detected!</h4>
            <p>The active scraping job has not reported any progress database updates for {Math.round(heartbeat.secondsSinceLastScriptUpdate / 60)} minutes. It may be stuck in a blocked socket state.</p>
          </div>
        </div>
      )}

      {/* Two Column Grid */}
      <div className="scheduler-grid">
        {/* Left Column: Config & Status */}
        <div className="grid-col-left">
          
          {/* Status controls */}
          <div className="scheduler-status-card">
            <h2>Execution Status</h2>
            <div className="status-info">
              <div className="status-item">
                <span className="status-label">Status:</span>
                <span className={`status-value ${isPaused ? 'paused' : isRunning ? 'running' : 'active'}`}>
                  {isPaused ? '⏸️ Paused' : isRunning ? '🔄 Running' : '✅ Active'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Last Run:</span>
                <span className="status-value">
                  {status?.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Total Runs:</span>
                <span className="status-value">{status?.state?.totalRuns || 0}</span>
              </div>
            </div>

            <div className="scheduler-actions">
              {isPaused ? (
                <button
                  onClick={() => resumeMutation.mutate()}
                  className="action-button resume"
                  disabled={resumeMutation.isLoading}
                >
                  Resume Scheduler
                </button>
              ) : (
                <button
                  onClick={() => pauseMutation.mutate()}
                  className="action-button pause"
                  disabled={pauseMutation.isLoading || isRunning}
                >
                  Pause Scheduler
                </button>
              )}
              <button
                onClick={() => triggerMutation.mutate()}
                className="action-button trigger"
                disabled={triggerMutation.isLoading || isRunning}
              >
                {triggerMutation.isLoading ? 'Triggering...' : 'Trigger Scrapes Now'}
              </button>
            </div>
          </div>

          {/* Config Settings Form */}
          <div className="scheduler-config-card">
            <h2>⚙️ Scheduler Configuration</h2>
            <form onSubmit={handleSaveConfig} className="config-form">
              {configSaveMsg && (
                <div className={`form-message ${configSaveMsg.type}`}>
                  {configSaveMsg.text}
                </div>
              )}
              
              <div className="form-group">
                <label>Bulk Updates Crawl Interval (Hours)</label>
                <input 
                  type="number" 
                  value={bulkInterval} 
                  onChange={(e) => setBulkInterval(e.target.value)} 
                  min="1" max="72" required 
                />
              </div>

              <div className="form-group">
                <label>Telegram Bot Processing (Hours)</label>
                <input 
                  type="number" 
                  value={botInterval} 
                  onChange={(e) => setBotInterval(e.target.value)} 
                  min="1" max="72" required 
                />
              </div>

              <div className="form-group">
                <label>Banners Discovery Crawl (Hours)</label>
                <input 
                  type="number" 
                  value={bannersInterval} 
                  onChange={(e) => setBannersInterval(e.target.value)} 
                  min="1" max="72" required 
                />
              </div>

              <div className="form-group">
                <label>Stale DB Verification Checks (Hours)</label>
                <input 
                  type="number" 
                  value={staleInterval} 
                  onChange={(e) => setStaleInterval(e.target.value)} 
                  min="1" max="72" required 
                />
              </div>

              <div className="form-group checkbox">
                <label className="switch-label">
                  <input 
                    type="checkbox" 
                    checked={activeDealsMode} 
                    onChange={(e) => setActiveDealsMode(e.target.checked)} 
                  />
                  <span>High-Frequency Mode (Force Hourly Updates)</span>
                </label>
              </div>

              <button type="submit" disabled={isSavingConfig} className="save-config-btn">
                {isSavingConfig ? 'Saving...' : 'Save Cron Configurations'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Terminal Logs */}
        <div className="grid-col-right">
          <div className="terminal-logs-card">
            <div className="terminal-header">
              <h2>🗔 Live Logs Terminal</h2>
              <div className="terminal-controls">
                <select 
                  value={selectedLogFile} 
                  onChange={(e) => {
                    setSelectedLogFile(e.target.value);
                    refetchLogs();
                  }}
                  className="log-file-select"
                >
                  {logsData?.availableFiles?.map(file => {
                    const name = typeof file === 'object' && file !== null ? (file as any).name : String(file);
                    return (
                      <option key={name} value={name}>{name}</option>
                    );
                  }) || <option value="">Loading files...</option>}
                </select>
                <button type="button" onClick={() => refetchLogs()} className="log-sync-btn">🔄</button>
              </div>
            </div>

            <div className="log-search-bar">
              <input 
                type="text" 
                placeholder="Filter logs by term (e.g. error, myntra, db)..."
                value={logsSearchQuery}
                onChange={(e) => setLogsSearchQuery(e.target.value)}
                className="log-search-input"
              />
            </div>

            <div className="terminal-console-pane">
              {filteredLogLines.length > 0 ? (
                filteredLogLines.map((line, index) => {
                  const dateStr = line.timestamp ? new Date(line.timestamp).toLocaleTimeString() : '';
                  return (
                    <div key={index} className={`log-line ${line.level || 'info'}`}>
                      <span className="log-time">[{dateStr}]</span>
                      <span className={`log-level-tag ${line.level}`}>{line.level?.toUpperCase()}</span>
                      {line.moduleName && <span className="log-module">[{line.moduleName}]</span>}
                      <span className="log-message">{line.message}</span>
                    </div>
                  );
                })
              ) : (
                <div className="no-logs-state">No matching log entries found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulerPage;


















