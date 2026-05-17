import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { analyticsAPI, schedulerAPI, bannersAPI, dealsAPI } from '../services/api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { data: performanceData } = useQuery('performance', analyticsAPI.getPerformance);
  const { data: schedulerStatus } = useQuery('scheduler-status', schedulerAPI.getStatus);
  const [isExtracting, setIsExtracting] = useState(false);
  const isBannerButtonVisible = false; // Hidden by default as requested
  
  // Product processing state
  const [productUrl, setProductUrl] = useState('');
  const [postProduct, setPostProduct] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<{
    status: 'idle' | 'success' | 'error' | 'excluded';
    message: string;
    error?: string;
  }>({ status: 'idle', message: '' });
  
  // Product code search and CRUD state
  const [productCode, setProductCode] = useState('');
  const [productData, setProductData] = useState<any>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productStatus, setProductStatus] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  
  const handleBannerExtraction = async () => {
    try {
      setIsExtracting(true);
      await bannersAPI.extract();
      setTimeout(() => setIsExtracting(false), 2000);
    } catch (error) {
      console.error('Error triggering banner extraction:', error);
      setIsExtracting(false);
    }
  };

  const handleProcessProduct = async () => {
    if (!productUrl.trim()) {
      setProcessStatus({
        status: 'error',
        message: 'Please enter a product URL',
        error: 'Product URL is required'
      });
      return;
    }

    setIsProcessing(true);
    setProcessStatus({ status: 'idle', message: 'Processing...' });

    try {
      const response = await dealsAPI.processProduct(productUrl.trim(), postProduct);
      setProcessStatus({
        status: response.data.status,
        message: response.data.message,
        error: response.data.error || undefined
      });
    } catch (error: any) {
      setProcessStatus({
        status: 'error',
        message: 'Failed to process product',
        error: error.response?.data?.error || error.message || 'Unknown error occurred'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchProduct = async () => {
    if (!productCode.trim()) {
      setProductStatus({
        status: 'error',
        message: 'Please enter a product code'
      });
      return;
    }

    setIsLoadingProduct(true);
    setProductStatus({ status: 'idle', message: 'Loading...' });
    setProductData(null);

    try {
      const response = await dealsAPI.getByCode(productCode.trim());
      if (response.data.success) {
        setProductData(response.data.data);
        setProductStatus({
          status: 'success',
          message: 'Product found successfully'
        });
      } else {
        setProductStatus({
          status: 'error',
          message: response.data.error || 'Product not found'
        });
      }
    } catch (error: any) {
      setProductStatus({
        status: 'error',
        message: error.response?.data?.error || error.message || 'Failed to fetch product'
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!productData || !productCode.trim()) {
      setProductStatus({
        status: 'error',
        message: 'No product data to update'
      });
      return;
    }

    setIsUpdating(true);
    setProductStatus({ status: 'idle', message: 'Updating...' });

    try {
      // Remove productKey from updates if it exists
      const { productKey, ...updates } = productData;
      const response = await dealsAPI.updateProduct(productCode.trim(), updates);
      if (response.data.success) {
        setProductStatus({
          status: 'success',
          message: 'Product updated successfully'
        });
        // Refresh product data
        await handleSearchProduct();
      } else {
        setProductStatus({
          status: 'error',
          message: response.data.error || 'Failed to update product'
        });
      }
    } catch (error: any) {
      setProductStatus({
        status: 'error',
        message: error.response?.data?.error || error.message || 'Failed to update product'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productCode.trim()) {
      setProductStatus({
        status: 'error',
        message: 'Product code is required'
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete product "${productCode}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setProductStatus({ status: 'idle', message: 'Deleting...' });

    try {
      const response = await dealsAPI.deleteProduct(productCode.trim());
      if (response.data.success) {
        setProductStatus({
          status: 'success',
          message: 'Product deleted successfully'
        });
        setProductData(null);
        setProductCode('');
      } else {
        setProductStatus({
          status: 'error',
          message: response.data.error || 'Failed to delete product'
        });
      }
    } catch (error: any) {
      setProductStatus({
        status: 'error',
        message: error.response?.data?.error || error.message || 'Failed to delete product'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProductFieldChange = (field: string, value: any) => {
    if (productData) {
      setProductData({
        ...productData,
        [field]: value
      });
    }
  };

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>System Status</h3>
          <p className="stat-value">
            {schedulerStatus?.data?.data?.isActive ? '🟢 Active' : '🔴 Inactive'}
          </p>
        </div>
        
        <div className="stat-card">
          <h3>Total Runs</h3>
          <p className="stat-value">
            {schedulerStatus?.data?.data?.state?.totalRuns || 0}
          </p>
        </div>
        
        <div className="stat-card">
          <h3>Products Processed</h3>
          <p className="stat-value">
            {schedulerStatus?.data?.data?.state?.totalProductsProcessed || 0}
          </p>
        </div>
        
        <div className="stat-card">
          <h3>Memory Usage</h3>
          <p className="stat-value">
            {performanceData?.data?.data?.system?.memoryUsage?.used || 0} MB
          </p>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Process Product</h2>
        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="product-url" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Product URL:
            </label>
            <input
              id="product-url"
              type="text"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="Enter product URL (e.g., https://www.amazon.in/...)"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
              disabled={isProcessing}
            />
          </div>
          
          <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              id="post-product"
              checked={postProduct}
              onChange={(e) => setPostProduct(e.target.checked)}
              disabled={isProcessing}
            />
            <label htmlFor="post-product" style={{ cursor: 'pointer' }}>
              Post Product to Social Media
            </label>
          </div>
          
          <button
            onClick={handleProcessProduct}
            disabled={isProcessing || !productUrl.trim()}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: isProcessing ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isProcessing || !productUrl.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isProcessing ? 'Processing...' : 'Submit'}
          </button>

          {processStatus.status !== 'idle' && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              borderRadius: '4px',
              backgroundColor: 
                processStatus.status === 'success' ? '#d4edda' :
                processStatus.status === 'error' ? '#f8d7da' :
                processStatus.status === 'excluded' ? '#fff3cd' : '#e2e3e5',
              border: `1px solid ${
                processStatus.status === 'success' ? '#c3e6cb' :
                processStatus.status === 'error' ? '#f5c6cb' :
                processStatus.status === 'excluded' ? '#ffeaa7' : '#d6d8db'
              }`,
              color: 
                processStatus.status === 'success' ? '#155724' :
                processStatus.status === 'error' ? '#721c24' :
                processStatus.status === 'excluded' ? '#856404' : '#383d41'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                Status: {processStatus.status === 'success' ? '✅ Success' : processStatus.status === 'error' ? '❌ Error' : processStatus.status === 'excluded' ? '⚠️ Excluded' : '⏳ Processing'}
              </div>
              <div style={{ marginBottom: processStatus.error ? '5px' : '0' }}>
                {processStatus.message}
              </div>
              {processStatus.error && (
                <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic' }}>
                  <strong>Error:</strong> {processStatus.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Manage Product by Code</h2>
        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="product-code" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Product Code:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                id="product-code"
                type="text"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchProduct()}
                placeholder="Enter product code (e.g., B08N5WRWNW)"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                disabled={isLoadingProduct}
              />
              <button
                onClick={handleSearchProduct}
                disabled={isLoadingProduct || !productCode.trim()}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: isLoadingProduct ? '#ccc' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoadingProduct || !productCode.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                {isLoadingProduct ? 'Loading...' : 'Search'}
              </button>
            </div>
          </div>

          {productStatus.status !== 'idle' && (
            <div style={{
              marginBottom: '15px',
              padding: '12px',
              borderRadius: '4px',
              backgroundColor: 
                productStatus.status === 'success' ? '#d4edda' :
                productStatus.status === 'error' ? '#f8d7da' : '#e2e3e5',
              border: `1px solid ${
                productStatus.status === 'success' ? '#c3e6cb' :
                productStatus.status === 'error' ? '#f5c6cb' : '#d6d8db'
              }`,
              color: 
                productStatus.status === 'success' ? '#155724' :
                productStatus.status === 'error' ? '#721c24' : '#383d41'
            }}>
              {productStatus.message}
            </div>
          )}

          {productData && (
            <div style={{
              marginTop: '20px',
              padding: '20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#fff',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Product Details</h3>
              
              <div style={{ display: 'grid', gap: '15px' }}>
                {Object.entries(productData).map(([key, value]) => {
                  // Skip productKey as it's not editable
                  if (key === 'productKey') return null;
                  
                  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
                  const isArray = Array.isArray(value);
                  
                  return (
                    <div key={key} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#555' }}>
                        {key}:
                      </label>
                      {isObject ? (
                        <textarea
                          value={JSON.stringify(value, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              handleProductFieldChange(key, parsed);
                            } catch {
                              // Invalid JSON, don't update
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '12px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            minHeight: '100px'
                          }}
                        />
                      ) : isArray ? (
                        <textarea
                          value={JSON.stringify(value, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              handleProductFieldChange(key, parsed);
                            } catch {
                              // Invalid JSON, don't update
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '12px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            minHeight: '80px'
                          }}
                        />
                      ) : typeof value === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) => handleProductFieldChange(key, e.target.checked)}
                          style={{ width: '20px', height: '20px' }}
                        />
                      ) : typeof value === 'number' ? (
                        <input
                          type="number"
                          value={value as number}
                          onChange={(e) => handleProductFieldChange(key, parseFloat(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '14px',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(value || '')}
                          onChange={(e) => handleProductFieldChange(key, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '14px',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleUpdateProduct}
                  disabled={isUpdating}
                  style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: isUpdating ? '#ccc' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    flex: 1
                  }}
                >
                  {isUpdating ? 'Updating...' : 'Update Product'}
                </button>
                <button
                  onClick={handleDeleteProduct}
                  disabled={isDeleting}
                  style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    backgroundColor: isDeleting ? '#ccc' : '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    flex: 1
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Product'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <button onClick={() => window.location.href = '/deals'}>
            View Deals
          </button>
          <button onClick={() => window.location.href = '/logs'}>
            View Logs
          </button>
          <button onClick={() => window.location.href = '/analytics'}>
            View Analytics
          </button>
          {isBannerButtonVisible && (
            <button 
              onClick={handleBannerExtraction}
              disabled={isExtracting}
              style={{ display: isBannerButtonVisible ? 'inline-block' : 'none' }}
            >
              {isExtracting ? 'Extracting...' : 'Extract Banners'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
