import React, { useState, useEffect } from 'react';
import './DealFilters.css';

interface DealFiltersProps {
  filters: {
    dealType: string;
    platform: string;
    date: string;
    limit: number;
    offset: number;
  };
  onFilterChange: (filters: any) => void;
  isLoading?: boolean;
}

const DealFilters: React.FC<DealFiltersProps> = ({ filters, onFilterChange, isLoading }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange(localFilters);
  };

  return (
    <div className="deal-filters-container">
      <h3 className="filters-title">Filters</h3>
      <form className="deal-filters" onSubmit={handleSubmit}>
        <div className="filter-group">
          <label>Deal Type:</label>
          <select
            value={localFilters.dealType}
            onChange={(e) => setLocalFilters({ ...localFilters, dealType: e.target.value })}
          >
            <option value="hotDeal">Hot Deals</option>
            <option value="productDeal">Product Deals</option>
            <option value="">All Deal Types</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Platform:</label>
          <select
            value={localFilters.platform}
            onChange={(e) => setLocalFilters({ ...localFilters, platform: e.target.value })}
          >
            <option value="">All Platforms</option>
            <option value="Amazon">Amazon</option>
            <option value="Flipkart">Flipkart</option>
            <option value="Myntra">Myntra</option>
            <option value="Ajio">Ajio</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Date:</label>
          <input
            type="date"
            value={localFilters.date || ''}
            onChange={(e) => setLocalFilters({ ...localFilters, date: e.target.value })}
            className="date-filter"
            title="Filter by Date"
          />
        </div>

        <div className="filter-group">
          <label>Per Page:</label>
          <select
            value={localFilters.limit}
            onChange={(e) => setLocalFilters({ ...localFilters, limit: parseInt(e.target.value) })}
          >
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
            <option value="200">200 per page</option>
          </select>
        </div>

        <button type="submit" className="submit-filters-btn" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="spinner">↻</span> Loading...
            </>
          ) : (
            <>Submit ↻</>
          )}
        </button>
      </form>
    </div>
  );
};

export default DealFilters;


















