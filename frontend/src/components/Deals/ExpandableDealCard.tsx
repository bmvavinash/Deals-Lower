import React, { useState } from 'react';
import { Deal } from '../../types/deal';
import NotificationStatus from './NotificationStatus';
import { dealsAPI } from '../../services/api';
import './ExpandableDealCard.css';

interface ExpandableDealCardProps {
  deal: any;
  isExpanded?: boolean;
  showAllDetails?: boolean;
  viewMode?: 'deals' | 'products' | 'both';
  database?: string;
  onToggleExpand?: () => void;
  onRetrigger?: (productCode: string) => void;
}

const ExpandableDealCard: React.FC<ExpandableDealCardProps> = ({ 
  deal, 
  isExpanded: externalExpanded = false, 
  showAllDetails = false,
  viewMode = 'deals',
  database,
  onToggleExpand,
  onRetrigger 
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isRetriggering, setIsRetriggering] = useState(false);
  
  // Use external state if provided, otherwise use internal
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const shouldShowDetails = isExpanded || showAllDetails;

  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const handleRetrigger = async () => {
    if (!deal.productCode) return;
    
    setIsRetriggering(true);
    try {
      await dealsAPI.retriggerProduct(deal.productCode, database || 'productdeals');
      alert('Product re-extraction triggered successfully! It will be updated in the background.');
      if (onRetrigger) {
        onRetrigger(deal.productCode);
      }
    } catch (error) {
      alert('Failed to trigger product re-extraction');
      console.error('Retrigger error:', error);
    } finally {
      setIsRetriggering(false);
    }
  };

  // Get all deal properties for full details view
  const getAllDetails = () => {
    const details: { [key: string]: any } = {};
    Object.keys(deal).forEach(key => {
      if (deal[key as keyof Deal] !== undefined && deal[key as keyof Deal] !== null) {
        details[key] = deal[key as keyof Deal];
      }
    });
    return details;
  };

  return (
    <div className={`expandable-deal-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="deal-card-minimal">
        {deal.photo && (
          <img src={deal.photo} alt={deal.title} className="deal-image" />
        )}
        <div className="deal-content">
          <h3 className="deal-title">{deal.title || deal.shortText || deal.productText || 'No Title'}</h3>
          <div className="deal-info">
            <span className="deal-price">
              {deal.price ? `₹${deal.price}` : 'Price N/A'}
            </span>
            {deal.discount && (
              <span className="deal-discount">{deal.discount}% off</span>
            )}
          </div>
          <div className="deal-meta">
            <span className="deal-platform">{deal.storeType || 'N/A'}</span>
            <span className="deal-code">
              {deal.productCode ? `Code: ${deal.productCode}` : 'Code: N/A'}
            </span>
            {deal.productId && (
              <span className="deal-id">ID: {deal.productId}</span>
            )}
          </div>
          {deal.notificationStatus && (
            <NotificationStatus status={deal.notificationStatus} />
          )}
          <div className="deal-actions">
            <button 
              className="retrigger-button"
              onClick={handleRetrigger}
              disabled={isRetriggering || !deal.productCode}
              title="Re-extract product details"
            >
              {isRetriggering ? '⏳' : '🔄'} {isRetriggering ? 'Retriggering...' : 'Retrigger'}
            </button>
          </div>
        </div>
        <button 
          className="expand-toggle"
          onClick={toggleExpand}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {(isExpanded || shouldShowDetails) && (
        <div className={`deal-details-full ${shouldShowDetails && !isExpanded ? 'compact' : ''}`}>
          <h4>Complete Product Details</h4>
          <div className="details-grid">
            {Object.entries(getAllDetails()).map(([key, value]) => (
              <div key={key} className="detail-item">
                <span className="detail-label">{key}:</span>
                <span className="detail-value">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </span>
              </div>
            ))}
          </div>
          {deal.productUrl && (
            <div className="product-url-section">
              <strong>Product URL:</strong>
              <a href={deal.productUrl} target="_blank" rel="noopener noreferrer">
                {deal.productUrl}
              </a>
            </div>
          )}
          {deal.links?.avinashbmvINR && (
            <div className="affiliate-link-section">
              <strong>Affiliate Link:</strong>
              <a href={deal.links.avinashbmvINR} target="_blank" rel="noopener noreferrer">
                {deal.links.avinashbmvINR}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpandableDealCard;



