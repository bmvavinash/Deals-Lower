import React, { useState } from 'react';
import { executionAPI } from '../../services/api';
import './PipelineView.css';

interface PipelineViewProps {
  execution: any;
}

const PipelineView: React.FC<PipelineViewProps> = ({ execution }) => {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);

  if (!execution || !execution.platforms) return null;

  const fetchProductDetails = async (productCode: string) => {
    if (selectedProduct?.productCode === productCode) {
      setSelectedProduct(null);
      return;
    }
    
    setLoadingProduct(productCode);
    try {
      const response = await executionAPI.getProductDetails(productCode);
      setSelectedProduct(response.data.data);
    } catch (error) {
      console.error('Error fetching product details:', error);
      alert('Failed to fetch product details');
    } finally {
      setLoadingProduct(null);
    }
  };

  const platforms = Object.entries(execution.platforms);

  return (
    <div className="pipeline-view">
      <h3>📊 Execution Pipeline</h3>
      <div className="pipeline-hierarchy">
        {platforms.map(([platform, platformData]: [string, any]) => (
          <div key={platform} className="pipeline-level platform-level">
            <div className="level-header">
              <span className="level-icon">🌐</span>
              <span className="level-name">{platform.toUpperCase()}</span>
              <span className="level-stats">
                {platformData.totalProcessed || 0}/{platformData.totalProducts || 0} products
              </span>
            </div>

            {platformData.categories && Object.entries(platformData.categories).map(([category, categoryData]: [string, any]) => (
              <div key={category} className="pipeline-level category-level">
                <div className="level-header">
                  <span className="level-icon">📁</span>
                  <span className="level-name">{category}</span>
                  <span className="level-stats">
                    {categoryData.processed || 0}/{categoryData.totalProducts || 0} products
                  </span>
                </div>

                {categoryData.pages && Object.entries(categoryData.pages).map(([pageKey, pageData]: [string, any]) => (
                  <div key={pageKey} className="pipeline-level page-level">
                    <div className="level-header">
                      <span className="level-icon">📄</span>
                      <span className="level-name">Page {pageData.index + 1}</span>
                      <span className="level-stats">
                        {pageData.processed || 0}/{pageData.totalProducts || 0} products
                      </span>
                    </div>
                    <div className="page-url">{pageData.url}</div>

                    {pageData.products && pageData.products.length > 0 && (
                      <div className="products-list">
                        {pageData.products.slice(0, 10).map((product: any, idx: number) => (
                          <div key={idx} className="product-item">
                            <span 
                              className="product-code clickable"
                              onClick={() => product.productCode && fetchProductDetails(product.productCode)}
                              title="Click to view details"
                            >
                              {product.productCode || 'N/A'}
                              {loadingProduct === product.productCode && ' ⏳'}
                            </span>
                            <span className="product-id">ID: {product.productId || 'N/A'}</span>
                            <span className={`product-status ${product.status}`}>
                              {product.status || 'pending'}
                            </span>
                          </div>
                        ))}
                        {pageData.products.length > 10 && (
                          <div className="more-products">
                            +{pageData.products.length - 10} more products
                          </div>
                        )}
                      </div>
                    )}
                    
                    {selectedProduct && (
                      <div className="product-details-modal">
                        <div className="modal-header">
                          <h4>Product Details: {selectedProduct.productCode}</h4>
                          <button onClick={() => setSelectedProduct(null)}>✕</button>
                        </div>
                        <div className="product-details-content">
                          {Object.entries(selectedProduct).map(([key, value]: [string, any]) => (
                            <div key={key} className="detail-row">
                              <strong>{key}:</strong>
                              <span>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelineView;



