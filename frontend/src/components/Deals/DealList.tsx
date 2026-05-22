import React, { useState } from 'react';
import ExpandableDealCard from './ExpandableDealCard';
import { Deal } from '../../types/deal';
import './DealList.css';

interface DealListProps {
  deals: Deal[];
  database?: string;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  onPageChange: (offset: number) => void;
}

const DealList: React.FC<DealListProps> = ({ deals, database, pagination, onPageChange }) => {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showAllDetails, setShowAllDetails] = useState(false);

  const handleToggleExpand = (productCode: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productCode)) {
      newExpanded.delete(productCode);
    } else {
      newExpanded.add(productCode);
      // If one is expanded, show all details for remaining in row
      if (!showAllDetails) {
        setShowAllDetails(true);
      }
    }
    setExpandedProducts(newExpanded);
  };

  return (
    <div className="deal-list">
      {expandedProducts.size > 0 && (
        <div className="deal-list-controls">
          <label>
            <input
              type="checkbox"
              checked={showAllDetails}
              onChange={(e) => setShowAllDetails(e.target.checked)}
            />
            Show all details for remaining deals in row
          </label>
        </div>
      )}
      <div className="deals-grid">
        {deals.map((deal, index) => (
          <ExpandableDealCard 
            key={deal.productCode || index} 
            deal={deal}
            database={database}
            isExpanded={expandedProducts.has(deal.productCode || '')}
            showAllDetails={showAllDetails}
            onToggleExpand={() => deal.productCode && handleToggleExpand(deal.productCode)}
            onRetrigger={(productCode) => {
              console.log('Product retriggered:', productCode);
              // Optionally refresh the list
            }}
          />
        ))}
      </div>

      {pagination && (
        <div className="pagination">
          <button
            disabled={pagination.offset === 0}
            onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
          >
            Previous
          </button>
          <span>
            Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <button
            disabled={!pagination.hasMore}
            onClick={() => onPageChange(pagination.offset + pagination.limit)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default DealList;


