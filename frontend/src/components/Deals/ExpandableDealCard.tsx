import React, { useState } from 'react';
import { Deal } from '../../types/deal';
import NotificationStatus from './NotificationStatus';
import { dealsAPI } from '../../services/api';
import { getValidationDetails } from '../../utils/validation';
import { useNotification } from '../../context/NotificationContext';
import './ExpandableDealCard.css';

interface ExpandableDealCardProps {
  deal: Deal;
  database?: string;
  onRetrigger?: (productCode: string) => void;
}

const ExpandableDealCard: React.FC<ExpandableDealCardProps> = ({ 
  deal: initialDeal, 
  database,
  onRetrigger 
}) => {
  const [deal, setDeal] = useState(initialDeal);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isRetriggering, setIsRetriggering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const { addNotification } = useNotification();
  
  // Edit State
  const [editForm, setEditForm] = useState({
    title: deal.title || '',
    shortText: deal.shortText || '',
    text: deal.text || '',
    productText: deal.productText || '',
    urltext: deal.urltext || '',
    price: deal.price || '',
    mrp: deal.mrp || '',
    discount: deal.discount || '',
    photo: deal.photo || deal.images || deal.image || '',
    brand: deal.brand || '',
    productCode: deal.productCode || '',
    productUrl: deal.productUrl || '',
    avinashbmv: deal.links?.avinashbmv || '',
    avinashbmvINR: deal.links?.avinashbmvINR || '',
    c1: deal.category?.c1 || '',
    c2: deal.category?.c2 || '',
    c3: deal.category?.c3 || '',
    c4: deal.category?.c4 || '',
    c5: deal.category?.c5 || '',
    isDeal: deal.isDeal !== undefined ? deal.isDeal : true,
    isDisplay: deal.isDisplay !== undefined ? deal.isDisplay : true
  });

  // Validation
  const validation = getValidationDetails(deal);
  
  const isExpanded = internalExpanded;
  
  // Explicitly tie details visibility only to this card's expansion state 
  const shouldShowDetails = isExpanded;

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalExpanded(!internalExpanded);
  };

  const handleRetrigger = async () => {
    if (!deal.productCode) return;
    
    setIsRetriggering(true);
    try {
      await dealsAPI.retriggerProduct(deal.productCode, database || 'productdeals');
      addNotification({ type: 'success', message: 'Product re-extraction triggered successfully! It will be updated in the background.', source: 'Retrigger Product', page: 'Deals' });
      if (onRetrigger) {
        onRetrigger(deal.productCode);
      }
    } catch (error) {
      addNotification({ type: 'error', message: 'Failed to trigger product re-extraction', source: 'Retrigger Product', page: 'Deals' });
      console.error('Retrigger error:', error);
    } finally {
      setIsRetriggering(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.productCode) {
      addNotification({ type: 'error', message: 'Product Code is required to save updates.', source: 'Edit Product', page: 'Deals' });
      return;
    }
    setIsSaving(true);
    try {
      const updates: any = {
        title: editForm.title,
        shortText: editForm.shortText,
        text: editForm.text,
        productText: editForm.productText,
        urltext: editForm.urltext,
        price: editForm.price,
        mrp: editForm.mrp,
        discount: editForm.discount,
        photo: editForm.photo,
        brand: editForm.brand,
        productCode: editForm.productCode,
        productUrl: editForm.productUrl,
        isDeal: editForm.isDeal,
        isDisplay: editForm.isDisplay,
        updatedAt: new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().replace('Z', '+05:30')
      };
      
      updates.links = {
        ...deal.links,
        avinashbmv: editForm.avinashbmv,
        avinashbmvINR: editForm.avinashbmvINR
      };

      updates.category = {
        ...deal.category,
        c1: editForm.c1,
        c2: editForm.c2,
        c3: editForm.c3,
        c4: editForm.c4,
        c5: editForm.c5
      };
      
      await dealsAPI.updateProduct(editForm.productCode, updates, database || 'productdeals');
      
      // Update local deal state to reflect immediately
      setDeal({
        ...deal,
        ...updates
      });
      setIsEditing(false);
      addNotification({ type: 'success', message: 'Deal updated successfully!', source: 'Edit Product', page: 'Deals' });
    } catch (error) {
      console.error("Failed to update deal:", error);
      addNotification({ type: 'error', message: 'Failed to update deal.', source: 'Edit Product', page: 'Deals' });
    } finally {
      setIsSaving(false);
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

  const handleInputChange = (field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className={`expandable-deal-card ${isExpanded ? 'expanded' : ''} ${validation.isValid ? 'deal-card-valid' : 'deal-card-blocked'}`}>
      <div className="deal-card-minimal">
        {(deal.photo || deal.images || deal.image) && (
          <img src={deal.photo || deal.images || deal.image || ''} alt={deal.title || deal.shortText || 'Product Deal'} className="deal-image" />
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
          
          <div className={`deal-validation-badge ${validation.isValid ? 'badge-valid' : 'badge-blocked'}`}>
            {validation.isValid ? '✓ Active (Displays on Website)' : '⚠️ Blocked from Website'}
          </div>
          {!validation.isValid && (
            <div className="validation-reasons">
              <ul>
                {validation.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {deal.notificationStatus && (
            <NotificationStatus status={deal.notificationStatus} />
          )}
          
          <div className="deal-actions" style={{ marginTop: '10px' }}>
            <button 
              className="retrigger-button"
              onClick={handleRetrigger}
              disabled={isRetriggering || !deal.productCode}
              title="Re-extract product details"
            >
              {isRetriggering ? '⏳' : '🔄'} {isRetriggering ? 'Retriggering...' : 'Retrigger'}
            </button>
            <button 
              className="edit-button"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel Edit' : '✎ Edit'}
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

      {isEditing && (
        <div className="edit-form">
          <h4>Quick Edit Product Fields</h4>
          
          {/* Identifiers & Image */}
          <div className="edit-form-group">
            <label>Product Code</label>
            <input type="text" value={editForm.productCode} onChange={e => handleInputChange('productCode', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Image URL</label>
            <input type="text" value={editForm.photo} onChange={e => handleInputChange('photo', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Brand</label>
            <input type="text" value={editForm.brand} onChange={e => handleInputChange('brand', e.target.value)} />
          </div>

          {/* Pricing */}
          <div className="edit-form-group">
            <label>Price</label>
            <input type="text" value={editForm.price} onChange={e => handleInputChange('price', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>MRP</label>
            <input type="text" value={editForm.mrp} onChange={e => handleInputChange('mrp', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Discount</label>
            <input type="text" value={editForm.discount} onChange={e => handleInputChange('discount', e.target.value)} />
          </div>

          {/* Titles */}
          <div className="edit-form-group">
            <label>Title</label>
            <input type="text" value={editForm.title} onChange={e => handleInputChange('title', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Short Text</label>
            <input type="text" value={editForm.shortText} onChange={e => handleInputChange('shortText', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Product Text</label>
            <input type="text" value={editForm.productText} onChange={e => handleInputChange('productText', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>URL Text</label>
            <input type="text" value={editForm.urltext} onChange={e => handleInputChange('urltext', e.target.value)} />
          </div>
          <div className="edit-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Long Text</label>
            <input type="text" value={editForm.text} onChange={e => handleInputChange('text', e.target.value)} />
          </div>

          {/* URLs */}
          <div className="edit-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Product URL</label>
            <input type="text" value={editForm.productUrl} onChange={e => handleInputChange('productUrl', e.target.value)} />
          </div>
          <div className="edit-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Affiliate URL (links.avinashbmv)</label>
            <input type="text" value={editForm.avinashbmv} onChange={e => handleInputChange('avinashbmv', e.target.value)} />
          </div>
          <div className="edit-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Affiliate URL INR (links.avinashbmvINR)</label>
            <input type="text" value={editForm.avinashbmvINR} onChange={e => handleInputChange('avinashbmvINR', e.target.value)} />
          </div>

          {/* Categories */}
          <div className="edit-form-group">
            <label>Category (c1)</label>
            <input type="text" value={editForm.c1} onChange={e => handleInputChange('c1', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Category (c2)</label>
            <input type="text" value={editForm.c2} onChange={e => handleInputChange('c2', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Category (c3)</label>
            <input type="text" value={editForm.c3} onChange={e => handleInputChange('c3', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Category (c4)</label>
            <input type="text" value={editForm.c4} onChange={e => handleInputChange('c4', e.target.value)} />
          </div>
          <div className="edit-form-group">
            <label>Category (c5)</label>
            <input type="text" value={editForm.c5} onChange={e => handleInputChange('c5', e.target.value)} />
          </div>

          {/* Booleans */}
          <div className="edit-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" id="isDeal" checked={editForm.isDeal} onChange={e => handleInputChange('isDeal', e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="isDeal" style={{ margin: 0 }}>isDeal</label>
          </div>
          <div className="edit-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" id="isDisplay" checked={editForm.isDisplay} onChange={e => handleInputChange('isDisplay', e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="isDisplay" style={{ margin: 0 }}>isDisplay</label>
          </div>

          <div className="edit-actions">
            <button className="btn-save" onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Updates (auto updates time)'}
            </button>
            <button className="btn-cancel" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(shouldShowDetails) && !isEditing && (
        <div className={`deal-details-full`}>
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
          {deal.links?.avinashbmv && (
            <div className="affiliate-link-section">
              <strong>Affiliate Link (Direct):</strong>
              <a href={deal.links.avinashbmv} target="_blank" rel="noopener noreferrer">
                {deal.links.avinashbmv}
              </a>
            </div>
          )}
          {deal.links?.avinashbmvINR && (
            <div className="affiliate-link-section">
              <strong>Affiliate Link (INR):</strong>
              <a href={deal.links.avinashbmvINR} target="_blank" rel="noopener noreferrer">
                {deal.links.avinashbmvINR}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Similar Products Strip */}
      {deal.similarProducts && deal.similarProducts.length > 0 && (
        <div className="similar-products-strip" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
            {deal.similarProducts.slice(0, 4).map((sim: any, idx: number) => (
              <img 
                key={idx} 
                src={sim.photo || sim.images || sim.image || ''} 
                alt={`similar-${idx}`}
                style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #ddd', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setShowSimilarModal(true); }}
              />
            ))}
            <button 
              onClick={(e) => { e.stopPropagation(); setShowSimilarModal(true); }}
              style={{
                background: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: 'bold',
                color: '#333'
              }}
            >
              +{deal.similarProducts.length} Deals
            </button>
          </div>
        </div>
      )}

      {/* Similar Deals Modal */}
      {showSimilarModal && (
        <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowSimilarModal(false); }} style={{ zIndex: 1000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', width: '1200px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Similar Deals ({deal.similarProducts.length})</h2>
              <button className="modal-close" onClick={() => setShowSimilarModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ background: '#f5f7fa', padding: '20px' }}>
              <div className="deals-grid">
                {deal.similarProducts.map((sim: any, idx: number) => (
                  <ExpandableDealCard 
                    key={sim.productCode || idx} 
                    deal={sim} 
                    database={database}
                    onRetrigger={onRetrigger}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpandableDealCard;
