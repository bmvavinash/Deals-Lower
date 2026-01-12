import React from 'react';
import './LogFilters.css';

interface LogFiltersProps {
  filters: {
    level: string;
    module: string;
    limit: number;
    category?: string;
    database?: string;
    source?: string;
  };
  onFilterChange: (filters: any) => void;
}

const LogFilters: React.FC<LogFiltersProps> = ({ filters, onFilterChange }) => {
  return (
    <div className="log-filters">
      <select
        value={filters.level}
        onChange={(e) => onFilterChange({ ...filters, level: e.target.value })}
      >
        <option value="">All Levels</option>
        <option value="error">Error</option>
        <option value="warn">Warning</option>
        <option value="info">Info</option>
        <option value="debug">Debug</option>
      </select>

      <select
        value={filters.module}
        onChange={(e) => onFilterChange({ ...filters, module: e.target.value })}
      >
        <option value="">All Modules</option>
        <option value="telegram">Telegram Bot</option>
        <option value="banners">Banners</option>
        <option value="bulk-updates">Bulk Updates</option>
        <option value="scheduler">Scheduler</option>
        <option value="pageScheduler">Page Scheduler</option>
        <option value="batchProductExtractor">Batch Extractor</option>
      </select>

      <input
        type="text"
        placeholder="Filter by category..."
        value={filters.category || ''}
        onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
      />

      <select
        value={filters.database || ''}
        onChange={(e) => onFilterChange({ ...filters, database: e.target.value })}
      >
        <option value="">All Databases</option>
        <option value="productdeals">Product Deals</option>
        <option value="deals">Hot Deals</option>
      </select>

      <select
        value={filters.limit}
        onChange={(e) => onFilterChange({ ...filters, limit: parseInt(e.target.value) })}
      >
        <option value="100">100 logs</option>
        <option value="500">500 logs</option>
        <option value="1000">1000 logs</option>
        <option value="5000">5000 logs</option>
      </select>
    </div>
  );
};

export default LogFilters;




