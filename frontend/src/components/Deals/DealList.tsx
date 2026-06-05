import React, { useState, useMemo } from 'react';
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
  const groupedDeals = useMemo(() => {
    const grouped = new Map();

    deals.forEach(deal => {
      // Smart Keyword Fallback Extraction
      let genderKey = '';
      const titleLower = (deal.title || deal.shortText || '').toLowerCase();
      if (titleLower.includes('men') && !titleLower.includes('women')) genderKey = 'men';
      else if (titleLower.includes('women') || titleLower.includes('ladies')) genderKey = 'women';
      else if (titleLower.includes('boy')) genderKey = 'boy';
      else if (titleLower.includes('girl')) genderKey = 'girl';
      else if (titleLower.includes('kids') || titleLower.includes('baby')) genderKey = 'kids';

      let itemTypeKey = '';
      if (titleLower.includes('kurta') || titleLower.includes('kurti')) itemTypeKey = 'kurta';
      else if (titleLower.includes('jeans') || titleLower.includes('denim')) itemTypeKey = 'jeans';
      else if (titleLower.includes('shirt')) itemTypeKey = 'shirt';
      else if (titleLower.includes('t-shirt') || titleLower.includes('tshirt')) itemTypeKey = 'tshirt';
      else if (titleLower.includes('dress') || titleLower.includes('gown') || titleLower.includes('frock')) itemTypeKey = 'dress';
      else if (titleLower.includes('shoe') || titleLower.includes('sneaker') || titleLower.includes('footwear')) itemTypeKey = 'shoes';
      else if (titleLower.includes('watch')) itemTypeKey = 'watch';
      else if (titleLower.includes('jacket') || titleLower.includes('coat')) itemTypeKey = 'jacket';
      else if (titleLower.includes('pant') || titleLower.includes('trouser')) itemTypeKey = 'pants';

      let smartFallback = `${genderKey}_${itemTypeKey}`.replace(/^_|_$/g, '');

      // 1. Determine baseKey prioritizing the most specific fields
      let baseKey = '';
      if (deal.category?.c3 && deal.category.c3.trim() !== '' && deal.category.c3.toLowerCase() !== 'dresses') {
        baseKey = deal.category.c3;
      } else if (deal.category?.c2 && deal.category.c2.trim() !== '' && deal.category.c2.toLowerCase() !== 'dresses') {
        baseKey = deal.category.c2;
      } else if (deal.category?.c1 && deal.category.c1.trim() !== '' && deal.category.c1.toLowerCase() !== 'dresses') {
        baseKey = deal.category.c1;
      } else {
        baseKey = deal.hierarchicalKey || deal?.hierarchicalCategory?.subcategory || deal.productCode || '';
      }

      baseKey = String(baseKey).trim().toLowerCase();
      
      // Inject the smart fallback to forcefully split vastly different items (like pants vs kurtas)
      if (['clothing', 'fashion', 'apparel', 'dresses', ''].includes(baseKey) && smartFallback) {
          baseKey = `${baseKey}_${smartFallback}`;
      } else if (smartFallback) {
          baseKey = `${baseKey}_${smartFallback}`;
      }

      // Ensure baseKey isn't empty
      if (!baseKey) {
        baseKey = `unknown_${deal.productCode || Math.random()}`;
      }

      // 2. Chunking Logic (max 50 per chunk)
      let chunkIndex = 0;
      let currentKey = `${baseKey}_chunk_${chunkIndex}`;

      while (grouped.has(currentKey) && grouped.get(currentKey).similarProducts.length >= 49) {
        chunkIndex++;
        currentKey = `${baseKey}_chunk_${chunkIndex}`;
      }

      // 3. Populate Map
      if (!grouped.has(currentKey)) {
        grouped.set(currentKey, { ...deal, similarProducts: [] });
      } else {
        grouped.get(currentKey).similarProducts.push(deal);
      }
    });

    return Array.from(grouped.values());
  }, [deals]);

  return (
    <div className="deal-list">
      <div className="deals-grid">
        {groupedDeals.map((deal, index) => (
          <ExpandableDealCard 
            key={deal.productCode || index} 
            deal={deal}
            database={database}
            onRetrigger={(productCode) => {
              console.log('Product retriggered:', productCode);
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


