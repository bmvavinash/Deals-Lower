import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// ─────────────────────────────────────────────
// Multi-Backend Resilient API Client
// Primary  → Oracle Cloud (via Cloudflare Tunnel HTTPS) — faster, more RAM
// Fallback → Render — kept alive via UptimeRobot ping every 10 min
// ─────────────────────────────────────────────

const PRIMARY_URL  = (import.meta as any).env?.VITE_PRIMARY_API_URL  || null;  // Oracle Cloud HTTPS
const FALLBACK_URL = (import.meta as any).env?.VITE_FALLBACK_API_URL || null;  // Render HTTPS
const LEGACY_URL   = (import.meta as any).env?.VITE_API_URL          || '/api'; // Legacy single-backend

// Determine which URL to use based on available env vars
const API_BASE_URL = PRIMARY_URL || LEGACY_URL;

// Track whether we are currently in fallback mode
let usingFallback = false;
let fallbackCheckedAt = 0;
const FALLBACK_RETRY_MS = 2 * 60 * 1000; // Re-try primary every 2 minutes

// Create the primary axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 12000,
});

// ─────────────────────────────────────────────
// Request interceptor: switch to fallback when in fallback mode
// ─────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (usingFallback && FALLBACK_URL) {
    config.baseURL = FALLBACK_URL;
    // Periodically attempt to return to primary
    if (Date.now() - fallbackCheckedAt > FALLBACK_RETRY_MS) {
      usingFallback = false; // optimistically try primary again
    }
  } else if (PRIMARY_URL) {
    config.baseURL = PRIMARY_URL;
  }
  return config;
});

// ─────────────────────────────────────────────
// Response interceptor: on network error, switch to fallback and retry once
// ─────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Successful response — if we were in fallback, stay there until next check
    return response;
  },
  async (error) => {
    const config = error.config as AxiosRequestConfig & { _retried?: boolean };

    // Only attempt fallback if:
    // 1. We have a fallback URL configured
    // 2. This is a network/timeout error (not a 4xx/5xx API error)
    // 3. We haven't already retried this request
    const isNetworkError = !error.response;
    if (FALLBACK_URL && isNetworkError && !config._retried) {
      config._retried = true;
      usingFallback = true;
      fallbackCheckedAt = Date.now();
      config.baseURL = FALLBACK_URL;
      console.warn('[API] Primary backend unreachable. Switching to fallback (Render).');
      return api.request(config);
    }

    return Promise.reject(error);
  }
);

// Deals API
export const dealsAPI = {
  getAll: (params?: { dealType?: string; platform?: string; date?: string; categoryGroup?: string; staticSubcategory?: string; limit?: number; offset?: number }) =>
    api.get('/deals', { params }),
  searchGlobal: (params: { q: string; limit?: number; offset?: number }) =>
    api.get('/deals/search', { params }),
  getByCode: (productCode: string, db?: string) =>
    api.get(`/deals/${encodeURIComponent(productCode)}`, { params: { db } }),
  getNotifications: (productCode: string) =>
    api.get(`/deals/notifications/${encodeURIComponent(productCode)}`),
  triggerBulkUpdate: (sourceType?: string, targetDb?: string) =>
    api.post('/deals/manual-trigger', { sourceType, targetDb }),
  triggerTelegramBot: () =>
    api.post('/deals/trigger-telegram-bot'),
  bulkRefreshTimestamps: (options: { source: 'productdeals' | 'deals' | 'both'; limit?: number; order?: 'newest' | 'oldest' }) =>
    api.post('/deals/bulk-refresh-timestamps', options),
  retriggerProduct: (productCode: string, db?: string) =>
    api.post(`/deals/${encodeURIComponent(productCode)}/retrigger`, {}, { params: { db } }),
  retriggerToday: (fields: string[], priority?: string) =>
    api.post('/deals/retrigger-today', { fields, priority }),
  processProduct: (url: string, postProduct: boolean = false) =>
    api.post('/deals/process-product', { url, postProduct }),
  updateProduct: (productCode: string, updates: any, db?: string) =>
    api.put(`/deals/${productCode}`, updates, { params: { db } }),
  deleteProduct: (productCode: string, db?: string) =>
    api.delete(`/deals/${productCode}`, { params: { db } })
};

// Stocks API
export const stocksAPI = {
  getZerodha: () => api.get('/stocks/zerodha'),
  getXAlpha: () => api.get('/stocks/xalpha'),
  getRecommendations: () => api.get('/stocks/recommendations'),
  getAll: () => api.get('/stocks')
};

// Logs API
export const logsAPI = {
  getAll: (params?: { level?: string; module?: string; startDate?: string; endDate?: string; limit?: number; category?: string; database?: string; source?: string }) =>
    api.get('/logs', { params }),
  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/logs/stats', { params }),
  clear: (params?: { startDate?: string; endDate?: string; level?: string; module?: string }) =>
    api.delete('/logs', { data: params }),
  fix: (logData: { productCode: string; productUrl: string; storeType: string; targetDb?: string; issue?: string }) =>
    api.post('/logs/fix', logData)
};

// News API
export const newsAPI = {
  getAll: (params?: { limit?: number; offset?: number; category?: string; sortBy?: string; order?: string }) =>
    api.get('/news', { params }),
  getById: (id: string) => api.get(`/news/${id}`),
  getReviews: (params?: { limit?: number; offset?: number; productName?: string; minRating?: number; sortBy?: string; order?: string }) =>
    api.get('/news/reviews', { params }),
  getReviewById: (id: string) => api.get(`/news/reviews/${id}`),
  triggerScrape: (params?: { scrapeNews?: boolean; scrapeReviews?: boolean; maxPages?: number; maxArticles?: number }) =>
    api.post('/news/trigger-scrape', params),
  addNews: (data: any) => api.post('/news/manual-add', data),
  addReview: (data: any) => api.post('/news/reviews/manual-add', data)
};

// Scheduler API
export const schedulerAPI = {
  getStatus: () => api.get('/scheduler/status'),
  pause: () => api.post('/scheduler/pause'),
  resume: () => api.post('/scheduler/resume'),
  trigger: () => api.post('/scheduler/trigger'),
  getHistory: (limit?: number) => api.get('/scheduler/history', { params: { limit } })
};

// Notifications API
export const notificationsAPI = {
  getPlatformStatus: (params?: { platform?: string; dealType?: string; success?: boolean }) =>
    api.get('/notifications/platform-status', { params }),
  getDealNotifications: (productCode: string) =>
    api.get(`/notifications/deal/${productCode}`),
  getFailed: () => api.get('/notifications/failed'),
  getStats: () => api.get('/notifications/stats')
};

// Analytics API
export const analyticsAPI = {
  getDeals: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/analytics/deals', { params }),
  getNotifications: () => api.get('/analytics/notifications'),
  getPerformance: () => api.get('/analytics/performance'),
  getBanners: () => api.get('/analytics/banners'),
  getFavoritesNotifications: () => api.get('/analytics/favorites-notifications')
};

// Execution API
export const executionAPI = {
  getStatus: (type?: 'bulk_update' | 'telegram_bot' | 'all') => 
    api.get('/execution/status', { params: { type: type || 'all' } }),
  getAnalytics: () => api.get('/execution/analytics'),
  getHistory: (limit?: number) => api.get('/execution/history', { params: { limit } }),
  getProductDetails: (productCode: string) => api.get(`/execution/product/${productCode}`),
  triggerTask: (type: string, params?: any, forceParallel?: boolean) => 
    api.post('/execution/trigger', { type, params, forceParallel }),
  cancelTask: (taskId: string) => 
    api.post('/execution/queue/cancel', { taskId })
};

// Banners API
export const bannersAPI = {
  extract: () => api.post('/banners/extract')
};

// Categories API
export const categoriesAPI = {
  getHierarchy: () => api.get('/categories/hierarchy'),
  getCustom: () => api.get('/categories/custom'),
  addCustom: (categoryGroup: string, subcategoryName: string) =>
    api.post('/categories/custom', { categoryGroup, subcategoryName })
};

export default api;

