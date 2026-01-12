import React from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { schedulerAPI } from '../services/api';
import './SchedulerPage.css';

const SchedulerPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: statusData } = useQuery('scheduler-status', schedulerAPI.getStatus);
  const { data: historyData } = useQuery('scheduler-history', () => schedulerAPI.getHistory(50));

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

  const status = statusData?.data?.data;
  const isPaused = status?.isPaused;
  const isRunning = status?.isRunning;

  return (
    <div className="scheduler-page">
      <h1>Scheduler Management</h1>

      <div className="scheduler-status-card">
        <h2>Current Status</h2>
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
          <div className="status-item">
            <span className="status-label">Products Processed:</span>
            <span className="status-value">{status?.state?.totalProductsProcessed || 0}</span>
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
            {triggerMutation.isLoading ? 'Triggering...' : 'Trigger Now'}
          </button>
        </div>
      </div>

      <div className="execution-history">
        <h2>Execution History</h2>
        <div className="history-list">
          {(historyData?.data?.data || []).map((execution: any, idx: number) => (
            <div key={idx} className={`history-item ${execution.success ? 'success' : 'failed'}`}>
              <div className="history-time">
                {new Date(execution.timestamp).toLocaleString()}
              </div>
              <div className="history-status">
                {execution.success ? '✅ Success' : '❌ Failed'}
              </div>
              {execution.error && (
                <div className="history-error">{execution.error}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchedulerPage;


















