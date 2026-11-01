import { auth } from '../config/firebase';
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

// Create the primary axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Helper to decode JWT payload expiration
function parseTokenExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp || null;
    }
  } catch {}
  return null;
}

// Global broadcast to automatically log out user when session expires
export function triggerSessionExpired(reason = 'Your session has expired. Please sign in again.') {
  try {
    localStorage.removeItem('admin_auth_session');
    localStorage.removeItem('auth_bypass_user');
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session_expired', { detail: { reason } }));
  }
}

// Auto-refresh token mechanism using Firebase
let refreshPromise: Promise<string | null> | null = null;
export async function refreshAuthToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      if (auth && auth.currentUser) {
        console.log('[Auth] Attempting background token refresh via Firebase...');
        const newIdToken = await auth.currentUser.getIdToken(true);
        if (newIdToken) {
          const res = await axios.post(`${API_BASE_URL}/auth/firebase-session`, {
            idToken: newIdToken,
            email: auth.currentUser.email
          }, { timeout: 10000 });

          if (res.data?.token) {
            const newSession = {
              email: auth.currentUser.email,
              token: res.data.token
            };
            localStorage.setItem('admin_auth_session', JSON.stringify(newSession));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth:session_updated', { detail: newSession }));
            }
            console.log('[Auth] Backend session token refreshed successfully.');
            return res.data.token;
          }
          return newIdToken;
        }
      }
    } catch (e) {
      console.warn('[Auth] Background token refresh failed:', e);
    } finally {
      refreshPromise = null;
    }
    return null;
  })();

  return refreshPromise;
}

// ─────────────────────────────────────────────
// Request interceptor: attach auth token & resolve baseURL
// ─────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  // 1. Attach token from admin session if available (with pre-expiration check)
  try {
    const saved = localStorage.getItem('admin_auth_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.token) {
        const exp = parseTokenExp(parsed.token);
        // Pre-emptive update if expiring within 60 seconds or already expired
        if (exp && (exp - 60000) <= Date.now()) {
          const refreshedToken = await refreshAuthToken();
          if (refreshedToken) {
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${refreshedToken}`;
            if (!config.baseURL) config.baseURL = API_BASE_URL;
            return config;
          }
        } else {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${parsed.token}`;
          if (!config.baseURL) config.baseURL = API_BASE_URL;
          return config;
        }
      }
    }
  } catch {
    // ignore JSON error
  }

  // 2. Fallback: If no session token, attach active Firebase user ID token
  if (!config.headers?.['Authorization'] && auth?.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch {
      // ignore firebase token error
    }
  }

  // 3. Fallback: Localhost developer bypass
  if (!config.headers?.['Authorization'] && isLocal) {
    try {
      const bypass = localStorage.getItem('auth_bypass_user');
      if (bypass) {
        config.headers = config.headers || {};
        config.headers['x-admin-email'] = bypass;
        config.headers['x-admin-password'] = 'Avinash@123';
      }
    } catch {}
  }

  if (!config.baseURL) {
    config.baseURL = API_BASE_URL;
  }

  return config;
});

// ─────────────────────────────────────────────
// Response interceptor: on network error, retry with fallback Render URL once
// ─────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const config = error?.config as (AxiosRequestConfig & { _retried?: boolean; _authRetried?: boolean }) | undefined;

    // Automatic Token Update or Automatic Logout on 401 Unauthorized
    if (error?.response?.status === 401 && config && !config._authRetried) {
      config._authRetried = true;
      console.warn('[Auth] Received 401 Unauthorized. Attempting automatic token update...');

      const newToken = await refreshAuthToken();
      if (newToken) {
        console.log('[Auth] Token automatically refreshed. Retrying original request...');
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${newToken}`;
        return api.request(config);
      }

      // If token update is impossible or rejected, automatically log out
      console.warn('[Auth] Credentials expired and cannot be auto-refreshed. Triggering automatic logout.');
      triggerSessionExpired('Your session has expired. Please sign in again.');
      return Promise.reject(error);
    }

    // Network error fallback to Render
    const isNetworkError = Boolean(error && !error.response);
    if (config && !config._retried && isNetworkError && FALLBACK_URL && config.baseURL !== FALLBACK_URL) {
      config._retried = true;
      config.baseURL = FALLBACK_URL;
      console.warn('[API] Request failed. Retrying with fallback (Render):', FALLBACK_URL);
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
  checkQueueStatus: (commandId: string) =>
    api.get(`/deals/queue-status/${encodeURIComponent(commandId)}`),
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
  firebaseSession: (idToken?: string, email?: string) =>
    api.post('/auth/firebase-session', { idToken, email }),
  verify: (token?: string) =>
    api.post('/auth/verify', { token })
};

export default api;
