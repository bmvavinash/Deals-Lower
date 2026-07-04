import React, { useState, useEffect } from 'react';
import './Banners.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Banner {
  id: string;
  title?: string;
  description?: string;
  url?: string;
  platform?: string;
  category?: string;
  isActive?: boolean;
  clickRedirectUrl?: string;
  creationTimestamp?: string;
  updateTimestamp?: string;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  byPlatform?: Record<string, number>;
  byCategory?: Record<string, number>;
  source?: string;
}

interface Filter {
  platform: string;
  activeOnly: boolean;
}

const buildBannerKey = (banner: Banner) => {
  const platform = (banner.platform || '').trim().toLowerCase();
  const url = (banner.url || '').trim().toLowerCase();
  const clickUrl = (banner.clickRedirectUrl || '').trim().toLowerCase();
  const key = [platform, url, clickUrl].join('|');
  return key || banner.id;
};

const dedupeBanners = (banners: Banner[]) => {
  const seen = new Set<string>();
  const unique: Banner[] = [];
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

// Format creation date for display
const formatBannerDate = (timestamp?: string): string => {
  if (!timestamp) return 'Date not available';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Show relative time for recent dates
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    
    // For older dates, show formatted date
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid date';
  }
};

const BannersPage: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [filter, setFilter] = useState<Filter>({ platform: 'all', activeOnly: true });
  const [bannerSource, setBannerSource] = useState('test-banners');
  const [sourceLoading, setSourceLoading] = useState(true);
  const [bannerVisibility, setBannerVisibility] = useState<Record<string, boolean>>({});
  const [dedupeInfo, setDedupeInfo] = useState<{ removed: number }>({ removed: 0 });
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{ extracted: number; stored: number; duplicates: number } | null>(null);

  useEffect(() => {
    fetchBannerSource();
    fetchStats();
    triggerBanners(); // Automatically fetch and display banners on mount
    const interval = setInterval(() => {
      fetchStats();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchBannerSource = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/source`);
      const result = await response.json();
      if (result.success) {
        setBannerSource(result.data.current);
        setSourceLoading(false);
      }
    } catch (err) {
      console.error('Error fetching banner source:', err);
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
        bannersArray = bannersArray.map((banner: Banner) => {
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

        const updatedStats: Stats = {
          ...(result.data.stats || {}),
          total: unique.length,
          active: unique.filter((b) => b && b.isActive).length,
          inactive: unique.filter((b) => b && !b.isActive).length,
          source: result.source || bannerSource,
        };
        setStats(updatedStats);
        
        // Initialize visibility state for each banner
        const visibilityState: Record<string, boolean> = {};
        unique.forEach((banner: Banner) => {
          visibilityState[banner.id] = true; // Default to visible
        });
        setBannerVisibility(visibilityState);
        
        setLoading(false);
      } else {
        throw new Error(result.error || 'Failed to trigger banners');
      }
    } catch (err) {
      setError((err as Error).message);
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
      setError((err as Error).message);
    } finally {
      setSourceLoading(false);
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

  const toggleBannerStatus = async (bannerId: string, currentStatus: boolean) => {
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
      setError(`Error updating banner: ${(err as Error).message}`);
    }
  };

  const toggleBannerVisibility = (bannerId: string) => {
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
      setError((err as Error).message);
    } finally {
      setExtracting(false);
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
        </div>
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
          [...banners]
            .filter(banner => bannerVisibility[banner.id] !== false)
            .filter(banner => {
              if (filter.activeOnly && !banner.isActive) return false;
              if (filter.platform !== 'all' && banner.platform !== filter.platform) return false;
              return true;
            })
            .sort((a, b) => {
              const aActive = a.isActive ? 1 : 0;
              const bActive = b.isActive ? 1 : 0;
              if (aActive !== bActive) return bActive - aActive;

              const getTs = (banner: any) => {
                if (banner.creationTimestamp) {
                  const t = new Date(banner.creationTimestamp).getTime();
                  if (!isNaN(t)) return t;
                }
                if (banner.updateTimestamp) {
                  const t = new Date(banner.updateTimestamp).getTime();
                  if (!isNaN(t)) return t;
                }
                const id = banner.id || "";
                const dateMatch = id.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (dateMatch) {
                  const t = new Date(dateMatch[0]).getTime();
                  if (!isNaN(t)) return t;
                }
                const tsMatch = id.match(/-(\d{10,13})$/);
                if (tsMatch) return parseInt(tsMatch[1], 10);
                return 0;
              };
              return getTs(b) - getTs(a);
            })
            .map((banner) => (
            <div key={banner.id} className={`banner-card ${banner.isActive ? 'active' : 'inactive'}`}>
              <div className="banner-status-toggle">
                <button 
                  onClick={() => toggleBannerStatus(banner.id, banner.isActive)}
                  className={`status-toggle-btn ${banner.isActive ? 'active' : 'inactive'}`}
                  title={`Click to ${banner.isActive ? 'deactivate' : 'activate'} this banner`}
                >
                  {banner.isActive ? '✓ Active' : '✗ Inactive'}
                </button>
              </div>
              <div className="banner-image">
                {banner.url ? (
                  <img src={banner.url} alt={banner.title || banner.id} onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x150?text=Banner+Image';
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
                  {banner.creationTimestamp && (
                    <span className="banner-date" title={new Date(banner.creationTimestamp).toLocaleString()}>
                      📅 {formatBannerDate(banner.creationTimestamp)}
                    </span>
                  )}
                </div>
                {banner.clickRedirectUrl && (
                  <a 
                    href={banner.clickRedirectUrl.startsWith('http://') || banner.clickRedirectUrl.startsWith('https://') 
                      ? banner.clickRedirectUrl 
                      : `https://${banner.clickRedirectUrl}`} 
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

export default BannersPage;
