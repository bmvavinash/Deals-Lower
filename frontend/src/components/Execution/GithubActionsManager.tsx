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

const CATEGORY_DEFINITIONS: Record<string, { name: string; icon: string; defaultQueries: string[] }> = {
  'electronics': {
    name: 'Electronics',
    icon: '⚡',
    defaultQueries: ['air conditioner', 'refrigerator', 'smart tv', 'smartphones', 'laptops', 'earbuds', 'gaming laptop', 'soundbar', 'smartwatch', 'dslr camera']
  },
  'fashion': {
    name: 'Fashion',
    icon: '👗',
    defaultQueries: ['kurtas', 'kurti', 'running shoes', 'sneakers', 't-shirts', 'jeans', 'dresses', 'jackets', 'analog watch', 'backpack']
  },
  'home-kitchen': {
    name: 'Home & Kitchen',
    icon: '🏠',
    defaultQueries: ['air fryer', 'microwave oven', 'water purifier', 'mixer grinder', 'vacuum cleaner', 'mattress', 'cookware', 'dining table']
  },
  'beauty-personal-care': {
    name: 'Beauty & Personal Care',
    icon: '💄',
    defaultQueries: ['haircare', 'face wash', 'sunscreen', 'perfume', 'hair dryer', 'lipstick', 'trimmers', 'body lotion']
  },
  'sports-fitness': {
    name: 'Sports & Fitness',
    icon: '🏋️',
    defaultQueries: ['dumbbells', 'yoga mat', 'treadmill', 'protein powder', 'running shoes', 'exercise bike', 'badminton racket']
  },
  'baby-kids': {
    name: 'Baby & Kids',
    icon: '👶',
    defaultQueries: ['diapers', 'baby clothes', 'baby stroller', 'kids toys', 'board games', 'baby car seat', 'kids shoes']
  },
  'grocery': {
    name: 'Grocery & Gourmet',
    icon: '🛒',
    defaultQueries: ['almonds', 'cashews', 'cooking oil', 'dry fruits', 'peanut butter', 'coffee beans', 'tea', 'oats']
  },
  'automotive': {
    name: 'Automotive',
    icon: '🚗',
    defaultQueries: ['car dash cam', 'helmet', 'car vacuum cleaner', 'car tire inflator', 'bike accessories', 'car perfume']
  },
  'books-stationery': {
    name: 'Books & Stationery',
    icon: '📚',
    defaultQueries: ['bestseller books', 'fiction books', 'kindle paperwhite', 'notebooks', 'pens', 'self help books']
  },
  'deals-trending': {
    name: 'Deals & Trending',
    icon: '🔥',
    defaultQueries: ['todays deals', 'trending offers', 'lightning deals', 'hot deals', 'electronics sale', 'clearance sale']
  },
  'stale-products-update': {
    name: 'Stale Products Update',
    icon: '🔄',
    defaultQueries: []
  },
  'favorites-check': {
    name: 'Favorites Check',
    icon: '❤️',
    defaultQueries: []
  },
  'hot-deals-telegram': {
    name: 'Hot Deals Telegram',
    icon: '📱',
    defaultQueries: []
  },
  'banners-fetch': {
    name: 'Banners Fetch',
    icon: '🖼️',
    defaultQueries: []
  },
  'amazon-promo-cards-fetch': {
    name: 'Amazon Promo Cards',
    icon: '🎯',
    defaultQueries: []
  }
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

export const GithubActionsManager: React.FC<GithubActionsManagerProps> = ({ autoRefresh }) => {
  // Trigger Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('electronics');
  const [targetQuery, setTargetQuery] = useState<string>('');
  const [dispatchTarget, setDispatchTarget] = useState<'auto' | 'github-actions' | 'commands-queue'>('auto');
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem('lowerdeal_gha_token') || '');
  const [showTokenInput, setShowTokenInput] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filter State
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

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
  const catalog = data?.catalog || {};
  const serverHasGhToken = !!data?.serverHasGhToken;

  // Persist token in localStorage when changed
  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setGithubToken(val);
    if (val) {
      localStorage.setItem('lowerdeal_gha_token', val);
    } else {
      localStorage.removeItem('lowerdeal_gha_token');
    }
  };

  // Get queries for selected category from catalog or fallback
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

  // Filter actions
  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      // Category filter
      if (filterCategory !== 'all') {
        const matchesCategory = 
          action.category === filterCategory ||
          action.name === filterCategory ||
          action.name === `category-${filterCategory}`;
        if (!matchesCategory) return false;
      }

      // Status filter
      if (filterStatus !== 'all') {
        if (action.status !== filterStatus) return false;
      }

      // Search query filter
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

  return (
    <div className="github-actions-manager">
      {/* Top Banner & Control Console */}
      <div className="gha-console-card">
        <div className="gha-console-header">
          <div>
            <h2>🚀 GitHub Actions & On-Demand Dispatch</h2>
            <p className="gha-console-subtitle">
              Trigger instant category scraping or targeted search keywords across Amazon, Flipkart, Myntra, and Ajio.
            </p>
          </div>
          <div className="gha-token-status-pill">
            <span className={`status-indicator ${serverHasGhToken || githubToken ? 'active' : 'warn'}`}></span>
            <span>{serverHasGhToken || githubToken ? 'GitHub API Connected' : 'Queue Mode (Daemon Fallback)'}</span>
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
              Saved locally in browser. If left empty, runs will dispatch to <code>commandsQueue</code> or server environment token.
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

        {/* Trigger Form */}
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
                <optgroup label="🛍️ Product Categories (Rotating Catalog)">
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
                <span className="optional-tag">(Optional - blank triggers rotating catalog)</span>
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

      {/* Filter Bar */}
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
            Showing <strong>{filteredActions.length}</strong> of <strong>{actions.length}</strong> actions
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
            const missedDeals = summary.missedDealsCount || 0;
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
                    <span className="kpi-value">⚠️ {missedDealsCount(summary)}</span>
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
    </div>
  );
};

function missedDealsCount(summary: any): number {
  return summary?.missedDealsCount || summary?.missedDeals || 0;
}

export default GithubActionsManager;
