import React from 'react';
import { Deal } from '../../types/deal';
import NotificationStatus from './NotificationStatus';
import './DealCard.css';

interface DealCardProps {
  deal: Deal;
}

const DealCard: React.FC<DealCardProps> = ({ deal }) => {
  return (
    <div className="deal-card">
      {(deal.photo || deal.images || deal.image) && (
        <img src={deal.photo || deal.images || deal.image || ''} alt={deal.title || deal.shortText || 'Product Deal'} className="deal-image" />
      )}
      <div className="deal-content">
        <h3 className="deal-title">{deal.title}</h3>
        <div className="deal-info">
          <span className="deal-price">₹{deal.price}</span>
          {deal.discount && (
            <span className="deal-discount">{deal.discount}% off</span>
          )}
        </div>
        <div className="deal-meta">
          <span className="deal-platform">{deal.storeType}</span>
          <span className="deal-code">{deal.productCode}</span>
        </div>
        {deal.notificationStatus && (
          <NotificationStatus status={deal.notificationStatus} />
        )}
      </div>
    </div>
  );
};

export default DealCard;


















