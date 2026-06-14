import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { analyticsAPI, schedulerAPI, bannersAPI, dealsAPI } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import CategoryMatcher from '../components/CategoryMatcher';
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
  
  // Product code search and CRUD state
  const [productCode, setProductCode] = useState('');
  const [productData, setProductData] = useState<any>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchDb, setSearchDb] = useState<'productdeals' | 'hotDeal'>('productdeals');
  
  const { addNotification } = useNotification();
  
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
      addNotification({
        type: 'error',
        message: 'Product URL is required',
        source: 'Process Product',
        page: 'Dashboard'
      });
      return;
    }

    let urlToProcess = productUrl.trim();
    if (!urlToProcess.startsWith('http')) {
      urlToProcess = `https://${urlToProcess}`;
    }

    setIsProcessing(true);
    addNotification({ type: 'info', message: 'Processing started...', source: 'Process Product', page: 'Dashboard' });

    try {
      const response = await dealsAPI.processProduct(urlToProcess, postProduct);
      let type: 'success' | 'error' | 'info' | 'warning' = 'success';
      if (response.data.status === 'error') type = 'error';
      else if (response.data.status === 'excluded') type = 'warning';

      addNotification({
        type,
        message: response.data.message || 'Product processed successfully',
        source: 'Process Product',
        page: 'Dashboard'
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: error.response?.data?.error || error.message || 'Failed to process product',
        source: 'Process Product',
        page: 'Dashboard'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearchProduct = async () => {
    if (!productCode.trim()) {
      addNotification({ type: 'error', message: 'Please enter a product code', source: 'Search Product', page: 'Dashboard' });
      return;
    }

    setIsLoadingProduct(true);
    setProductData(null);

    try {
      const targetDb = searchDb === 'hotDeal' ? 'deals' : 'productdeals';
      const response = await dealsAPI.getByCode(productCode.trim(), targetDb);
      if (response.data.success) {
        setProductData(response.data.data);
        addNotification({ type: 'success', message: 'Product found successfully', source: 'Search Product', page: 'Dashboard' });
      } else {
        addNotification({ type: 'error', message: response.data.error || 'Product not found', source: 'Search Product', page: 'Dashboard' });
      }
    } catch (error: any) {
      addNotification({ type: 'error', message: error.response?.data?.error || error.message || 'Failed to fetch product', source: 'Search Product', page: 'Dashboard' });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!productData || !productCode.trim()) {
      addNotification({ type: 'error', message: 'No product data to update', source: 'Update Product', page: 'Dashboard' });
      return;
    }

    setIsUpdating(true);

    try {
      // Remove productKey from updates if it exists
      const { productKey, ...updates } = productData;
      const targetDb = searchDb === 'hotDeal' ? 'deals' : 'productdeals';
      const response = await dealsAPI.updateProduct(productCode.trim(), updates, targetDb);
      if (response.data.success) {
        addNotification({ type: 'success', message: 'Product updated successfully', source: 'Update Product', page: 'Dashboard' });
        // Refresh product data
        await handleSearchProduct();
      } else {
        addNotification({ type: 'error', message: response.data.error || 'Failed to update product', source: 'Update Product', page: 'Dashboard' });
      }
    } catch (error: any) {
      addNotification({ type: 'error', message: error.response?.data?.error || error.message || 'Failed to update product', source: 'Update Product', page: 'Dashboard' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productCode.trim()) {
      addNotification({ type: 'error', message: 'Product code is required', source: 'Delete Product', page: 'Dashboard' });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete product "${productCode}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await dealsAPI.deleteProduct(productCode.trim());
      if (response.data.success) {
        addNotification({ type: 'success', message: 'Product deleted successfully', source: 'Delete Product', page: 'Dashboard' });
        setProductData(null);
        setProductCode('');
      } else {
        addNotification({ type: 'error', message: response.data.error || 'Failed to delete product', source: 'Delete Product', page: 'Dashboard' });
      }
    } catch (error: any) {
      addNotification({ type: 'error', message: error.response?.data?.error || error.message || 'Failed to delete product', source: 'Delete Product', page: 'Dashboard' });
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
                Product URL (or Short URL):
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  id="product-url"
                  type="text"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="Enter full URL or short URL (e.g., https://amzn.to/...)"
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



          {productData && (
              <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                maxHeight: '600px',
                overflowY: 'auto'
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Product Details</h3>
                
                <CategoryMatcher 
                  productData={productData} 
                  onChange={handleProductFieldChange} 
                  onSave={handleUpdateProduct}
                  isSaving={isUpdating}
                />
                
                <div style={{ display: 'grid', gap: '15px' }}>
                  {Object.entries(productData).map(([key, value]) => {
                    // Skip productKey as it's not editable
                    if (key === 'productKey') return null;
                    
                    // Skip category fields as they are handled by CategoryMatcher
                    if (['category', 'subCategory', 'categoryGroup', 'style'].includes(key)) return null;
                    
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
