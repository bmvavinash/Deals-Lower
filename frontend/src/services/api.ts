import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// ─────────────────────────────────────────────
// Multi-Backend Resilient API Client
// Local dev  → /api (proxied by Vite to localhost:3003)
// Production → https://dealsoptimised.onrender.com/api (Render Cloud)
// ─────────────────────────────────────────────

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.')
);

const API_BASE_URL = isLocal ? '/api' : 'https://dealsoptimised.onrender.com/api';
const FALLBACK_URL = 'https://dealsoptimised.onrender.com/api';

let usingFallback = false;

// Create the primary axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─────────────────────────────────────────────
// Request interceptor: attach auth token & resolve baseURL
// ─────────────────────────────────────────────
api.interceptors.request.use((config) => {
  // Attach token from admin session if available
  try {
    const saved = localStorage.getItem('admin_auth_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${parsed.token}`;
      }
    }
  } catch {
    // ignore JSON error
  }

  if (usingFallback && FALLBACK_URL) {
    config.baseURL = FALLBACK_URL;
    if (Date.now() - fallbackCheckedAt > FALLBACK_RETRY_MS) {
      usingFallback = false;
    }
  } else if (PRIMARY_URL) {
    config.baseURL = PRIMARY_URL;
  }

  // Ensure config.baseURL always ends with /api if it's an absolute url
  if (config.baseURL && !config.baseURL.startsWith('/') && !config.baseURL.endsWith('/api')) {
    config.baseURL = ensureApiBase(config.baseURL);
  }

  return config;
});

// ─────────────────────────────────────────────
// Response interceptor: on network error, switch to fallback and retry once
// ─────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
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
      console.warn('[API] Primary backend unreachable. Switching to fallback (Render):', FALLBACK_URL);
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
    api.post(`/deals/${encodeURIComponent(productCode)}/retrigger`, {}, { params: { db }, timeout: 120000 }),
  retriggerToday: (fields: string[], priority?: string) =>
    api.post('/deals/retrigger-today', { fields, priority }, { timeout: 120000 }),
  processProduct: (urlOrUrls: string | string[], postProduct: boolean = false, saleName?: string) => {
    const payload = Array.isArray(urlOrUrls)
      ? { urls: urlOrUrls, postProduct, saleName }
      : { url: urlOrUrls, postProduct, saleName };
    return api.post('/deals/process-product', payload, { timeout: 180000 });
  },
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
  getAll: () => api.get('/stocks'),
  getEquitySignals: (params?: { action?: string; status?: string; source?: string }) =>
    api.get('/stocks/equity/signals', { params }),
  getEquityInsights: () => api.get('/stocks/equity/insights'),
  extractWhatsApp: (port?: number) => api.post('/stocks/equity/extract-whatsapp', { port }),
  extractSheets: (port?: number) => api.post('/stocks/equity/extract-sheets', { port }),
  parseText: (data: { text: string; source?: string; saveToDB?: boolean }) =>
    api.post('/stocks/equity/parse-text', data),
  getClarifications: () => api.get('/stocks/equity/clarifications'),
  resolveClarification: (data: { signalId: string; symbol: string; notes?: string }) =>
    api.post('/stocks/equity/resolve-clarification', data),
  getQuote: (symbol: string) => api.get(`/stocks/equity/quote/${symbol}`),
  getNotifications: () => api.get('/stocks/equity/notifications'),
  triggerCheck: () => api.post('/stocks/equity/trigger-check'),
  refreshQuotes: (force?: boolean) => api.post('/stocks/equity/refresh-quotes', { force }),
  getRefresherStatus: () => api.get('/stocks/equity/refresher-status'),
  startRefresher: (intervalSeconds?: number) => api.post('/stocks/equity/refresher-start', { intervalSeconds }),
  stopRefresher: () => api.post('/stocks/equity/refresher-stop'),
  getTelegramConfig: () => api.get('/stocks/equity/telegram-config'),
  saveTelegramConfig: (data: any) => api.post('/stocks/equity/telegram-config', data),
  testTelegramTopic: (data: { topic: string; customText?: string }) => api.post('/stocks/equity/telegram-test', data),
  getSchedulerStatus: () => api.get('/stocks/scheduler/status'),
  startScheduler: () => api.post('/stocks/scheduler/start'),
  stopScheduler: () => api.post('/stocks/scheduler/stop'),
  triggerSchedulerWhatsApp: () => api.post('/stocks/scheduler/trigger-whatsapp'),
  triggerSchedulerCMP: () => api.post('/stocks/scheduler/trigger-cmp'),
  triggerSchedulerSheets: () => api.post('/stocks/scheduler/trigger-sheets')
};

// IPO API
export const ipoAPI = {
  checkKfintechStatus: (data: { ipoKeyword: string; panNumbers: string[] }) =>
    api.post('/ipo/check-kfintech', data)
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
    api.post('/execution/queue/cancel', { taskId }),
  getHeartbeat: () => api.get('/execution/heartbeat'),
  restartDaemon: () => api.post('/execution/daemon/restart'),
  getSchedulerConfig: () => api.get('/execution/scheduler/config'),
  saveSchedulerConfig: (config: any) => api.post('/execution/scheduler/config', config),
  getLogs: (file?: string) => api.get('/execution/logs', { params: { file } })
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

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  verify: (token?: string) =>
    api.post('/auth/verify', { token })
};

export default api;
