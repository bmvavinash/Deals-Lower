import React from 'react';
import './DealFilters.css';

interface DealFiltersProps {
  filters: {
    dealType: string;
    platform: string;
    limit: number;
    offset: number;
  };
  onFilterChange: (filters: any) => void;
}

const DealFilters: React.FC<DealFiltersProps> = ({ filters, onFilterChange }) => {
  return (
    <div className="deal-filters">
      <select
        value={filters.dealType}
        onChange={(e) => onFilterChange({ dealType: e.target.value })}
      >
        <option value="">All Deal Types</option>
        <option value="hotDeal">Hot Deals</option>
        <option value="productDeal">Product Deals</option>
      </select>

      <select
        value={filters.platform}
        onChange={(e) => onFilterChange({ platform: e.target.value })}
      >
        <option value="">All Platforms</option>
        <option value="Amazon">Amazon</option>
        <option value="Flipkart">Flipkart</option>
        <option value="Myntra">Myntra</option>
        <option value="Ajio">Ajio</option>
      </select>

      <input
        type="date"
        value={filters.date || ''}
        onChange={(e) => onFilterChange({ date: e.target.value })}
        className="date-filter"
        title="Filter by Date"
      />

      <select
        value={filters.limit}
        onChange={(e) => onFilterChange({ limit: parseInt(e.target.value) })}
      >
        <option value="50">50 per page</option>
        <option value="100">100 per page</option>
        <option value="200">200 per page</option>
      </select>
    </div>
  );
};

export default DealFilters;


















