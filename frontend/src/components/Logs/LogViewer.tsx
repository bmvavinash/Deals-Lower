import React from 'react';
import { LogEntry } from '../../types/log';
import './LogViewer.css';

interface LogViewerProps {
  logs: LogEntry[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const getLevelClass = (level: string) => {
    switch (level) {
      case 'error': return 'log-error';
      case 'warn': return 'log-warn';
      case 'info': return 'log-info';
      case 'debug': return 'log-debug';
      default: return '';
    }
  };

  return (
    <div className="log-viewer">
      <div className="log-list">
        {logs.map((log, idx) => (
          <div key={idx} className={`log-entry ${getLevelClass(log.level)}`}>
            <div className="log-header">
              <span className="log-level">{log.level.toUpperCase()}</span>
              <span className="log-module">{log.module || log.moduleName || 'GENERAL'}</span>
              <span className="log-time">
                {new Date(log.timestamp || log.date || Date.now()).toLocaleString()}
              </span>
            </div>
            <div className="log-message">{log.message || log.raw}</div>
            {log.error && (
              <div className="log-error-details">
                <strong>Error:</strong> {log.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogViewer;


















