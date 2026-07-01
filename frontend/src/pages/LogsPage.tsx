import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { logsAPI } from '../services/api';
import LogViewer from '../components/Logs/LogViewer';
import LogFilters from '../components/Logs/LogFilters';
import LogStats from '../components/Logs/LogStats';
import './LogsPage.css';

const LogsPage: React.FC = () => {
  const [filters, setFilters] = useState({ 
    level: '', 
    module: '', 
    limit: 1000,
    category: '',
    database: '',
    source: ''
  });

  const { data: logsData, isLoading } = useQuery(
    ['logs', filters],
    () => logsAPI.getAll(filters),
    {
      refetchInterval: 3000,
      keepPreviousData: true
    }
  );

  const { data: statsData } = useQuery(
    'log-stats',
    () => logsAPI.getStats(),
    {
      refetchInterval: 3000,
      keepPreviousData: true
    }
  );

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear logs? This action cannot be undone.')) {
      try {
        await logsAPI.clear();
        alert('Logs cleared successfully');
        window.location.reload();
      } catch (error) {
        alert('Failed to clear logs');
      }
    }
  };

  return (
    <div className="logs-page">
      <div className="page-header">
        <h1>Logs Management</h1>
        <button onClick={handleClearLogs} className="clear-button">
          Clear Logs
        </button>
      </div>

      {statsData && <LogStats stats={statsData.data.data} />}

      <LogFilters filters={filters} onFilterChange={setFilters} />

      {isLoading && <div className="loading">Loading logs...</div>}
      
      {logsData && (
        <LogViewer logs={(logsData.data as any)?.data || logsData.data || []} />
      )}
      
      {!isLoading && logsData && (!logsData.data || (logsData.data as any)?.data?.length === 0) && (
        <div className="no-logs">
          <p>No logs found. Logs may be stored in files. Check the logs directory or Firebase.</p>
          <p>Source: {(logsData.data as any)?.source || 'unknown'}</p>
        </div>
      )}
    </div>
  );
};

export default LogsPage;




