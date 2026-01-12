import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { analyticsAPI, schedulerAPI, bannersAPI, dealsAPI } from '../services/api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { data: performanceData } = useQuery('performance', analyticsAPI.getPerformance);
  const { data: schedulerStatus } = useQuery('scheduler-status', schedulerAPI.getStatus);
  const [isExtracting, setIsExtracting] = useState(false);
  const isBannerButtonVisible = false;
  
  const [productUrl, setProductUrl] = useState('');
  const [postProduct, setPostProduct] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<{
    status: 'idle' | 'success' | 'error' | 'excluded';
    message: string;
    error?: string;
  }>({ status: 'idle', message: '' });
  
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

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>System Status</h3>
          <p className="stat-value">
            {schedulerStatus?.data?.data?.isActive ? 'ðŸŸ¢ Active' : 'ðŸ”´ Inactive'}
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
                Status: {processStatus.status === 'success' ? 'âœ… Success' : processStatus.status === 'error' ? 'âŒ Error' : processStatus.status === 'excluded' ? 'âš ï¸ Excluded' : 'â³ Processing'}
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;