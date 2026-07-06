import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { dealsAPI, newsAPI, categoriesAPI } from '../services/api';
import DealList from '../components/Deals/DealList';
import DealFilters from '../components/Deals/DealFilters';
import CategoryMatcher from '../components/CategoryMatcher';
import { useNotification } from '../context/NotificationContext';
import './DealsPage.css';
import './Banners.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type ViewMode = 'deals' | 'news' | 'reviews' | 'banners';

const CATEGORY_MAP: Record<string, { label: string; subcategories: string[] }> = {
  'electronics': {
    label: 'Electronics',
    subcategories: ['Air Conditioners', 'Geysers', 'Air Coolers', 'Refrigerators', 'Washing Machines', 'Mobiles', 'Laptops', 'Audio', 'Wearables', 'Televisions', 'Cameras', 'Monitors', 'Others']
  },
  'fashion': {
    label: 'Fashion',
    subcategories: ['Dresses', 'Kurtas', 'T-Shirts', 'Shirts', 'Jeans', 'Pants', 'Shoes', 'Sandals', 'Accessories', 'Innerwear', 'Others']
  },
  'home-kitchen': {
    label: 'Home & Kitchen',
    subcategories: ['Kitchen Appliances', 'Cookware', 'Furniture', 'Home Decor', 'Others']
  },
  'beauty-personal-care': {
    label: 'Beauty & Personal Care',
    subcategories: ['Skincare', 'Haircare', 'Makeup', 'Fragrances', 'Bath & Body', 'Others']
  },
  'books-stationery': {
    label: 'Books & Stationery',
    subcategories: ['Fiction', 'Non-Fiction', 'Academic', 'Stationery', 'Others']
  },
  'sports-fitness': {
    label: 'Sports & Fitness',
    subcategories: ['Equipment', 'Clothing', 'Footwear', 'Accessories', 'Others']
  },
  'baby-kids': {
    label: 'Baby & Kids',
    subcategories: ['Toys', 'Clothing', 'Footwear', 'Baby Care', 'Others']
  },
  'grocery': {
    label: 'Grocery',
    subcategories: ['Others']
  },
  'automotive': {
    label: 'Automotive',
    subcategories: ['Others']
  },
  'tools-hardware': {
    label: 'Tools & Hardware',
    subcategories: ['Others']
  },
  'pet-supplies': {
    label: 'Pet Supplies',
    subcategories: ['Others']
  },
  'music-entertainment': {
    label: 'Music & Entertainment',
    subcategories: ['Others']
  },
  'deals': {
    label: 'Deals',
    subcategories: ['Others']
  },
  'home': {
    label: 'Home',
    subcategories: ['Others']
  }
};

interface Banner {
  id: string;
  title?: string;
  description?: string;
  url?: string;
  platform?: string;
  category?: string;
  isActive?: boolean;
  isProductImage?: boolean;
  clickRedirectUrl?: string;
  creationTimestamp?: string;
  updateTimestamp?: string;
}

interface BannerStats {
  total: number;
  active: number;
  inactive: number;
  byPlatform?: Record<string, number>;
  byCategory?: Record<string, number>;
  source?: string;
}

const DealsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('deals');
  const [showDeals, setShowDeals] = useState<boolean>(false);
  const [filters, setFilters] = useState({ dealType: 'hotDeal', platform: '', date: '', categoryGroup: '', staticSubcategory: '', limit: 100, offset: 0, q: '' });
  const [newsFilters, setNewsFilters] = useState({ limit: 20, offset: 0, category: '', sortBy: 'publishDate', order: 'desc' });
  const [reviewsFilters, setReviewsFilters] = useState({ limit: 20, offset: 0, productName: '', minRating: '', sortBy: 'publishDate', order: 'desc' });
  
  const { addNotification } = useNotification();
  const [categoryMap, setCategoryMap] = useState<Record<string, { label: string; subcategories: string[] }>>(CATEGORY_MAP);

  const CATEGORIES = [
    { id: '', label: 'All Categories' },
    ...Object.entries(categoryMap).map(([id, info]) => ({
      id,
      label: info.label
    }))
  ];

  // Fetch custom categories on mount and merge them
  useEffect(() => {
    const fetchCustomCategories = async () => {
      try {
        const response = await categoriesAPI.getCustom();
        if (response.data && response.data.success) {
          const customData = response.data.data;
          setCategoryMap(prev => {
            const updated = { ...prev };
            Object.entries(customData).forEach(([group, subs]) => {
              if (updated[group] && Array.isArray(subs)) {
                const currentSubs = updated[group].subcategories;
                const newSubs = [...currentSubs];
                subs.forEach((sub: string) => {
                  if (!newSubs.includes(sub)) {
                    const othersIndex = newSubs.indexOf('Others');
                    if (othersIndex !== -1) {
                      newSubs.splice(othersIndex, 0, sub);
                    } else {
                      newSubs.push(sub);
                    }
                  }
                });
                updated[group] = {
                  ...updated[group],
                  subcategories: newSubs
                };
              }
            });
            return updated;
          });
        }
      } catch (err) {
        console.error('Failed to fetch custom categories:', err);
      }
    };
    fetchCustomCategories();
  }, []);
  // Deals query
  const { data: dealsData, isLoading: dealsLoading, error: dealsError, refetch: refetchDeals } = useQuery(
    ['deals', filters],
    () => filters.q ? dealsAPI.searchGlobal(filters) : dealsAPI.getAll(filters),
    { keepPreviousData: true, enabled: viewMode === 'deals' && showDeals }
  );

  // News query
  const { data: newsData, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery(
    ['news', newsFilters],
    () => newsAPI.getAll(newsFilters),
    { keepPreviousData: true, enabled: viewMode === 'news' }
  );

  // Reviews query
  const { data: reviewsData, isLoading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useQuery(
    ['reviews', reviewsFilters],
    () => newsAPI.getReviews({
      ...reviewsFilters,
      minRating: reviewsFilters.minRating ? parseFloat(reviewsFilters.minRating) : undefined
    }),
    { keepPreviousData: true, enabled: viewMode === 'reviews' }
  );

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters, offset: 0 });
  };

  const handleNewsFilterChange = (newFilters: any) => {
    setNewsFilters({ ...newsFilters, ...newFilters, offset: 0 });
  };

  const handleReviewsFilterChange = (newFilters: any) => {
    setReviewsFilters({ ...reviewsFilters, ...newFilters, offset: 0 });
  };

  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isTelegramRunning, setIsTelegramRunning] = useState(false);
  const [isNewsScraping, setIsNewsScraping] = useState(false);
  const [showRetriggerModal, setShowRetriggerModal] = useState(false);
  const [isRetriggering, setIsRetriggering] = useState(false);
  const [productCodeSearch, setProductCodeSearch] = useState('');
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [productCodeResult, setProductCodeResult] = useState<any>(null);

  const handleSearchByProductCode = async () => {
    if (!productCodeSearch.trim()) {
      setProductCodeResult(null);
      return;
    }
    
    try {
      setIsSearchingCode(true);
      const targetDb = filters.dealType === 'hotDeal' ? 'deals' : 'productdeals';
      const response = await dealsAPI.getByCode(productCodeSearch.trim(), targetDb);
      
      if (response.data && (response.data.data || response.data)) {
        setProductCodeResult(response.data.data || response.data);
      } else {
        setProductCodeResult(null);
      }
    } catch (error) {
      console.error('Error searching product code:', error);
      setProductCodeResult(null);
    } finally {
      setIsSearchingCode(false);
    }
  };
  const [isExtractingBanners, setIsExtractingBanners] = useState(false);
  const [isTriggeringBanners, setIsTriggeringBanners] = useState(false);
  const [bannerExtractionResult, setBannerExtractionResult] = useState<{ extracted: number; stored: number; duplicates: number } | null>(null);
  const [retriggerFields, setRetriggerFields] = useState({
    price: true,
    links: false,
    discount: false,
    category: false,
    photo: false
  });

  // Banner state
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannerStats, setBannerStats] = useState<BannerStats | null>(null);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerFilter, setBannerFilter] = useState({ 
    platform: 'all', 
    activeOnly: false,
    timestamp: 'all', // 'all', 'today', 'yesterday', 'recent'
    hideProductImages: true // Hide product images by default
  });
  const [bannerSource, setBannerSource] = useState('test-banners');
  const [bannerVisibility, setBannerVisibility] = useState<Record<string, boolean>>({});
  const [bannerDedupeInfo, setBannerDedupeInfo] = useState<{ removed: number }>({ removed: 0 });
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [selectedBanners, setSelectedBanners] = useState<Set<string>>(new Set());
  const [isDeletingFlights, setIsDeletingFlights] = useState(false);
  const [isDeletingOldBanners, setIsDeletingOldBanners] = useState(false);
  const [isDeletingProductImages, setIsDeletingProductImages] = useState(false);
  const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);
  const [isRefreshingTimestamps, setIsRefreshingTimestamps] = useState(false);
  const [timestampRefreshSource, setTimestampRefreshSource] = useState<'productdeals' | 'deals' | 'both'>('productdeals');
  const [timestampRefreshOrder, setTimestampRefreshOrder] = useState<'newest' | 'oldest'>('newest');
  const [timestampRefreshLimit, setTimestampRefreshLimit] = useState<number>(100);
  
  // Banner cache
  const [bannerCache, setBannerCache] = useState<{
    data: Banner[];
    timestamp: number;
    source: string;
  } | null>(null);
  
  const BANNER_CACHE_KEY = 'banner_cache';
  const BANNER_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  const handleTriggerBulkUpdate = async () => {
    try {
      setIsBulkUpdating(true);
      await dealsAPI.triggerBulkUpdate('website', 'productdeals');
      addNotification({ type: 'success', message: 'Bulk update triggered successfully! It will run in the background.', source: 'Bulk Update', page: 'Deals' });
      refetchDeals();
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Failed to trigger bulk update';
      addNotification({ type: 'error', message: `Failed to trigger bulk update: ${msg}`, source: 'Bulk Update', page: 'Deals' });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkRefreshTimestamps = async () => {
    try {
      setIsRefreshingTimestamps(true);
      await dealsAPI.bulkRefreshTimestamps({
        source: timestampRefreshSource,
        order: timestampRefreshOrder,
        limit: timestampRefreshLimit,
      });
      alert(`Timestamps refreshed for top ${timestampRefreshLimit} ${timestampRefreshOrder === 'newest' ? 'newest' : 'oldest'} products in ${timestampRefreshSource === 'both' ? 'both databases' : timestampRefreshSource}.`);
      // Refetch current deals list to reflect new ordering
      if (viewMode === 'deals') {
        refetchDeals();
      }
    } catch (error: any) {
      alert(`Failed to refresh timestamps: ${error.response?.data?.message || error.message || 'Unknown error'}`);
    } finally {
      setIsRefreshingTimestamps(false);
    }
  };

  const handleTriggerTelegramBot = async () => {
    try {
      setIsTelegramRunning(true);
      await dealsAPI.triggerTelegramBot();
      addNotification({ type: 'success', message: 'Telegram bot triggered successfully! It will process messages continuously in the background.', source: 'Telegram Bot', page: 'Deals' });
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Failed to trigger Telegram bot';
      addNotification({ type: 'error', message: `Failed to trigger Telegram bot: ${msg}`, source: 'Telegram Bot', page: 'Deals' });
    } finally {
      setIsTelegramRunning(false);
    }
  };

  const handleTriggerNewsReviews = async () => {
    try {
      setIsNewsScraping(true);
      await newsAPI.triggerScrape({ scrapeNews: true, scrapeReviews: true, maxPages: 5, maxArticles: 50 });
      alert('News & Reviews scraping triggered successfully! It will run in the background and update the database.');
      if (viewMode === 'news') refetchNews();
      if (viewMode === 'reviews') refetchReviews();
    } catch (error) {
      alert('Failed to trigger News & Reviews scraping');
    } finally {
      setIsNewsScraping(false);
    }
  };

  const handleRetriggerToday = async () => {
    try {
      setIsRetriggering(true);
      const selectedFields = Object.entries(retriggerFields)
        .filter(([_, selected]) => selected)
        .map(([field, _]) => field);
      
      if (selectedFields.length === 0) {
        addNotification({ type: 'warning', message: 'Please select at least one field to retrigger', source: 'Retrigger', page: 'Deals' });
        return;
      }

      const response = await dealsAPI.retriggerToday(selectedFields, 'price');
      const data = response.data;
      
      addNotification({ type: 'success', message: `Retrigger started! Found ${data.stats.toRetrigger} deals to process.\nCheck logs for progress.`, source: 'Retrigger', page: 'Deals' });
      
      setShowRetriggerModal(false);
      refetchDeals();
    } catch (error: any) {
      addNotification({ type: 'error', message: `Failed to trigger retrigger: ${error.response?.data?.error || error.message}`, source: 'Retrigger', page: 'Deals' });
    } finally {
      setIsRetriggering(false);
    }
  };

  const handleExtractAllBanners = async () => {
    try {
      setIsExtractingBanners(true);
      setBannerExtractionResult(null);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/extract-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setBannerExtractionResult({
          extracted: result.data.extracted,
          stored: result.data.stored,
          duplicates: result.data.duplicates
        });
        
        alert(`✅ Banner Extraction Complete!\n\nExtracted: ${result.data.extracted}\nStored: ${result.data.stored}\nDuplicates Skipped: ${result.data.duplicates}\n\nAll banners stored with visibility OFF. You can turn them on one by one in the Banners page.`);
      } else {
        throw new Error(result.error || 'Failed to extract banners');
      }
    } catch (error: any) {
      alert(`Failed to extract banners: ${error.message || 'Unknown error'}`);
    } finally {
      setIsExtractingBanners(false);
    }
  };

  // Load banner cache from localStorage
  const loadBannerCache = (): { data: Banner[]; timestamp: number; source: string } | null => {
    try {
      const cached = localStorage.getItem(BANNER_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        // Check if cache is still valid (not expired and same source)
        if (now - parsed.timestamp < BANNER_CACHE_EXPIRY && parsed.source === bannerSource) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading banner cache:', e);
    }
    return null;
  };

  // Save banner cache to localStorage
  const saveBannerCache = (data: Banner[], source: string) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        source
      };
      localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(cacheData));
      setBannerCache(cacheData);
    } catch (e) {
      console.error('Error saving banner cache:', e);
    }
  };

  // Clear banner cache
  const clearBannerCache = () => {
    localStorage.removeItem(BANNER_CACHE_KEY);
    setBannerCache(null);
  };

  // Filter banners based on current filters
  const filterBanners = (bannersToFilter: Banner[], filters: typeof bannerFilter): Banner[] => {
    return bannersToFilter.filter(banner => {
      // Hide product images filter - only filter if explicitly marked as product image (true)
      if (filters.hideProductImages && banner.isProductImage === true) {
        return false;
      }
      
      // Platform filter
      if (filters.platform !== 'all' && banner.platform !== filters.platform) {
        return false;
      }
      
      // Active/Inactive filter
      if (filters.activeOnly && !banner.isActive) {
        return false;
      }
      
      // Timestamp filter
      if (filters.timestamp !== 'all') {
        const timestamp = banner.creationTimestamp || banner.updateTimestamp;
        if (!timestamp) return false;
        
        const bannerDate = new Date(timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const recent = new Date(today);
        recent.setDate(recent.getDate() - 7); // Last 7 days
        const bannerDateOnly = new Date(bannerDate.getFullYear(), bannerDate.getMonth(), bannerDate.getDate());
        
        switch (filters.timestamp) {
          case 'today':
            return bannerDateOnly.getTime() === today.getTime();
          case 'yesterday':
            return bannerDateOnly.getTime() === yesterday.getTime();
          case 'recent':
            return bannerDate >= recent;
          default:
            return true;
        }
      }
      
      return true;
    });
  };

  // Apply filters to banners and update displayed banners
  const applyBannerFilters = (bannersToFilter: Banner[]) => {
    const filtered = filterBanners(bannersToFilter, bannerFilter);
    setBanners(filtered);
  };

  // Fetch banners from API (on-demand)
  const fetchBannersFromAPI = async (forceRefresh: boolean = false) => {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = loadBannerCache();
      if (cached) {
        const { unique } = dedupeBanners(cached.data);
        applyBannerFilters(unique);
        return;
      }
    }

    try {
      setIsTriggeringBanners(true);
      setBannerError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        let bannersArray = result.data.banners;
        
        // Ensure isProductImage field is preserved (default to false if undefined)
        bannersArray = bannersArray.map((banner: Banner) => ({
          ...banner,
          isProductImage: banner.isProductImage === true, // Explicitly set to false if undefined/null
          isActive: banner.isActive === true // Explicitly set to false if undefined/null
        }));
        
        // Apply cached status to banners (but preserve isProductImage from DB)
        bannersArray = bannersArray.map((banner: Banner) => {
          const cacheKey = `banner_${banner.id}_status`;
          const cachedData = localStorage.getItem(cacheKey);
          
          if (cachedData) {
            try {
              const cached = JSON.parse(cachedData);
              return { 
                ...banner, 
                isActive: cached.isActive !== undefined ? cached.isActive : banner.isActive,
                // Preserve isProductImage from DB, don't override with cache
                isProductImage: banner.isProductImage
              };
            } catch (e) {
              return banner;
            }
          }
          return banner;
        });

        const { unique, removed } = dedupeBanners(bannersArray);
        setBannerDedupeInfo({ removed });
        
        // Save to cache
        saveBannerCache(unique, result.source || bannerSource);
        
        // Apply filters and set banners
        applyBannerFilters(unique);

        const updatedStats: BannerStats = {
          ...(result.data.stats || {}),
          total: unique.length,
          active: unique.filter((b) => b && b.isActive).length,
          inactive: unique.filter((b) => b && !b.isActive).length,
          source: result.source || bannerSource,
        };
        setBannerStats(updatedStats);
        
        // Initialize visibility state
        const visibilityState: Record<string, boolean> = {};
        unique.forEach((banner: Banner) => {
          visibilityState[banner.id] = true;
        });
        setBannerVisibility(visibilityState);
        
        setBannerLoading(false);
      } else {
        throw new Error(result.error || 'Failed to trigger banners');
      }
    } catch (error: any) {
      setBannerError(error.message || 'Unknown error');
    } finally {
      setIsTriggeringBanners(false);
    }
  };

  const handleTriggerBanners = async () => {
    await fetchBannersFromAPI(true); // Force refresh from API
  };

  // Handle filter changes - use cached data
  const handleBannerFilterChange = (newFilters: Partial<typeof bannerFilter>) => {
    const updatedFilters = { ...bannerFilter, ...newFilters };
    setBannerFilter(updatedFilters);
    
    // Use cached data for filtering (client-side filtering)
    const cached = loadBannerCache();
    if (cached) {
      const filtered = filterBanners(cached.data, updatedFilters);
      setBanners(filtered);
    } else if (bannerCache && bannerCache.data.length > 0) {
      // Use in-memory cache
      const filtered = filterBanners(bannerCache.data, updatedFilters);
      setBanners(filtered);
    } else {
      // If no data at all, fetch from API
      fetchBannersFromAPI(false);
    }
  };

  const dedupeBanners = (banners: Banner[]) => {
    const seen = new Set<string>();
    const unique: Banner[] = [];
    let removed = 0;

    banners.forEach((banner) => {
      const platform = (banner.platform || '').trim().toLowerCase();
      const url = (banner.url || '').trim().toLowerCase();
      const clickUrl = (banner.clickRedirectUrl || '').trim().toLowerCase();
      const key = [platform, url, clickUrl].join('|') || banner.id;
      
      if (seen.has(key)) {
        removed += 1;
        return;
      }
      seen.add(key);
      unique.push(banner);
    });

    return { unique, removed };
  };

  const fetchBannerSource = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/source`);
      const result = await response.json();
      if (result.success) {
        setBannerSource(result.data.current);
      }
    } catch (err) {
      console.error('Error fetching banner source:', err);
      setBannerSource('test-banners');
    }
  };

  const fetchBannerStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/stats`);
      const result = await response.json();
      if (result.success) {
        setBannerStats(result.data);
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
        setBanners(prev => 
          prev.map(b => 
            b.id === bannerId 
              ? { ...b, isActive: result.data.isActive }
              : b
          )
        );
        
        // Update cache
        const cached = loadBannerCache();
        if (cached) {
          const updatedCache = cached.data.map(b => 
            b.id === bannerId ? { ...b, isActive: result.data.isActive } : b
          );
          saveBannerCache(updatedCache, cached.source);
        }
        
        const cacheKey = `banner_${bannerId}_status`;
        localStorage.setItem(cacheKey, JSON.stringify({
          isActive: result.data.isActive,
          timestamp: new Date().toISOString()
        }));
        
        fetchBannerStats();
      } else {
        setBannerError(`Failed to update banner: ${result.error}`);
      }
    } catch (err) {
      setBannerError(`Error updating banner: ${(err as Error).message}`);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    try {
      setDeletingBannerId(bannerId);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove from displayed banners
        setBanners(prev => prev.filter(b => b.id !== bannerId));
        
        // Update cache
        const cached = loadBannerCache();
        if (cached) {
          const updatedCache = cached.data.filter(b => b.id !== bannerId);
          saveBannerCache(updatedCache, cached.source);
        }
        
        // Remove from selected banners
        setSelectedBanners(prev => {
          const newSet = new Set(prev);
          newSet.delete(bannerId);
          return newSet;
        });
        
        // Update stats
        fetchBannerStats();
        
        setShowDeleteConfirm(null);
      } else {
        throw new Error(result.error || 'Failed to delete banner');
      }
    } catch (err) {
      setBannerError(`Error deleting banner: ${(err as Error).message}`);
    } finally {
      setDeletingBannerId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBanners.size === 0) {
      alert('Please select at least one banner to delete');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedBanners.size} banner(s)? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const bannerIds = Array.from(selectedBanners);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerIds })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove from displayed banners
        setBanners(prev => prev.filter(b => !selectedBanners.has(b.id)));
        
        // Update cache
        const cached = loadBannerCache();
        if (cached) {
          const updatedCache = cached.data.filter(b => !selectedBanners.has(b.id));
          saveBannerCache(updatedCache, cached.source);
        }
        
        // Clear selection
        setSelectedBanners(new Set());
        
        // Update stats
        fetchBannerStats();
        
        alert(`Successfully deleted ${result.data.deletedCount || bannerIds.length} banner(s)`);
      } else {
        throw new Error(result.error || 'Failed to delete banners');
      }
    } catch (err) {
      setBannerError(`Error deleting banners: ${(err as Error).message}`);
    }
  };

  const toggleBannerSelection = (bannerId: string) => {
    setSelectedBanners(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bannerId)) {
        newSet.delete(bannerId);
      } else {
        newSet.add(bannerId);
      }
      return newSet;
    });
  };

  const selectAllBanners = () => {
    if (selectedBanners.size === banners.length) {
      setSelectedBanners(new Set());
    } else {
      setSelectedBanners(new Set(banners.map(b => b.id)));
    }
  };

  const handleDeleteFlightBanners = async () => {
    if (!confirm('Are you sure you want to delete all flight-related banners? This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsDeletingFlights(true);
      setBannerError(null);
      
      const flightKeywords = [
        'flight', 'flights', 'airline', 'airlines', 'airport', 'booking',
        'book flight', 'flight booking', 'air ticket', 'air tickets',
        'domestic flight', 'international flight', 'cheap flights',
        'flight deals', 'flight offers', 'travel', 'air travel'
      ];
      
      const response = await fetch(`${API_BASE_URL}/api/banners/delete-by-keyword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: flightKeywords })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh banners from cache/API
        clearBannerCache();
        await fetchBannersFromAPI(true);
        
        alert(`✅ Successfully deleted ${result.data.deletedCount} flight-related banner(s)!`);
      } else {
        throw new Error(result.error || 'Failed to delete flight banners');
      }
    } catch (err) {
      setBannerError(`Error deleting flight banners: ${(err as Error).message}`);
    } finally {
      setIsDeletingFlights(false);
    }
  };

  const handleDeleteOldBanners = async () => {
    if (!confirm('Are you sure you want to delete all banners from years before 2026? Only banners from 2026 will remain. This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsDeletingOldBanners(true);
      setBannerError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/delete-by-year`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: 2026 })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh banners from cache/API
        clearBannerCache();
        await fetchBannersFromAPI(true);
        
        alert(`✅ Successfully deleted ${result.data.deletedCount} banner(s) from years before 2026!\n\nOnly banners from 2026 remain.`);
      } else {
        throw new Error(result.error || 'Failed to delete old banners');
      }
    } catch (err) {
      setBannerError(`Error deleting old banners: ${(err as Error).message}`);
    } finally {
      setIsDeletingOldBanners(false);
    }
  };

  const handleDeleteProductImages = async () => {
    if (!confirm('Are you sure you want to delete all product image banners? This will remove banners that appear to be product images rather than promotional banners. This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsDeletingProductImages(true);
      setBannerError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/delete-product-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh banners from cache/API
        clearBannerCache();
        await fetchBannersFromAPI(true);
        
        alert(`✅ Successfully deleted ${result.data.deletedCount} product image banner(s)!`);
      } else {
        throw new Error(result.error || 'Failed to delete product images');
      }
    } catch (err) {
      setBannerError(`Error deleting product images: ${(err as Error).message}`);
    } finally {
      setIsDeletingProductImages(false);
    }
  };

  const handleDeleteDuplicates = async () => {
    if (!confirm('⚠️ Are you sure you want to delete ALL duplicate banners?\n\nDuplicates are identified by matching URLs (image URL or clickRedirectUrl).\nThe oldest banner will be kept, others will be deleted.\n\nThis action cannot be undone.')) {
      return;
    }
    
    try {
      setIsDeletingDuplicates(true);
      setBannerError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/delete-duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        clearBannerCache();
        await fetchBannersFromAPI(true);
        
        alert(`✅ Successfully deleted ${result.data.deletedCount} duplicate banner(s)!\n\n${result.data.duplicatesFound} duplicates were found and removed.`);
      } else {
        throw new Error(result.error || 'Failed to delete duplicates');
      }
    } catch (err) {
      setBannerError(`Error deleting duplicates: ${(err as Error).message}`);
    } finally {
      setIsDeletingDuplicates(false);
    }
  };

  const handleMarkAsProductImage = async (bannerId: string, isProductImage: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}/mark-product-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isProductImage })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update banner in state
        setBanners(prev => 
          prev.map(b => 
            b.id === bannerId 
              ? { ...b, isProductImage: result.data.isProductImage }
              : b
          )
        );
        
        // Update cache
        const cached = loadBannerCache();
        if (cached) {
          const updatedCache = cached.data.map(b => 
            b.id === bannerId 
              ? { ...b, isProductImage: result.data.isProductImage }
              : b
          );
          saveBannerCache(updatedCache, cached.source);
        }
        
        // If hiding product images and marking as product image, remove from view
        if (bannerFilter.hideProductImages && isProductImage) {
          setBanners(prev => prev.filter(b => b.id !== bannerId));
        }
      } else {
        throw new Error(result.error || 'Failed to mark banner');
      }
    } catch (err) {
      setBannerError(`Error marking banner: ${(err as Error).message}`);
    }
  };

  const handleBulkMarkAsProductImage = async (isProductImage: boolean) => {
    if (selectedBanners.size === 0) {
      alert('Please select at least one banner');
      return;
    }
    
    try {
      const bannerIds = Array.from(selectedBanners);
      
      const response = await fetch(`${API_BASE_URL}/api/banners/bulk-mark-product-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerIds, isProductImage })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update banners in state
        setBanners(prev => 
          prev.map(b => 
            selectedBanners.has(b.id)
              ? { ...b, isProductImage: isProductImage }
              : b
          ).filter(b => {
            // If hiding product images and marking as product image, remove from view
            if (bannerFilter.hideProductImages && isProductImage && selectedBanners.has(b.id)) {
              return false;
            }
            return true;
          })
        );
        
        // Update cache
        const cached = loadBannerCache();
        if (cached) {
          const updatedCache = cached.data.map(b => 
            selectedBanners.has(b.id)
              ? { ...b, isProductImage: isProductImage }
              : b
          );
          saveBannerCache(updatedCache, cached.source);
        }
        
        // Clear selection
        setSelectedBanners(new Set());
        
        alert(`✅ Successfully marked ${result.data.success} banner(s) as ${isProductImage ? 'product images' : 'not product images'}`);
      } else {
        throw new Error(result.error || 'Failed to mark banners');
      }
    } catch (err) {
      setBannerError(`Error marking banners: ${(err as Error).message}`);
    }
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

  useEffect(() => {
    if (viewMode === 'banners') {
      fetchBannerSource();
      fetchBannerStats();
      
      // Load from cache first, then fetch if needed
      const cached = loadBannerCache();
      if (cached && cached.source === bannerSource) {
        const { unique } = dedupeBanners(cached.data);
        applyBannerFilters(unique);
      } else {
        // Only fetch if cache is empty or source changed
        fetchBannersFromAPI(false);
      }
      
      const interval = setInterval(() => {
        fetchBannerStats();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [viewMode]);
  
  // Update filters when bannerFilter changes (re-filter cached data)
  useEffect(() => {
    if (viewMode === 'banners') {
      const cached = loadBannerCache();
      if (cached) {
        // Ensure isProductImage field is preserved
        const bannersWithProductFlag = cached.data.map((banner: Banner) => ({
          ...banner,
          isProductImage: banner.isProductImage === true
        }));
        const filtered = filterBanners(bannersWithProductFlag, bannerFilter);
        setBanners(filtered);
      } else if (bannerCache && bannerCache.data.length > 0) {
        // Ensure isProductImage field is preserved
        const bannersWithProductFlag = bannerCache.data.map((banner: Banner) => ({
          ...banner,
          isProductImage: banner.isProductImage === true
        }));
        const filtered = filterBanners(bannersWithProductFlag, bannerFilter);
        setBanners(filtered);
      }
    }
  }, [bannerFilter, viewMode]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="deals-page">
      {(dealsLoading || isSearchingCode || isTriggeringBanners) && (
        <div className="global-loading-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="spinner" style={{ fontSize: '3rem', marginBottom: '10px' }}>↻</div>
          <h2>Loading...</h2>
        </div>
      )}

      <div className="view-mode-selector">
      <div className="page-header">
        <h1>Deals Management</h1>
        <div className="trigger-buttons">
          <button 
            onClick={handleTriggerBulkUpdate} 
            className="trigger-button"
            disabled={isBulkUpdating}
          >
            {isBulkUpdating ? '⏳ Triggering...' : '🔄 Trigger Bulk Update'}
          </button>
          <div className="timestamp-refresh-controls">
            <select
              value={timestampRefreshSource}
              onChange={(e) => setTimestampRefreshSource(e.target.value as 'productdeals' | 'deals' | 'both')}
              className="trigger-select"
            >
              <option value="productdeals">Bulk Update Products (productdeals)</option>
              <option value="deals">Telegram Bot Products (deals)</option>
              <option value="both">Both Databases</option>
            </select>
            <select
              value={timestampRefreshOrder}
              onChange={(e) => setTimestampRefreshOrder(e.target.value as 'newest' | 'oldest')}
              className="trigger-select"
            >
              <option value="newest">Top by Newest Date/Time</option>
              <option value="oldest">Bottom (Oldest Date/Time)</option>
            </select>
            <input
              type="number"
              min={1}
              max={1000}
              value={timestampRefreshLimit}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setTimestampRefreshLimit(Number.isNaN(val) ? 100 : Math.min(Math.max(val, 1), 1000));
              }}
              className="trigger-input"
              placeholder="Limit (e.g. 100)"
            />
            <button
              onClick={handleBulkRefreshTimestamps}
              className="trigger-button"
              disabled={isRefreshingTimestamps}
              title="Refresh updateTimestamp for selected top/bottom products in chosen database(s)"
            >
              {isRefreshingTimestamps ? '⏳ Updating Timestamps...' : '🕒 Refresh Product Timestamps'}
            </button>
          </div>
          <button 
            onClick={handleTriggerTelegramBot} 
            className="trigger-button telegram-button"
            disabled={isTelegramRunning}
          >
            {isTelegramRunning ? '⏳ Starting...' : '📱 Trigger Telegram Bot'}
          </button>
          <button 
            onClick={handleTriggerNewsReviews} 
            className="trigger-button news-button"
            disabled={isNewsScraping}
          >
            {isNewsScraping ? '⏳ Scraping...' : '📰 Trigger News & Reviews'}
          </button>
          <button 
            onClick={handleExtractAllBanners} 
            className="trigger-button banner-button"
            disabled={isExtractingBanners}
            title="Extract banners from all stores and store in DB (visibility OFF)"
          >
            {isExtractingBanners ? '⏳ Extracting...' : '🔍 Extract All Banners'}
          </button>
          <button 
            onClick={() => setShowRetriggerModal(true)} 
            className="trigger-button retrigger-button"
            disabled={isRetriggering}
          >
            {isRetriggering ? '⏳ Retriggering...' : '🔄 Retrigger Today\'s Deals'}
          </button>
        </div>
        <div className="trigger-info">
          <p className="info-text">
            <strong>Note:</strong> All processes can run in parallel. 
            They use separate processes and won't interfere with each other.
          </p>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="view-mode-tabs">
        <button 
          className={`view-tab ${viewMode === 'deals' ? 'active' : ''}`}
          onClick={() => setViewMode('deals')}
        >
          🛍️ Deals
        </button>
        <button 
          className={`view-tab ${viewMode === 'news' ? 'active' : ''}`}
          onClick={() => setViewMode('news')}
        >
          📰 News
        </button>
        <button 
          className={`view-tab ${viewMode === 'reviews' ? 'active' : ''}`}
          onClick={() => setViewMode('reviews')}
        >
          ⭐ Reviews
        </button>
        <button 
          className={`view-tab ${viewMode === 'banners' ? 'active' : ''}`}
          onClick={() => setViewMode('banners')}
        >
          🖼️ Banners
        </button>
      </div>
      </div>

      {/* Deals View */}
      {viewMode === 'deals' && (
        <div className="deals-page-layout">
          <div className="deals-sidebar">
            <DealFilters filters={filters} onFilterChange={handleFilterChange} isLoading={dealsLoading} />
          </div>
          
          <div className="deals-main-content">
            {/* Category Filter Pills Bar */}
            <div className="category-filter-bar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-pill ${filters.categoryGroup === cat.id ? 'active' : ''}`}
                  onClick={() => handleFilterChange({ categoryGroup: cat.id, staticSubcategory: '' })}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Subcategory Filter Pills Bar */}
            {filters.categoryGroup && categoryMap[filters.categoryGroup] && (
              <div className="subcategory-filter-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '5px 0 12px 0', marginBottom: '15px', borderBottom: '1px dashed #eee' }}>
                <button
                  className={`category-pill ${filters.staticSubcategory === '' ? 'active' : ''}`}
                  onClick={() => handleFilterChange({ staticSubcategory: '' })}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  All Subcategories
                </button>
                {categoryMap[filters.categoryGroup].subcategories.map((sub) => (
                  <button
                    key={sub}
                    className={`category-pill ${filters.staticSubcategory === sub ? 'active' : ''}`}
                    onClick={() => handleFilterChange({ staticSubcategory: sub })}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

            <div className="deals-view-header search-section" style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div className="product-code-search" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Enter Product Code..." 
                  value={productCodeSearch}
                  onChange={(e) => setProductCodeSearch(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchByProductCode()}
                />
                <button 
                  onClick={handleSearchByProductCode}
                  className="trigger-button"
                  style={{ padding: '6px 12px', fontSize: '14px' }}
                  disabled={isSearchingCode}
                >
                  {isSearchingCode ? 'Searching...' : 'Find Code'}
                </button>
                {productCodeResult && (
                  <button 
                    onClick={() => { setProductCodeSearch(''); setProductCodeResult(null); }}
                    className="btn-cancel"
                    style={{ padding: '6px 12px', fontSize: '14px', height: 'auto' }}
                  >
                    Clear Search
                  </button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                {showDeals && (
                  <button 
                    onClick={() => setShowDeals(false)} 
                    className="trigger-button"
                    style={{ backgroundColor: '#f44336', color: '#fff', border: 'none' }}
                    title="Hide deals list"
                  >
                    🙈 Hide Deals
                  </button>
                )}
                <button 
                  onClick={handleTriggerBanners} 
                  className="trigger-button banner-trigger-button"
                  disabled={isTriggeringBanners}
                  title="Display banners from all platforms"
                >
                  {isTriggeringBanners ? (
                    <><span className="spinner">↻</span> Loading...</>
                  ) : '🖼️ Display Banners'}
                </button>
              </div>
            </div>
            
            {productCodeResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <CategoryMatcher 
                  productData={productCodeResult}
                  onChange={(field, value) => setProductCodeResult({ ...productCodeResult, [field]: value })}
                  onSave={async () => {
                    try {
                      const db = filters.dealType === 'hotDeal' ? 'deals' : 'productdeals';
                      await dealsAPI.updateProduct(productCodeResult.productCode, productCodeResult, db);
                      addNotification({ type: 'success', message: 'Categories updated successfully!', source: 'Category Matcher', page: 'Deals' });
                    } catch (error) {
                      console.error('Failed to update categories:', error);
                      addNotification({ type: 'error', message: 'Failed to update categories.', source: 'Category Matcher', page: 'Deals' });
                    }
                  }}
                />
                <DealList 
                  deals={[productCodeResult]} 
                  database={filters.dealType === 'hotDeal' ? 'deals' : 'productdeals'}
                  pagination={{ total: 1, limit: 1, offset: 0, hasMore: false }}
                  onPageChange={() => {}}
                />
              </div>
            ) : !showDeals ? (
              <div className="display-deals-trigger-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', border: '1px dashed #ccc', borderRadius: '8px', margin: '20px 0', backgroundColor: '#fafafa' }}>
                <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '15px' }}>Deals list loading is currently paused to optimize performance. Click below to load and display all deals.</p>
                <button 
                  onClick={() => setShowDeals(true)}
                  className="trigger-button"
                  style={{ padding: '10px 24px', fontSize: '16px', fontWeight: 'bold' }}
                >
                  📊 Display Deals
                </button>
              </div>
            ) : (
              <>
                {dealsLoading && <div className="loading"><span className="spinner">↻</span> Loading deals...</div>}
                {!!dealsError && <div className="error">Error loading deals: {String(dealsError)}</div>}
                {!!dealsData && (
                  <DealList 
                    deals={(dealsData.data as any).data || []} 
                    database={(dealsData.data as any).database}
                    pagination={(dealsData.data as any).pagination}
                    onPageChange={(offset) => setFilters({ ...filters, offset })}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* News View */}
      {viewMode === 'news' && (
        <>
          <div className="content-filters">
            <select 
              value={newsFilters.category} 
              onChange={(e) => handleNewsFilterChange({ category: e.target.value })}
              className="filter-select"
            >
              <option value="">All Categories</option>
              <option value="mobile">Mobile</option>
              <option value="tech">Tech</option>
              <option value="gadgets">Gadgets</option>
            </select>
            <select 
              value={newsFilters.sortBy} 
              onChange={(e) => handleNewsFilterChange({ sortBy: e.target.value })}
              className="filter-select"
            >
              <option value="publishDate">Sort by Date</option>
              <option value="title">Sort by Title</option>
            </select>
            <select 
              value={newsFilters.order} 
              onChange={(e) => handleNewsFilterChange({ order: e.target.value })}
              className="filter-select"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
          {newsLoading && <div className="loading">Loading news...</div>}
          {newsError && <div className="error">Error loading news: {String(newsError)}</div>}
          {newsData && !newsLoading && (
            <>
              {(() => {
                // Handle axios response structure: response.data.data.data
                // axios wraps: { data: { success: true, data: [...], pagination: {...} } }
                const apiResponse = (newsData.data as any)?.data || {};
                const newsArray = apiResponse.data || [];
                console.log('News API Response:', { apiResponse, newsArray, length: newsArray.length });
                return newsArray.length === 0 ? (
                  <div className="empty-state">No news articles found. Click "Trigger News & Reviews" to start scraping.</div>
                ) : (
                  <div className="content-list">
                    {newsArray.map((article: any) => (
                  <div key={article.id} className="content-card">
                    {article.images && article.images.length > 0 && (
                      <div className="content-image">
                        <img src={article.images[0].url} alt={article.images[0].alt || article.title} />
                      </div>
                    )}
                    <div className="content-details">
                      <div className="content-meta">
                        {article.category && <span className="category-badge">{article.category}</span>}
                        {article.publishDate && <span className="date">{formatDate(article.publishDate)}</span>}
                        {article.author && <span className="author">By {article.author}</span>}
                      </div>
                      <h3 className="content-title">{article.title}</h3>
                      <p className="content-excerpt">{article.content?.substring(0, 300)}...</p>
                      {article.tags && article.tags.length > 0 && (
                        <div className="content-tags">
                          {article.tags.slice(0, 3).map((tag: string, idx: number) => (
                            <span key={idx} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="read-more">
                        Read Full Article →
                      </a>
                    </div>
                  </div>
                    ))}
                  </div>
                );
              })()}
              {(() => {
                const apiResponse = (newsData.data as any)?.data || {};
                const pagination = apiResponse.pagination;
                return pagination ? (
                  <div className="pagination">
                    <button
                      onClick={() => setNewsFilters({ ...newsFilters, offset: Math.max(0, newsFilters.offset - newsFilters.limit) })}
                      disabled={newsFilters.offset === 0}
                      className="pagination-button"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Showing {newsFilters.offset + 1} - {Math.min(newsFilters.offset + newsFilters.limit, pagination.total)} of {pagination.total}
                    </span>
                    <button
                      onClick={() => setNewsFilters({ ...newsFilters, offset: newsFilters.offset + newsFilters.limit })}
                      disabled={!pagination.hasMore}
                      className="pagination-button"
                    >
                      Next
                    </button>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </>
      )}

      {/* Reviews View */}
      {viewMode === 'reviews' && (
        <>
          <div className="content-filters">
            <input
              type="text"
              placeholder="Search by product name..."
              value={reviewsFilters.productName}
              onChange={(e) => handleReviewsFilterChange({ productName: e.target.value })}
              className="filter-input"
            />
            <select 
              value={reviewsFilters.minRating} 
              onChange={(e) => handleReviewsFilterChange({ minRating: e.target.value })}
              className="filter-select"
            >
              <option value="">All Ratings</option>
              <option value="4">4+ Stars</option>
              <option value="4.5">4.5+ Stars</option>
            </select>
            <select 
              value={reviewsFilters.sortBy} 
              onChange={(e) => handleReviewsFilterChange({ sortBy: e.target.value })}
              className="filter-select"
            >
              <option value="publishDate">Sort by Date</option>
              <option value="rating">Sort by Rating</option>
              <option value="productName">Sort by Product</option>
            </select>
            <select 
              value={reviewsFilters.order} 
              onChange={(e) => handleReviewsFilterChange({ order: e.target.value })}
              className="filter-select"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
          {reviewsLoading && <div className="loading">Loading reviews...</div>}
          {reviewsError && <div className="error">Error loading reviews: {String(reviewsError)}</div>}
          {reviewsData && !reviewsLoading && (
            <>
              {(() => {
                // Handle axios response structure: response.data.data.data
                // axios wraps: { data: { success: true, data: [...], pagination: {...} } }
                const apiResponse = (reviewsData.data as any)?.data || {};
                const reviewsArray = apiResponse.data || [];
                console.log('Reviews API Response:', { apiResponse, reviewsArray, length: reviewsArray.length });
                return reviewsArray.length === 0 ? (
                  <div className="empty-state">No reviews found. Click "Trigger News & Reviews" to start scraping.</div>
                ) : (
                  <div className="content-list">
                    {reviewsArray.map((review: any) => (
                  <div key={review.id} className="content-card">
                    {review.images && review.images.length > 0 && (
                      <div className="content-image">
                        <img src={review.images[0].url} alt={review.images[0].alt || review.productName} />
                      </div>
                    )}
                    <div className="content-details">
                      <div className="content-header">
                        <h3 className="content-title">{review.productName || review.title}</h3>
                        {review.rating && (
                          <div className="rating-display">
                            {'★'.repeat(Math.floor(review.rating))}
                            <span className="rating-value">{review.rating.toFixed(1)}/5</span>
                          </div>
                        )}
                      </div>
                      <div className="content-meta">
                        {review.publishDate && <span className="date">{formatDate(review.publishDate)}</span>}
                        {review.author && <span className="author">By {review.author}</span>}
                      </div>
                      <p className="content-excerpt">{review.content?.substring(0, 300)}...</p>
                      {review.pros && review.pros.length > 0 && (
                        <div className="pros-cons">
                          <strong>Pros:</strong>
                          <ul>
                            {review.pros.slice(0, 3).map((pro: string, idx: number) => (
                              <li key={idx}>{pro}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {review.cons && review.cons.length > 0 && (
                        <div className="pros-cons">
                          <strong>Cons:</strong>
                          <ul>
                            {review.cons.slice(0, 3).map((con: string, idx: number) => (
                              <li key={idx}>{con}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {review.verdict && (
                        <div className="verdict">
                          <strong>Verdict:</strong> {review.verdict.substring(0, 200)}...
                        </div>
                      )}
                      <a href={review.url} target="_blank" rel="noopener noreferrer" className="read-more">
                        Read Full Review →
                      </a>
                    </div>
                  </div>
                    ))}
                  </div>
                );
              })()}
              {(() => {
                const apiResponse = (reviewsData.data as any)?.data || {};
                const pagination = apiResponse.pagination;
                return pagination ? (
                  <div className="pagination">
                    <button
                      onClick={() => setReviewsFilters({ ...reviewsFilters, offset: Math.max(0, reviewsFilters.offset - reviewsFilters.limit) })}
                      disabled={reviewsFilters.offset === 0}
                      className="pagination-button"
                    >
                      Previous
                    </button>
                    <span className="pagination-info">
                      Showing {reviewsFilters.offset + 1} - {Math.min(reviewsFilters.offset + reviewsFilters.limit, pagination.total)} of {pagination.total}
                    </span>
                    <button
                      onClick={() => setReviewsFilters({ ...reviewsFilters, offset: reviewsFilters.offset + reviewsFilters.limit })}
                      disabled={!pagination.hasMore}
                      className="pagination-button"
                    >
                      Next
                    </button>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </>
      )}

      {/* Banners View */}
      {viewMode === 'banners' && (
        <>
          <div className="banners-header">
            <h1>🖼️ Banner Management</h1>
            {bannerStats && (
              <div className="banner-stats-summary">
                <span>Total: {bannerStats.total}</span>
                <span className="active">Active: {bannerStats.active}</span>
                <span>Inactive: {bannerStats.inactive}</span>
                <span className="source-info">Source: {bannerStats.source || bannerSource}</span>
              </div>
            )}
          </div>

          <div className="banners-controls">
            <div className="control-group">
              <button 
                onClick={handleTriggerBanners}
                disabled={isTriggeringBanners}
                className="trigger-button"
              >
                {isTriggeringBanners ? '🔄 Loading...' : '🚀 Display Banners'}
              </button>
              
              <button 
                onClick={handleExtractAllBanners}
                disabled={isExtractingBanners}
                className="extract-all-button"
                title="Extract banners from all stores and store in DB (visibility OFF)"
              >
                {isExtractingBanners ? '⏳ Extracting...' : '🔍 Extract All Banners'}
              </button>
              
              <div className="source-toggle">
                <span className="source-label">Banner Source:</span>
                <div className="toggle-switch">
                  <button 
                    onClick={async () => {
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/banners/source/toggle`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        if (result.success) {
                          setBannerSource(result.data.current);
                        }
                      } catch (err) {
                        setBannerError((err as Error).message);
                      }
                    }}
                    className={`source-button ${bannerSource === 'test-banners' ? 'active' : ''}`}
                  >
                    test-banners.json
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/banners/source/toggle`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        if (result.success) {
                          setBannerSource(result.data.current);
                        }
                      } catch (err) {
                        setBannerError((err as Error).message);
                      }
                    }}
                    className={`source-button ${bannerSource === 'production' ? 'active' : ''}`}
                  >
                    production
                  </button>
                </div>
              </div>
            </div>
          </div>

          {bannerDedupeInfo.removed > 0 && (
            <div className="banners-info">
              Removed {bannerDedupeInfo.removed} duplicate banners for this session.
            </div>
          )}

          {bannerError && (
            <div className="banners-error">⚠️ Error: {bannerError}</div>
          )}

          {bannerExtractionResult && (
            <div className="banners-success">
              ✅ Extraction Complete! 
              Extracted: {bannerExtractionResult.extracted}, 
              Stored: {bannerExtractionResult.stored}, 
              Duplicates Skipped: {bannerExtractionResult.duplicates}
              <br />
              <small>All banners stored with visibility OFF. You can turn them on one by one in the UI.</small>
            </div>
          )}

          {banners.length === 0 && !isTriggeringBanners && (
            <div className="no-banners-message">
              <p>No banners loaded yet. Click "Display Banners" to fetch from {bannerSource}.</p>
            </div>
          )}

          <div className="banners-filters">
            <select 
              value={bannerFilter.platform} 
              onChange={(e) => handleBannerFilterChange({ platform: e.target.value })}
              className="filter-select"
            >
              <option value="all">All Platforms</option>
              <option value="amazon">Amazon</option>
              <option value="flipkart">Flipkart</option>
              <option value="myntra">Myntra</option>
              <option value="ajio">Ajio</option>
            </select>
            
            <select 
              value={bannerFilter.timestamp} 
              onChange={(e) => handleBannerFilterChange({ timestamp: e.target.value })}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="recent">Recent (Last 7 Days)</option>
            </select>
            
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={bannerFilter.activeOnly}
                onChange={(e) => handleBannerFilterChange({ activeOnly: e.target.checked })}
              />
              Active Only
            </label>
            
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={bannerFilter.hideProductImages}
                onChange={(e) => handleBannerFilterChange({ hideProductImages: e.target.checked })}
              />
              Hide Product Images
            </label>
            
            {banners.length > 0 && (
              <>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedBanners.size === banners.length && banners.length > 0}
                    onChange={selectAllBanners}
                  />
                  Select All ({selectedBanners.size})
                </label>
                
                {selectedBanners.size > 0 && (
                  <>
                    <button
                      onClick={() => handleBulkMarkAsProductImage(true)}
                      className="trigger-button"
                      style={{ backgroundColor: '#f39c12', fontSize: '14px', padding: '8px 16px' }}
                      title={`Mark ${selectedBanners.size} selected banner(s) as product images`}
                    >
                      🏷️ Mark as Product Image ({selectedBanners.size})
                    </button>
                    <button
                      onClick={() => handleBulkMarkAsProductImage(false)}
                      className="trigger-button"
                      style={{ backgroundColor: '#95a5a6', fontSize: '14px', padding: '8px 16px' }}
                      title={`Unmark ${selectedBanners.size} selected banner(s) as product images`}
                    >
                      ✏️ Unmark as Product Image ({selectedBanners.size})
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="trigger-button"
                      style={{ backgroundColor: '#dc3545', fontSize: '14px', padding: '8px 16px' }}
                      title={`Delete ${selectedBanners.size} selected banner(s)`}
                    >
                      🗑️ Delete Selected ({selectedBanners.size})
                    </button>
                  </>
                )}
                
                <button
                  onClick={handleDeleteFlightBanners}
                  disabled={isDeletingFlights}
                  className="trigger-button"
                  style={{ backgroundColor: '#ff6b6b', fontSize: '14px', padding: '8px 16px' }}
                  title="Delete all flight-related banners"
                >
                  {isDeletingFlights ? '⏳ Deleting...' : '✈️ Delete Flight Banners'}
                </button>
                
                <button
                  onClick={handleDeleteOldBanners}
                  disabled={isDeletingOldBanners}
                  className="trigger-button"
                  style={{ backgroundColor: '#e74c3c', fontSize: '14px', padding: '8px 16px' }}
                  title="Delete all banners from years before 2026"
                >
                  {isDeletingOldBanners ? '⏳ Deleting...' : '🗑️ Delete Old Banners (Before 2026)'}
                </button>
                
                <button
                  onClick={handleDeleteProductImages}
                  disabled={isDeletingProductImages}
                  className="trigger-button"
                  style={{ backgroundColor: '#f39c12', fontSize: '14px', padding: '8px 16px' }}
                  title="Delete all product image banners"
                >
                  {isDeletingProductImages ? '⏳ Deleting...' : '🖼️ Delete Product Images'}
                </button>
                
                <button
                  onClick={handleDeleteDuplicates}
                  disabled={isDeletingDuplicates}
                  className="trigger-button"
                  style={{ backgroundColor: '#9b59b6', fontSize: '14px', padding: '8px 16px' }}
                  title="Delete duplicate banners based on URL matching"
                >
                  {isDeletingDuplicates ? '⏳ Deleting...' : '🔄 Delete Duplicates'}
                </button>
              </>
            )}
            
            <button
              onClick={() => {
                clearBannerCache();
                fetchBannersFromAPI(true);
              }}
              className="trigger-button"
              style={{ marginLeft: 'auto', fontSize: '14px', padding: '8px 16px' }}
              title="Clear cache and refresh from database"
            >
              🔄 Refresh
            </button>
          </div>

          {bannerStats && bannerStats.byPlatform && Object.keys(bannerStats.byPlatform).length > 0 && (
            <div className="platform-breakdown">
              <h3>Banners by Platform</h3>
              <div className="platform-stats">
                {Object.entries(bannerStats.byPlatform).map(([platform, count]) => (
                  <div key={platform} className="platform-stat-item">
                    <span className="platform-name">{platform}</span>
                    <span className="platform-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="banners-grid">
            {banners.length === 0 && !isTriggeringBanners ? (
              <div className="no-banners">No banners found matching the filters</div>
            ) : (
              banners
                .filter(banner => bannerVisibility[banner.id] !== false)
                .map((banner) => (
                <div key={banner.id} className={`banner-card ${banner.isActive ? 'active' : 'inactive'} ${selectedBanners.has(banner.id) ? 'selected' : ''}`}>
                  <div className="banner-card-header">
                    <label className="banner-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedBanners.has(banner.id)}
                        onChange={() => toggleBannerSelection(banner.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </label>
                    <div className="banner-status-toggle">
                      <button 
                        onClick={() => toggleBannerStatus(banner.id, banner.isActive || false)}
                        className={`status-toggle-btn ${banner.isActive ? 'active' : 'inactive'}`}
                        title={`Click to ${banner.isActive ? 'deactivate' : 'activate'} this banner`}
                      >
                        {banner.isActive ? '✓ Active' : '✗ Inactive'}
                      </button>
                    </div>
                    <button
                      onClick={() => handleMarkAsProductImage(banner.id, !banner.isProductImage)}
                      className="banner-mark-product-btn"
                      style={{ 
                        backgroundColor: banner.isProductImage ? '#f39c12' : '#95a5a6',
                        fontSize: '11px',
                        padding: '4px 8px',
                        marginRight: '4px',
                        minWidth: 'auto'
                      }}
                      title={banner.isProductImage ? 'Unmark as product image' : 'Mark as product image'}
                    >
                      {banner.isProductImage ? '🏷️' : '🖼️'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm({ id: banner.id, title: banner.title || banner.id })}
                      className="banner-delete-btn"
                      title="Delete this banner"
                      disabled={deletingBannerId === banner.id}
                    >
                      {deletingBannerId === banner.id ? '⏳' : '🗑️'}
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
                      {banner.category && (
                        <span className="banner-category">{banner.category}</span>
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
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Banner</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Are you sure you want to delete this banner?
                <br />
                <strong>"{showDeleteConfirm.title}"</strong>
                <br />
                <span style={{ color: '#dc3545', fontSize: '14px' }}>This action cannot be undone.</span>
              </p>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-button cancel" 
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingBannerId === showDeleteConfirm.id}
              >
                Cancel
              </button>
              <button 
                className="modal-button primary" 
                onClick={() => handleDeleteBanner(showDeleteConfirm.id)}
                disabled={deletingBannerId === showDeleteConfirm.id}
                style={{ backgroundColor: '#dc3545' }}
              >
                {deletingBannerId === showDeleteConfirm.id ? '⏳ Deleting...' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retrigger Modal */}
      {showRetriggerModal && (
        <div className="modal-overlay" onClick={() => setShowRetriggerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Retrigger Today's Deals</h2>
              <button className="modal-close" onClick={() => setShowRetriggerModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-description">
                Select which fields to check and retrigger. Only deals with issues in the selected fields will be processed.
                <strong> Priority: Price issues are processed first.</strong>
              </p>
              <div className="retrigger-fields">
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.price}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, price: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Price</strong> (Highest Priority)
                    <span className="field-description">Missing, N/A, or invalid prices</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.links}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, links: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Links</strong>
                    <span className="field-description">Missing affiliate links or product URLs</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.discount}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, discount: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Discount</strong>
                    <span className="field-description">Missing or invalid discount information</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.category}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, category: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Category</strong>
                    <span className="field-description">Missing or invalid category data</span>
                  </span>
                </label>
                <label className="retrigger-field-item">
                  <input
                    type="checkbox"
                    checked={retriggerFields.photo}
                    onChange={(e) => setRetriggerFields({ ...retriggerFields, photo: e.target.checked })}
                  />
                  <span className="field-label">
                    <strong>Photo</strong>
                    <span className="field-description">Missing product images</span>
                  </span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-button cancel" 
                onClick={() => setShowRetriggerModal(false)}
                disabled={isRetriggering}
              >
                Cancel
              </button>
              <button 
                className="modal-button primary" 
                onClick={handleRetriggerToday}
                disabled={isRetriggering || Object.values(retriggerFields).every(v => !v)}
              >
                {isRetriggering ? '⏳ Retriggering...' : '🔄 Start Retrigger'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsPage;

