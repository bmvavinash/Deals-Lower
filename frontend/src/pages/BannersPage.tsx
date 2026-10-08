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
  'general': {
      label: 'General',
      subcategories: ['Promotional', 'Sale', 'Event', 'Others']
    },
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
  subcategory?: string;
  isActive?: boolean;
  isProductImage?: boolean;
  clickRedirectUrl?: string;
  creationTimestamp?: string;
  updateTimestamp?: string;
  priority?: number;
}

interface BannerStats {
  total: number;
  active: number;
  inactive: number;
  byPlatform?: Record<string, number>;
  byCategory?: Record<string, number>;
  source?: string;
}

const BannersPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('banners');
  const [showBannersInDeals, setShowBannersInDeals] = useState(false);
  const [filters, setFilters] = useState({ dealType: 'hotDeal', platform: '', date: '', categoryGroup: '', staticSubcategory: '', limit: 100, offset: 0, q: '' });
  
  // Banner editing states
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPlatform, setEditPlatform] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIsProduct, setEditIsProduct] = useState(false);
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editClickRedirectUrl, setEditClickRedirectUrl] = useState('');
  const [editPriority, setEditPriority] = useState<number>(0);
  const [newsFilters, setNewsFilters] = useState({ limit: 20, offset: 0, category: '', sortBy: 'publishDate', order: 'desc' });
  const [reviewsFilters, setReviewsFilters] = useState({ limit: 20, offset: 0, productName: '', minRating: '', sortBy: 'publishDate', order: 'desc' });
  
  const { addNotification } = useNotification();
  const [categoryMap, setCategoryMap] = useState<Record<string, { label: string; subcategories: string[] }>>(CATEGORY_MAP);

  const CATEGORIES = [
    { id: '', label: 'All Categories' },
    ...Object.entries(categoryMap).map(([id, info]) => ({
      id,
      label: info.label,
      subcategories: info.subcategories || []
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
    { keepPreviousData: true, enabled: viewMode === 'deals' }
  );

  // News query (Disabled)
  /*
  const { data: newsData, isLoading: newsLoading, error: newsError, refetch: refetchNews } = useQuery(
    ['news', newsFilters],
    () => newsAPI.getAll(newsFilters),
    { keepPreviousData: true, enabled: viewMode === 'news' }
  );
  */
  const newsData = null as any;
  const newsLoading = false;
  const newsError = null as any;
  const refetchNews = () => {};

  // Reviews query (Disabled)
  /*
  const { data: reviewsData, isLoading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useQuery(
    ['reviews', reviewsFilters],
    () => newsAPI.getReviews({
      ...reviewsFilters,
      minRating: reviewsFilters.minRating ? parseFloat(reviewsFilters.minRating) : undefined
    }),
    { keepPreviousData: true, enabled: viewMode === 'reviews' }
  );
  */
  const reviewsData = null as any;
  const reviewsLoading = false;
  const reviewsError = null as any;
  const refetchReviews = () => {};

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
    hideProductImages: true, // Hide product images by default
    sortBy: 'default',
    order: 'desc'
  });
  const [bannerSource, setBannerSource] = useState('production');
  const [bannerVisibility, setBannerVisibility] = useState<Record<string, boolean>>({});
  const [isListView, setIsListView] = useState(true);
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
    let filteredList = bannersToFilter.filter(banner => {
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

    const isDesc = filters.order !== 'asc';
    filteredList.sort((a, b) => {
      let valA, valB;
      if (filters.sortBy === 'priority') {
        const getPriority = (p?: number) => (p === undefined || p === null || p <= 0) ? 9999 : p;
        valA = getPriority(a.priority);
        valB = getPriority(b.priority);
      } else if (filters.sortBy === 'updateTimestamp') {
        valA = a.updateTimestamp ? new Date(a.updateTimestamp).getTime() : 0;
        valB = b.updateTimestamp ? new Date(b.updateTimestamp).getTime() : 0;
      } else if (filters.sortBy === 'title') {
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
      } else if (filters.sortBy === 'active') {
        valA = a.isActive ? 1 : 0;
        valB = b.isActive ? 1 : 0;
      } else {
        // default / creationTimestamp
        valA = a.creationTimestamp ? new Date(a.creationTimestamp).getTime() : 0;
        valB = b.creationTimestamp ? new Date(b.creationTimestamp).getTime() : 0;
      }

      if (valA < valB) return isDesc ? 1 : -1;
      if (valA > valB) return isDesc ? -1 : 1;
      return 0;
    });

    return filteredList;
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
    if (viewMode === 'deals') {
      setShowBannersInDeals(true);
    }
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

  const handleNextBanner = () => {
    const visibleBanners = banners.filter(b => bannerVisibility[b.id] !== false);
    const currentIndex = visibleBanners.findIndex(b => b.id === editingBannerId);
    if (currentIndex >= 0) {
      const nextIndex = (currentIndex + 1) % visibleBanners.length;
      startEditingBanner(visibleBanners[nextIndex]);
    }
  };

  const handlePrevBanner = () => {
    const visibleBanners = banners.filter(b => bannerVisibility[b.id] !== false);
    const currentIndex = visibleBanners.findIndex(b => b.id === editingBannerId);
    if (currentIndex >= 0) {
      const prevIndex = (currentIndex - 1 + visibleBanners.length) % visibleBanners.length;
      startEditingBanner(visibleBanners[prevIndex]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingBannerId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        handleNextBanner();
      } else if (e.key === 'ArrowLeft') {
        handlePrevBanner();
      } else if (e.key === 'Escape') {
        setEditingBannerId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingBannerId, banners, bannerVisibility]);

  const startEditingBanner = (banner: Banner) => {
    setEditingBannerId(banner.id);
    setEditTitle(banner.title || '');
    setEditDescription(banner.description || '');
    setEditPlatform(banner.platform || '');
    setEditCategory(banner.category ? banner.category.toLowerCase() : '');
    setEditIsProduct(banner.isProductImage || false);
    setEditSubcategory(banner.subcategory ? (CATEGORIES.find(c => c.id === (banner.category || '').toLowerCase())?.subcategories?.find(s => s.toLowerCase() === banner.subcategory!.toLowerCase()) || banner.subcategory) : '');
    setEditUrl(banner.url || '');
    setEditClickRedirectUrl(banner.clickRedirectUrl || '');
    setEditPriority(banner.priority || 0);
  };

  const handleSaveBannerDetails = async (bannerId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          platform: editPlatform,
          category: editCategory,
          subcategory: editSubcategory,
            isProductImage: editIsProduct,
          url: editUrl,
          clickRedirectUrl: editClickRedirectUrl,
          priority: editPriority
        })
      });
      const result = await response.json();
      if (result.success) {
        // Update local state without reload
        setBanners(prev => 
          prev.map(b => 
            b.id === bannerId 
              ? { ...b, ...result.data }
              : b
          )
        );
        
        // Update cache
        const cached = loadBannerCache();
        if (cached) {
          const updatedCache = cached.data.map(b => 
            b.id === bannerId ? { ...b, ...result.data } : b
          );
          saveBannerCache(updatedCache, cached.source);
        }
        
        setEditingBannerId(null);
        addNotification({ type: 'success', message: 'Banner updated successfully!', source: 'Banner Manager', page: 'Deals' });
      } else {
        alert(`Failed to update banner: ${result.error}`);
      }
    } catch (err) {
      alert(`Error updating banner: ${(err as Error).message}`);
    }
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
      setBannerSource('production');
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
      } else if (diffDays < 30) {
        return ` ${diffDays} days ago`;
      } else if (diffDays < 365) {
        const diffMonths = Math.floor(diffDays / 30);
        return diffMonths === 1 ? '1 month ago' : ` ${diffMonths} months ago`;
      } else {
        const diffYears = Math.floor(diffDays / 365);
        return diffYears === 1 ? '1 year ago' : ` ${diffYears} years ago`;
      }
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

  const renderBannersSection = (isInline: boolean = false) => {
    return (
      <div className={isInline ? "inline-banners-section" : "standalone-banners-section"} style={isInline ? { marginTop: '40px', borderTop: '2px solid #e2e8f0', paddingTop: '30px' } : undefined}>
        <div className="banners-header" style={isInline ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' } : undefined}>
          {isInline ? (
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>🖼️ Banners Configuration</h2>
              <button 
                onClick={() => setShowBannersInDeals(false)} 
                className="btn-cancel"
                style={{ padding: '6px 12px', fontSize: '13px', height: 'auto', margin: 0 }}
              >
                Hide Banners Section
              </button>
            </div>
          ) : (
            <h1>🖼️ Banner Management</h1>
          )}
          {!isInline && bannerStats && (
            <div className="banner-stats-summary">
              <span>Total: {bannerStats.total}</span>
              <span className="active">Active: {bannerStats.active}</span>
              <span>Inactive: {bannerStats.inactive}</span>
              <span className="source-info">Source: {bannerStats.source || bannerSource}</span>
            </div>
          )}
        </div>
        
        {isInline && bannerStats && (
          <div className="banner-stats-summary" style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', gap: '15px' }}>
            <span>Total Banners: <strong>{bannerStats.total}</strong></span>
            <span className="active">Active: <strong>{bannerStats.active}</strong></span>
            <span>Inactive: <strong>{bannerStats.inactive}</strong></span>
            <span className="source-info">Source: <strong>{bannerStats.source || bannerSource}</strong></span>
          </div>
        )}

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

        <div className="banners-filters" style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <strong style={{ marginRight: '8px', color: '#334155' }}>Sort & Filter:</strong>
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

          <select 
            value={bannerFilter.sortBy} 
            onChange={(e) => handleBannerFilterChange({ sortBy: e.target.value })}
            className="filter-select"
          >
            <option value="default">Sort: Date Added</option>
            <option value="updateTimestamp">Sort: Last Updated</option>
            <option value="priority">Sort: Priority</option>
            <option value="title">Sort: Title</option>
            <option value="active">Sort: Status</option>
          </select>

          <select 
            value={bannerFilter.order} 
            onChange={(e) => handleBannerFilterChange({ order: e.target.value })}
            className="filter-select"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
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

        {editingBannerId ? (
          (() => {
            const visibleBanners = banners.filter(b => bannerVisibility[b.id] !== false);
            const currentIndex = visibleBanners.findIndex(b => b.id === editingBannerId);
            const banner = visibleBanners[currentIndex];
            if (!banner) return null;

            return (
              <div className="single-banner-view">
                <div className="single-banner-navigation" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '10px 20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <button onClick={handlePrevBanner} className="nav-arrow" style={{ padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>&larr; Previous</button>
                  <span className="nav-count" style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#2c3e50' }}>Banner {currentIndex + 1} of {visibleBanners.length}</span>
                    <button onClick={() => toggleBannerStatus(banner.id, banner.isActive || false)} className={`trigger-button ${banner.isActive ? 'btn-active' : 'btn-inactive'}`} style={{ padding: '8px 16px', backgroundColor: banner.isActive ? '#e74c3c' : '#2ecc71', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '15px' }}>{banner.isActive ? 'Make Inactive' : 'Make Active'}</button>
                  <button onClick={() => setEditingBannerId(null)} className="btn-cancel close-btn" style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Back to Grid</button>
                  <button onClick={handleNextBanner} className="nav-arrow" style={{ padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Next &rarr;</button>
                </div>
                
                <div className="single-banner-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <div className="single-banner-image-container" style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '20px', minHeight: '300px' }}>
                    {banner.url ? (
                      <img src={banner.url} alt={banner.title || banner.id} onClick={() => window.open(banner.clickRedirectUrl || banner.url, '_blank')} title="Click to open link" style={{ cursor: 'pointer', maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }} onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x400?text=Banner+Image';
                      }} />
                    ) : (
                      <div className="banner-placeholder large-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '1.5em' }}>No Image Available</div>
                    )}
                  </div>

                  <div className="single-banner-details" style={{ textAlign: 'center' }}>
                    <h2 className="single-banner-title" style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '2em' }}>{banner.title || banner.id}</h2>
                    {banner.description && <p className="single-banner-desc" style={{ color: '#64748b', fontSize: '1.1em', maxWidth: '800px', margin: '0 auto' }}>{banner.description}</p>}
                  </div>
                    <div style={{ marginTop: '10px', color: '#64748b', fontSize: '1em', fontWeight: 'bold' }}>
                      Added: {formatBannerDate(banner.creationTimestamp)}
                    </div>

                  <div className="banner-edit-form full-width-form" style={{ marginTop: '20px', borderTop: '2px solid #f1f5f9', paddingTop: '20px' }}>
                    <h3 style={{marginTop: 0, marginBottom: '20px', color: '#2c3e50', fontSize: '1.5em'}}>Edit Details</h3>
                    <div className="form-row" style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                      <div className="banner-edit-field" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Title</label>
                        <input 
                          type="text" 
                          className="banner-edit-input"
                          value={editTitle} 
                          onChange={(e) => setEditTitle(e.target.value)} 
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em' }}
                        />
                      </div>
                      <div className="banner-edit-field" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Image URL</label>
                        <input 
                          type="text" 
                          className="banner-edit-input"
                          value={editUrl} 
                          onChange={(e) => setEditUrl(e.target.value)} 
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em' }}
                        />
                      </div>
                    </div>
                    <div className="banner-edit-field" style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Description</label>
                      <textarea 
                        className="banner-edit-input"
                        value={editDescription} 
                        onChange={(e) => setEditDescription(e.target.value)} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', minHeight: '80px', resize: 'vertical', fontSize: '1em', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div className="form-row multi-col" style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                      <div className="banner-edit-field" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Platform</label>
                        <select 
                          className="banner-edit-input"
                          value={editPlatform} 
                          onChange={(e) => setEditPlatform(e.target.value)}
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em' }}
                        >
                          <option value="amazon">Amazon</option>
                          <option value="flipkart">Flipkart</option>
                          <option value="myntra">Myntra</option>
                          <option value="ajio">Ajio</option>
                          <option value="others">Others</option>
                        </select>
                      </div>
                      <div className="banner-edit-field" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Category</label>
                        <select 
                          className="banner-edit-input"
                          value={editCategory} 
                          onChange={(e) => setEditCategory(e.target.value)} 
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em', backgroundColor: 'white' }}
                        >
                          <option value="">Select Category</option>
                          {CATEGORIES.filter(c => c.id !== '').map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="banner-edit-field" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Subcategory</label>
                        <select 
                          className="banner-edit-input"
                          value={editSubcategory} 
                          onChange={(e) => setEditSubcategory(e.target.value)} 
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em', backgroundColor: 'white' }}
                        >
                          <option value="">Select Subcategory</option>
                          {editCategory && CATEGORIES.find(c => c.id === editCategory)?.subcategories?.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                      <div className="banner-edit-field" style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Priority</label>
                        <input 
                          type="number" 
                          className="banner-edit-input"
                          value={editPriority} 
                          onChange={(e) => setEditPriority(parseInt(e.target.value) || 0)} 
                          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em' }}
                        />
                      </div>
                    </div>
                    <div className="banner-edit-field" style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#475569' }}>Redirect URL</label>
                      <input 
                        type="text" 
                        className="banner-edit-input"
                        value={editClickRedirectUrl} 
                        onChange={(e) => setEditClickRedirectUrl(e.target.value)} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em' }}
                      />
                    </div>
                                          <div className="banner-edit-field" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}>
                          <input 
                            type="checkbox"
                            checked={editIsProduct}
                            onChange={(e) => setEditIsProduct(e.target.checked)}
                            style={{ marginRight: '10px', transform: 'scale(1.2)' }}
                          />
                          Is Product Image?
                        </label>
                      </div>
                      <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      <button 
                        onClick={() => toggleBannerStatus(banner.id, banner.isActive || false)}
                        className={`trigger-button ${banner.isActive ? 'btn-active' : 'btn-inactive'}`}
                        style={{ padding: '12px 24px', backgroundColor: banner.isActive ? '#e74c3c' : '#2ecc71', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' }}
                      >
                        {banner.isActive ? 'Make Inactive' : 'Make Active'}
                      </button>
                      <button 
                        onClick={() => handleSaveBannerDetails(banner.id)}
                        className="trigger-button btn-save"
                        style={{ padding: '12px 24px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(46, 204, 113, 0.3)' }}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className={`banners-grid ${isListView ? 'list-view' : ''}`}>
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
                      <div className="banner-image" onClick={() => startEditingBanner(banner)} style={{ cursor: 'pointer' }} title="Click to view details">
                        {banner.url ? (
                          <img src={banner.url} alt={banner.title || banner.id} onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x150?text=Banner+Image';
                          }} />
                        ) : (
                          <div className="banner-placeholder">No Image</div>
                        )}
                      </div>
                      <div className="banner-info">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h3 style={{ margin: 0 }}>{banner.title || banner.id}</h3>
                          <button 
                            onClick={() => startEditingBanner(banner)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer', 
                              fontSize: '15px', 
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#f1f5f9'
                            }}
                            title="Edit banner details"
                          >
                            ✏️
                          </button>
                        </div>
                        {banner.description && <p>{banner.description}</p>}
                        <div className="banner-meta">
                          <span className={`banner-status ${banner.isActive ? 'active' : 'inactive'}`}>
                            {banner.isActive ? '✓ Active' : '✗ Inactive'}
                          </span>
                          {banner.platform && (
                            <span className="banner-platform">{banner.platform}</span>
                          )}
                          {banner.category && (
                            <span className="banner-category">{banner.category}{banner.subcategory && banner.subcategory !== 'Others' ? ` - ${banner.subcategory}` : ''}</span>
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
        )}
      </div>
    );
  };

  return (
    <div className="banners-page" style={{ padding: '20px' }}>
      {renderBannersSection(false)}
    </div>
  );
};

export default BannersPage;






