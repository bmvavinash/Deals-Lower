import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Banners.css';
import BannerCarousel from '../components/Deals/BannerCarousel';

const API_BASE_URL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.')) ? '/api' : 'https://dealsoptimised.onrender.com/api';

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

const Banners = ({ defaultTab = 'banners' }) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.pathname === '/promo-tiles' || new URLSearchParams(location.search).get('tab') === 'tiles' ? 'tiles' : defaultTab
  );
  const [promoCardsSource, setPromoCardsSource] = useState('Firebase RTDB');
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
  const [selectedBannerId, setSelectedBannerId] = useState(null);

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
  const [formOriginalUrl, setFormOriginalUrl] = useState('');
  const [isGeneratingAffUrl, setIsGeneratingAffUrl] = useState(false);
  const [useCacheLive, setUseCacheLive] = useState(false);
  const [formCarouselType, setFormCarouselType] = useState('none');
  const [formCarouselValue, setFormCarouselValue] = useState('');

  // Sale Scraper states
  const [scraperSaleName, setScraperSaleName] = useState('');
  const [scraperPlatform, setScraperPlatform] = useState('amazon');
  const [scraperCategory, setScraperCategory] = useState('general');
  const [scraperUrls, setScraperUrls] = useState('');
  const [scraperStatusText, setScraperStatusText] = useState(null);
  const [activeScraperTask, setActiveScraperTask] = useState(null);

  // Amazon Promotional Cards states
  const [scrapingPromoCards, setScrapingPromoCards] = useState(false);
  const [promoCardStatus, setPromoCardStatus] = useState(null);
  const [promoCardsCount, setPromoCardsCount] = useState(null);
  const [promoCardsList, setPromoCardsList] = useState([]);
  const [showPromoCardsModal, setShowPromoCardsModal] = useState(false);
  const [timerModalCard, setTimerModalCard] = useState(null);
  const [timerPreset, setTimerPreset] = useState('60');
  const [timerCustomDateTime, setTimerCustomDateTime] = useState('');
  const [timerActionLoading, setTimerActionLoading] = useState(false);
  const [timerMode, setTimerMode] = useState('countdown'); // 'countdown' | 'daily' | 'schedule'
  const [timerStartsAt, setTimerStartsAt] = useState('');
  const [timerExpiresAt, setTimerExpiresAt] = useState('');
  const [dailyWindowEnabled, setDailyWindowEnabled] = useState(false);
  const [dailyStartHour, setDailyStartHour] = useState(20);
  const [dailyEndHour, setDailyEndHour] = useState(24);
  const [timerShowCountdown, setTimerShowCountdown] = useState(true);
  const [timerPriceBadge, setTimerPriceBadge] = useState('');

  // Global Timed Slots Configuration
  const [timedSlots, setTimedSlots] = useState({
    amazon: [
      { slot: '3pm', label: '3 PM Picks', startHour: 15, endHour: 18, enabled: true },
      { slot: '8pm', label: '8 PM Deals', startHour: 20, endHour: 24, enabled: true }
    ],
    flipkart: [
      { slot: '5pm', label: '5 PM Deals', startHour: 17, endHour: 20, enabled: true },
      { slot: '9pm', label: '9 PM Deals', startHour: 21, endHour: 24, enabled: true }
    ]
  });
  const [showTimedSlots, setShowTimedSlots] = useState(false);
  const [savingTimedSlots, setSavingTimedSlots] = useState(false);

  // Edit Tile Card Details State
  const [editTileCard, setEditTileCard] = useState(null);
  const [editTileForm, setEditTileForm] = useState({
    title: '',
    priceBadge: '',
    tagline: '',
    category: '',
    clickRedirectUrl: '',
    imageUrl: '',
    isActive: true
  });
  const [editTileSaving, setEditTileSaving] = useState(false);

  // Full-Height Detail Lightbox Modal State & Keyboard Navigation
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);

  // Keyboard arrow navigation (ArrowLeft, ArrowRight, Escape) for Tile Detail Modal
  useEffect(() => {
    if (selectedTileIndex === null) return;

    const handleKeyDown = (e) => {
      // Don't intercept when user is typing in form inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedTileIndex(prev => {
          if (prev === null || promoCardsList.length === 0) return null;
          return prev > 0 ? prev - 1 : promoCardsList.length - 1;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedTileIndex(prev => {
          if (prev === null || promoCardsList.length === 0) return null;
          return prev < promoCardsList.length - 1 ? prev + 1 : 0;
        });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedTileIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTileIndex, promoCardsList.length]);

  useEffect(() => {
    fetchBannerSource();
    fetchStats();
    checkActiveTask();
    triggerBanners(); // Automatically fetch and display banners on mount
    fetchPromoCards(); // Fetch promotional cards on mount
    fetchTimedSlots(); // Fetch platform timed slots
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

  const fetchPromoCards = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/promo-cards?includeExpired=true`);
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setPromoCardsList(result.data);
        setPromoCardsCount(result.data.filter(c => c.isActive !== false && !c.isExpired).length);
        if (result.source) {
          setPromoCardsSource(result.source === 'firebase' ? 'Firebase RTDB' : 'Local JSON File');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch promotional cards:', err);
    }
  };

  const fetchTimedSlots = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/banners/timed-slots`);
      const data = await res.json();
      if (data && data.success && data.data) {
        setTimedSlots(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch timed slots:', err);
    }
  };

  const handleSaveTimedSlots = async () => {
    setSavingTimedSlots(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/banners/timed-slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timedSlots)
      });
      const data = await res.json();
      if (data.success) {
        setPromoCardStatus('✅ Event timed slots updated and applied successfully');
        setTimeout(() => setPromoCardStatus(null), 4000);
        await fetchPromoCards();
      } else {
        alert(data.error || 'Failed to save timed slots');
      }
    } catch (err) {
      alert(`Error saving timed slots: ${err.message}`);
    } finally {
      setSavingTimedSlots(false);
    }
  };

  const openTimerModal = (card) => {
    setTimerModalCard(card);
    setTimerPreset('60');
    setTimerPriceBadge(card.priceBadge || '');
    setTimerShowCountdown(card.showCountdown !== false);

    if (card.dailyWindow && card.dailyWindow.enabled) {
      setTimerMode('daily');
      setDailyWindowEnabled(true);
      setDailyStartHour(card.dailyWindow.startHour ?? 20);
      setDailyEndHour(card.dailyWindow.endHour ?? 24);
    } else if (card.startsAt || (card.expiresAt && !card.durationMinutes)) {
      setTimerMode('schedule');
      setDailyWindowEnabled(false);
    } else {
      setTimerMode('countdown');
      setDailyWindowEnabled(false);
    }

    if (card.startsAt) {
      const d = new Date(card.startsAt);
      const localISO = (new Date(d.getTime() - d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      setTimerStartsAt(localISO);
    } else {
      setTimerStartsAt('');
    }

    if (card.expiresAt) {
      const d = new Date(card.expiresAt);
      const localISO = (new Date(d.getTime() - d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      setTimerExpiresAt(localISO);
      setTimerCustomDateTime(localISO);
    } else {
      const d = new Date(Date.now() + 2 * 3600000);
      const localISO = (new Date(d.getTime() - d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      setTimerExpiresAt(localISO);
      setTimerCustomDateTime(localISO);
    }
  };

  const handleApplyTimer = async (actionType = 'set') => {
    if (!timerModalCard) return;
    setTimerActionLoading(true);
    try {
      let body = {};
      if (actionType === 'expire') {
        body = { action: 'expire' };
      } else if (actionType === 'clear') {
        body = { action: 'clear' };
      } else {
        body.showCountdown = timerShowCountdown;
        if (timerPriceBadge) body.priceBadge = timerPriceBadge;

        if (timerMode === 'daily') {
          body.dailyWindow = {
            enabled: true,
            startHour: Number(dailyStartHour),
            endHour: Number(dailyEndHour)
          };
          delete body.expiresAt;
        } else if (timerMode === 'schedule') {
          if (!timerExpiresAt) {
            alert('Please choose an End Date & Time');
            setTimerActionLoading(false);
            return;
          }
          if (timerStartsAt) {
            body.startsAt = new Date(timerStartsAt).toISOString();
          } else {
            body.startsAt = null;
          }
          body.expiresAt = new Date(timerExpiresAt).toISOString();
          body.dailyWindow = { enabled: false };
        } else {
          // countdown mode
          if (timerPreset === 'custom') {
            if (!timerCustomDateTime) {
              alert('Please select a valid date/time');
              setTimerActionLoading(false);
              return;
            }
            body.expiresAt = new Date(timerCustomDateTime).toISOString();
          } else if (timerPreset === 'tonight') {
            const tonight = new Date();
            tonight.setHours(23, 59, 59, 999);
            body.expiresAt = tonight.toISOString();
          } else {
            body.durationMinutes = Number(timerPreset);
          }
          body.dailyWindow = { enabled: false };
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/banners/promo-cards/${timerModalCard.id}/timer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (result.success) {
        setPromoCardStatus(`✅ ${result.message}`);
        setTimeout(() => setPromoCardStatus(null), 4000);
        await fetchPromoCards();
        setTimerModalCard(null);
      } else {
        alert(result.error || 'Failed to update timer');
      }
    } catch (err) {
      alert(`Error updating timer: ${err.message}`);
    } finally {
      setTimerActionLoading(false);
    }
  };

  const openEditTileModal = (card) => {
    setEditTileCard(card);
    setEditTileForm({
      title: card.title || '',
      priceBadge: card.priceBadge || '',
      tagline: card.tagline || '',
      category: card.category || 'Festive Deals',
      clickRedirectUrl: card.clickRedirectUrl || '',
      imageUrl: card.imageUrl || '',
      isActive: card.isActive !== false && !card.isExpired
    });
  };

  const handleSaveTileEdit = async (e) => {
    e.preventDefault();
    if (!editTileCard) return;
    setEditTileSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/banners/promo-cards/${editTileCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTileForm)
      });
      const data = await res.json();
      if (data.success) {
        setPromoCardStatus(`✅ Tile #${editTileCard.id} details saved!`);
        setTimeout(() => setPromoCardStatus(null), 4000);
        await fetchPromoCards();
        setEditTileCard(null);
      } else {
        alert(data.error || 'Failed to update tile');
      }
    } catch (err) {
      alert('Error updating tile: ' + err.message);
    } finally {
      setEditTileSaving(false);
    }
  };

  const handleQuickToggleTile = async (card) => {
    try {
      const isCurrentlyActive = card.isActive !== false && !card.isExpired;
      const action = isCurrentlyActive ? 'expire' : 'clear';
      const response = await fetch(`${API_BASE_URL}/api/banners/promo-cards/${card.id}/timer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const result = await response.json();
      if (result.success) {
        setPromoCardStatus(`✅ ${isCurrentlyActive ? 'Expired & hidden tile' : 'Reactivated tile'}: #${card.id}`);
        setTimeout(() => setPromoCardStatus(null), 4000);
        await fetchPromoCards();
      }
    } catch (err) {
      console.error('Quick toggle error:', err);
    }
  };

  const formatAdminTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      return `${Math.floor(hours / 24)}d ${hours % 24}h remaining`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const handleTriggerPromoCardsScrape = async () => {
    setScrapingPromoCards(true);
    setPromoCardStatus('⏳ Triggering Amazon Promotional Cards Scraper...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/promo-cards/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (result.success) {
        setPromoCardStatus('🚀 Scraper initiated in background! Fetching 15+ Amazon festival promotional cards...');
        // Refresh cards list after scraper runs
        setTimeout(async () => {
          await fetchPromoCards();
          setPromoCardStatus(`✅ Amazon promotional cards successfully updated! (${promoCardsCount || 21} cards available)`);
          setTimeout(() => setPromoCardStatus(null), 5000);
        }, 4000);
      } else {
        setPromoCardStatus(`❌ Scrape error: ${result.error || 'Failed to trigger scraper'}`);
        setTimeout(() => setPromoCardStatus(null), 5000);
      }
    } catch (err) {
      setPromoCardStatus(`❌ Request failed: ${err.message}`);
      setTimeout(() => setPromoCardStatus(null), 5000);
    } finally {
      setTimeout(() => setScrapingPromoCards(false), 2000);
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
          originalUrl: formOriginalUrl,
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
        if (selectedBannerId) {
          setBanners(prev => prev.map(b => b.id === selectedBannerId ? result.data : b));
          fetchStats();
          setTimeout(() => setFormStatus(null), 3000);
        } else {
          // Clear form and refresh if adding/editing from bottom card
          handleCancelEdit();
          triggerBanners();
        }
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
    setFormOriginalUrl(banner.originalUrl || banner.orig || '');
    setFormPlatform(banner.platform || 'custom');
    setFormCategory(banner.category || 'general');
    setFormTitle(banner.title || '');
    setFormDescription(banner.description || '');
    setFormIsActive(banner.isActive === true);
    setFormOrder(String(banner.order || 0));
    if(banner.carouselConfig) {
      setFormCarouselType(banner.carouselConfig.type || 'none');
      setFormCarouselValue(banner.carouselConfig.value || '');
    } else {
      setFormCarouselType('none');
      setFormCarouselValue('');
    }
    setFormStatus(null);
  };
 
  const handleCancelEdit = () => {
    setEditingBannerId(null);
    setFormUrl('');
    setFormClickRedirectUrl('');
    setFormOriginalUrl('');
    setFormPlatform('custom');
    setFormCategory('general');
    setFormTitle('');
    setFormDescription('');
    setFormIsActive(true);
    setFormOrder('0');
    setFormCarouselType('none');
    setFormCarouselValue('');
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

  const handleAutoGenerateAffiliateLink = async () => {
    const targetUrl = formOriginalUrl || formClickRedirectUrl;
    if (!targetUrl || !targetUrl.trim()) {
      setFormStatus('❌ Enter a target Original URL first.');
      return;
    }

    setIsGeneratingAffUrl(true);
    setFormStatus('⏳ Generating Extrape Affiliate Link via Selenium...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/generate-affiliate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      const result = await response.json();
      if (response.ok && result.success && result.affiliateUrl) {
        setFormClickRedirectUrl(result.affiliateUrl);
        setFormStatus('✅ Affiliate link generated successfully.');
        setTimeout(() => setFormStatus(null), 3000);
      } else {
        setFormStatus(`❌ Conversion failed: ${result.error || 'Server error'}`);
      }
    } catch (err) {
      setFormStatus(`❌ Connection Error: ${err.message}`);
    } finally {
      setIsGeneratingAffUrl(false);
    }
  };

  // Derived state: Filtered Banners list sorted by status & timestamp
  const filteredBanners = [...banners]
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

      const getTs = (banner) => {
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
    });

  const selectedBanner = filteredBanners.find(b => b.id === selectedBannerId);
  const activeIndex = selectedBannerId ? filteredBanners.findIndex(b => b.id === selectedBannerId) : -1;

  // Initialize edit form with selected banner details
  useEffect(() => {
    if (selectedBannerId && selectedBanner) {
      handleEditBannerClick(selectedBanner);
    } else if (!selectedBannerId) {
      handleCancelEdit();
    }
  }, [selectedBannerId, selectedBanner]);

  // Adjust selection if current banner gets filtered out
  useEffect(() => {
    if (selectedBannerId) {
      const exists = filteredBanners.some(b => b.id === selectedBannerId);
      if (!exists) {
        if (filteredBanners.length > 0) {
          setSelectedBannerId(filteredBanners[0].id);
        } else {
          setSelectedBannerId(null);
        }
      }
    }
  }, [filter, banners, selectedBannerId, filteredBanners]);

  const handlePrevBanner = () => {
    if (filteredBanners.length <= 1 || activeIndex === -1) return;
    const prevIndex = (activeIndex - 1 + filteredBanners.length) % filteredBanners.length;
    setSelectedBannerId(filteredBanners[prevIndex].id);
  };

  const handleNextBanner = () => {
    if (filteredBanners.length <= 1 || activeIndex === -1) return;
    const nextIndex = (activeIndex + 1) % filteredBanners.length;
    setSelectedBannerId(filteredBanners[nextIndex].id);
  };

  if (selectedBanner) {
    return (
      <div className="banners-edit-page-view">
        <div className="maximized-header">
          <h2>🖼️ Banner Workspace (Big Screen Preview)</h2>
          <div className="maximized-header-actions">
            <div className="maximized-filters">
              <span className="filter-label">Filter navigation:</span>
              <select 
                value={filter.platform} 
                onChange={(e) => setFilter({ ...filter, platform: e.target.value })}
              >
                <option value="all">All Platforms</option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="myntra">Myntra</option>
                <option value="ajio">Ajio</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={filter.activeOnly}
                  onChange={(e) => setFilter({ ...filter, activeOnly: e.target.checked })}
                />
                Active Only
              </label>
            </div>
            <button 
              onClick={() => setSelectedBannerId(null)}
              className="close-maximized-btn"
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              ← Back to Banners List
            </button>
          </div>
        </div>
        
        <div className="maximized-content">
          <div className="preview-pane">
            {filteredBanners.length > 1 && (
              <button 
                onClick={handlePrevBanner}
                className="nav-arrow left"
                title="Previous Banner"
              >
                ‹
              </button>
            )}
            
            
            <div style={{ padding: '20px', width: '100%', overflow: 'hidden' }}>
              <BannerCarousel banner={selectedBanner} />
              
              <div style={{ marginTop: '20px' }}>
                <button 
                  onClick={async () => {
                    const res = await fetch(`${API_BASE_URL}/api/banners/with-deals`);
                    const data = await res.json();
                    if(data.success) {
                      const updated = data.data.find(b => b.id === selectedBanner.id);
                      if(updated) {
                         alert('Test API fetched deals successfully! Deals found: ' + (updated.carouselDeals ? updated.carouselDeals.length : 0));
                         // We could set selectedBanner.carouselDeals to update the UI
                      }
                    }
                  }}
                  style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Test Fetch API Carousel Deals
                </button>
              </div>
            </div>
            
            <div className="preview-image-container" style={{ display: 'none' }}>

              {selectedBanner.url ? (
                <img 
                  src={selectedBanner.url} 
                  alt={selectedBanner.title || selectedBanner.id} 
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/600x300?text=Banner+Image';
                  }}
                />
              ) : (
                <div className="banner-placeholder">No Image</div>
              )}
            </div>

            {filteredBanners.length > 1 && (
              <button 
                onClick={handleNextBanner}
                className="nav-arrow right"
                title="Next Banner"
              >
                ›
              </button>
            )}
          </div>
          
          <div className="details-pane">
            <h3>📝 Edit Banner Details</h3>
            <form onSubmit={handleSaveBanner} className="edit-form">
              <div className="form-group">
                <label>Banner ID (Read-only)</label>
                <input type="text" value={selectedBanner.id} disabled style={{ opacity: 0.6, background: '#2a2a2a' }} />
              </div>
              
              <div className="form-group">
                <label>Title</label>
                <input 
                  type="text" 
                  value={formTitle} 
                  onChange={(e) => setFormTitle(e.target.value)} 
                  placeholder="Enter banner title"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={formDescription} 
                  onChange={(e) => setFormDescription(e.target.value)} 
                  placeholder="Enter banner description"
                />
              </div>
              
              <div className="form-group">
                <label>Image URL</label>
                <input 
                  type="text" 
                  value={formUrl} 
                  onChange={(e) => setFormUrl(e.target.value)} 
                  placeholder="Enter image URL"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Original URL (Target Merchant Page)</label>
                <input 
                  type="text" 
                  value={formOriginalUrl} 
                  onChange={(e) => setFormOriginalUrl(e.target.value)} 
                  placeholder="e.g. https://www.flipkart.com/washing-machines-store"
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Click Redirect URL (Affiliate Link)</span>
                  <button
                    type="button"
                    onClick={handleAutoGenerateAffiliateLink}
                    disabled={isGeneratingAffUrl}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {isGeneratingAffUrl ? '⏳ Generating...' : '⚡ Auto Generate Affiliate Link'}
                  </button>
                </label>
                <input 
                  type="text" 
                  value={formClickRedirectUrl} 
                  onChange={(e) => setFormClickRedirectUrl(e.target.value)} 
                  placeholder="Enter destination URL"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Platform</label>
                <select 
                  value={formPlatform} 
                  onChange={(e) => setFormPlatform(e.target.value)}
                >
                  <option value="custom">Custom Platform</option>
                  <option value="amazon">Amazon</option>
                  <option value="flipkart">Flipkart</option>
                  <option value="myntra">Myntra</option>
                  <option value="ajio">Ajio</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <input 
                  type="text" 
                  value={formCategory} 
                  onChange={(e) => setFormCategory(e.target.value)} 
                  placeholder="Enter category name"
                />
              </div>
              
              
              <div className="form-group">
                <label>Carousel Configuration (Deals Overlay)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={formCarouselType} onChange={(e) => setFormCarouselType(e.target.value)}>
                    <option value="none">No Carousel</option>
                    <option value="category">Fetch by Category</option>
                    <option value="platform">Fetch by Platform</option>
                    <option value="search">Fetch by Search Term</option>
                  </select>
                  {formCarouselType !== 'none' && (
                    <input 
                      type="text" 
                      value={formCarouselValue} 
                      onChange={(e) => setFormCarouselValue(e.target.value)} 
                      placeholder="Enter category / platform / term" 
                      style={{ flex: 1 }}
                    />
                  )}
                </div>
              </div>

              <div className="form-group form-group-checkbox">
                <input type="checkbox" id="formIsActive"
                  checked={formIsActive} 
                  onChange={(e) => setFormIsActive(e.target.checked)} 
                />
                <label htmlFor="formIsActive" style={{ color: '#fff', fontSize: '14px' }}>Is Active (Visible on site)</label>
              </div>
              
              <div className="form-actions">
                {formStatus && (
                  <span style={{ 
                    color: formStatus.startsWith('✅') ? '#28a745' : '#ef4444', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginRight: 'auto',
                    fontSize: '13px'
                  }}>
                    {formStatus}
                  </span>
                )}
                <button 
                  type="button" 
                  onClick={() => setSelectedBannerId(null)}
                  className="cancel-btn"
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  className="save-btn"
                >
                  💾 Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="banners">
      {/* Top View Navigation: Separate Campaign Banners vs Amazon Promo Tiles */}
      <div className="banners-view-tab-bar">
        <button 
          type="button" 
          className={`view-tab-btn ${activeTab === 'banners' ? 'active' : ''}`}
          onClick={() => setActiveTab('banners')}
        >
          🖼️ Campaign Banners
        </button>
        <button 
          type="button" 
          className={`view-tab-btn ${activeTab === 'tiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('tiles')}
        >
          🎯 Amazon Promo Tiles ({promoCardsList.length || 0})
        </button>
      </div>

      {activeTab === 'tiles' ? (
        <div className="promo-tiles-full-view">
          <div className="promo-tiles-page-header">
            <div className="promo-tiles-title-area">
              <h2>🎯 Amazon Promotional Carousel Tiles</h2>
              <p>
                Scrapes live promotional banner cards from the Amazon India festival carousel (<code>#gwm-window</code>).
                Stored in <strong>{promoCardsSource || 'Firebase RTDB'}</strong> and rendered in the Storefront (2nd row below hero banners) with dynamic affiliate tagging.
              </p>
            </div>
            <div className="promo-tiles-header-actions">
              <button 
                type="button"
                className="action-btn promo-scrape-action-btn primary-scrape-btn"
                onClick={handleTriggerPromoCardsScrape}
                disabled={scrapingPromoCards}
                title="Go to Amazon and scrape all promotional cards"
              >
                {scrapingPromoCards ? '⏳ Scraping in progress...' : '🚀 Scrape Amazon Promo Tiles'}
              </button>
              <button 
                type="button"
                className="action-btn promo-refresh-btn"
                onClick={fetchPromoCards}
                title="Refresh cards from database"
              >
                🔄 Refresh from DB
              </button>
              <a 
                href="http://localhost:3000/?ref=ramtechtelugu" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="action-btn promo-view-storefront-btn"
                title="Open storefront on port 3000 to see live cards"
              >
                👁️ View Storefront Carousel (Port 3000) ↗
              </a>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="promo-tiles-stats-bar">
            <div className="promo-stat-pill">
              <span className="stat-label">Total Tiles:</span>
              <strong className="stat-value">{promoCardsList.length}</strong>
            </div>
            <div className="promo-stat-pill">
              <span className="stat-label">DB Source:</span>
              <strong className="stat-value source-highlight">{promoCardsSource || 'Firebase RTDB'}</strong>
            </div>
            <div className="promo-stat-pill">
              <span className="stat-label">Target Page:</span>
              <strong className="stat-value">amazon.in (#gwm-window)</strong>
            </div>
            <div className="promo-stat-pill">
              <span className="stat-label">Affiliate Support:</span>
              <strong className="stat-value success-highlight">Dynamic (?ref=...)</strong>
            </div>
          </div>

          {/* Status Alert */}
          {promoCardStatus && (
            <div className={`promo-cards-status-alert ${promoCardStatus.includes('❌') ? 'error' : 'success'}`}>
              <span>{promoCardStatus}</span>
            </div>
          )}

          {/* Global Timed Slots Configuration Panel */}
          <div className="timed-slots-card">
            <div className="timed-slots-header" onClick={() => setShowTimedSlots(!showTimedSlots)}>
              <div className="slots-title-wrap">
                <span className="slots-icon">⚙️</span>
                <div>
                  <h4>Global Event Timed Slots (Amazon & Flipkart)</h4>
                  <p>Configure automatic daily active windows (e.g. 8 PM Deals, 3 PM Handpicked, 5 PM, 9 PM)</p>
                </div>
              </div>
              <button type="button" className="slots-toggle-btn">
                {showTimedSlots ? '▲ Hide Schedule' : '▼ Configure Event Slots'}
              </button>
            </div>

            {showTimedSlots && (
              <div className="timed-slots-body">
                <div className="slots-platform-group">
                  <h5>Amazon Events</h5>
                  <div className="slots-grid">
                    {timedSlots.amazon && timedSlots.amazon.map((slot, idx) => (
                      <div key={slot.slot || idx} className="slot-config-item">
                        <div className="slot-header">
                          <label className="slot-toggle-label">
                            <input 
                              type="checkbox" 
                              checked={slot.enabled !== false}
                              onChange={(e) => {
                                const copy = { ...timedSlots };
                                copy.amazon[idx].enabled = e.target.checked;
                                setTimedSlots(copy);
                              }}
                            />
                            <strong>{slot.label || slot.slot}</strong>
                          </label>
                          <span className="slot-badge">#{slot.slot}</span>
                        </div>
                        <div className="slot-hours-row">
                          <div>
                            <span className="hour-label">Start (IST):</span>
                            <input 
                              type="number" 
                              min="0" 
                              max="23" 
                              value={slot.startHour ?? 0}
                              onChange={(e) => {
                                const copy = { ...timedSlots };
                                copy.amazon[idx].startHour = Number(e.target.value);
                                setTimedSlots(copy);
                              }}
                            />
                            <span className="hour-desc">{slot.startHour}:00</span>
                          </div>
                          <div>
                            <span className="hour-label">End (IST):</span>
                            <input 
                              type="number" 
                              min="1" 
                              max="24" 
                              value={slot.endHour ?? 24}
                              onChange={(e) => {
                                const copy = { ...timedSlots };
                                copy.amazon[idx].endHour = Number(e.target.value);
                                setTimedSlots(copy);
                              }}
                            />
                            <span className="hour-desc">{slot.endHour === 24 ? 'Midnight (24:00)' : `${slot.endHour}:00`}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="slots-platform-group">
                  <h5>Flipkart Events</h5>
                  <div className="slots-grid">
                    {timedSlots.flipkart && timedSlots.flipkart.map((slot, idx) => (
                      <div key={slot.slot || idx} className="slot-config-item">
                        <div className="slot-header">
                          <label className="slot-toggle-label">
                            <input 
                              type="checkbox" 
                              checked={slot.enabled !== false}
                              onChange={(e) => {
                                const copy = { ...timedSlots };
                                copy.flipkart[idx].enabled = e.target.checked;
                                setTimedSlots(copy);
                              }}
                            />
                            <strong>{slot.label || slot.slot}</strong>
                          </label>
                          <span className="slot-badge">#{slot.slot}</span>
                        </div>
                        <div className="slot-hours-row">
                          <div>
                            <span className="hour-label">Start (IST):</span>
                            <input 
                              type="number" 
                              min="0" 
                              max="23" 
                              value={slot.startHour ?? 0}
                              onChange={(e) => {
                                const copy = { ...timedSlots };
                                copy.flipkart[idx].startHour = Number(e.target.value);
                                setTimedSlots(copy);
                              }}
                            />
                            <span className="hour-desc">{slot.startHour}:00</span>
                          </div>
                          <div>
                            <span className="hour-label">End (IST):</span>
                            <input 
                              type="number" 
                              min="1" 
                              max="24" 
                              value={slot.endHour ?? 24}
                              onChange={(e) => {
                                const copy = { ...timedSlots };
                                copy.flipkart[idx].endHour = Number(e.target.value);
                                setTimedSlots(copy);
                              }}
                            />
                            <span className="hour-desc">{slot.endHour === 24 ? 'Midnight (24:00)' : `${slot.endHour}:00`}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="slots-save-row">
                  <button 
                    type="button" 
                    className="save-slots-btn"
                    disabled={savingTimedSlots}
                    onClick={handleSaveTimedSlots}
                  >
                    {savingTimedSlots ? 'Saving Schedule...' : '💾 Save Event Slots Schedule'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tiles Grid Gallery */}
          <div className="promo-tiles-gallery-container">
            <h3>Scraped Carousel Tiles ({promoCardsList.length} Available)</h3>
            <div className="promo-tiles-gallery-grid">
              {promoCardsList.map((card, idx) => {
                const isCardDead = card.isActive === false || card.isExpired;
                return (
                  <div 
                    key={card.id || idx} 
                    className={`promo-tile-full-card ${isCardDead ? 'card-expired' : ''}`}
                    onClick={() => setSelectedTileIndex(idx)}
                    title="Click to view full height details and navigate with keyboard arrows"
                  >
                    <div className="promo-tile-thumb-wrap">
                      <img 
                        src={card.imageUrl} 
                        alt={card.title} 
                        onError={(e) => { e.target.src = '/banners/card_scraped_kitchen.png'; }} 
                      />
                      {card.priceBadge && <span className="promo-tile-badge">{card.priceBadge}</span>}
                      {card.imageUrl?.endsWith('.gif') && <span className="promo-tile-gif-badge">ANIMATED GIF</span>}
                      {isCardDead ? (
                        <span className="promo-tile-countdown-badge expired">⏰ Expired (Hidden)</span>
                      ) : card.dailyWindow && card.dailyWindow.enabled ? (
                        <span className="promo-tile-countdown-badge timed">🔁 Daily {card.dailyWindow.startHour}:00 - {card.dailyWindow.endHour}:00 IST</span>
                      ) : card.startsAt && new Date(card.startsAt).getTime() > Date.now() ? (
                        <span className="promo-tile-countdown-badge timed">⏳ Starts in {formatAdminTimeRemaining(card.startsAt)}</span>
                      ) : card.expiresAt ? (
                        <span className="promo-tile-countdown-badge timed">⏳ {formatAdminTimeRemaining(card.expiresAt)}</span>
                      ) : (
                        <span className="promo-tile-countdown-badge active">🟢 Live Always</span>
                      )}
                    </div>
                    <div className="promo-tile-body">
                      <div className="promo-tile-meta">
                        <span className="promo-tile-category">{card.category || 'Festive Deals'}</span>
                        <span className="promo-tile-id">#{card.id}</span>
                      </div>
                      <h4 className="promo-tile-title" title={card.title}>{card.title}</h4>
                      {card.tagline && <p className="promo-tile-tagline">{card.tagline}</p>}
                      {card.disabledReason && <p className="promo-tile-reason">Reason: {card.disabledReason}</p>}
                      <div className="promo-tile-footer">
                        <a 
                          href={card.clickRedirectUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="promo-tile-open-btn"
                          title={card.clickRedirectUrl}
                          onClick={e => e.stopPropagation()}
                        >
                          🔗 Amazon ↗
                        </a>
                        <div className="promo-tile-actions">
                          <button
                            type="button"
                            className="promo-tile-btn timer-btn"
                            onClick={(e) => { e.stopPropagation(); openTimerModal(card); }}
                            title="Set or modify expiration timer and schedule"
                          >
                            ⏱️ Timing
                          </button>
                          <button
                            type="button"
                            className="promo-tile-btn edit-btn"
                            onClick={(e) => { e.stopPropagation(); openEditTileModal(card); }}
                            title="Edit tile title, badge, links and media"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className={`promo-tile-btn toggle-btn ${!isCardDead ? 'expire' : 'activate'}`}
                            onClick={(e) => { e.stopPropagation(); handleQuickToggleTile(card); }}
                            title={!isCardDead ? 'Expire and hide tile from storefront' : 'Reactivate tile'}
                          >
                            {!isCardDead ? '⚡ Expire' : '🔄 Reactivate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Promotional Tile Full-Height Detail Lightbox Modal with Keyboard Navigation */}
          {selectedTileIndex !== null && promoCardsList[selectedTileIndex] && (() => {
            const currentTile = promoCardsList[selectedTileIndex];
            const isTileDead = currentTile.isActive === false || currentTile.isExpired;

            return (
              <div 
                className="promo-tile-detail-modal-overlay" 
                onClick={() => setSelectedTileIndex(null)}
              >
                <div 
                  className="promo-tile-detail-modal-container" 
                  onClick={e => e.stopPropagation()}
                >
                  {/* Left / Prev Navigation Arrow */}
                  <button
                    type="button"
                    className="promo-tile-lightbox-nav prev"
                    onClick={() => setSelectedTileIndex(prev => prev > 0 ? prev - 1 : promoCardsList.length - 1)}
                    title="Previous Tile (Left Arrow ←)"
                    aria-label="Previous Tile"
                  >
                    &#10094;
                  </button>

                  {/* Modal Content Box */}
                  <div className="promo-tile-detail-content">
                    {/* Header */}
                    <div className="promo-tile-detail-header">
                      <div className="header-meta">
                        <span className="tile-counter-badge">
                          Tile {selectedTileIndex + 1} of {promoCardsList.length}
                        </span>
                        <span className="tile-category-pill">{currentTile.category || 'Festive Deals'}</span>
                        <span className="tile-id-pill">#{currentTile.id}</span>
                      </div>
                      <button 
                        type="button" 
                        className="promo-tile-detail-close" 
                        onClick={() => setSelectedTileIndex(null)}
                        title="Close (Esc)"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 2-Column Body */}
                    <div className="promo-tile-detail-body">
                      {/* Left Column: Full-Height Poster Media */}
                      <div className="promo-tile-detail-media-pane">
                        <div className="promo-tile-detail-image-box">
                          <img 
                            src={currentTile.imageUrl} 
                            alt={currentTile.title} 
                            onError={(e) => { e.target.src = '/banners/card_scraped_kitchen.png'; }} 
                          />
                          {currentTile.priceBadge && (
                            <span className="detail-price-badge">{currentTile.priceBadge}</span>
                          )}
                          {currentTile.imageUrl?.endsWith('.gif') && (
                            <span className="detail-gif-badge">ANIMATED GIF</span>
                          )}
                        </div>
                      </div>

                      {/* Right Column: All Details & Timings */}
                      <div className="promo-tile-detail-info-pane">
                        <h2 className="detail-title">{currentTile.title}</h2>
                        {currentTile.tagline && (
                          <p className="detail-tagline">{currentTile.tagline}</p>
                        )}

                        {/* Status & Timing Box */}
                        <div className="detail-status-card">
                          <div className="status-row">
                            <span className="label">Live Status:</span>
                            {isTileDead ? (
                              <span className="status-badge expired">⏰ Expired / Inactive (Hidden from Storefront)</span>
                            ) : currentTile.dailyWindow && currentTile.dailyWindow.enabled ? (
                              <span className="status-badge timed">🔁 Daily Recurring ({currentTile.dailyWindow.startHour}:00 - {currentTile.dailyWindow.endHour}:00 IST)</span>
                            ) : currentTile.startsAt && new Date(currentTile.startsAt).getTime() > Date.now() ? (
                              <span className="status-badge timed">⏳ Scheduled: Starts in {formatAdminTimeRemaining(currentTile.startsAt)}</span>
                            ) : currentTile.expiresAt ? (
                              <span className="status-badge timed">⏳ Active: Ends in {formatAdminTimeRemaining(currentTile.expiresAt)}</span>
                            ) : (
                              <span className="status-badge active">🟢 Live Always (No Expiration)</span>
                            )}
                          </div>

                          {currentTile.dailyWindow && currentTile.dailyWindow.enabled && (
                            <div className="status-row">
                              <span className="label">Daily Window:</span>
                              <span className="value-text">{currentTile.dailyWindow.startHour}:00 to {currentTile.dailyWindow.endHour}:00 IST ({currentTile.dailyWindow.label || 'Active Daily'})</span>
                            </div>
                          )}

                          {currentTile.expiresAt && (
                            <div className="status-row">
                              <span className="label">Expires At:</span>
                              <span className="value-code">{new Date(currentTile.expiresAt).toLocaleString()}</span>
                            </div>
                          )}

                          {currentTile.priceBadge && (
                            <div className="status-row">
                              <span className="label">Price Badge:</span>
                              <span className="value-highlight">{currentTile.priceBadge}</span>
                            </div>
                          )}

                          {currentTile.category && (
                            <div className="status-row">
                              <span className="label">Category:</span>
                              <span className="value-text">{currentTile.category}</span>
                            </div>
                          )}
                        </div>

                        {/* Amazon Destination URL */}
                        <div className="detail-link-box">
                          <label className="link-label">Target Amazon URL:</label>
                          <div className="link-display">
                            <input 
                              type="text" 
                              readOnly 
                              value={currentTile.clickRedirectUrl || ''} 
                              onClick={e => e.target.select()}
                            />
                            <a 
                              href={currentTile.clickRedirectUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="detail-open-link-btn"
                              title="Test link directly on Amazon"
                            >
                              Open Link ↗
                            </a>
                          </div>
                        </div>

                        {/* Management Actions */}
                        <div className="detail-actions-panel">
                          <button
                            type="button"
                            className="detail-action-btn timer"
                            onClick={() => openTimerModal(currentTile)}
                          >
                            ⏱️ Configure Timings & Schedule
                          </button>
                          <button
                            type="button"
                            className="detail-action-btn edit"
                            onClick={() => openEditTileModal(currentTile)}
                          >
                            ✏️ Edit Tile Details
                          </button>
                          <button
                            type="button"
                            className={`detail-action-btn toggle ${!isTileDead ? 'expire' : 'activate'}`}
                            onClick={() => handleQuickToggleTile(currentTile)}
                          >
                            {!isTileDead ? '⚡ Expire (Hide from Store)' : '🔄 Reactivate'}
                          </button>
                        </div>

                        {/* Keyboard navigation hint */}
                        <div className="detail-keyboard-hint">
                          <span>⌨️ <strong>Arrow Keys:</strong> Press <strong>← Left</strong> or <strong>Right →</strong> to switch tiles &bull; <strong>Esc</strong> to close</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right / Next Navigation Arrow */}
                  <button
                    type="button"
                    className="promo-tile-lightbox-nav next"
                    onClick={() => setSelectedTileIndex(prev => prev < promoCardsList.length - 1 ? prev + 1 : 0)}
                    title="Next Tile (Right Arrow →)"
                    aria-label="Next Tile"
                  >
                    &#10095;
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Promotional Tile Expiration Timer & Schedule Modal */}
          {timerModalCard && (
            <div className="promo-timer-modal-overlay" onClick={() => setTimerModalCard(null)}>
              <div className="promo-timer-modal upgraded" onClick={e => e.stopPropagation()}>
                <div className="promo-timer-modal-header">
                  <h3>⏱️ Configure Tile Timings & Schedule</h3>
                  <button type="button" className="close-btn" onClick={() => setTimerModalCard(null)}>✕</button>
                </div>

                <div className="promo-timer-modal-body">
                  <div className="promo-timer-card-preview">
                    <img 
                      src={timerModalCard.imageUrl} 
                      alt={timerModalCard.title} 
                      onError={(e) => { e.target.src = '/banners/card_scraped_kitchen.png'; }} 
                    />
                    <div>
                      <strong>{timerModalCard.title}</strong>
                      <span className="card-id-text">ID: #{timerModalCard.id}</span>
                      <div className="card-current-status">
                        Current Status: {timerModalCard.isActive === false || timerModalCard.isExpired 
                          ? <span className="status-text expired">⏰ Expired (Hidden from Storefront)</span> 
                          : timerModalCard.dailyWindow && timerModalCard.dailyWindow.enabled
                            ? <span className="status-text timed">🔁 Daily {timerModalCard.dailyWindow.startHour}:00 - {timerModalCard.dailyWindow.endHour}:00 IST</span>
                            : timerModalCard.expiresAt 
                              ? <span className="status-text timed">⏳ Ends in {formatAdminTimeRemaining(timerModalCard.expiresAt)}</span>
                              : <span className="status-text active">🟢 Always Active (No Timer)</span>}
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="timing-mode-tabs">
                    <button 
                      type="button"
                      className={`timing-tab-btn ${timerMode === 'countdown' ? 'active' : ''}`}
                      onClick={() => setTimerMode('countdown')}
                    >
                      ⚡ Quick Countdown
                    </button>
                    <button 
                      type="button"
                      className={`timing-tab-btn ${timerMode === 'daily' ? 'active' : ''}`}
                      onClick={() => setTimerMode('daily')}
                    >
                      🔁 Daily Recurring Window
                    </button>
                    <button 
                      type="button"
                      className={`timing-tab-btn ${timerMode === 'schedule' ? 'active' : ''}`}
                      onClick={() => setTimerMode('schedule')}
                    >
                      📅 Specific Date/Time
                    </button>
                  </div>

                  {timerMode === 'countdown' && (
                    <div className="promo-timer-preset-group">
                      <label className="section-label">Select Countdown Duration:</label>
                      <div className="preset-buttons">
                        {[
                          { label: '⚡ 15 Mins', val: '15' },
                          { label: '⚡ 30 Mins', val: '30' },
                          { label: '⏱️ 1 Hour', val: '60' },
                          { label: '⏱️ 2 Hours', val: '120' },
                          { label: '⏱️ 4 Hours', val: '240' },
                          { label: '⏱️ 8 Hours', val: '480' },
                          { label: '🌙 Ends Tonight', val: 'tonight' },
                          { label: '📅 Custom Date/Time', val: 'custom' },
                        ].map(p => (
                          <button
                            key={p.val}
                            type="button"
                            className={`preset-btn ${timerPreset === p.val ? 'active' : ''}`}
                            onClick={() => setTimerPreset(p.val)}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {timerPreset === 'custom' && (
                        <div className="custom-datetime-wrap">
                          <label>Choose End Date & Time:</label>
                          <input 
                            type="datetime-local" 
                            value={timerCustomDateTime}
                            onChange={e => setTimerCustomDateTime(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {timerMode === 'daily' && (
                    <div className="daily-schedule-group">
                      <div className="info-banner">
                        <span className="info-icon">ℹ️</span>
                        <span>This tile will automatically appear live on LowerDeal during this daily time window, and automatically hide outside it. Perfect for recurring events like 8 PM Deals!</span>
                      </div>
                      <div className="hours-config-grid">
                        <div className="hour-input-block">
                          <label>Start Hour (IST):</label>
                          <input 
                            type="number" 
                            min="0" 
                            max="23"
                            value={dailyStartHour} 
                            onChange={e => setDailyStartHour(e.target.value)} 
                          />
                          <span className="hour-helper-text">{dailyStartHour}:00 ({dailyStartHour >= 12 ? (dailyStartHour === 12 ? '12 PM' : `${dailyStartHour - 12} PM`) : `${dailyStartHour} AM`})</span>
                        </div>
                        <div className="hour-input-block">
                          <label>End Hour (IST):</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="24"
                            value={dailyEndHour} 
                            onChange={e => setDailyEndHour(e.target.value)} 
                          />
                          <span className="hour-helper-text">{dailyEndHour === 24 ? 'Midnight (12:00 AM)' : `${dailyEndHour}:00 (${dailyEndHour >= 12 ? `${dailyEndHour - 12} PM` : `${dailyEndHour} AM`})`}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {timerMode === 'schedule' && (
                    <div className="specific-schedule-group">
                      <div className="datetime-input-row">
                        <div className="datetime-field">
                          <label>Starts At (Optional, leave blank to start immediately):</label>
                          <input 
                            type="datetime-local" 
                            value={timerStartsAt}
                            onChange={e => setTimerStartsAt(e.target.value)}
                          />
                        </div>
                        <div className="datetime-field">
                          <label>Ends At (Expiration Date & Time):</label>
                          <input 
                            type="datetime-local" 
                            value={timerExpiresAt}
                            onChange={e => setTimerExpiresAt(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="timer-extra-options">
                    <div className="extra-input-row">
                      <label>Badge Text Override (Optional):</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Live Now, Ends in 1h, Under ₹499"
                        value={timerPriceBadge}
                        onChange={e => setTimerPriceBadge(e.target.value)}
                      />
                    </div>
                    <label className="checkbox-option">
                      <input 
                        type="checkbox" 
                        checked={timerShowCountdown}
                        onChange={e => setTimerShowCountdown(e.target.checked)}
                      />
                      <span>Show live ticking countdown badge on storefront tile</span>
                    </label>
                  </div>
                </div>

                <div className="promo-timer-modal-footer">
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={timerActionLoading}
                    onClick={() => handleApplyTimer('expire')}
                    title="Immediately expire this tile and hide it from the storefront"
                  >
                    ⚡ Expire Now (Hide)
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={timerActionLoading}
                    onClick={() => handleApplyTimer('clear')}
                    title="Remove timer and keep tile always visible"
                  >
                    🟢 Clear Timer (Live Always)
                  </button>

                  <button
                    type="button"
                    className="btn-primary"
                    disabled={timerActionLoading}
                    onClick={() => handleApplyTimer('set')}
                  >
                    {timerActionLoading ? 'Saving...' : '💾 Save Timings & Schedule'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Tile Details Modal */}
          {editTileCard && (
            <div className="promo-timer-modal-overlay" onClick={() => setEditTileCard(null)}>
              <div className="promo-timer-modal upgraded" onClick={e => e.stopPropagation()}>
                <div className="promo-timer-modal-header">
                  <h3>✏️ Edit Carousel Tile #{editTileCard.id}</h3>
                  <button type="button" className="close-btn" onClick={() => setEditTileCard(null)}>✕</button>
                </div>
                <form onSubmit={handleSaveTileEdit} className="tile-edit-form">
                  <div className="promo-timer-modal-body">
                    <div className="form-group">
                      <label>Title:</label>
                      <input 
                        type="text" 
                        required
                        value={editTileForm.title}
                        onChange={e => setEditTileForm({ ...editTileForm, title: e.target.value })}
                      />
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label>Price Badge:</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Under ₹499, Live Now"
                          value={editTileForm.priceBadge}
                          onChange={e => setEditTileForm({ ...editTileForm, priceBadge: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Category:</label>
                        <input 
                          type="text" 
                          value={editTileForm.category}
                          onChange={e => setEditTileForm({ ...editTileForm, category: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Tagline / Subtitle:</label>
                      <input 
                        type="text" 
                        value={editTileForm.tagline}
                        onChange={e => setEditTileForm({ ...editTileForm, tagline: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Click Redirect URL (Amazon Link):</label>
                      <input 
                        type="text" 
                        required
                        value={editTileForm.clickRedirectUrl}
                        onChange={e => setEditTileForm({ ...editTileForm, clickRedirectUrl: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Image or GIF Asset URL:</label>
                      <input 
                        type="text" 
                        required
                        value={editTileForm.imageUrl}
                        onChange={e => setEditTileForm({ ...editTileForm, imageUrl: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="checkbox-option">
                        <input 
                          type="checkbox" 
                          checked={editTileForm.isActive}
                          onChange={e => setEditTileForm({ ...editTileForm, isActive: e.target.checked })}
                        />
                        <span>Active on LowerDeal Storefront</span>
                      </label>
                    </div>
                  </div>
                  <div className="promo-timer-modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setEditTileCard(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={editTileSaving}>
                      {editTileSaving ? 'Saving...' : '💾 Save Tile Details'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="banners-view-content">

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

          <button 
            onClick={handleTriggerPromoCardsScrape}
            disabled={scrapingPromoCards}
            className="promo-cards-button"
            title="Trigger automated scraping of Amazon festival promotional cards (15+ items for homepage carousel)"
          >
            {scrapingPromoCards ? '⏳ Scraping Cards...' : `🎯 Scrape Promo Cards${promoCardsCount ? ` (${promoCardsCount})` : ''}`}
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

        {promoCardStatus && (
          <div className={`promo-cards-status-alert ${promoCardStatus.includes('❌') ? 'error' : 'success'}`}>
            <span>{promoCardStatus}</span>
            <button 
              type="button"
              className="view-promo-cards-toggle-btn"
              onClick={() => setShowPromoCardsModal(!showPromoCardsModal)}
            >
              {showPromoCardsModal ? '▲ Hide Preview' : `👁️ View Scraped Cards (${promoCardsList.length || 21})`}
            </button>
          </div>
        )}
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
        {filteredBanners.length === 0 && !triggering ? (
          <div className="no-banners">No banners found</div>
        ) : (
          filteredBanners.map((banner) => (
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
              <div 
                className="banner-image" 
                onClick={() => setSelectedBannerId(banner.id)}
                style={{ cursor: 'pointer' }}
                title="Click to view details in maximized mode"
              >
                {banner.url ? (
                  <img src={banner.url} alt={banner.title || banner.id} onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/300x150?text=Banner+Image';
                  }} />
                ) : (
                  <div className="banner-placeholder">No Image</div>
                )}
              </div>
              <div className="banner-info">
                <h3 onClick={() => setSelectedBannerId(banner.id)} style={{ cursor: 'pointer' }} title="Click to view in maximized mode">
                  {banner.title || banner.id}
                </h3>
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
  )}
    </div>
  );
};

export default Banners;
