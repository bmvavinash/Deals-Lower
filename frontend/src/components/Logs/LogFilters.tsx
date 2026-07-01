import React, { useState, useEffect } from 'react';
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
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local filters when parent filters change (e.g. on clear)
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange(localFilters);
  };

  return (
    <form className="log-filters" onSubmit={handleSubmit}>
      <select
        value={localFilters.level}
        onChange={(e) => setLocalFilters({ ...localFilters, level: e.target.value })}
      >
        <option value="">All Levels</option>
        <option value="error">Error</option>
        <option value="warn">Warning</option>
        <option value="info">Info</option>
        <option value="debug">Debug</option>
      </select>

      <select
        value={localFilters.module}
        onChange={(e) => setLocalFilters({ ...localFilters, module: e.target.value })}
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
        value={localFilters.category || ''}
        onChange={(e) => setLocalFilters({ ...localFilters, category: e.target.value })}
      />

      <select
        value={localFilters.database || ''}
        onChange={(e) => setLocalFilters({ ...localFilters, database: e.target.value })}
      >
        <option value="">All Databases</option>
        <option value="productdeals">Product Deals</option>
        <option value="deals">Hot Deals</option>
      </select>

      <select
        value={localFilters.limit}
        onChange={(e) => setLocalFilters({ ...localFilters, limit: parseInt(e.target.value) })}
      >
        <option value="100">100 logs</option>
        <option value="500">500 logs</option>
        <option value="1000">1000 logs</option>
        <option value="5000">5000 logs</option>
      </select>

      <button type="submit" className="apply-filters-btn">
        Apply Filters
      </button>
    </form>
  );
};

export default LogFilters;




