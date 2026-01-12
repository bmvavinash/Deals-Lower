import React from 'react';
import { LogStats as LogStatsType } from '../../types/log';
import './LogStats.css';

interface LogStatsProps {
  stats: LogStatsType;
}

const LogStats: React.FC<LogStatsProps> = ({ stats }) => {
  return (
    <div className="log-stats">
      <div className="stat-item">
        <span className="stat-label">Total Logs:</span>
        <span className="stat-value">{stats.total}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Errors:</span>
        <span className="stat-value error">{stats.errors}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Warnings:</span>
        <span className="stat-value warn">{stats.warnings}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Info:</span>
        <span className="stat-value info">{stats.info}</span>
      </div>
    </div>
  );
};

export default LogStats;


















