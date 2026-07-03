import React, { useState, useEffect } from 'react';
import './Banners.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const buildBannerKey = (banner = {}) => {
  const platform = (banner.platform || '').trim().toLowerCase();
  const url = (banner.url || '').trim().toLowerCase();
  const clickUrl = (banner.clickRedirectUrl || '').trim().toLowerCase();
  const key = [platform, url, clickUrl].join('|');
  return key || banner.id;
};

const dedupeBanners = (banners = []) => {
  const seen = new Set();
  const unique = [];
  let removed = 0;

  banners.forEach((banner) => {
    const key = buildBannerKey(banner);
    if (seen.has(key)) {
      removed += 1;
      return;
    }
    seen.add(key);
    unique.push(banner);
  });

  return { unique, removed };
};

const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [filter, setFilter] = useState({ platform: 'all', activeOnly: true });
  const [bannerSource, setBannerSource] = useState('test-banners');
  const [sourceLoading, setSourceLoading] = useState(true);
  const [bannerVisibility, setBannerVisibility] = useState({});
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState(null);
  const [dedupeInfo, setDedupeInfo] = useState({ removed: 0 });

  // Custom manual deal/banner form states
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [formUrl, setFormUrl] = useState('');
  const [formClickRedirectUrl, setFormClickRedirectUrl] = useState('');
  const [formPlatform, setFormPlatform] = useState('custom');
  const [formCategory, setFormCategory] = useState('general');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formOrder, setFormOrder] = useState('0');
  const [formStatus, setFormStatus] = useState(null);
  const [useCacheLive, setUseCacheLive] = useState(false);

  // Sale Scraper states
  const [scraperSaleName, setScraperSaleName] = useState('');
  const [scraperPlatform, setScraperPlatform] = useState('amazon');
  const [scraperCategory, setScraperCategory] = useState('general');
  const [scraperUrls, setScraperUrls] = useState('');
  const [scraperStatusText, setScraperStatusText] = useState(null);
  const [activeScraperTask, setActiveScraperTask] = useState(null);

  useEffect(() => {
    fetchBannerSource();
    fetchStats();
    checkActiveTask();
    triggerBanners(); // Automatically fetch and display banners on mount
    const interval = setInterval(() => {
      fetchStats();
      checkActiveTask();
    }, 4000); // Poll status every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const checkActiveTask = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/execution/status`);
      const result = await response.json();
      if (result.success && result.data && result.data.type === 'sale_scraper') {
        setActiveScraperTask(result.data);
      } else {
        setActiveScraperTask(null);
      }
    } catch (err) {
      console.warn('Error checking active scraper task status:', err);
    }
  };

  const handleStartScraper = async (e) => {
    e.preventDefault();
    if (!scraperSaleName || !scraperUrls) {
      alert('Please fill in both Sale Name and Target URLs list.');
      return;
    }
    
    const parsedUrls = scraperUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);
      
    if (parsedUrls.length === 0) {
      alert('Please enter at least one valid URL.');
      return;
    }

    setScraperStatusText('🚀 Initializing sale scraper background task...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/scrape-sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleName: scraperSaleName,
          platform: scraperPlatform,
          category: scraperCategory,
          urls: parsedUrls
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setScraperStatusText('✅ Background scraper started! Tracking live execution...');
        setScraperUrls('');
        setScraperSaleName('');
        checkActiveTask();
      } else {
        setScraperStatusText(`❌ Error starting scraper: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setScraperStatusText(`❌ Error: ${err.message}`);
    }
  };

  const fetchBannerSource = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/source`);
      const result = await response.json();
      if (result.success) {
        setBannerSource(result.data.current);
        setSourceLoading(false);
      }
      
      const configRes = await fetch(`${API_BASE_URL}/api/banners/config`);
      const configResult = await configRes.json();
      if (configResult.success && configResult.data) {
        setUseCacheLive(configResult.data.useCache === true);
      }
    } catch (err) {
      console.error('Error fetching banner source/config:', err);
      setBannerSource('test-banners'); // Default to test-banners
      setSourceLoading(false);
    }
  };

  const triggerBanners = async () => {
    setTriggering(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      if (result.success) {
        let bannersArray = result.data.banners;
        
        // Apply cached status to banners
        bannersArray = bannersArray.map(banner => {
          const cacheKey = `banner_${banner.id}_status`;
          const cachedData = localStorage.getItem(cacheKey);
          
          if (cachedData) {
            try {
              const cached = JSON.parse(cachedData);
              return { ...banner, isActive: cached.isActive };
            } catch (e) {
              // Invalid cache, use original
              return banner;
            }
          }
          return banner;
        });
        
        const { unique, removed } = dedupeBanners(bannersArray);
        setDedupeInfo({ removed });

        setBanners(unique);

        const updatedStats = {
          ...(result.data.stats || {}),
          total: unique.length,
          active: unique.filter(b => b && b.isActive).length,
          inactive: unique.filter(b => b && !b.isActive).length,
          source: result.source || bannerSource
        };
        setStats(updatedStats);
        
        // Initialize visibility state for each banner
        const visibilityState = {};
        unique.forEach(banner => {
          visibilityState[banner.id] = true; // Default to visible
        });
        setBannerVisibility(visibilityState);
        
        setLoading(false);
      } else {
        throw new Error(result.error || 'Failed to trigger banners');
      }
    } catch (err) {
      setError(err.message);
      setTriggering(false);
    } finally {
      setTriggering(false);
    }
  };

  const toggleBannerSource = async () => {
    setSourceLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/source/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      if (result.success) {
        setBannerSource(result.data.current);
      } else {
        throw new Error(result.error || 'Failed to toggle banner source');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSourceLoading(false);
    }
  };

  const toggleLiveCacheSetting = async () => {
    const newValue = !useCacheLive;
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useCache: newValue })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setUseCacheLive(newValue);
      } else {
        alert('Failed to update live cache setting');
      }
    } catch (err) {
      alert(`Error toggling cache setting: ${err.message}`);
    }
  };

  const fetchBanners = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.platform !== 'all') params.append('platform', filter.platform);
      if (filter.activeOnly) params.append('activeOnly', 'true');
      
      const response = await fetch(`${API_BASE_URL}/api/banners?${params}`);
      const result = await response.json();
      if (result.success) {
        const bannersArray = Object.entries(result.data).map(([id, data]) => ({
          id,
          ...data
        }));
        const { unique, removed } = dedupeBanners(bannersArray);
        setDedupeInfo({ removed });
        setBanners(unique);
        setLoading(false);
      } else {
        throw new Error(result.error || 'Failed to fetch banners');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/stats`);
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Error fetching banner stats:', err);
    }
  };

  const toggleBannerStatus = async (bannerId, currentStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}/toggle-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update local state with new status
        setBanners(prev => 
          prev.map(b => 
            b.id === bannerId 
              ? { ...b, isActive: result.data.isActive }
              : b
          )
        );
        
        // Cache the new status
        const cacheKey = `banner_${bannerId}_status`;
        localStorage.setItem(cacheKey, JSON.stringify({
          isActive: result.data.isActive,
          timestamp: new Date().toISOString()
        }));
        
        // Update stats
        fetchStats();
      } else {
        setError(`Failed to update banner: ${result.error}`);
      }
    } catch (err) {
      setError(`Error updating banner: ${err.message}`);
    }
  };

  const toggleBannerVisibility = (bannerId) => {
    setBannerVisibility(prev => ({
      ...prev,
      [bannerId]: !prev[bannerId]
    }));
  };

  const extractAllBanners = async () => {
    setExtracting(true);
    setError(null);
    setExtractionResult(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/extract-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setExtractionResult({
          extracted: result.data.extracted,
          stored: result.data.stored,
          duplicates: result.data.duplicates
        });
        
        // Refresh stats after extraction
        setTimeout(() => {
          fetchStats();
        }, 1000);
        
        // Show success message
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to extract banners');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (!formUrl.trim() || !formClickRedirectUrl.trim()) {
      setFormStatus('❌ Image URL and Target link are required.');
      return;
    }
    
    setFormStatus(editingBannerId ? 'Updating...' : 'Adding...');
    
    const urlEndpoint = editingBannerId 
      ? `${API_BASE_URL}/api/banners/${editingBannerId}`
      : `${API_BASE_URL}/api/banners/add`;
      
    const method = editingBannerId ? 'PUT' : 'POST';

    try {
      const response = await fetch(urlEndpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formUrl,
          clickRedirectUrl: formClickRedirectUrl,
          platform: formPlatform,
          category: formCategory,
          title: formTitle,
          description: formDescription,
          isActive: formIsActive,
          order: Number(formOrder) || 0
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setFormStatus(`✅ Success: ${result.message}`);
        // Clear form
        handleCancelEdit();
        // Refresh banners
        triggerBanners();
      } else {
        setFormStatus(`❌ Error: ${result.error || 'Failed to save deal'}`);
      }
    } catch (err) {
      setFormStatus(`❌ Connection Error: ${err.message}`);
    }
  };

  const handleEditBannerClick = (banner) => {
    setEditingBannerId(banner.id);
    setFormUrl(banner.url || '');
    setFormClickRedirectUrl(banner.clickRedirectUrl || '');
    setFormPlatform(banner.platform || 'custom');
    setFormCategory(banner.category || 'general');
    setFormTitle(banner.title || '');
    setFormDescription(banner.description || '');
    setFormIsActive(banner.isActive === true);
    setFormOrder(String(banner.order || 0));
    setFormStatus(null);
  };

  const handleCancelEdit = () => {
    setEditingBannerId(null);
    setFormUrl('');
    setFormClickRedirectUrl('');
    setFormPlatform('custom');
    setFormCategory('general');
    setFormTitle('');
    setFormDescription('');
    setFormIsActive(true);
    setFormOrder('0');
    setFormStatus(null);
  };

  const handleDeleteBanner = async (bannerId) => {
    if (!window.confirm('Are you sure you want to delete this live deal/banner?')) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setBanners(prev => prev.filter(b => b.id !== bannerId));
        fetchStats();
      } else {
        alert(`Failed to delete banner: ${result.error}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="banners">
      <div className="banners-header">
        <h1>🖼️ Banner Management</h1>
        {stats && (
          <div className="banner-stats-summary">
            <span>Total: {stats.total}</span>
            <span className="active">Active: {stats.active}</span>
            <span>Inactive: {stats.inactive}</span>
            <span className="source-info">Source: {stats.source || bannerSource}</span>
          </div>
        )}
      </div>

      <div className="banners-controls">
        <div className="control-group">
          <button 
            onClick={triggerBanners}
            disabled={triggering}
            className="trigger-button"
          >
            {triggering ? '🔄 Loading...' : '🚀 Display Banners'}
          </button>
          
          <button 
            onClick={extractAllBanners}
            disabled={extracting}
            className="extract-all-button"
            title="Extract banners from all stores and store in DB (visibility OFF)"
          >
            {extracting ? '⏳ Extracting...' : '🔍 Extract All Banners'}
          </button>
          
          <div className="source-toggle">
            <span className="source-label">Banner Source:</span>
            <div className="toggle-switch">
              <button 
                onClick={toggleBannerSource}
                disabled={sourceLoading}
                className={`source-button ${bannerSource === 'test-banners' ? 'active' : ''}`}
              >
                test-banners.json
              </button>
              <button 
                onClick={toggleBannerSource}
                disabled={sourceLoading}
                className={`source-button ${bannerSource === 'production' ? 'active' : ''}`}
              >
                production
              </button>
            </div>
          </div>

          <div className="source-toggle" style={{ marginLeft: '20px' }}>
            <span className="source-label" style={{ minWidth: '135px' }}>Live Web Caching:</span>
            <div className="toggle-switch">
              <button 
                onClick={toggleLiveCacheSetting}
                className={`source-button ${useCacheLive ? 'active' : ''}`}
                style={{
                  backgroundColor: useCacheLive ? '#16a34a' : '#ef4444',
                  borderColor: useCacheLive ? '#15803d' : '#b91c1c',
                  color: 'white',
                  fontWeight: 700
                }}
              >
                {useCacheLive ? 'Enabled (Cached Banners)' : 'Disabled (Live Banners)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sale Scraper & Execution Monitor Console Card */}
      <div className="users-filter-card" style={{ marginTop: '24px', borderLeft: '4px solid #ef4444', background: '#fffbeb', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#b45309', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🤖 Automated Dynamic Sale Scraper Console
        </h3>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '-10px 0 20px 0' }}>
          Paste target deal URLs (e.g. Myntra end of season, Amazon deals pages) to scrape live banners & offers automatically in the background using Selenium.
        </p>

        <form onSubmit={handleStartScraper}>
          <div className="filters-inputs-row" style={{ flexWrap: 'wrap', gap: '15px' }}>
            <div className="filter-input-wrapper" style={{ flex: '1 1 200px' }}>
              <label>Campaign / Sale Name</label>
              <input
                type="text"
                value={scraperSaleName}
                onChange={(e) => setScraperSaleName(e.target.value)}
                placeholder="e.g. Myntra Big Bold Sale"
                required
              />
            </div>
            
            <div className="filter-input-wrapper" style={{ flex: '1 1 120px' }}>
              <label>Store Platform</label>
              <select value={scraperPlatform} onChange={(e) => setScraperPlatform(e.target.value)}>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="myntra">Myntra</option>
                <option value="ajio">Ajio</option>
              </select>
            </div>

            <div className="filter-input-wrapper" style={{ flex: '1 1 120px' }}>
              <label>Target Category</label>
              <select value={scraperCategory} onChange={(e) => setScraperCategory(e.target.value)}>
                <option value="general">General</option>
                <option value="fashion">Fashion</option>
                <option value="laptops">Laptops</option>
                <option value="mobiles">Mobiles</option>
                <option value="electronics">Electronics</option>
              </select>
            </div>
          </div>

          <div className="filter-input-wrapper" style={{ marginTop: '15px' }}>
            <label>Target URLs List (one URL per line)</label>
            <textarea
              value={scraperUrls}
              onChange={(e) => setScraperUrls(e.target.value)}
              placeholder="e.g.&#10;https://www.myntra.com/sale-clothing&#10;https://www.myntra.com/sale-footwear"
              rows={4}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontFamily: 'inherit',
                fontSize: '13px',
                resize: 'vertical'
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
            {scraperStatusText && (
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#b45309' }}>
                {scraperStatusText}
              </span>
            )}
            
            <button
              type="submit"
              disabled={!!activeScraperTask}
              style={{
                backgroundColor: activeScraperTask ? '#9ca3af' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 20px',
                cursor: activeScraperTask ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                marginLeft: 'auto'
              }}
            >
              {activeScraperTask ? '⏳ Scraper Running in Background' : '🚀 Start Background Scraper'}
            </button>
          </div>
        </form>

        {/* Live Scraper Execution Tracker & Logs Viewport */}
        {activeScraperTask && (
          <div style={{ marginTop: '20px', background: '#1e293b', borderRadius: '8px', padding: '15px', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '10px' }}>
              <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '14px' }}>
                📡 LIVE EXECUTION TRACKER: {activeScraperTask.saleName}
              </span>
              <span style={{ fontSize: '12px', background: '#b45309', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                {activeScraperTask.status}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', fontSize: '13px', marginBottom: '10px' }}>
              <div>
                <strong>URLs Processed:</strong> {activeScraperTask.processedUrls} / {activeScraperTask.totalUrls}
              </div>
              <div>
                <strong>Banners Extracted:</strong> {activeScraperTask.extractedBanners}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
              <div 
                style={{ 
                  height: '100%', 
                  background: '#fbbf24', 
                  width: `${(activeScraperTask.processedUrls / activeScraperTask.totalUrls) * 100}%`,
                  transition: 'width 0.4s ease'
                }} 
              />
            </div>

            {/* Terminal logs */}
            <div style={{ fontSize: '12px', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto', background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
              {activeScraperTask.logs && activeScraperTask.logs.map((log, idx) => (
                <div key={idx} style={{ color: log.includes('[ERROR]') ? '#ef4444' : '#38bdf8', margin: '2px 0' }}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Live Deal / Banner Form Card */}
      <div className="users-filter-card" style={{ marginTop: '24px', borderLeft: '4px solid #3b82f6', background: '#f8fafc', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#1e3a8a', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {editingBannerId ? '✏️ Edit Live Deal / Banner' : '➕ Add Custom Live Deal / Banner'}
        </h3>
        <form onSubmit={handleSaveBanner}>
          <div className="filters-inputs-row" style={{ flexWrap: 'wrap', gap: '15px' }}>
            <div className="filter-input-wrapper" style={{ flex: '1 1 250px' }}>
              <label>Banner Image URL</label>
              <input
                type="text"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="e.g. https://m.media-amazon.com/...jpg"
                required
              />
            </div>
            
            <div className="filter-input-wrapper" style={{ flex: '1 1 250px' }}>
              <label>Target Redirect Link</label>
              <input
                type="text"
                value={formClickRedirectUrl}
                onChange={(e) => setFormClickRedirectUrl(e.target.value)}
                placeholder="e.g. https://www.amazon.in/deal/..."
                required
              />
            </div>
          </div>

          <div className="filters-inputs-row" style={{ flexWrap: 'wrap', gap: '15px', marginTop: '15px' }}>
            <div className="filter-input-wrapper" style={{ flex: '1 1 180px' }}>
              <label>Deal Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Flipkart Sale 60% Off"
              />
            </div>

            <div className="filter-input-wrapper" style={{ flex: '1 1 120px' }}>
              <label>Platform Store</label>
              <select value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)}>
                <option value="custom">Custom Platform</option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="myntra">Myntra</option>
                <option value="ajio">Ajio</option>
              </select>
            </div>

            <div className="filter-input-wrapper" style={{ flex: '1 1 120px' }}>
              <label>Target Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                <option value="general">General</option>
                <option value="fashion">Fashion</option>
                <option value="laptops">Laptops</option>
                <option value="mobiles">Mobiles</option>
                <option value="electronics">Electronics</option>
              </select>
            </div>

            <div className="filter-input-wrapper" style={{ flex: '1 1 80px' }}>
              <label>Order Priority</label>
              <input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="filter-input-wrapper" style={{ marginTop: '15px' }}>
            <label>Description (Optional)</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="e.g. Save on top electronics products this weekend..."
              rows={2}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              Make Deal Active immediately on Homepage
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
            {formStatus && (
              <span style={{ fontSize: '13px', fontWeight: 600, color: formStatus.startsWith('✅') ? '#16a34a' : '#2563eb' }}>
                {formStatus}
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
              {editingBannerId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    backgroundColor: '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {editingBannerId ? 'Update Deal' : '🚀 Save Live Deal'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {dedupeInfo.removed > 0 && (
        <div className="banners-info">
          Removed {dedupeInfo.removed} duplicate banners for this session.
        </div>
      )}

      {error && (
        <div className="banners-error">⚠️ Error: {error}</div>
      )}

      {extractionResult && (
        <div className="banners-success">
          ✅ Extraction Complete! 
          Extracted: {extractionResult.extracted}, 
          Stored: {extractionResult.stored}, 
          Duplicates Skipped: {extractionResult.duplicates}
          <br />
          <small>All banners stored with visibility OFF. You can turn them on one by one in the UI.</small>
        </div>
      )}

      {banners.length === 0 && !triggering && (
        <div className="no-banners-message">
          <p>No banners loaded yet. Click "Display Banners" to fetch from {bannerSource}.</p>
        </div>
      )}

      <div className="banners-filters">
        <select 
          value={filter.platform} 
          onChange={(e) => setFilter({ ...filter, platform: e.target.value })}
          className="filter-select"
          disabled={banners.length === 0}
        >
          <option value="all">All Platforms</option>
          <option value="amazon">Amazon</option>
          <option value="flipkart">Flipkart</option>
          <option value="myntra">Myntra</option>
          <option value="ajio">Ajio</option>
        </select>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={filter.activeOnly}
            onChange={(e) => setFilter({ ...filter, activeOnly: e.target.checked })}
            disabled={banners.length === 0}
          />
          Active Only
        </label>
      </div>

      {stats && stats.byPlatform && Object.keys(stats.byPlatform).length > 0 && (
        <div className="platform-breakdown">
          <h3>Banners by Platform</h3>
          <div className="platform-stats">
            {Object.entries(stats.byPlatform).map(([platform, count]) => (
              <div key={platform} className="platform-stat-item">
                <span className="platform-name">{platform}</span>
                <span className="platform-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="banners-grid">
        {banners.length === 0 && !triggering ? (
          <div className="no-banners">No banners found</div>
        ) : (
          banners
            .filter(banner => bannerVisibility[banner.id] !== false)
            .filter(banner => {
              if (filter.activeOnly && !banner.isActive) return false;
              if (filter.platform !== 'all' && banner.platform !== filter.platform) return false;
              return true;
            })
            .map((banner) => (
            <div key={banner.id} className={`banner-card ${banner.isActive ? 'active' : 'inactive'}`}>
              <div className="banner-status-toggle" style={{ display: 'flex', gap: '5px' }}>
                <button 
                  onClick={() => toggleBannerStatus(banner.id, banner.isActive)}
                  className={`status-toggle-btn ${banner.isActive ? 'active' : 'inactive'}`}
                  title={`Click to ${banner.isActive ? 'deactivate' : 'activate'} this banner`}
                >
                  {banner.isActive ? '✓ Active' : '✗ Inactive'}
                </button>
                <button 
                  onClick={() => handleEditBannerClick(banner)}
                  style={{
                    backgroundColor: '#eab308',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  title="Edit this banner's properties"
                >
                  ✏️ Edit
                </button>
                <button 
                  onClick={() => handleDeleteBanner(banner.id)}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  title="Delete this banner"
                >
                  🗑️ Delete
                </button>
              </div>
              <div className="banner-image">
                {banner.url ? (
                  <img src={banner.url} alt={banner.title || banner.id} onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/300x150?text=Banner+Image';
                  }} />
                ) : (
                  <div className="banner-placeholder">No Image</div>
                )}
              </div>
              <div className="banner-info">
                <h3>{banner.title || banner.id}</h3>
                {banner.description && <p>{banner.description}</p>}
                <div className="banner-meta">
                  <span className={`banner-status ${banner.isActive ? 'active' : 'inactive'}`}>
                    {banner.isActive ? '✓ Active' : '✗ Inactive'}
                  </span>
                  {banner.platform && (
                    <span className="banner-platform">{banner.platform}</span>
                  )}
                </div>
                {banner.clickRedirectUrl && (
                  <a 
                    href={banner.clickRedirectUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="banner-link"
                  >
                    View Link →
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Banners;
