import React, { useState, useEffect } from 'react';
import { stocksAPI } from '../services/api';
import './EquityPage.css';

interface StockSignal {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  action: 'BUY' | 'SELL' | 'PARTIAL_EXIT' | 'COMPLETE_EXIT' | 'WATCH';
  callType: string;
  entryPrice?: number;
  entryMax?: number;
  entryMin?: number;
  target1?: number;
  stopLoss?: number;
  currentCMP?: number;
  dayChangePercent?: number;
  status: string;
  statusReason?: string;
  rating?: number;
  source: string;
  timestamp: string;
  requiresClarification?: boolean;
  clarificationReason?: string;
}

interface BestInsight {
  type: 'ACTIONABLE_EXIT' | 'BUY_OPPORTUNITY' | 'CONSENSUS';
  symbol: string;
  companyName: string;
  action?: string;
  targetLevel?: number | null;
  buyUpto?: number | null;
  currentCMP?: number | null;
  dayChangePercent?: number | null;
  gainPercent?: number;
  discountPercent?: number;
  reason: string;
  source?: string;
  rating?: number | null;
  totalCalls?: number;
  distinctSources?: number;
}

interface ClarificationItem {
  signalId: string;
  symbol: string;
  companyName: string;
  action: string;
  entryPrice?: number;
  reason?: string;
}

interface StockNotification {
  id: string;
  signalId?: string;
  symbol: string;
  companyName: string;
  type: string;
  title: string;
  message: string;
  currentCMP: number;
  action: string;
  level?: number;
  source?: string;
  timestamp: string;
  channelSent?: boolean;
}

interface TelegramConfigState {
  channelId: string;
  channelType: string;
  topics: {
    high_conviction: string;
    buy_trades: string;
    sell_trades: string;
    daily_insights: string;
  };
}

const EquityPage: React.FC = () => {
  const [signals, setSignals] = useState<StockSignal[]>([]);
  const [insights, setInsights] = useState<BestInsight[]>([]);
  const [clarifications, setClarifications] = useState<ClarificationItem[]>([]);
  const [notifications, setNotifications] = useState<StockNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtractingWhatsApp, setIsExtractingWhatsApp] = useState(false);
  const [isExtractingSheets, setIsExtractingSheets] = useState(false);
  const [isCheckingAlerts, setIsCheckingAlerts] = useState(false);
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [refresherStatusMsg, setRefresherStatusMsg] = useState<string | null>(null);
  
  // Mobile actions collapsible drawer
  const [showMoreActions, setShowMoreActions] = useState(false);

  // Responsive view mode: 'cards' on mobile screens by default, 'table' on desktop
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => 
    typeof window !== 'undefined' && window.innerWidth <= 768 ? 'cards' : 'table'
  );

  // Refresh timer state (default: 30s)
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState<number>(30);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Navigation tab & search
  const [activeTab, setActiveTab] = useState<'all' | 'buy' | 'sell' | 'actionable' | 'alerts' | 'clarifications'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-filters & sorting state
  const [sortBy, setSortBy] = useState<string>('rating_desc');
  const [ratingFilter, setRatingFilter] = useState<'all' | '4plus' | '3plus' | 'sub3'>('all');
  const [horizonFilter, setHorizonFilter] = useState<'all' | 'positional' | 'swing'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'whatsapp' | 'google_sheets' | 'sheet_watchlist' | 'sheet_stocklist' | 'telegram'>('all');
  const [cmpStatusFilter, setCmpStatusFilter] = useState<'all' | 'buy_range' | 'target_met' | 'near'>('all');

  // Telegram Config Modal state
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfigState>({
    channelId: '',
    channelType: 'group_with_topics',
    topics: {
      high_conviction: '',
      buy_trades: '',
      sell_trades: '',
      daily_insights: ''
    }
  });
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [testingTopic, setTestingTopic] = useState<string | null>(null);
  const [telegramNotice, setTelegramNotice] = useState<string | null>(null);

  // Sandbox state
  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxText, setSandboxText] = useState('');
  const [isParsingSandbox, setIsParsingSandbox] = useState(false);
  const [sandboxFeedback, setSandboxFeedback] = useState<string | null>(null);

  // Manual doubt resolution modal/state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvedTickerInput, setResolvedTickerInput] = useState('');

  // Global banner notification message
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Master Scheduler & Telegram Ingestion State
  const [schedulerState, setSchedulerState] = useState<any>(null);
  const [isSchedulerToggling, setIsSchedulerToggling] = useState(false);

  // 1. Fetch dashboard signals & insights
  const fetchDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [signalsRes, insightsRes, doubtsRes, notifsRes, schedRes] = await Promise.allSettled([
        stocksAPI.getEquitySignals(),
        stocksAPI.getEquityInsights(),
        stocksAPI.getClarifications(),
        stocksAPI.getNotifications(),
        stocksAPI.getSchedulerStatus()
      ]);

      if (signalsRes.status === 'fulfilled' && signalsRes.value.data?.success) {
        setSignals(signalsRes.value.data.data || []);
      }
      if (insightsRes.status === 'fulfilled' && insightsRes.value.data?.success) {
        setInsights(insightsRes.value.data.data || []);
      }
      if (doubtsRes.status === 'fulfilled' && doubtsRes.value.data?.success) {
        setClarifications(doubtsRes.value.data.data || []);
      }
      if (notifsRes.status === 'fulfilled' && notifsRes.value.data?.success) {
        setNotifications(notifsRes.value.data.data || []);
      }
      if (schedRes.status === 'fulfilled' && schedRes.value.data?.success) {
        setSchedulerState(schedRes.value.data.data || null);
      }
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Error fetching equity dashboard data:', err?.message, err?.response?.status, err?.config?.url);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleToggleScheduler = async () => {
    setIsSchedulerToggling(true);
    try {
      if (schedulerState?.isMasterActive) {
        await stocksAPI.stopScheduler();
      } else {
        await stocksAPI.startScheduler();
      }
      const res = await stocksAPI.getSchedulerStatus();
      if (res.data?.success) setSchedulerState(res.data.data);
    } catch (e: any) {
      console.warn('Scheduler toggle error:', e.message);
    } finally {
      setIsSchedulerToggling(false);
    }
  };

  // 2. Fetch Telegram Config
  const loadTelegramConfig = async () => {
    try {
      const res = await stocksAPI.getTelegramConfig();
      if (res.data?.success && res.data.data?.stocks) {
        const stocks = res.data.data.stocks;
        setTelegramConfig({
          channelId: stocks.channelId || '',
          channelType: stocks.channelType || 'group_with_topics',
          topics: {
            high_conviction: stocks.topics?.high_conviction ? String(stocks.topics.high_conviction) : '',
            buy_trades: stocks.topics?.buy_trades ? String(stocks.topics.buy_trades) : '',
            sell_trades: stocks.topics?.sell_trades ? String(stocks.topics.sell_trades) : '',
            daily_insights: stocks.topics?.daily_insights ? String(stocks.topics.daily_insights) : ''
          }
        });
      }
    } catch (e: any) {
      console.warn('Could not load Telegram config:', e.message);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    loadTelegramConfig();
  }, []);

  // 3. Periodic Auto-Refresh for Quotes & Signals
  useEffect(() => {
    if (autoRefreshIntervalSec <= 0) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, autoRefreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshIntervalSec]);

  // 4. Force Live Quote Refresh
  const handleForceRefreshQuotes = async () => {
    setIsRefreshingQuotes(true);
    setBannerNotice(null);
    try {
      const res = await stocksAPI.refreshQuotes(true);
      if (res.data?.success) {
        const d = res.data.data;
        const msg = `⚡ Refreshed CMP for ${d.stocksRefreshed} stocks in ${(d.durationMs / 1000).toFixed(1)}s!`;
        setRefresherStatusMsg(msg);
        setBannerNotice({ type: 'success', text: msg });
        await fetchDashboardData(true);
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        text: `Error refreshing quotes: ${err.response?.data?.message || err.message}`
      });
    } finally {
      setIsRefreshingQuotes(false);
    }
  };

  // 5. WhatsApp extraction trigger
  const handleExtractWhatsApp = async () => {
    setIsExtractingWhatsApp(true);
    setBannerNotice(null);
    try {
      const res = await stocksAPI.extractWhatsApp(9223);
      if (res.data?.success) {
        setBannerNotice({
          type: 'success',
          text: `✅ Extracted ${res.data.signalsFound} stock signals from "${res.data.chatTitle}"!`
        });
        await fetchDashboardData();
      } else {
        setBannerNotice({
          type: 'error',
          text: `⚠️ WhatsApp extraction notice: ${res.data?.message || res.data?.error || 'No chat active on port 9223'}`
        });
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        text: `❌ Extraction failed: ${err.response?.data?.message || err.message}`
      });
    } finally {
      setIsExtractingWhatsApp(false);
    }
  };

  // 6. Google Sheet live extraction trigger
  const handleExtractSheets = async () => {
    setIsExtractingSheets(true);
    setBannerNotice(null);
    try {
      const res = await stocksAPI.extractSheets(9223);
      if (res.data?.success) {
        const tabsStr = Object.entries(res.data.tabsProcessed || {})
          .map(([tab, count]) => `${tab}: ${count}`)
          .join(', ');
        setBannerNotice({
          type: 'success',
          text: `✅ Extracted ${res.data.totalSignalsFound} signals across tabs (${tabsStr}) from "${res.data.sheetTitle}"! Generated ${res.data.insightsGenerated} insights.`
        });
        await fetchDashboardData();
      } else {
        setBannerNotice({
          type: 'error',
          text: `⚠️ Google Sheet extraction: ${res.data?.message || 'Extraction incomplete'}`
        });
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        text: `❌ Google Sheet extraction failed: ${err.response?.data?.message || err.message}`
      });
    } finally {
      setIsExtractingSheets(false);
    }
  };

  // 7. Immediate CMP Alert Check trigger
  const handleRunAlertCheck = async () => {
    setIsCheckingAlerts(true);
    setBannerNotice(null);
    try {
      const res = await stocksAPI.triggerCheck();
      if (res.data?.success) {
        const count = res.data.triggeredNowCount || 0;
        setBannerNotice({
          type: 'success',
          text: count > 0 
            ? `🚨 CMP Alert Check Complete: Evaluated & grouped ${count} stock alert(s)!`
            : `✅ CMP Alert Check Complete: All active stocks evaluated. ${res.data.notifications?.length || 0} alert(s) on record.`
        });
        await fetchDashboardData();
      }
    } catch (err: any) {
      setBannerNotice({
        type: 'error',
        text: `Error checking CMP alerts: ${err.message}`
      });
    } finally {
      setIsCheckingAlerts(false);
    }
  };

  // 8. Save Telegram Config
  const handleSaveTelegramConfig = async () => {
    setIsSavingTelegram(true);
    setTelegramNotice(null);
    try {
      const res = await stocksAPI.saveTelegramConfig({
        domain: 'stocks',
        channelId: telegramConfig.channelId.trim(),
        topics: {
          high_conviction: telegramConfig.topics.high_conviction ? Number(telegramConfig.topics.high_conviction) : null,
          buy_trades: telegramConfig.topics.buy_trades ? Number(telegramConfig.topics.buy_trades) : null,
          sell_trades: telegramConfig.topics.sell_trades ? Number(telegramConfig.topics.sell_trades) : null,
          daily_insights: telegramConfig.topics.daily_insights ? Number(telegramConfig.topics.daily_insights) : null
        }
      });
      if (res.data?.success) {
        setTelegramNotice('✅ Telegram configuration saved successfully! Alerts will now post to your group and topics.');
      }
    } catch (e: any) {
      setTelegramNotice(`❌ Error saving: ${e.response?.data?.message || e.message}`);
    } finally {
      setIsSavingTelegram(false);
    }
  };

  // 9. Send Test Alert to specific topic
  const handleTestTelegramTopic = async (topicKey: string) => {
    setTestingTopic(topicKey);
    setTelegramNotice(null);
    try {
      const res = await stocksAPI.testTelegramTopic({ topic: topicKey });
      if (res.data?.success) {
        setTelegramNotice(`✅ Test alert sent successfully to topic "${topicKey}"! Check your Telegram group.`);
      } else {
        setTelegramNotice(`⚠️ Could not send test: ${res.data?.error || res.data?.message || 'Check channel ID and bot permissions.'}`);
      }
    } catch (e: any) {
      setTelegramNotice(`❌ Test send failed: ${e.response?.data?.message || e.message}`);
    } finally {
      setTestingTopic(null);
    }
  };

  // 10. Sandbox parsing
  const handleParseSandbox = async () => {
    if (!sandboxText.trim()) return;
    setIsParsingSandbox(true);
    setSandboxFeedback(null);
    try {
      const res = await stocksAPI.parseText({
        text: sandboxText,
        source: 'Manual Sandbox Test',
        saveToDB: true
      });

      if (res.data?.isTradeSignal && res.data?.signals?.length > 0) {
        setSandboxFeedback(`✅ Successfully parsed & saved ${res.data.signals.length} signal(s)!`);
        setSandboxText('');
        await fetchDashboardData();
      } else {
        setSandboxFeedback(`ℹ️ Message parsed but no trade signals recognized: ${res.data?.reason || 'Non-stock text'}`);
      }
    } catch (err: any) {
      setSandboxFeedback(`❌ Error parsing: ${err.message}`);
    } finally {
      setIsParsingSandbox(false);
    }
  };

  // 11. Resolve clarification doubt
  const handleResolveClarification = async (signalId: string) => {
    if (!resolvedTickerInput.trim()) return;
    try {
      const res = await stocksAPI.resolveClarification({
        signalId,
        symbol: resolvedTickerInput.trim().toUpperCase()
      });
      if (res.data?.success) {
        setResolvingId(null);
        setResolvedTickerInput('');
        setBannerNotice({
          type: 'success',
          text: `✅ Signal successfully mapped to ${resolvedTickerInput.toUpperCase()}!`
        });
        await fetchDashboardData();
      }
    } catch (err: any) {
      alert(`Error resolving: ${err.message}`);
    }
  };

  // 12. Filter & Sort signals
  const filteredSignals = signals
    .filter(s => {
      // Search
      const matchesSearch = !searchQuery || 
        s.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.source?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Primary tab
      if (activeTab === 'buy' && s.action !== 'BUY') return false;
      if (activeTab === 'sell' && !(s.action?.includes('SELL') || s.action?.includes('EXIT'))) return false;
      if (activeTab === 'actionable' && !(s.status === 'TRIGGERED' || s.status === 'IN_BUY_RANGE')) return false;
      if (activeTab === 'clarifications' && !s.requiresClarification) return false;

      // Sub-filter: Star Rating
      const star = Number(s.rating || 0);
      if (ratingFilter === '4plus' && star < 4) return false;
      if (ratingFilter === '3plus' && star < 3) return false;
      if (ratingFilter === 'sub3' && (star >= 3 || star === 0)) return false;

      // Sub-filter: Horizon / Call Type
      if (horizonFilter === 'positional' && s.callType !== 'POSITIONAL') return false;
      if (horizonFilter === 'swing' && s.callType !== 'SWING') return false;

      // Sub-filter: Source
      const src = s.source?.toLowerCase() || '';
      if (sourceFilter === 'whatsapp' && !src.includes('whatsapp')) return false;
      if (sourceFilter === 'google_sheets' && !src.includes('sheet')) return false;
      if (sourceFilter === 'sheet_watchlist' && !src.includes('watchlist')) return false;
      if (sourceFilter === 'sheet_stocklist' && !src.includes('stock list')) return false;
      if (sourceFilter === 'telegram' && !src.includes('telegram')) return false;

      // Sub-filter: CMP Status
      if (cmpStatusFilter === 'buy_range' && s.status !== 'IN_BUY_RANGE') return false;
      if (cmpStatusFilter === 'target_met' && s.status !== 'TRIGGERED') return false;
      if (cmpStatusFilter === 'near' && s.status !== 'NEAR_BUY_RANGE') return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'source_priority') {
        const getRank = (sourceStr?: string) => {
          const str = (sourceStr || '').toLowerCase();
          if (str.includes('whatsapp')) return 1;
          if (str.includes('sheet')) return 2;
          if (str.includes('telegram')) return 3;
          return 4;
        };
        const rankA = (a as any).sourcePriority || getRank(a.source);
        const rankB = (b as any).sourcePriority || getRank(b.source);
        if (rankA !== rankB) return rankA - rankB;
        return (Number(b.rating || 0)) - (Number(a.rating || 0));
      }
      if (sortBy === 'rating_desc') {
        return (Number(b.rating || 0)) - (Number(a.rating || 0));
      }
      if (sortBy === 'discount_desc') {
        const discA = a.entryMax && a.currentCMP ? ((a.entryMax - a.currentCMP) / a.entryMax) : -999;
        const discB = b.entryMax && b.currentCMP ? ((b.entryMax - b.currentCMP) / b.entryMax) : -999;
        return discB - discA;
      }
      if (sortBy === 'day_change_desc') {
        return (b.dayChangePercent || 0) - (a.dayChangePercent || 0);
      }
      if (sortBy === 'day_change_asc') {
        return (a.dayChangePercent || 0) - (b.dayChangePercent || 0);
      }
      if (sortBy === 'symbol_asc') {
        return (a.symbol || '').localeCompare(b.symbol || '');
      }
      if (sortBy === 'level_desc') {
        const priceA = a.entryPrice || a.entryMax || a.entryMin || 0;
        const priceB = b.entryPrice || b.entryMax || b.entryMin || 0;
        return priceB - priceA;
      }
      return 0;
    });

  // Derived metrics
  const totalSignals = signals.length;
  const actionableBuys = signals.filter(s => s.action === 'BUY' && s.status === 'IN_BUY_RANGE').length;
  const exitsTriggered = signals.filter(s => s.status === 'TRIGGERED').length;
  const highConvictionCount = signals.filter(s => Number(s.rating || 0) >= 4).length;
  const pendingDoubts = clarifications.length;
  const alertCount = notifications.length;

  // Helper to format alert descriptions cleanly Line-by-Line without raw markdown clutter
  const renderFormattedAlertMessage = (notif: StockNotification) => {
    const rawMsg = notif.message || '';
    const cleanMsg = rawMsg.replace(/[*_~`]/g, '').trim();

    // Split by newlines or bullets
    const rawSegments = cleanMsg
      .split(/\n|•/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const detailRows: { key: string; value: string; isHighlight?: boolean }[] = [];
    let summarySentence = '';

    rawSegments.forEach((segment) => {
      const colonIdx = segment.indexOf(':');
      if (colonIdx > 0 && colonIdx < 35) {
        const key = segment.slice(0, colonIdx).trim();
        const val = segment.slice(colonIdx + 1).trim();
        const isCMP = /cmp/i.test(key);
        const isCeiling = /ceiling|level|target/i.test(key);
        detailRows.push({ key, value: val, isHighlight: isCMP || isCeiling });
      } else if (!summarySentence && segment.length > 5) {
        summarySentence = segment;
      } else {
        detailRows.push({ key: 'Status', value: segment });
      }
    });

    return (
      <div className="alert-card-details">
        {summarySentence && (
          <div className="alert-detail-summary">
            📌 {summarySentence}
          </div>
        )}
        <div className="alert-detail-rows">
          {detailRows.map((row, idx) => (
            <div key={idx} className={`alert-detail-row ${row.isHighlight ? 'highlight-row' : ''}`}>
              <span className="alert-row-key">• {row.key}:</span>
              <span className="alert-row-val">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="equity-page">
      {/* 1. Header with Prioritized Mobile Actions */}
      <div className="equity-header">
        <div>
          <h1>📊 Equity Insights Hub</h1>
          <p className="equity-subtitle">
            Multi-engine recommendation aggregator with live CMP market tracking &amp; automated Telegram topic notifications.
          </p>
        </div>
        
        {/* Prioritized Action Bar: Core buttons prominent, secondary collapsible */}
        <div className="header-actions">
          {/* Priority 1: Force Refresh CMP */}
          <button 
            className="btn-primary"
            style={{ backgroundColor: '#2563eb' }}
            onClick={handleForceRefreshQuotes}
            disabled={isRefreshingQuotes}
            title="Fetch latest CMP quotes from Yahoo/NSE for all stocks"
          >
            {isRefreshingQuotes ? '⚡ Refreshing...' : '⚡ Refresh CMP'}
          </button>

          {/* Priority 2: Telegram Topics Settings */}
          <button 
            className="btn-outline"
            style={{ 
              borderColor: telegramConfig.channelId ? '#2563eb' : '#d97706',
              color: telegramConfig.channelId ? '#1d4ed8' : '#b45309',
              fontWeight: 600
            }}
            onClick={() => setShowTelegramModal(true)}
          >
            📱 Telegram {telegramConfig.channelId ? '✅' : '⚠️'}
          </button>

          {/* Priority 3: Extract Google Sheet */}
          <button 
            className="btn-success"
            style={{ backgroundColor: '#0284c7' }}
            onClick={handleExtractSheets}
            disabled={isExtractingSheets}
          >
            {isExtractingSheets ? '⏳ Extracting...' : '📊 Sheets (9223)'}
          </button>

          {/* Priority 4: Expandable More Tools */}
          <button 
            className="btn-outline"
            style={{ fontWeight: 600 }}
            onClick={() => setShowMoreActions(!showMoreActions)}
          >
            {showMoreActions ? '✕ Less Tools' : '⚙️ More Tools ▾'}
          </button>

          {/* Collapsible Tools Drawer */}
          {showMoreActions && (
            <div className="more-actions-drawer">
              <button 
                className="btn-primary"
                style={{ backgroundColor: '#dc2626', fontSize: '12px', padding: '8px 12px' }}
                onClick={handleRunAlertCheck}
                disabled={isCheckingAlerts}
              >
                {isCheckingAlerts ? '⏳ Evaluating CMP...' : '🔔 Run Alert Check'}
              </button>
              <button 
                className="btn-success"
                style={{ fontSize: '12px', padding: '8px 12px' }}
                onClick={handleExtractWhatsApp}
                disabled={isExtractingWhatsApp}
              >
                {isExtractingWhatsApp ? '⏳ Extracting...' : '⚡ WhatsApp (Port 9223)'}
              </button>
              <button 
                className="btn-primary"
                style={{ fontSize: '12px', padding: '8px 12px' }}
                onClick={() => setShowSandbox(!showSandbox)}
              >
                {showSandbox ? '✕ Close Sandbox' : '➕ Test / Add Signal'}
              </button>
            </div>
          )}
        </div>
      </div>

      

      {/* 2. Global Banner Notification */}
      {bannerNotice && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          marginBottom: '16px',
          backgroundColor: bannerNotice.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: bannerNotice.type === 'success' ? '#15803d' : '#b91c1c',
          fontWeight: 500
        }}>
          {bannerNotice.text}
        </div>
      )}

      {/* 3. Real-Time Triggered Stock Alerts (Top Priority for Mobile Traders) */}
      {notifications.length > 0 && (
        <div className="alerts-section">
          <div className="alerts-header">
            <div className="alerts-title">
              <span>🚨 Live Actionable Alerts (CMP in Range / Target Met)</span>
              <span className="alerts-count-badge">{notifications.length}</span>
            </div>
            <button 
              className="btn-outline" 
              style={{ fontSize: '12px', padding: '4px 10px', background: '#fff' }}
              onClick={() => setActiveTab('alerts')}
            >
              View All
            </button>
          </div>
          <div className="alerts-grid">
            {notifications.slice(0, 4).map((notif) => {
              const isBuy = notif.type === 'BUY_ZONE_ENTERED';
              return (
                <div key={notif.id} className={`alert-card ${isBuy ? 'buy_zone' : ''}`}>
                  <div className="alert-card-top">
                    <div>
                      <span className="alert-card-sym">{notif.symbol}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '6px' }}>
                        {notif.companyName}
                      </span>
                    </div>
                    <span className={`alert-card-badge ${isBuy ? 'buy' : 'exit'}`}>
                      {isBuy ? '🟢 BUY ZONE' : '🎯 TARGET MET'}
                    </span>
                  </div>
                  <div className="alert-card-prices">
                    <span>Target Level: <strong>₹{notif.level || '-'}</strong></span>
                    <span style={{ color: isBuy ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                      Live CMP: ₹{notif.currentCMP}
                    </span>
                  </div>
                  {renderFormattedAlertMessage(notif)}
                  <div className="alert-card-footer">
                    <span>{notif.source || 'Advisory'} • {new Date(notif.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="telegram-sent-tag">
                      📱 Grouped Alert Sent
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Live Market Stream Bar */}
      <div className="stream-bar">
        <div className="stream-indicator">
          <span className="pulse-dot"></span>
          <span>Live Market Stream: Active (NSE)</span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b' }}>
            • Synced: {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {refresherStatusMsg && (
            <span className="refresher-status-pill">{refresherStatusMsg}</span>
          )}
        </div>
        <div className="stream-controls">
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Auto-refresh:</span>
          <select 
            value={autoRefreshIntervalSec} 
            onChange={(e) => setAutoRefreshIntervalSec(Number(e.target.value))}
            className="filter-select"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <option value={5}>Every 5s</option>
            <option value={10}>Every 10s</option>
            <option value={30}>Every 30s (Default)</option>
            <option value={60}>Every 1m</option>
            <option value={0}>Off</option>
          </select>
        </div>
      </div>

      

            {/* 4b. Automation & Master Scheduler Banner */}
      <div className="scheduler-banner">
        <div className="scheduler-left">
          <div className="scheduler-badge-row">
            <span className={`status-pill ${schedulerState?.isMasterActive ? 'active' : 'paused'}`}>
              <span className="pulse-dot"></span>
              {schedulerState?.isMasterActive ? 'Scheduler: ACTIVE' : 'Scheduler: PAUSED'}
            </span>
            <span className="scheduler-tag">💬 WA: 3m (9223)</span>
            <span className="scheduler-tag">⚡ CMP: 2m</span>
            <span className="scheduler-tag">📊 Sheets: 15m (9223)</span>
            <span className="scheduler-tag tg-tag">📱 TG Fallback: Ingesting 24/7</span>
          </div>
          <div className="scheduler-subtitle">
            {schedulerState?.isMasterActive 
              ? 'Auto-polling WhatsApp every 3m on Chrome 9223. Forward or repost trades in Telegram anytime to auto-ingest.'
              : 'Local scheduler paused. Telegram Ingestion listener active 24/7 for reposted trade calls.'}
          </div>
        </div>
        <div className="scheduler-actions">
          <button
            className="btn-outline"
            style={{ fontSize: '11px', padding: '5px 10px', background: '#fff', fontWeight: 600 }}
            onClick={handleToggleScheduler}
            disabled={isSchedulerToggling}
          >
            {schedulerState?.isMasterActive ? '⏸️ Pause' : '▶️ Resume'}
          </button>
          <button
            className="btn-outline"
            style={{ fontSize: '11px', padding: '5px 10px', background: '#fff' }}
            onClick={() => stocksAPI.triggerSchedulerWhatsApp().then(() => fetchDashboardData(true))}
            title="Scan WhatsApp on Chrome 9223 right now"
          >
            💬 WA Now
          </button>
          <button
            className="btn-outline"
            style={{ fontSize: '11px', padding: '5px 10px', background: '#fff' }}
            onClick={() => stocksAPI.triggerSchedulerSheets().then(() => fetchDashboardData(true))}
            title="Scan Google Sheets on Chrome 9223 right now"
          >
            📊 Sheets Now
          </button>
        </div>
      </div>

      {/* 5. Metric Cards (Clean 2x2 Grid on Mobile) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Signals</div>
          <div className="metric-value">{totalSignals}</div>
          <div className="metric-sub">Sheet (73) + WhatsApp + Sandbox</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">⭐ High-Conviction</div>
          <div className="metric-value" style={{ color: '#d97706' }}>{highConvictionCount}</div>
          <div className="metric-sub">4★–5★ top rated calls</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">🟢 Buys In Range</div>
          <div className="metric-value" style={{ color: '#16a34a' }}>{actionableBuys}</div>
          <div className="metric-sub">CMP &lt;= Recommended ceiling</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">🎯 Exits Reached</div>
          <div className="metric-value" style={{ color: '#dc2626' }}>{exitsTriggered}</div>
          <div className="metric-sub">CMP &gt;= Target / Exit level</div>
        </div>
      </div>

      

      {/* 6. Telegram Topics Settings Modal */}
      {showTelegramModal && (
        <div className="modal-overlay" onClick={() => setShowTelegramModal(false)}>
          <div className="telegram-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="telegram-modal-header">
              <h2>📱 Telegram Dedicated Channel &amp; Topics Routing</h2>
              <button className="modal-close-btn" onClick={() => setShowTelegramModal(false)}>✕</button>
            </div>

            <div className="telegram-tip-box">
              <strong>💡 Telegram Channel vs. Group Recommendation:</strong><br />
              In the Telegram Bot API, <strong>Forum Topics</strong> (separate tabs for Buy Trades, Sell Trades, etc.) are only supported in a <strong>Telegram Supergroup with Topics turned ON</strong>.<br />
              <strong>Best Practice:</strong> Create a Telegram Group, enable <em>Topics</em> in Group Settings, and set Member Permissions so <em>Only Admins can send messages</em>. This gives you the clean, noise-free broadcast experience of a Channel with the organization of Topic tabs!
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                Telegram Supergroup / Channel ID:
              </label>
              <input 
                type="text"
                placeholder="e.g. -1002345678901 or @my_stock_alerts"
                value={telegramConfig.channelId}
                onChange={(e) => setTelegramConfig({ ...telegramConfig, channelId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Stock alerts to <code>@dealshubglobal</code> are permanently blocked to prevent channel mixing.
              </span>
            </div>

            <h4 style={{ margin: '16px 0 10px 0', fontSize: '14px', color: '#1e293b' }}>
              🎯 Topic Thread Routing (Enter Telegram <code>message_thread_id</code>):
            </h4>

            {/* Topic 1: 4-5 Star Trades */}
            <div className="topic-row">
              <div className="topic-row-info">
                <div className="topic-row-title">⭐ 4★–5★ High Conviction Trades</div>
                <div className="topic-row-desc">Top rated advisory calls in buying range</div>
              </div>
              <div className="topic-row-actions">
                <input 
                  type="text"
                  placeholder="Thread ID (e.g. 2)"
                  value={telegramConfig.topics.high_conviction}
                  onChange={(e) => setTelegramConfig({
                    ...telegramConfig,
                    topics: { ...telegramConfig.topics, high_conviction: e.target.value }
                  })}
                  className="topic-input"
                />
                <button 
                  className="btn-test-topic"
                  onClick={() => handleTestTelegramTopic('high_conviction')}
                  disabled={testingTopic === 'high_conviction' || !telegramConfig.channelId}
                >
                  {testingTopic === 'high_conviction' ? 'Sending...' : '🧪 Test'}
                </button>
              </div>
            </div>

            {/* Topic 2: Buy Trades */}
            <div className="topic-row">
              <div className="topic-row-info">
                <div className="topic-row-title">🟢 Buy Trades (2★–3★ &amp; General Buys)</div>
                <div className="topic-row-desc">Fresh buying opportunities in range</div>
              </div>
              <div className="topic-row-actions">
                <input 
                  type="text"
                  placeholder="Thread ID (e.g. 3)"
                  value={telegramConfig.topics.buy_trades}
                  onChange={(e) => setTelegramConfig({
                    ...telegramConfig,
                    topics: { ...telegramConfig.topics, buy_trades: e.target.value }
                  })}
                  className="topic-input"
                />
                <button 
                  className="btn-test-topic"
                  onClick={() => handleTestTelegramTopic('buy_trades')}
                  disabled={testingTopic === 'buy_trades' || !telegramConfig.channelId}
                >
                  {testingTopic === 'buy_trades' ? 'Sending...' : '🧪 Test'}
                </button>
              </div>
            </div>

            {/* Topic 3: Sell Trades */}
            <div className="topic-row">
              <div className="topic-row-info">
                <div className="topic-row-title">🎯 Sell Trades &amp; Target Exits</div>
                <div className="topic-row-desc">Stocks hitting target levels or stop-losses</div>
              </div>
              <div className="topic-row-actions">
                <input 
                  type="text"
                  placeholder="Thread ID (e.g. 4)"
                  value={telegramConfig.topics.sell_trades}
                  onChange={(e) => setTelegramConfig({
                    ...telegramConfig,
                    topics: { ...telegramConfig.topics, sell_trades: e.target.value }
                  })}
                  className="topic-input"
                />
                <button 
                  className="btn-test-topic"
                  onClick={() => handleTestTelegramTopic('sell_trades')}
                  disabled={testingTopic === 'sell_trades' || !telegramConfig.channelId}
                >
                  {testingTopic === 'sell_trades' ? 'Sending...' : '🧪 Test'}
                </button>
              </div>
            </div>

            {/* Topic 4: Daily Insights */}
            <div className="topic-row">
              <div className="topic-row-info">
                <div className="topic-row-title">📊 Daily Insights &amp; Market Movers</div>
                <div className="topic-row-desc">Ranked digests &amp; consensus summaries</div>
              </div>
              <div className="topic-row-actions">
                <input 
                  type="text"
                  placeholder="Thread ID (e.g. 5)"
                  value={telegramConfig.topics.daily_insights}
                  onChange={(e) => setTelegramConfig({
                    ...telegramConfig,
                    topics: { ...telegramConfig.topics, daily_insights: e.target.value }
                  })}
                  className="topic-input"
                />
                <button 
                  className="btn-test-topic"
                  onClick={() => handleTestTelegramTopic('daily_insights')}
                  disabled={testingTopic === 'daily_insights' || !telegramConfig.channelId}
                >
                  {testingTopic === 'daily_insights' ? 'Sending...' : '🧪 Test'}
                </button>
              </div>
            </div>

            {telegramNotice && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '6px',
                marginTop: '12px',
                fontSize: '13px',
                backgroundColor: telegramNotice.includes('✅') ? '#dcfce7' : '#fee2e2',
                color: telegramNotice.includes('✅') ? '#15803d' : '#b91c1c'
              }}>
                {telegramNotice}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                className="btn-outline" 
                onClick={() => setShowTelegramModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleSaveTelegramConfig}
                disabled={isSavingTelegram}
              >
                {isSavingTelegram ? 'Saving...' : '💾 Save Telegram Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Best Insights Highlights Shelf */}
      {insights.length > 0 && (
        <div className="insights-shelf">
          <div className="shelf-title">
            <span>🚀 Best Equity Insights (Ranked by Multi-Engine Consensus &amp; CMP)</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginLeft: 'auto' }}>
              Showing {Math.min(insights.length, 6)} highest-conviction calls
            </span>
          </div>
          <div className="insights-grid">
            {insights.slice(0, 6).map((item, idx) => {
              const cardTypeClass = item.type === 'ACTIONABLE_EXIT' ? 'exit' : item.type === 'CONSENSUS' ? 'consensus' : 'buy';
              const actionLabel = item.type === 'ACTIONABLE_EXIT' 
                ? 'TARGET / EXIT MET' 
                : item.type === 'BUY_OPPORTUNITY' 
                  ? 'BUY IN RANGE' 
                  : `CONSENSUS: ${item.action || 'CALL'}`;

              const targetPrice = item.targetLevel || item.buyUpto;
              const hasCMP = item.currentCMP !== null && item.currentCMP !== undefined;

              return (
                <div key={idx} className={`insight-item-card ${cardTypeClass}`}>
                  <div className="insight-card-header">
                    <div>
                      <span className="insight-symbol">{item.symbol}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>
                        {item.companyName}
                      </span>
                    </div>
                    <span className={`insight-tag ${cardTypeClass}`}>
                      {actionLabel}
                    </span>
                  </div>

                  <div className="insight-prices" style={{ alignItems: 'baseline', marginTop: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="insight-target-label">
                        {item.action === 'BUY' ? 'Buy Upto' : 'Target / Exit'}
                      </span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                        {targetPrice ? `₹${targetPrice}` : 'Market / Multiple'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 'auto', textAlign: 'right' }}>
                      <span className="insight-target-label">Live CMP</span>
                      <div className="insight-cmp-badge">
                        {hasCMP ? (
                          <>
                            ₹{item.currentCMP}
                            {item.dayChangePercent !== null && item.dayChangePercent !== undefined && (
                              <span style={{ 
                                fontSize: '11px', 
                                marginLeft: '4px',
                                color: item.dayChangePercent >= 0 ? '#4ade80' : '#f87171' 
                              }}>
                                ({item.dayChangePercent >= 0 ? '+' : ''}{item.dayChangePercent}%)
                              </span>
                            )}
                          </>
                        ) : (
                          'Fetching quote...'
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="insight-reason" style={{ marginTop: '8px', lineHeight: 1.4 }}>
                    {item.rating ? `⭐ Rating ${item.rating} • ` : ''}{item.reason}
                  </div>

                  <div className="insight-footer-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {item.source?.toLowerCase().includes('whatsapp') ? (
                        <span className="source-of-truth-pill" style={{ padding: '2px 6px', fontSize: '10px' }}>
                          🟢 WhatsApp (Source of Truth)
                        </span>
                      ) : (
                        <span>Source: {item.source || 'Advisory'}</span>
                      )}
                    </span>
                    {item.type === 'ACTIONABLE_EXIT' && <span style={{ color: '#f87171', fontWeight: 600 }}>🚨 Exit Alert Sent</span>}
                    {item.type === 'BUY_OPPORTUNITY' && <span style={{ color: '#4ade80', fontWeight: 600 }}>🚀 In Buy Range</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Clarification Alert Banner */}
      {clarifications.length > 0 && (
        <div className="clarification-banner">
          <div className="clarification-text">
            ⚠️ <span className="clarification-count">{clarifications.length} Stock Signal(s)</span> have unmapped tickers (e.g. {clarifications.map(c => `"${c.companyName}"`).slice(0, 2).join(', ')}). You can resolve them on Telegram or directly below.
          </div>
          <button 
            className="btn-outline"
            style={{ borderColor: '#d97706', color: '#b45309' }}
            onClick={() => setActiveTab('clarifications')}
          >
            Review Clarifications
          </button>
        </div>
      )}

      {/* 9. Primary Tab Bar & Search */}
      <div className="filter-bar">
        <div className="tabs-group">
          <button 
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Signals ({signals.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'buy' ? 'active' : ''}`}
            onClick={() => setActiveTab('buy')}
          >
            Buy Calls
          </button>
          <button 
            className={`tab-btn ${activeTab === 'sell' ? 'active' : ''}`}
            onClick={() => setActiveTab('sell')}
          >
            Sell / Exits
          </button>
          <button 
            className={`tab-btn ${activeTab === 'actionable' ? 'active' : ''}`}
            onClick={() => setActiveTab('actionable')}
          >
            Actionable CMP ({actionableBuys + exitsTriggered})
          </button>
          {notifications.length > 0 && (
            <button 
              className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
              style={{ color: '#dc2626' }}
            >
              🚨 Alerts ({notifications.length})
            </button>
          )}
          {clarifications.length > 0 && (
            <button 
              className={`tab-btn ${activeTab === 'clarifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('clarifications')}
              style={{ color: '#d97706' }}
            >
              Needs Resolution ({clarifications.length})
            </button>
          )}
        </div>

        <input 
          type="text" 
          placeholder="Search symbol, company or source..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input-mobile"
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '13px',
            width: '280px'
          }}
        />
      </div>

      {/* 10. Sub-Filters and Sorting Toolbar */}
      <div className="subfilter-toolbar">
        {/* Star Rating Chips (Horizontally scrollable on mobile) */}
        <div className="subfilter-group">
          <span className="subfilter-label">Rating:</span>
          <div className="subfilter-chips-container">
            <button 
              className={`filter-chip ${ratingFilter === 'all' ? 'active' : ''}`}
              onClick={() => setRatingFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-chip rating-4plus ${ratingFilter === '4plus' ? 'active' : ''}`}
              onClick={() => setRatingFilter('4plus')}
            >
              ⭐ 4★–5★ ({highConvictionCount})
            </button>
            <button 
              className={`filter-chip ${ratingFilter === '3plus' ? 'active' : ''}`}
              onClick={() => setRatingFilter('3plus')}
            >
              ⭐ 3★+
            </button>
            <button 
              className={`filter-chip ${ratingFilter === 'sub3' ? 'active' : ''}`}
              onClick={() => setRatingFilter('sub3')}
            >
              ⭐ 1★–2★
            </button>
          </div>
        </div>

        {/* Horizon, Source, CMP Status, and Sort Controls (Responsive 2x2 grid on mobile) */}
        <div className="subfilter-group" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <div className="subfilter-selects-grid">
            {/* Horizon Dropdown */}
            <select 
              value={horizonFilter} 
              onChange={(e) => setHorizonFilter(e.target.value as any)}
              className="filter-select"
              title="Filter by Investment Horizon"
            >
              <option value="all">🌐 All Horizons</option>
              <option value="positional">⏳ Long Term</option>
              <option value="swing">⚡ Short Term</option>
            </select>

            {/* Source Dropdown with Source of Truth Hierarchy */}
            <select 
              value={sourceFilter} 
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="filter-select"
              title="Filter by Advisory Source (WhatsApp = 1st Priority / Source of Truth)"
            >
              <option value="all">📂 All Advisory Sources</option>
              <option value="whatsapp">🟢 1st Priority: WhatsApp (Source of Truth)</option>
              <option value="google_sheets">📄 2nd Priority: Google Sheets (All)</option>
              <option value="sheet_watchlist">📄 GS: Watchlist</option>
              <option value="sheet_stocklist">📋 GS: Stock list</option>
              <option value="telegram">✈️ 3rd Priority: Telegram Ingestion</option>
            </select>

            {/* CMP Status Dropdown */}
            <select 
              value={cmpStatusFilter} 
              onChange={(e) => setCmpStatusFilter(e.target.value as any)}
              className="filter-select"
              title="Filter by CMP Target Status"
            >
              <option value="all">🎯 All Statuses</option>
              <option value="buy_range">🟢 In Buy Range</option>
              <option value="target_met">🎯 Target Met</option>
              <option value="near">🟡 Near Range</option>
            </select>

            {/* Multi-Sort Dropdown */}
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
              style={{ fontWeight: 700, borderColor: '#93c5fd' }}
              title="Sort Signals"
            >
              <option value="source_priority">🛡️ Source of Truth (WhatsApp ➔ GS)</option>
              <option value="rating_desc">⭐ Rating (5★ → 1★)</option>
              <option value="discount_desc">📉 Highest Discount %</option>
              <option value="day_change_desc">📈 Top Gainers</option>
              <option value="day_change_asc">📉 Top Losers</option>
              <option value="symbol_asc">🔤 Symbol (A → Z)</option>
              <option value="level_desc">💰 Price Level</option>
            </select>
          </div>

          {/* View Mode Switcher (Card vs Table) */}
          <div className="view-mode-toggle">
            <button 
              className={`view-mode-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Cards View (Best on Mobile)"
            >
              📱 Cards
            </button>
            <button 
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View (Best on Desktop)"
            >
              📋 Table
            </button>
          </div>
        </div>
      </div>

      

      {/* 11. Sandbox Drawer */}
      {showSandbox && (
        <div className="sandbox-drawer">
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>📝 Live Signal Ingestion Sandbox</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>
            Paste any unstructured trade advisory message. The parser isolates the calls, fetches live CMP, stores them, and checks alert conditions.
          </p>
          <textarea
            className="sandbox-textarea"
            placeholder="Paste raw stock message here, e.g.:&#10;Stocks to sell:&#10;Hind zinc&#10;Sell above 575&#10;&#10;New stocks:&#10;Neuland labs&#10;Rating 2&#10;Buy upto 22500"
            value={sandboxText}
            onChange={(e) => setSandboxText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={handleParseSandbox}
              disabled={isParsingSandbox || !sandboxText.trim()}
            >
              {isParsingSandbox ? 'Analyzing...' : 'Parse & Save to Database'}
            </button>
            {sandboxFeedback && (
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{sandboxFeedback}</span>
            )}
          </div>
        </div>
      )}

      {/* 12. Alerts Tab View */}
      {activeTab === 'alerts' ? (
        <div className="signals-container" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>🚨 All Real-Time Dispatched Alerts</h3>
          <div className="alerts-grid">
            {notifications.map((notif) => {
              const isBuy = notif.type === 'BUY_ZONE_ENTERED';
              return (
                <div key={notif.id} className={`alert-card ${isBuy ? 'buy_zone' : ''}`}>
                  <div className="alert-card-top">
                    <div>
                      <span className="alert-card-sym">{notif.symbol}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '6px' }}>
                        {notif.companyName}
                      </span>
                    </div>
                    <span className={`alert-card-badge ${isBuy ? 'buy' : 'exit'}`}>
                      {isBuy ? '🟢 BUY ZONE' : '🎯 TARGET MET'}
                    </span>
                  </div>
                  <div className="alert-card-prices">
                    <span>Target Level: <strong>₹{notif.level || '-'}</strong></span>
                    <span style={{ color: isBuy ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                      Live CMP: ₹{notif.currentCMP}
                    </span>
                  </div>
                  {renderFormattedAlertMessage(notif)}
                  <div className="alert-card-footer">
                    <span>{notif.source || 'Advisory'} • {new Date(notif.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="telegram-sent-tag">
                      📱 Grouped &amp; Dispatched by Topic
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 13. Signals Container: Supports both Touch Cards & Full Table */
        <div className={`signals-container view-${viewMode}`}>
          {isLoading && signals.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#4f46e5' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>Loading Live Trade Signals & Market Quotes...</div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>Connecting to Multi-DB & refreshing live CMPs...</div>
            </div>
          ) : filteredSignals.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
              <div>No stock signals found matching your current filter.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Try switching the tab to "All" or adjusting the star rating filter above.</div>
            </div>
          ) : (
            <>
              {/* Touch-Friendly Mobile Cards View */}
              <div className="mobile-signals-cards">
                {filteredSignals.map((sig) => {
                  const isBuy = sig.action === 'BUY';
                  const isSell = sig.action?.includes('SELL') || sig.action?.includes('EXIT');
                  const cardClass = isBuy ? 'buy-card' : isSell ? 'sell-card' : 'watch-card';
                  const star = Number(sig.rating || 0);
                  const isResolvingThis = resolvingId === sig.id;

                  return (
                    <div key={sig.id} className={`mobile-signal-card ${cardClass}`}>
                      <div className="mobile-card-top-row">
                        <div className="mobile-card-title-group">
                          <div className="mobile-card-symbol-line">
                            <span className="mobile-card-symbol">{sig.symbol}</span>
                            {star > 0 && (
                              <span className="mobile-card-stars">
                                {'⭐'.repeat(star)} ({star}★)
                              </span>
                            )}
                          </div>
                          <span className="mobile-card-company">{sig.companyName}</span>
                        </div>
                        <div className="mobile-card-badges">
                          <span className={`badge-action ${sig.action?.toLowerCase() || 'watch'}`}>
                            {sig.action}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-prices-grid">
                        <div className="mobile-price-box">
                          <span className="mobile-price-label">
                            {sig.action === 'BUY' ? 'Buy Upto' : 'Target / Level'}
                          </span>
                          <span className="mobile-price-val">
                            ₹{sig.entryPrice || sig.entryMax || sig.entryMin || '-'}
                          </span>
                        </div>
                        <div className="mobile-price-box">
                          <span className="mobile-price-label">Live CMP</span>
                          <span className="mobile-price-val" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {sig.currentCMP ? (
                              <>
                                ₹{sig.currentCMP}
                                {sig.dayChangePercent !== undefined && sig.dayChangePercent !== null && (
                                  <span className={`cmp-change ${sig.dayChangePercent >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: '11px', margin: 0 }}>
                                    ({sig.dayChangePercent >= 0 ? '+' : ''}{sig.dayChangePercent}%)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Pending</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-meta-row">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span className={`badge-status ${sig.status?.toLowerCase() || 'active'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                              {sig.statusReason || sig.status}
                            </span>
                            {sig.source?.toLowerCase().includes('whatsapp') ? (
                              <span className="source-of-truth-pill">
                                🟢 WhatsApp (Source of Truth)
                              </span>
                            ) : (
                              <span className="source-secondary-pill">
                                📄 {sig.source}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {sig.callType || 'General'}
                          </span>
                        </div>
                        <div>
                          {sig.requiresClarification ? (
                            isResolvingThis ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <input 
                                  type="text" 
                                  placeholder="Ticker"
                                  value={resolvedTickerInput}
                                  onChange={(e) => setResolvedTickerInput(e.target.value)}
                                  style={{ width: '70px', padding: '2px 4px', fontSize: '11px' }}
                                />
                                <button className="btn-primary" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => handleResolveClarification(sig.id)}>Save</button>
                                <button className="btn-outline" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setResolvingId(null)}>✕</button>
                              </div>
                            ) : (
                              <button 
                                className="btn-outline"
                                style={{ borderColor: '#d97706', color: '#b45309', fontSize: '11px', padding: '2px 8px' }}
                                onClick={() => { setResolvingId(sig.id); setResolvedTickerInput(sig.symbol); }}
                              >
                                Resolve Ticker
                              </button>
                            )
                          ) : (
                            <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>✓ Synced</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full Data Table View with Horizontal Scroll */}
              <div className="signals-table-wrapper">
                <table className="signals-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Symbol / Company</th>
                      <th>Rating</th>
                      <th>Call Level (₹)</th>
                      <th>Live CMP (₹)</th>
                      <th>Market Status</th>
                      <th>Source &amp; Horizon</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.map((sig) => {
                      const actionClass = sig.action?.toLowerCase() || 'watch';
                      const statusClass = sig.status?.toLowerCase() || 'active';
                      const isResolvingThis = resolvingId === sig.id;
                      const star = Number(sig.rating || 0);

                      return (
                        <tr key={sig.id}>
                          <td>
                            <span className={`badge-action ${actionClass}`}>
                              {sig.action}
                            </span>
                          </td>
                          <td>
                            <div className="symbol-name-col">
                              <span className="symbol-code">{sig.symbol}</span>
                              <span className="company-sub">
                                {sig.companyName}
                              </span>
                            </div>
                          </td>
                          <td>
                            {star > 0 ? (
                              <span style={{ 
                                fontWeight: 700, 
                                color: star >= 4 ? '#d97706' : star === 3 ? '#16a34a' : '#64748b' 
                              }}>
                                {'⭐'.repeat(star)} ({star}★)
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>-</span>
                            )}
                          </td>
                          <td>
                            <strong style={{ fontSize: '15px' }}>
                              ₹{sig.entryPrice || sig.entryMax || sig.entryMin || '-'}
                            </strong>
                          </td>
                          <td>
                            {sig.currentCMP ? (
                              <div className="cmp-cell">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span>
                                  ₹{sig.currentCMP}
                                </span>
                                {sig.dayChangePercent !== undefined && sig.dayChangePercent !== null && (
                                  <span className={`cmp-change ${sig.dayChangePercent >= 0 ? 'pos' : 'neg'}`}>
                                    ({sig.dayChangePercent >= 0 ? '+' : ''}{sig.dayChangePercent}%)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Pending quote</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge-status ${statusClass}`}>
                              {sig.statusReason || sig.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.3 }}>
                              {sig.source?.toLowerCase().includes('whatsapp') ? (
                                <div className="source-of-truth-pill" style={{ display: 'inline-flex', marginBottom: '4px' }}>
                                  🟢 WhatsApp (Source of Truth)
                                </div>
                              ) : (
                                <div className="source-secondary-pill" style={{ display: 'inline-flex', marginBottom: '4px' }}>
                                  📄 {sig.source}
                                </div>
                              )}
                              <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                {sig.callType || 'General'}
                              </div>
                            </div>
                          </td>
                          <td>
                            {sig.requiresClarification ? (
                              isResolvingThis ? (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <input 
                                    type="text" 
                                    placeholder="NSE Symbol"
                                    value={resolvedTickerInput}
                                    onChange={(e) => setResolvedTickerInput(e.target.value)}
                                    style={{ width: '90px', padding: '4px', fontSize: '12px' }}
                                  />
                                  <button 
                                    className="btn-primary" 
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                    onClick={() => handleResolveClarification(sig.id)}
                                  >
                                    Save
                                  </button>
                                  <button 
                                    className="btn-outline" 
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                    onClick={() => setResolvingId(null)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  className="btn-outline"
                                  style={{ borderColor: '#d97706', color: '#b45309', fontSize: '12px', padding: '4px 10px' }}
                                  onClick={() => {
                                    setResolvingId(sig.id);
                                    setResolvedTickerInput(sig.symbol);
                                  }}
                                >
                                  Resolve Ticker
                                </button>
                              )
                            ) : (
                              <span style={{ color: '#10b981', fontSize: '13px' }}>✓ Synced</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EquityPage;
