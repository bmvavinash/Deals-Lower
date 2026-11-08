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
  const [processedLowerdealUrls, setProcessedLowerdealUrls] = useState<string[]>([]);
  const [batchItems, setBatchItems] = useState<Array<{
    queuedId?: string;
    url?: string;
    lowerdealUrl?: string;
    productCode?: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    title?: string;
    price?: string | number;
    executor?: string;
  }>>([]);
  const [extractionStatus, setExtractionStatus] = useState<{
    status: 'idle' | 'queued' | 'running' | 'completed' | 'failed';
    title?: string;
    price?: string | number;
    executor?: string;
    message?: string;
    productCode?: string;
    completedCount?: number;
    totalCount?: number;
  }>({ status: 'idle' });
  
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
        message: 'Product URL(s) required',
        source: 'Process Product',
        page: 'Dashboard'
      });
      return;
    }

    setIsProcessing(true);
    setProcessedLowerdealUrls([]);
    setExtractionStatus({ status: 'running', message: 'Submitting request to API server...' });
    addNotification({ type: 'info', message: 'Processing started...', source: 'Process Product', page: 'Dashboard' });

    try {
      const response = await dealsAPI.processProduct(productUrl, postProduct);
      let type: 'success' | 'error' | 'info' | 'warning' = 'success';
      if (response.data.status === 'error') type = 'error';
      else if (response.data.status === 'excluded') type = 'warning';

      if (Array.isArray(response.data.lowerdealUrls) && response.data.lowerdealUrls.length > 0) {
        setProcessedLowerdealUrls(response.data.lowerdealUrls);
      } else if (response.data.lowerdealUrl) {
        setProcessedLowerdealUrls([response.data.lowerdealUrl]);
      }
      if (response.data.productCode) {
        setProductCode(response.data.productCode);
      }

      // Prepare batch items from results or single URL response
      const resultsArray = Array.isArray(response.data.results) && response.data.results.length > 0
        ? response.data.results
        : [{
            queuedId: response.data.queuedId,
            originalUrl: productUrl,
            lowerdealUrl: response.data.lowerdealUrl,
            productCode: response.data.productCode,
            status: response.data.status,
            queued: response.data.queued,
            data: response.data.data
          }];

      const initialBatch = resultsArray.map((r: any) => ({
        queuedId: r.queuedId,
        url: r.originalUrl,
        lowerdealUrl: r.lowerdealUrl || (r.productCode ? `https://lowerdeal.com/p/${r.productCode}` : undefined),
        productCode: r.productCode,
        status: (r.status === 'success' || (!r.queued && r.success)) ? 'completed' : (r.queued ? 'queued' : (r.status === 'error' ? 'failed' : 'queued')),
        title: r.data?.title || r.title || r.productCode,
        price: r.data?.price || r.price,
        executor: r.targetDaemon === 'oracle' ? 'Oracle Cloud VM' : 'Local Daemon'
      }));
      setBatchItems(initialBatch);

      // If any items are queued for background daemon execution, poll queue status for live completion
      const hasQueuedItems = initialBatch.some((b: any) => b.status === 'queued' || b.status === 'running');
      if (hasQueuedItems) {
        const targetDaemonName = response.data.targetDaemon === 'oracle' ? 'Oracle Cloud VM' : 'Local Daemon';
        const totalCount = initialBatch.length;
        const queuedCount = initialBatch.filter((b: any) => b.status === 'queued' || b.status === 'running').length;

        setExtractionStatus({
          status: 'queued',
          executor: targetDaemonName,
          totalCount,
          completedCount: totalCount - queuedCount,
          message: totalCount > 1 
            ? `${queuedCount} of ${totalCount} products queued on ${targetDaemonName}. Processing sequentially in FIFO order...`
            : `Task queued on ${targetDaemonName}. Scraper is initializing headless browser to extract live details...`,
          productCode: response.data.productCode
        });

        addNotification({
          type: 'info',
          message: totalCount > 1
            ? `${totalCount} product links submitted. Output links are ready below while scraper processes them in FIFO order...`
            : `Product queued on ${targetDaemonName}. Output link is ready below while scraper extracts full details in background...`,
          source: 'Process Product',
          page: 'Dashboard'
        });

        const pollInterval = 2500;
        const maxAttempts = 60 * Math.max(1, Math.ceil(totalCount / 2));
        let attempts = 0;
        const currentBatch = [...initialBatch];

        const pollStatus = async () => {
          attempts++;
          try {
            let anyRunning = false;

            for (let i = 0; i < currentBatch.length; i++) {
              const item = currentBatch[i];
              if (item.queuedId && item.status !== 'completed' && item.status !== 'failed') {
                try {
                  const statusRes = await dealsAPI.checkQueueStatus(item.queuedId);
                  const statusData = statusRes.data;

                  if (statusData.status === 'running') {
                    item.status = 'running';
                    item.executor = statusData.executorType === 'oracle' ? 'Oracle Cloud VM' : 'Local Daemon';
                    anyRunning = true;
                  } else if (statusData.status === 'completed') {
                    item.status = 'completed';
                    item.title = statusData.product?.title || item.title || statusData.productCode;
                    item.price = statusData.product?.price || item.price;
                    item.executor = statusData.executorType === 'oracle' ? 'Oracle Cloud VM' : 'Local Daemon';
                  } else if (statusData.status === 'failed') {
                    item.status = 'failed';
                  }
                } catch (_) {}
              }
            }

            setBatchItems([...currentBatch]);
            const completedCount = currentBatch.filter((b: any) => b.status === 'completed').length;
            const failedCount = currentBatch.filter((b: any) => b.status === 'failed').length;

            if (completedCount + failedCount >= currentBatch.length) {
              clearInterval(pollTimer);
              setIsProcessing(false);
              const allSuccess = failedCount === 0;
              setExtractionStatus({
                status: allSuccess ? 'completed' : 'failed',
                completedCount,
                totalCount: currentBatch.length,
                title: currentBatch.length === 1 ? currentBatch[0].title : undefined,
                price: currentBatch.length === 1 ? currentBatch[0].price : undefined,
                executor: currentBatch[0]?.executor,
                message: allSuccess
                  ? (currentBatch.length > 1
                      ? `All ${currentBatch.length} products are ready in the database! Live deals verified.`
                      : 'Product is ready in the database! Live deal verified.')
                  : `Batch finished: ${completedCount} completed, ${failedCount} failed.`
              });
              addNotification({
                type: allSuccess ? 'success' : 'warning',
                message: `Finished processing batch (${completedCount}/${currentBatch.length} saved to DB)!`,
                source: 'Process Product',
                page: 'Dashboard'
              });
              return;
            }

            setExtractionStatus(prev => ({
              ...prev,
              status: anyRunning ? 'running' : 'queued',
              completedCount,
              totalCount: currentBatch.length,
              message: anyRunning
                ? `Extracting products... (${completedCount}/${currentBatch.length} ready in DB)`
                : `Queued in line (FIFO)... (${completedCount}/${currentBatch.length} ready in DB)`
            }));

            if (attempts >= maxAttempts) {
              clearInterval(pollTimer);
              setIsProcessing(false);
              setExtractionStatus({
                status: 'running',
                message: 'Processing is taking longer than expected. Scraper is still working in background; links will update once saved.'
              });
            }
          } catch (pollErr) {
            if (attempts >= maxAttempts) {
              clearInterval(pollTimer);
              setIsProcessing(false);
            }
          }
        };

        const pollTimer = setInterval(pollStatus, pollInterval);
        return; // Retain isProcessing = true while polling
      }

      setExtractionStatus({
        status: 'completed',
        title: response.data.data?.title || response.data.productCode || 'Product',
        price: response.data.data?.price,
        executor: 'Cloud Direct',
        message: 'Product processed and saved to database successfully!'
      });
      addNotification({
        type,
        message: response.data.message || 'Product(s) processed successfully',
        source: 'Process Product',
        page: 'Dashboard'
      });
      setIsProcessing(false);
    } catch (error: any) {
      setExtractionStatus({
        status: 'failed',
        message: error.response?.data?.error || error.message || 'Failed to process product(s)'
      });
      addNotification({
        type: 'error',
        message: error.response?.data?.error || error.message || 'Failed to process product(s)',
        source: 'Process Product',
        page: 'Dashboard'
      });
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
                Product URL(s) (Single URL, or multiple URLs separated by newlines / commas):
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <textarea
                  id="product-url"
                  rows={3}
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="Paste one or multiple product links (Amazon, Flipkart, Myntra, etc.)..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
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

          {/* Real-time Extraction Status & DB Indicator */}
          {extractionStatus.status !== 'idle' && (
            <div style={{
              marginTop: '15px',
              padding: '14px 18px',
              borderRadius: '8px',
              border: '1px solid ' + (
                extractionStatus.status === 'completed' ? '#81c784' :
                extractionStatus.status === 'failed' ? '#e57373' : '#64b5f6'
              ),
              backgroundColor: (
                extractionStatus.status === 'completed' ? '#e8f5e9' :
                extractionStatus.status === 'failed' ? '#ffebee' : '#e3f2fd'
              ),
              color: '#333'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>
                  {extractionStatus.status === 'completed' ? '✅' :
                   extractionStatus.status === 'failed' ? '❌' : '⏳'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '15px',
                    color: extractionStatus.status === 'completed' ? '#2e7d32' : extractionStatus.status === 'failed' ? '#c62828' : '#1565c0'
                  }}>
                    {extractionStatus.status === 'completed' && 'Product Ready in Database! 🎉'}
                    {(extractionStatus.status === 'queued' || extractionStatus.status === 'running') && 'Extraction in Progress... ⏳'}
                    {extractionStatus.status === 'failed' && 'Extraction Failed ❌'}
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '3px', color: '#555' }}>
                    {extractionStatus.message}
                  </div>
                  {extractionStatus.status === 'completed' && extractionStatus.title && (
                    <div style={{ fontSize: '13px', marginTop: '6px', fontWeight: 'bold', color: '#1b5e20', backgroundColor: '#c8e6c9', padding: '6px 10px', borderRadius: '4px', display: 'inline-block' }}>
                      📦 {extractionStatus.title} {extractionStatus.price ? `• ₹${extractionStatus.price}` : ''}
                      {extractionStatus.executor ? ` (${extractionStatus.executor})` : ''}
                    </div>
                  )}
                  {(extractionStatus.status === 'queued' || extractionStatus.status === 'running') && (
                    <div style={{ fontSize: '12px', marginTop: '6px', color: '#e65100', fontWeight: 'bold' }}>
                      ⚠️ Scraper is writing product data & images to database. Opening the link before extraction finishes will show "product unavailable".
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lowerdeal URLs Display */}
          {(processedLowerdealUrls.length > 0 || batchItems.length > 0) && (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: '#333' }}>
                  🛒 Generated Lowerdeal URL{Math.max(processedLowerdealUrls.length, batchItems.length) > 1 ? 's' : ''} ({Math.max(processedLowerdealUrls.length, batchItems.length)}):
                </h4>
                {extractionStatus.status === 'completed' && (
                  <span style={{ fontSize: '12px', backgroundColor: '#4CAF50', color: 'white', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                    Live in DB ✓
                  </span>
                )}
                {(extractionStatus.status === 'queued' || extractionStatus.status === 'running') && (
                  <span style={{ fontSize: '12px', backgroundColor: '#ff9800', color: 'white', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                    {extractionStatus.completedCount !== undefined && extractionStatus.totalCount !== undefined
                      ? `${extractionStatus.completedCount}/${extractionStatus.totalCount} Ready`
                      : 'Scraping... ⏳'}
                  </span>
                )}
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {(batchItems.length > 0 ? batchItems : processedLowerdealUrls.map(u => ({ lowerdealUrl: u, status: extractionStatus.status }))).map((item: any, idx: number) => {
                  const ldUrl = item.lowerdealUrl || item;
                  const isDone = item.status === 'completed' || extractionStatus.status === 'completed';
                  const isRun = item.status === 'running';
                  const isQueued = item.status === 'queued';
                  const isFailed = item.status === 'failed';

                  return (
                    <li key={idx} style={{ marginBottom: '10px', wordBreak: 'break-all' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <a
                          href={ldUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: isDone ? '#1b5e20' : '#1565c0',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            textDecoration: 'underline'
                          }}
                        >
                          {ldUrl}
                        </a>

                        {isDone && (
                          <span style={{ fontSize: '11px', backgroundColor: '#c8e6c9', color: '#1b5e20', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                            ✓ Live in DB {item.price ? `(₹${item.price})` : ''}
                          </span>
                        )}

                        {isRun && (
                          <span style={{ fontSize: '11px', backgroundColor: '#ffe0b2', color: '#e65100', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                            ⚡ Scraping now...
                          </span>
                        )}

                        {isQueued && (
                          <span style={{ fontSize: '11px', backgroundColor: '#f5f5f5', color: '#757575', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                            ⏳ Queued in line (FIFO)
                          </span>
                        )}

                        {isFailed && (
                          <span style={{ fontSize: '11px', backgroundColor: '#ffcdd2', color: '#c62828', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                            ✕ Extraction failed
                          </span>
                        )}

                        {item.title && (
                          <span style={{ fontSize: '12px', color: '#555', fontStyle: 'italic' }}>
                            — {item.title.substring(0, 45)}...
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
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
