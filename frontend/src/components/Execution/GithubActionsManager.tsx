import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'react-query';
import { executionAPI } from '../../services/api';
import './GithubActionsManager.css';

interface GithubActionItem {
  id: string;
  name: string;
  workflow: string;
  status: 'completed' | 'running' | 'queued' | 'failed' | string;
  source: string;
  runId: string | null;
  commitSha: string | null;
  startTime: string | null;
  completedAt: string | null;
  duration: number;
  summary: {
    productsExtracted?: number;
    productsCreated?: number;
    productsUpdated?: number;
    priceReducedCount?: number;
    missedDealsCount?: number;
    failedCount?: number;
    staleUrlsCount?: number;
    successfulUpdates?: number;
    markedOutOfStock?: number;
    totalExtracted?: number;
    totalStored?: number;
    [key: string]: any;
  };
  actionItems?: Array<{ url: string; reason: string } | string>;
  metadata?: {
    category?: string;
    seedsCount?: number;
    selectedQueries?: string[];
    [key: string]: any;
  };
  lastHeartbeat?: string | null;
  localDaemonDelegated?: boolean;
  category?: string | null;
  currentPointer?: number;
  lastQueries?: string[];
}

interface GithubActionsManagerProps {
  autoRefresh: boolean;
}

interface SubcategoryMatrixItem {
  categoryKey: string;
  categoryName: string;
  categoryIcon: string;
  query: string;
  status: 'completed' | 'in_pipeline' | 'missed' | 'core' | 'upcoming';
  supportedStores: string[];
  lastRunTime?: string | null;
  failureReason?: string;
  missedUrl?: string;
}

const CATEGORY_DEFINITIONS: Record<string, { name: string; icon: string; defaultQueries: string[]; defaultStores: string[] }> = {
  'electronics': {
    name: 'Electronics',
    icon: '⚡',
    defaultQueries: ['air conditioner', 'refrigerator', 'smart tv', 'smartphones', 'laptops', 'earbuds', 'gaming laptop', 'soundbar', 'smartwatch', 'dslr camera'],
    defaultStores: ['amazon', 'flipkart']
  },
  'fashion': {
    name: 'Fashion',
    icon: '👗',
    defaultQueries: ['kurtas', 'kurti', 'running shoes', 'sneakers', 't-shirts', 'jeans', 'dresses', 'jackets', 'analog watch', 'backpack'],
    defaultStores: ['amazon', 'flipkart', 'myntra', 'ajio']
  },
  'home-kitchen': {
    name: 'Home & Kitchen',
    icon: '🏠',
    defaultQueries: ['air fryer', 'microwave oven', 'water purifier', 'mixer grinder', 'vacuum cleaner', 'mattress', 'cookware', 'dining table'],
    defaultStores: ['amazon', 'flipkart']
  },
  'beauty-personal-care': {
    name: 'Beauty & Personal Care',
    icon: '💄',
    defaultQueries: ['haircare', 'face wash', 'sunscreen', 'perfume', 'hair dryer', 'lipstick', 'trimmers', 'body lotion'],
    defaultStores: ['amazon', 'flipkart', 'myntra']
  },
  'sports-fitness': {
    name: 'Sports & Fitness',
    icon: '🏋️',
    defaultQueries: ['dumbbells', 'yoga mat', 'treadmill', 'protein powder', 'running shoes', 'exercise bike', 'badminton racket'],
    defaultStores: ['amazon', 'flipkart', 'myntra']
  },
  'baby-kids': {
    name: 'Baby & Kids',
    icon: '👶',
    defaultQueries: ['diapers', 'baby clothes', 'baby stroller', 'kids toys', 'board games', 'baby car seat', 'kids shoes'],
    defaultStores: ['amazon', 'flipkart', 'myntra', 'ajio']
  },
  'grocery': {
    name: 'Grocery & Gourmet',
    icon: '🛒',
    defaultQueries: ['almonds', 'cashews', 'cooking oil', 'dry fruits', 'peanut butter', 'coffee beans', 'tea', 'oats'],
    defaultStores: ['amazon', 'flipkart']
  },
  'automotive': {
    name: 'Automotive',
    icon: '🚗',
    defaultQueries: ['car dash cam', 'helmet', 'car vacuum cleaner', 'car tire inflator', 'bike accessories', 'car perfume'],
    defaultStores: ['amazon', 'flipkart']
  },
  'books-stationery': {
    name: 'Books & Stationery',
    icon: '📚',
    defaultQueries: ['bestseller books', 'fiction books', 'kindle paperwhite', 'notebooks', 'pens', 'self help books'],
    defaultStores: ['amazon', 'flipkart']
  },
  'deals-trending': {
    name: 'Deals & Trending',
    icon: '🔥',
    defaultQueries: ['todays deals', 'trending offers', 'lightning deals', 'hot deals', 'electronics sale', 'clearance sale'],
    defaultStores: ['amazon', 'flipkart', 'myntra']
  },
  'stale-products-update': {
    name: 'Stale Products Update',
    icon: '🔄',
    defaultQueries: [],
    defaultStores: ['amazon', 'flipkart', 'myntra', 'ajio']
  },
  'favorites-check': {
    name: 'Favorites Check',
    icon: '❤️',
    defaultQueries: [],
    defaultStores: ['amazon', 'flipkart', 'myntra', 'ajio']
  },
  'hot-deals-telegram': {
    name: 'Hot Deals Telegram',
    icon: '📱',
    defaultQueries: [],
    defaultStores: ['amazon', 'flipkart', 'myntra', 'ajio']
  },
  'banners-fetch': {
    name: 'Banners Fetch',
    icon: '🖼️',
    defaultQueries: [],
    defaultStores: ['amazon', 'flipkart']
  },
  'amazon-promo-cards-fetch': {
    name: 'Amazon Promo Cards',
    icon: '🎯',
    defaultQueries: [],
    defaultStores: ['amazon']
  }
};

const COMPANY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'amazon': { label: 'Amazon', icon: '🟠', color: '#ff9900' },
  'flipkart': { label: 'Flipkart', icon: '🔵', color: '#2874f0' },
  'myntra': { label: 'Myntra', icon: '🔴', color: '#ff3f6c' },
  'ajio': { label: 'Ajio', icon: '🟢', color: '#2c4152' }
};

const formatDuration = (ms?: number) => {
  if (!ms || ms <= 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins}m ${remainingSecs}s`;
};

const formatRelativeTime = (dateString?: string | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays <= 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
};

const buildPlatformSearchUrl = (store: string, query: string) => {
  const q = encodeURIComponent(query.trim());
  const slug = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  switch (store.toLowerCase()) {
    case 'amazon':
      return `https://www.amazon.in/s?k=${q}`;
    case 'flipkart':
      return `https://www.flipkart.com/search?q=${q}`;
    case 'myntra':
      return `https://www.myntra.com/${slug}`;
    case 'ajio':
      return `https://www.ajio.com/search/?text=${q}`;
    default:
      return `https://www.amazon.in/s?k=${q}`;
  }
};

export const GithubActionsManager: React.FC<GithubActionsManagerProps> = ({ autoRefresh }) => {
  // Main view mode switcher: 'workflows' | 'rotation-matrix'
  const [activeViewMode, setActiveViewMode] = useState<'workflows' | 'rotation-matrix'>('workflows');

  // Trigger Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('electronics');
  const [targetQuery, setTargetQuery] = useState<string>('');
  const [dispatchTarget, setDispatchTarget] = useState<'auto' | 'github-actions' | 'commands-queue'>('auto');
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem('lowerdeal_gha_token') || '');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Workflow Filters State
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  // Rotation Matrix Specific Filters & Controls
  const [matrixCompanyFilter, setMatrixCompanyFilter] = useState<string>('all');
  const [matrixStatusFilter, setMatrixStatusFilter] = useState<string>('all');
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>('all');
  const [matrixGroupBy, setMatrixGroupBy] = useState<'category' | 'status' | 'company'>('category');
  const [matrixSortBy, setMatrixSortBy] = useState<'lastUpdated' | 'progress' | 'name' | 'missedCount'>('lastUpdated');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');

  // Query API
  const { data: responseData, refetch, isLoading } = useQuery(
    'execution-github-actions',
    () => executionAPI.getGithubActions(),
    {
      refetchInterval: autoRefresh ? 4000 : false,
      staleTime: 2000
    }
  );

  const data = (responseData?.data as any)?.data;
  const actions: GithubActionItem[] = data?.actions || [];
  const categoryPointers = data?.categoryPointers || {};
  const catalog = data?.catalog || {};
  const serverHasGhToken = !!data?.serverHasGhToken;

  // Persist token in localStorage
  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setGithubToken(val);
    if (val) {
      localStorage.setItem('lowerdeal_gha_token', val);
    } else {
      localStorage.removeItem('lowerdeal_gha_token');
    }
  };

  // Queries for selected category from catalog or fallback
  const availableQueries = useMemo(() => {
    const fromCatalog = catalog[selectedCategory]?.rotatingQueries;
    if (fromCatalog && Array.isArray(fromCatalog) && fromCatalog.length > 0) {
      return fromCatalog;
    }
    return CATEGORY_DEFINITIONS[selectedCategory]?.defaultQueries || [];
  }, [catalog, selectedCategory]);

  const handleSelectQueryChip = (query: string) => {
    setTargetQuery(query);
  };

  const handleClearQuery = () => {
    setTargetQuery('');
  };

  const handleTriggerAction = async (overrideCategory?: string, overrideQuery?: string, overrideActionName?: string) => {
    setIsSubmitting(true);
    setFeedback(null);

    const cat = overrideCategory !== undefined ? overrideCategory : selectedCategory;
    const q = overrideQuery !== undefined ? overrideQuery : targetQuery;
    const actName = overrideActionName || (cat.includes('-') && !cat.startsWith('category-') && !CATEGORY_DEFINITIONS[cat] ? cat : (cat.startsWith('category-') ? cat : `category-${cat}`));

    try {
      const res = await executionAPI.triggerGithubAction({
        category: cat.startsWith('category-') ? cat.replace('category-', '') : cat,
        target_query: q || '',
        actionName: actName,
        dispatchTarget,
        githubToken: githubToken || undefined
      });

      const resData = (res.data as any);
      setFeedback({
        text: resData.message || `Action ${actName} triggered successfully via ${resData.dispatchedVia}!`,
        type: 'success'
      });

      refetch();
      setTimeout(() => setFeedback(null), 8000);
    } catch (err: any) {
      setFeedback({
        text: err.response?.data?.error || err.message || 'Failed to trigger action.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter actions for Workflows View
  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      if (filterCategory !== 'all') {
        const matchesCategory = 
          action.category === filterCategory ||
          action.name === filterCategory ||
          action.name === `category-${filterCategory}`;
        if (!matchesCategory) return false;
      }

      if (filterStatus !== 'all') {
        if (action.status !== filterStatus) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = action.name?.toLowerCase().includes(q);
        const matchesWorkflow = action.workflow?.toLowerCase().includes(q);
        const matchesQueryList = (action.lastQueries || action.metadata?.selectedQueries || []).some(k => k.toLowerCase().includes(q));
        const matchesItems = (action.actionItems || []).some(item => {
          const str = typeof item === 'string' ? item : `${item.url} ${item.reason}`;
          return str.toLowerCase().includes(q);
        });
        if (!matchesName && !matchesWorkflow && !matchesQueryList && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [actions, filterCategory, filterStatus, searchQuery]);

  // Build Comprehensive Subcategories Matrix across all Categories, Subcategories, and Companies
  const { allMatrixItems, categorySummaries } = useMemo(() => {
    const items: SubcategoryMatrixItem[] = [];
    const catSummaries: Record<string, {
      categoryKey: string;
      name: string;
      icon: string;
      totalQueries: number;
      pointer: number;
      progressPct: number;
      completedCount: number;
      pipelineCount: number;
      missedCount: number;
      upcomingCount: number;
      lastUpdated: string | null;
      supportedStores: string[];
      action?: GithubActionItem;
    }> = {};

    const catKeys = Object.keys(CATEGORY_DEFINITIONS).filter(k => !k.includes('update') && !k.includes('fetch') && !k.includes('check') && !k.includes('telegram'));

    catKeys.forEach(catKey => {
      const def = CATEGORY_DEFINITIONS[catKey];
      const catData = catalog[catKey] || {};
      const coreQueries: string[] = catData.coreQueries || [];
      const rotatingQueries: string[] = (catData.rotatingQueries && catData.rotatingQueries.length > 0) 
        ? catData.rotatingQueries 
        : def.defaultQueries;
      const supportedStores: string[] = catData.supportedStores || def.defaultStores;

      const pointerInfo = categoryPointers[catKey] || { pointer: 0, lastQueries: [], lastUpdated: null };
      const pointer = pointerInfo.pointer || 0;
      const lastQueries: string[] = (pointerInfo.lastQueries || []).map((q: string) => q.toLowerCase());

      const action = actions.find(a => a.category === catKey || a.name === `category-${catKey}`);
      const failedActionItems = action?.actionItems || [];
      const missedUrls = failedActionItems.map(item => typeof item === 'string' ? item : item.url);

      const batchSize = 8;
      const totalRotating = rotatingQueries.length;
      const pipelineWindow: string[] = [];
      for (let i = 0; i < Math.min(batchSize, totalRotating); i++) {
        const idx = (pointer + i) % totalRotating;
        pipelineWindow.push(rotatingQueries[idx].toLowerCase());
      }

      let compCount = 0;
      let pipeCount = 0;
      let missCount = 0;
      let upCount = 0;

      // Add Core Evergreen Queries
      coreQueries.forEach(q => {
        items.push({
          categoryKey: catKey,
          categoryName: def.name,
          categoryIcon: def.icon,
          query: q,
          status: 'core',
          supportedStores,
          lastRunTime: pointerInfo.lastUpdated
        });
      });

      // Add Rotating Subcategory Queries
      rotatingQueries.forEach((q, idx) => {
        const qLower = q.toLowerCase();
        let status: 'completed' | 'in_pipeline' | 'missed' | 'upcoming' = 'upcoming';

        const isMissed = missedUrls.some(u => u.toLowerCase().includes(encodeURIComponent(qLower)) || u.toLowerCase().includes(qLower.replace(/\s+/g, '-')));

        if (isMissed) {
          status = 'missed';
          missCount++;
        } else if (lastQueries.includes(qLower)) {
          status = 'completed';
          compCount++;
        } else if (pipelineWindow.includes(qLower)) {
          status = 'in_pipeline';
          pipeCount++;
        } else {
          status = 'upcoming';
          upCount++;
        }

        items.push({
          categoryKey: catKey,
          categoryName: def.name,
          categoryIcon: def.icon,
          query: q,
          status,
          supportedStores,
          lastRunTime: pointerInfo.lastUpdated
        });
      });

      const progressPct = totalRotating > 0 ? Math.round((pointer / totalRotating) * 100) : 0;

      catSummaries[catKey] = {
        categoryKey: catKey,
        name: def.name,
        icon: def.icon,
        totalQueries: totalRotating + coreQueries.length,
        pointer,
        progressPct,
        completedCount: compCount,
        pipelineCount: pipeCount,
        missedCount: missCount,
        upcomingCount: upCount,
        lastUpdated: pointerInfo.lastUpdated || action?.completedAt || null,
        supportedStores,
        action
      };
    });

    return { allMatrixItems: items, categorySummaries: catSummaries };
  }, [catalog, categoryPointers, actions]);

  // Filter Subcategory Matrix Items
  const filteredMatrixItems = useMemo(() => {
    return allMatrixItems.filter(item => {
      // Category filter
      if (matrixCategoryFilter !== 'all' && item.categoryKey !== matrixCategoryFilter) {
        return false;
      }

      // Company/Platform filter
      if (matrixCompanyFilter !== 'all' && !item.supportedStores.includes(matrixCompanyFilter)) {
        return false;
      }

      // Status filter
      if (matrixStatusFilter !== 'all' && item.status !== matrixStatusFilter) {
        return false;
      }

      // Text search
      if (matrixSearchQuery.trim()) {
        const q = matrixSearchQuery.toLowerCase();
        const matchesQuery = item.query.toLowerCase().includes(q);
        const matchesCat = item.categoryName.toLowerCase().includes(q);
        const matchesStore = item.supportedStores.some(s => s.toLowerCase().includes(q));
        if (!matchesQuery && !matchesCat && !matchesStore) {
          return false;
        }
      }

      return true;
    });
  }, [allMatrixItems, matrixCategoryFilter, matrixCompanyFilter, matrixStatusFilter, matrixSearchQuery]);

  // Grouped Categories for Display
  const sortedCategories = useMemo(() => {
    const list = Object.values(categorySummaries);

    // Filter by category or company
    const filtered = list.filter(cat => {
      if (matrixCategoryFilter !== 'all' && cat.categoryKey !== matrixCategoryFilter) return false;
      if (matrixCompanyFilter !== 'all' && !cat.supportedStores.includes(matrixCompanyFilter)) return false;
      return true;
    });

    // Sort categories
    filtered.sort((a, b) => {
      if (matrixSortBy === 'lastUpdated') {
        const tA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const tB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return tB - tA;
      }
      if (matrixSortBy === 'progress') {
        return b.progressPct - a.progressPct;
      }
      if (matrixSortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (matrixSortBy === 'missedCount') {
        return b.missedCount - a.missedCount;
      }
      return 0;
    });

    return filtered;
  }, [categorySummaries, matrixCategoryFilter, matrixCompanyFilter, matrixSortBy]);

  return (
    <div className="github-actions-manager">
      {/* View Switcher Tabs: Workflows vs Subcategories Rotation Matrix */}
      <div className="gha-view-switcher-bar">
        <div className="gha-switcher-buttons">
          <button
            className={`gha-switcher-btn ${activeViewMode === 'workflows' ? 'active' : ''}`}
            onClick={() => setActiveViewMode('workflows')}
          >
            ⚡ Workflows & Execution Runs ({actions.length})
          </button>
          <button
            className={`gha-switcher-btn ${activeViewMode === 'rotation-matrix' ? 'active' : ''}`}
            onClick={() => setActiveViewMode('rotation-matrix')}
          >
            🔄 Rotating Coverage Matrix & Subcategories ({allMatrixItems.length})
          </button>
        </div>

        <div className="gha-token-status-pill">
          <span className={`status-indicator ${serverHasGhToken || githubToken ? 'active' : 'warn'}`}></span>
          <span>{serverHasGhToken || githubToken ? 'GitHub Actions API Online' : 'CommandsQueue Daemon Mode'}</span>
          <button 
            className="gha-token-toggle-btn"
            onClick={() => setShowTokenInput(!showTokenInput)}
            title="Configure Personal Access Token"
          >
            ⚙️ {showTokenInput ? 'Hide Token' : 'Set Token'}
          </button>
        </div>
      </div>

      {/* Optional PAT Input */}
      {showTokenInput && (
        <div className="gha-token-input-row">
          <label>GitHub Personal Access Token (PAT):</label>
          <input
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={githubToken}
            onChange={handleTokenChange}
          />
          <span className="gha-token-hint">
            Saved locally in browser. If left empty, dispatches to <code>commandsQueue</code> for local/Oracle daemon execution.
          </span>
        </div>
      )}

      {/* Feedback Message */}
      {feedback && (
        <div className={`gha-feedback-banner ${feedback.type}`}>
          <span className="feedback-icon">{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="feedback-text">{feedback.text}</span>
          <button className="feedback-close-btn" onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 1: WORKFLOWS & EXECUTION RUNS VIEW                  */}
      {/* ======================================================== */}
      {activeViewMode === 'workflows' && (
        <>
          {/* Top Dispatch Console */}
          <div className="gha-console-card">
            <div className="gha-console-header">
              <div>
                <h2>🚀 Instant Category & Search Dispatch</h2>
                <p className="gha-console-subtitle">
                  Trigger targeted subcategories or A-to-Z search keywords directly across Amazon, Flipkart, Myntra, and Ajio.
                </p>
              </div>
            </div>

            <div className="gha-trigger-form">
              <div className="gha-form-row">
                {/* Category Dropdown */}
                <div className="gha-field-group">
                  <label>1. Select Category</label>
                  <select
                    className="gha-select"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setTargetQuery('');
                    }}
                  >
                    <optgroup label="🛍️ Product Categories (Rotating Matrix)">
                      <option value="electronics">⚡ Electronics (TVs, Laptops, ACs, Audio)</option>
                      <option value="fashion">👗 Fashion (Kurtas, Shoes, Jeans, Sarees)</option>
                      <option value="home-kitchen">🏠 Home & Kitchen (Appliances, Decor)</option>
                      <option value="beauty-personal-care">💄 Beauty & Personal Care (Skincare, Hair)</option>
                      <option value="sports-fitness">🏋️ Sports & Fitness (Gym, Shoes, Treadmill)</option>
                      <option value="baby-kids">👶 Baby & Kids (Toys, Diapers, Clothes)</option>
                      <option value="grocery">🛒 Grocery & Gourmet (Dry fruits, Oils)</option>
                      <option value="automotive">🚗 Automotive (Car Care, Dashcams)</option>
                      <option value="books-stationery">📚 Books & Stationery (Kindle, Best Sellers)</option>
                      <option value="deals-trending">🔥 Deals & Trending (Lightning Deals)</option>
                    </optgroup>
                    <optgroup label="⚙️ Maintenance & Bot Workflows">
                      <option value="stale-products-update">🔄 Stale Products Update</option>
                      <option value="favorites-check">❤️ Favorites Check</option>
                      <option value="hot-deals-telegram">📱 Hot Deals Telegram</option>
                      <option value="banners-fetch">🖼️ Banners Fetch</option>
                      <option value="amazon-promo-cards-fetch">🎯 Amazon Promotional Cards</option>
                    </optgroup>
                  </select>
                </div>

                {/* Target Query Input */}
                <div className="gha-field-group flex-grow">
                  <label>
                    2. Target Subcategory or Search Query 
                    <span className="optional-tag">(Leave blank to use round-robin rotation)</span>
                  </label>
                  <div className="gha-query-input-wrap">
                    <input
                      type="text"
                      className="gha-input"
                      placeholder="e.g. air conditioner, refrigerator, smart tv, earbuds, running shoes..."
                      value={targetQuery}
                      onChange={(e) => setTargetQuery(e.target.value)}
                      disabled={selectedCategory.includes('fetch') || selectedCategory.includes('check') || selectedCategory.includes('stale')}
                    />
                    {targetQuery && (
                      <button className="gha-input-clear-btn" onClick={handleClearQuery} title="Clear query">
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Dispatch Target */}
                <div className="gha-field-group">
                  <label>3. Runner Mode</label>
                  <select
                    className="gha-select"
                    value={dispatchTarget}
                    onChange={(e) => setDispatchTarget(e.target.value as any)}
                  >
                    <option value="auto">⚡ Auto (GitHub Actions + Fallback)</option>
                    <option value="github-actions">☁️ GitHub Actions Cloud</option>
                    <option value="commands-queue">🖥️ Local / Oracle Daemon</option>
                  </select>
                </div>

                {/* Trigger Button */}
                <div className="gha-field-group btn-group">
                  <button
                    className="gha-dispatch-btn"
                    onClick={() => handleTriggerAction()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="gha-spinner"></span>
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀 Dispatch Action</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Query Suggestion Chips */}
              {availableQueries.length > 0 && (
                <div className="gha-chips-row">
                  <span className="chips-label">Popular Searches:</span>
                  <div className="chips-scroll">
                    {availableQueries.slice(0, 14).map((q) => (
                      <button
                        key={q}
                        className={`gha-chip ${targetQuery.toLowerCase() === q.toLowerCase() ? 'active' : ''}`}
                        onClick={() => handleSelectQueryChip(q)}
                      >
                        {q}
                      </button>
                    ))}
                    {targetQuery && (
                      <button className="gha-chip-reset" onClick={handleClearQuery}>
                        🔄 Reset to Auto-Rotation
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Filter Bar */}
          <div className="gha-filter-bar">
            <div className="gha-filter-left">
              <div className="filter-group">
                <label>Filter Category:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">📁 All Workflows ({actions.length})</option>
                  {Object.entries(CATEGORY_DEFINITIONS).map(([key, def]) => (
                    <option key={key} value={key}>
                      {def.icon} {def.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">✅ Completed</option>
                  <option value="running">⚡ Running</option>
                  <option value="queued">⏳ Queued</option>
                  <option value="failed">❌ Failed</option>
                </select>
              </div>

              <div className="filter-group search-group">
                <input
                  type="text"
                  placeholder="🔍 Search actions, queries, errors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="filter-search-input"
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')}>×</button>
                )}
              </div>
            </div>

            <div className="gha-filter-right">
              <span className="results-count">
                Showing <strong>{filteredActions.length}</strong> of <strong>{actions.length}</strong> workflows
              </span>
              {(filterCategory !== 'all' || filterStatus !== 'all' || searchQuery) && (
                <button 
                  className="filter-reset-btn"
                  onClick={() => {
                    setFilterCategory('all');
                    setFilterStatus('all');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Action Cards Grid */}
          {isLoading && actions.length === 0 ? (
            <div className="gha-loading-state">
              <div className="gha-big-spinner"></div>
              <p>Loading GitHub Actions execution history...</p>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="gha-empty-state">
              <span className="empty-icon">📂</span>
              <h3>No matching GitHub Actions found</h3>
              <p>Try adjusting your category, status, or search filters above.</p>
            </div>
          ) : (
            <div className="gha-cards-grid">
              {filteredActions.map((action) => {
                const isExpanded = expandedActionId === action.id;
                const def = CATEGORY_DEFINITIONS[action.category || ''] || CATEGORY_DEFINITIONS[action.name] || { name: action.name, icon: '⚡' };
                const queries = action.lastQueries || action.metadata?.selectedQueries || [];
                const summary = action.summary || {};
                const extracted = summary.productsExtracted || summary.totalExtracted || summary.extracted || 0;
                const created = summary.productsCreated || summary.created || 0;
                const updated = summary.productsUpdated || summary.updated || summary.successfulUpdates || 0;
                const priceDrops = summary.priceReducedCount || 0;
                const missedDeals = summary.missedDealsCount || summary.missedDeals || 0;
                const failedCount = summary.failedCount || summary.failed || (action.actionItems?.length || 0);

                return (
                  <div key={action.id} className={`gha-card status-${action.status}`}>
                    {/* Header */}
                    <div className="gha-card-header">
                      <div className="gha-card-title-wrap">
                        <span className="gha-card-icon">{def.icon}</span>
                        <div>
                          <h3 className="gha-card-title">{action.workflow || action.name}</h3>
                          <div className="gha-card-submeta">
                            <span className="gha-action-name-tag">{action.name}</span>
                            {action.runId && (
                              <a
                                href={`https://github.com/bmvavinash/Deals-Lower/actions/runs/${action.runId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gha-run-link"
                                title="View GitHub Actions Run"
                              >
                                Run #{action.runId} ↗
                              </a>
                            )}
                            {action.commitSha && (
                              <span className="gha-commit-tag">
                                sha:{action.commitSha.slice(0, 7)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="gha-card-status-col">
                        <span className={`gha-status-badge ${action.status}`}>
                          {action.status === 'running' && <span className="gha-pulse-dot"></span>}
                          {action.status.toUpperCase()}
                        </span>
                        <span className="gha-time-relative">
                          {formatRelativeTime(action.completedAt || action.startTime)}
                        </span>
                      </div>
                    </div>

                    {/* Duration & Execution Timing */}
                    <div className="gha-card-timing">
                      <span>⏱️ Duration: <strong>{formatDuration(action.duration)}</strong></span>
                      {action.startTime && (
                        <span>Started: {new Date(action.startTime).toLocaleTimeString()}</span>
                      )}
                      {action.completedAt && (
                        <span>Finished: {new Date(action.completedAt).toLocaleTimeString()}</span>
                      )}
                    </div>

                    {/* KPI Metrics Grid */}
                    <div className="gha-kpi-grid">
                      <div className="gha-kpi-item">
                        <span className="kpi-label">Extracted</span>
                        <span className="kpi-value">{extracted}</span>
                      </div>
                      <div className="gha-kpi-item created">
                        <span className="kpi-label">Created</span>
                        <span className="kpi-value">+{created}</span>
                      </div>
                      <div className="gha-kpi-item updated">
                        <span className="kpi-label">Updated</span>
                        <span className="kpi-value">~{updated}</span>
                      </div>
                      <div className="gha-kpi-item price-drop">
                        <span className="kpi-label">Price Drops</span>
                        <span className="kpi-value">📉 {priceDrops}</span>
                      </div>
                      <div className="gha-kpi-item missed-deals">
                        <span className="kpi-label">Missed</span>
                        <span className="kpi-value">⚠️ {missedDeals}</span>
                      </div>
                      <div className={`gha-kpi-item ${failedCount > 0 ? 'failed' : ''}`}>
                        <span className="kpi-label">Failed / Del.</span>
                        <span className="kpi-value">{failedCount > 0 ? `❌ ${failedCount}` : '0'}</span>
                      </div>
                    </div>

                    {/* Rotating Queries / Catalog Progress */}
                    {queries.length > 0 && (
                      <div className="gha-queries-section">
                        <div className="queries-label-row">
                          <span className="queries-title">Active Rotation Queries:</span>
                          {action.currentPointer !== undefined && action.currentPointer > 0 && (
                            <span className="pointer-tag">Catalog Pointer: #{action.currentPointer}</span>
                          )}
                        </div>
                        <div className="queries-pills">
                          {queries.map((q, idx) => (
                            <span key={idx} className="query-pill">
                              {q}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items / Failed URLs Accordion */}
                    {action.actionItems && action.actionItems.length > 0 && (
                      <div className="gha-action-items-section">
                        <button
                          className="action-items-toggle-btn"
                          onClick={() => setExpandedActionId(isExpanded ? null : action.id)}
                        >
                          <span>
                            ⚠️ {action.actionItems.length} Missed/Failed Items {action.localDaemonDelegated ? '(Delegated to Local Daemon)' : ''}
                          </span>
                          <span>{isExpanded ? '▲ Hide' : '▼ View Items'}</span>
                        </button>

                        {isExpanded && (
                          <div className="action-items-list">
                            {action.actionItems.map((item, idx) => {
                              const url = typeof item === 'string' ? item : item.url;
                              const reason = typeof item === 'string' ? 'Extraction failure' : item.reason;
                              return (
                                <div key={idx} className="action-item-row">
                                  <span className="item-reason">{reason}</span>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="item-url-link"
                                  >
                                    {url}
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Action Footer */}
                    <div className="gha-card-footer">
                      <span className="gha-source-label">
                        Runner: <strong>{action.source}</strong> {action.localDaemonDelegated && '⚡ Auto-Delegated to Daemon'}
                      </span>
                      <button
                        className="gha-retrigger-btn"
                        onClick={() => {
                          setSelectedCategory(action.category || action.name.replace('category-', ''));
                          handleTriggerAction(action.category || action.name.replace('category-', ''), '', action.name);
                        }}
                        title="Run this action now"
                      >
                        ▶️ Run Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: ROTATING COVERAGE MATRIX & SUBCATEGORIES         */}
      {/* ======================================================== */}
      {activeViewMode === 'rotation-matrix' && (
        <div className="gha-matrix-view">
          {/* Matrix Top Summary KPI Ribbon */}
          <div className="matrix-kpi-ribbon">
            <div className="matrix-kpi-card">
              <span className="kpi-icon">📁</span>
              <div>
                <span className="kpi-num">{Object.keys(categorySummaries).length}</span>
                <span className="kpi-title">Active Categories</span>
              </div>
            </div>
            <div className="matrix-kpi-card">
              <span className="kpi-icon">🏷️</span>
              <div>
                <span className="kpi-num">{allMatrixItems.length}</span>
                <span className="kpi-title">Total Subcategories & A-Z</span>
              </div>
            </div>
            <div className="matrix-kpi-card completed">
              <span className="kpi-icon">🟢</span>
              <div>
                <span className="kpi-num">
                  {allMatrixItems.filter(i => i.status === 'completed').length}
                </span>
                <span className="kpi-title">Completed (Fresh)</span>
              </div>
            </div>
            <div className="matrix-kpi-card in-pipeline">
              <span className="kpi-icon">🔵</span>
              <div>
                <span className="kpi-num">
                  {allMatrixItems.filter(i => i.status === 'in_pipeline').length}
                </span>
                <span className="kpi-title">In Pipeline (Next Batch)</span>
              </div>
            </div>
            <div className="matrix-kpi-card missed">
              <span className="kpi-icon">🔴</span>
              <div>
                <span className="kpi-num">
                  {allMatrixItems.filter(i => i.status === 'missed').length}
                </span>
                <span className="kpi-title">Missed / Delegated</span>
              </div>
            </div>
            <div className="matrix-kpi-card upcoming">
              <span className="kpi-icon">⚪</span>
              <div>
                <span className="kpi-num">
                  {allMatrixItems.filter(i => i.status === 'upcoming').length}
                </span>
                <span className="kpi-title">Upcoming in Pool</span>
              </div>
            </div>
          </div>

          {/* Matrix Controls & Filters Bar */}
          <div className="matrix-controls-panel">
            <div className="matrix-filters-row">
              {/* Company / Platform Filter */}
              <div className="matrix-filter-group">
                <label>Company / Platform:</label>
                <div className="company-toggle-group">
                  <button
                    className={`company-toggle-btn ${matrixCompanyFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setMatrixCompanyFilter('all')}
                  >
                    All Companies
                  </button>
                  {Object.entries(COMPANY_CONFIG).map(([storeKey, conf]) => (
                    <button
                      key={storeKey}
                      className={`company-toggle-btn ${matrixCompanyFilter === storeKey ? 'active' : ''}`}
                      onClick={() => setMatrixCompanyFilter(storeKey)}
                    >
                      {conf.icon} {conf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="matrix-filter-group">
                <label>Status Filter:</label>
                <select
                  className="matrix-select"
                  value={matrixStatusFilter}
                  onChange={(e) => setMatrixStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses ({allMatrixItems.length})</option>
                  <option value="completed">🟢 Completed (Fresh in last run)</option>
                  <option value="in_pipeline">🔵 In Pipeline (Next up in rotation)</option>
                  <option value="missed">🔴 Missed / Delegated (Needs attention)</option>
                  <option value="upcoming">⚪ Upcoming in cycle</option>
                  <option value="core">💎 Core Evergreen (Smartphones, Laptops, etc.)</option>
                </select>
              </div>

              {/* Category Filter */}
              <div className="matrix-filter-group">
                <label>Category:</label>
                <select
                  className="matrix-select"
                  value={matrixCategoryFilter}
                  onChange={(e) => setMatrixCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories ({Object.keys(categorySummaries).length})</option>
                  {Object.entries(CATEGORY_DEFINITIONS).filter(([k]) => !k.includes('check') && !k.includes('update') && !k.includes('fetch') && !k.includes('telegram')).map(([key, def]) => (
                    <option key={key} value={key}>
                      {def.icon} {def.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Group By Filter */}
              <div className="matrix-filter-group">
                <label>Group By:</label>
                <select
                  className="matrix-select"
                  value={matrixGroupBy}
                  onChange={(e) => setMatrixGroupBy(e.target.value as any)}
                >
                  <option value="category">📁 Group by Category</option>
                  <option value="status">📊 Group by Status (Completed / Pipeline / Missed)</option>
                  <option value="company">🏢 Group by Company (Amazon / Flipkart / Myntra / Ajio)</option>
                </select>
              </div>

              {/* Sort By Filter */}
              <div className="matrix-filter-group">
                <label>Sort Categories By:</label>
                <select
                  className="matrix-select"
                  value={matrixSortBy}
                  onChange={(e) => setMatrixSortBy(e.target.value as any)}
                >
                  <option value="lastUpdated">🕒 Last Refreshed</option>
                  <option value="progress">📈 Rotation Progress %</option>
                  <option value="name">🔤 Alphabetical (A-Z)</option>
                  <option value="missedCount">⚠️ Most Missed / Errors First</option>
                </select>
              </div>

              {/* Text Search Filter */}
              <div className="matrix-filter-group search">
                <label>Search Subcategories:</label>
                <div className="matrix-search-wrap">
                  <input
                    type="text"
                    placeholder="🔍 e.g. air conditioner, kurtas, shoes..."
                    value={matrixSearchQuery}
                    onChange={(e) => setMatrixSearchQuery(e.target.value)}
                    className="matrix-search-input"
                  />
                  {matrixSearchQuery && (
                    <button className="search-clear-btn" onClick={() => setMatrixSearchQuery('')}>×</button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Filter Reset */}
            <div className="matrix-status-counter-bar">
              <span>
                Displaying <strong>{filteredMatrixItems.length}</strong> subcategories across <strong>{sortedCategories.length}</strong> categories
              </span>
              {(matrixCompanyFilter !== 'all' || matrixStatusFilter !== 'all' || matrixCategoryFilter !== 'all' || matrixSearchQuery) && (
                <button
                  className="matrix-reset-btn"
                  onClick={() => {
                    setMatrixCompanyFilter('all');
                    setMatrixStatusFilter('all');
                    setMatrixCategoryFilter('all');
                    setMatrixSearchQuery('');
                  }}
                >
                  Reset All Matrix Filters
                </button>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* GROUP BY: CATEGORY                                       */}
          {/* ======================================================== */}
          {matrixGroupBy === 'category' && (
            <div className="category-matrix-accordion">
              {sortedCategories.map(cat => {
                const catItems = filteredMatrixItems.filter(i => i.categoryKey === cat.categoryKey);
                if (catItems.length === 0 && (matrixSearchQuery || matrixStatusFilter !== 'all')) return null;

                return (
                  <div key={cat.categoryKey} className="cat-matrix-card">
                    {/* Category Card Header */}
                    <div className="cat-matrix-header">
                      <div className="cat-title-left">
                        <span className="cat-big-icon">{cat.icon}</span>
                        <div>
                          <div className="cat-title-row">
                            <h3 className="cat-title-text">{cat.name}</h3>
                            <span className="cat-sub-count">{cat.totalQueries} subcategories</span>
                            {cat.missedCount > 0 && (
                              <span className="cat-missed-alert">⚠️ {cat.missedCount} Missed</span>
                            )}
                          </div>
                          <div className="cat-meta-row">
                            <span>Last Refreshed: <strong>{formatRelativeTime(cat.lastUpdated)}</strong></span>
                            <span>Rotation Pointer: <strong>#{cat.pointer}</strong> / {cat.totalQueries}</span>
                            <span>Stores:</span>
                            <div className="cat-stores-list">
                              {cat.supportedStores.map(st => (
                                <span key={st} className={`store-badge ${st}`} title={`Scraped on ${st}`}>
                                  {COMPANY_CONFIG[st]?.icon} {COMPANY_CONFIG[st]?.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rotation Progress Bar */}
                      <div className="cat-progress-box">
                        <div className="progress-labels">
                          <span>Coverage Cycle</span>
                          <span className="progress-pct-num">{cat.progressPct}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-bar-fill" style={{ width: `${Math.max(5, cat.progressPct)}%` }}></div>
                        </div>
                        <div className="progress-stats-inline">
                          <span className="stat-pill comp">🟢 {cat.completedCount} Fresh</span>
                          <span className="stat-pill pipe">🔵 {cat.pipelineCount} In Pipeline</span>
                          <span className="stat-pill up">⚪ {cat.upcomingCount} In Pool</span>
                        </div>
                      </div>

                      {/* Category Action Button */}
                      <div className="cat-actions-col">
                        <button
                          className="cat-trigger-btn"
                          onClick={() => {
                            setSelectedCategory(cat.categoryKey);
                            handleTriggerAction(cat.categoryKey, '', `category-${cat.categoryKey}`);
                          }}
                          title="Run next round-robin batch now"
                        >
                          ⚡ Trigger Next Batch
                        </button>
                      </div>
                    </div>

                    {/* Subcategories Grid for this category */}
                    <div className="subcat-items-grid">
                      {catItems.map((item, idx) => (
                        <div key={idx} className={`subcat-item-pill status-${item.status}`}>
                          <div className="subcat-pill-main">
                            <span className={`status-dot ${item.status}`}></span>
                            <span className="subcat-name">{item.query}</span>
                            <span className={`subcat-status-tag ${item.status}`}>
                              {item.status === 'completed' && 'Fresh'}
                              {item.status === 'in_pipeline' && 'Next Up'}
                              {item.status === 'missed' && 'Missed'}
                              {item.status === 'core' && 'Core'}
                              {item.status === 'upcoming' && 'In Pool'}
                            </span>
                          </div>

                          <div className="subcat-pill-actions">
                            {/* Merchant Store Quick Links */}
                            <div className="store-links-wrap">
                              {item.supportedStores.map(store => (
                                <a
                                  key={store}
                                  href={buildPlatformSearchUrl(store, item.query)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`store-mini-link ${store}`}
                                  title={`Inspect search on ${COMPANY_CONFIG[store]?.label || store}`}
                                >
                                  {COMPANY_CONFIG[store]?.icon}
                                </a>
                              ))}
                            </div>

                            {/* One-Click Scrape Now */}
                            <button
                              className="subcat-scrape-btn"
                              onClick={() => {
                                setSelectedCategory(item.categoryKey);
                                setTargetQuery(item.query);
                                handleTriggerAction(item.categoryKey, item.query, `category-${item.categoryKey}`);
                              }}
                              title={`Trigger immediate scraping for "${item.query}"`}
                            >
                              ⚡ Scrape Now
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ======================================================== */}
          {/* GROUP BY: STATUS (Swimlanes)                              */}
          {/* ======================================================== */}
          {matrixGroupBy === 'status' && (
            <div className="status-swimlanes-grid">
              {['in_pipeline', 'completed', 'missed', 'upcoming'].map((statusKey) => {
                const laneItems = filteredMatrixItems.filter(i => i.status === statusKey);
                const titleMap: Record<string, { title: string; icon: string; desc: string }> = {
                  'in_pipeline': { title: 'In Pipeline (Next Batch Up)', icon: '🔵', desc: 'Scheduled to run next in round-robin sequence' },
                  'completed': { title: 'Completed (Fresh in Last Run)', icon: '🟢', desc: 'Recently refreshed products stored in database' },
                  'missed': { title: 'Missed / Delegated (Needs Attention)', icon: '🔴', desc: 'Blocked by WAF or no prices detected, auto-delegated to daemon' },
                  'upcoming': { title: 'Upcoming in Rotation Pool', icon: '⚪', desc: 'Queued in catalog waiting for their round-robin slot' }
                };
                const lane = titleMap[statusKey];

                return (
                  <div key={statusKey} className={`swimlane-col status-${statusKey}`}>
                    <div className="swimlane-header">
                      <div className="swimlane-title-wrap">
                        <span className="swimlane-icon">{lane.icon}</span>
                        <div>
                          <h4 className="swimlane-title">{lane.title}</h4>
                          <span className="swimlane-desc">{lane.desc}</span>
                        </div>
                      </div>
                      <span className="swimlane-count-badge">{laneItems.length}</span>
                    </div>

                    <div className="swimlane-items-scroll">
                      {laneItems.length === 0 ? (
                        <div className="swimlane-empty">No subcategories in this status</div>
                      ) : (
                        laneItems.map((item, idx) => (
                          <div key={idx} className="swimlane-item-card">
                            <div className="item-card-top">
                              <span className="item-cat-tag">
                                {item.categoryIcon} {item.categoryName}
                              </span>
                              <button
                                className="item-scrape-btn"
                                onClick={() => handleTriggerAction(item.categoryKey, item.query, `category-${item.categoryKey}`)}
                                title="Scrape immediately"
                              >
                                ⚡ Scrape
                              </button>
                            </div>
                            <h5 className="item-query-name">{item.query}</h5>
                            <div className="item-card-bottom">
                              <div className="item-stores-row">
                                {item.supportedStores.map(s => (
                                  <a
                                    key={s}
                                    href={buildPlatformSearchUrl(s, item.query)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="store-micro-link"
                                    title={`View on ${COMPANY_CONFIG[s]?.label}`}
                                  >
                                    {COMPANY_CONFIG[s]?.icon}
                                  </a>
                                ))}
                              </div>
                              <span className="item-timing">{formatRelativeTime(item.lastRunTime)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ======================================================== */}
          {/* GROUP BY: COMPANY / STORE                                */}
          {/* ======================================================== */}
          {matrixGroupBy === 'company' && (
            <div className="company-groups-grid">
              {Object.entries(COMPANY_CONFIG).map(([storeKey, conf]) => {
                const storeItems = filteredMatrixItems.filter(i => i.supportedStores.includes(storeKey));
                return (
                  <div key={storeKey} className={`company-group-card store-${storeKey}`}>
                    <div className="company-card-header">
                      <div className="company-header-title">
                        <span className="company-big-icon">{conf.icon}</span>
                        <div>
                          <h3>{conf.label} Coverage</h3>
                          <span className="company-subtitle">{storeItems.length} active queries supported on {conf.label}</span>
                        </div>
                      </div>
                      <span className="company-count-badge">{storeItems.length} Subcategories</span>
                    </div>

                    <div className="company-items-container">
                      {storeItems.slice(0, 40).map((item, idx) => (
                        <div key={idx} className={`company-item-row status-${item.status}`}>
                          <div className="company-item-details">
                            <span className={`status-dot ${item.status}`}></span>
                            <span className="company-item-name">{item.query}</span>
                            <span className="company-item-cat">({item.categoryName})</span>
                          </div>
                          <div className="company-item-actions">
                            <a
                              href={buildPlatformSearchUrl(storeKey, item.query)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="company-search-link"
                              title={`Open search on ${conf.label}`}
                            >
                              🔍 View on {conf.label} ↗
                            </a>
                            <button
                              className="company-scrape-btn"
                              onClick={() => handleTriggerAction(item.categoryKey, item.query, `category-${item.categoryKey}`)}
                              title="Scrape this query now"
                            >
                              ⚡ Scrape
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GithubActionsManager;
