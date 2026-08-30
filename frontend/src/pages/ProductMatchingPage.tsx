import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProductMatchingPage.css';

interface MatchedProduct {
  productCode: string;
  db: string;
  title: string;
  price: string | number;
  storeType: string;
  photo: string;
  productUrl: string;
}

interface MatchGroup {
  matchId: string;
  products: MatchedProduct[];
}

const ProductMatchingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'registry' | 'manual'>('registry');
  
  // Linker Form State
  const [linkSource, setLinkSource] = useState('');
  const [linkTarget, setLinkTarget] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  // Unlinker Form State
  const [unlinkSource, setUnlinkSource] = useState('');
  const [unlinkTarget, setUnlinkTarget] = useState('');
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [unlinkSuccess, setUnlinkSuccess] = useState<string | null>(null);

  // Matches Registry State
  const [groups, setGroups] = useState<MatchGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'registry') {
      fetchMatches();
    }
  }, [activeTab]);

  const fetchMatches = async () => {
    try {
      setRegistryLoading(true);
      setRegistryError(null);
      const response = await axios.get('/api/deals/matches');
      if (response.data && response.data.success) {
        setGroups(response.data.groups || []);
      }
    } catch (err: any) {
      console.error('Fetch matches error:', err);
      setRegistryError('Failed to fetch matched products registry');
    } finally {
      setRegistryLoading(false);
    }
  };

  const extractCode = (input: string) => {
    if (!input) return '';
    if (input.includes('amazon.in')) {
      const match = input.match(/\/dp\/([A-Z0-9]+)/);
      return match ? match[1] : input;
    }
    if (input.includes('flipkart.com')) {
      const match = input.match(/pid=([A-Z0-9]+)/) || input.match(/\/p\/([a-zA-Z0-9]+)/);
      return match ? match[1] : input;
    }
    return input.trim();
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSource || !linkTarget) {
      setLinkError('Please provide both product codes or URLs');
      return;
    }

    try {
      setLinkLoading(true);
      setLinkError(null);
      setLinkSuccess(null);

      const sCode = extractCode(linkSource);
      const tCode = extractCode(linkTarget);

      const response = await axios.post('/api/deals/link', {
        sourceProductCode: sCode,
        targetProductCode: tCode
      });

      setLinkSuccess(`Success! ${response.data.message}. These products will now display together.`);
      setLinkSource('');
      setLinkTarget('');
    } catch (err: any) {
      console.error('Link error', err);
      setLinkError(err.response?.data?.error || 'An error occurred while linking products.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlink = async (source: string, target: string, database?: string) => {
    try {
      const sCode = extractCode(source);
      const tCode = extractCode(target);

      const response = await axios.post('/api/deals/unlink', {
        productCode1: sCode,
        productCode2: tCode,
        database
      });

      return { success: true, message: response.data.message };
    } catch (err: any) {
      console.error('Unlink error', err);
      throw new Error(err.response?.data?.error || 'An error occurred while de-linking products.');
    }
  };

  const handleManualUnlink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlinkSource || !unlinkTarget) {
      setUnlinkError('Please provide both product codes or URLs');
      return;
    }

    try {
      setUnlinkLoading(true);
      setUnlinkError(null);
      setUnlinkSuccess(null);

      const result = await handleUnlink(unlinkSource, unlinkTarget);
      setUnlinkSuccess(`Success! ${result.message}. These products have been de-linked.`);
      
      const sCode = extractCode(unlinkSource);
      const tCode = extractCode(unlinkTarget);
      setGroups(prevGroups => prevGroups.filter(g => {
        const hasSource = g.products.some(p => p.productCode === sCode);
        const hasTarget = g.products.some(p => p.productCode === tCode);
        return !(hasSource && hasTarget);
      }));

      setUnlinkSource('');
      setUnlinkTarget('');
    } catch (err: any) {
      setUnlinkError(err.message);
    } finally {
      setUnlinkLoading(false);
    }
  };

  const handleGroupUnlink = async (group: MatchGroup) => {
    if (group.products.length < 2) return;
    const p1 = group.products[0];
    const p2 = group.products[1];

    if (!window.confirm(`Are you sure you want to break the link between:\n\n1. [${p1.storeType}] ${p1.title}\n2. [${p2.storeType}] ${p2.title}?`)) {
      return;
    }

    try {
      // Direct call using the database they belong to
      await handleUnlink(p1.productCode, p2.productCode, p1.db);
      alert('Products successfully de-linked!');
      setGroups(prevGroups => prevGroups.filter(g => g.matchId !== group.matchId));
    } catch (err: any) {
      alert(`Failed to de-link products: ${err.message}`);
    }
  };

  // Filter groups based on search query
  const filteredGroups = groups.filter(group => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase().trim();
    return group.products.some(p => 
      p.title.toLowerCase().includes(query) ||
      p.productCode.toLowerCase().includes(query) ||
      p.storeType.toLowerCase().includes(query)
    );
  });

  return (
    <div className="matching-page">
      <div className="matching-header">
        <h1>Product Matching & De-linking Registry</h1>
        <p>Manage cross-platform product links. Force products to match or separate incorrect matches so they display correctly on the website.</p>
      </div>

      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'registry' ? 'active' : ''}`}
          onClick={() => setActiveTab('registry')}
        >
          📁 Match Registry
        </button>
        <button 
          className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          🔧 Manual Link / Unlink
        </button>
      </div>

      {activeTab === 'registry' && (
        <div className="registry-tab">
          <div className="search-filter-bar">
            <input 
              type="text" 
              placeholder="🔍 Search matches by product code, platform, or title..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="registry-search"
            />
            <button className="refresh-btn" onClick={fetchMatches} disabled={registryLoading}>
              {registryLoading ? 'Refreshing...' : 'Refresh ↻'}
            </button>
          </div>

          {registryError && <div className="alert error">{registryError}</div>}

          {registryLoading ? (
            <div className="loading-state">
              <span className="spinner">↻</span> Loading matches database...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="empty-state">
              {searchQuery ? 'No matches found matching your search query.' : 'No active matched products found.'}
            </div>
          ) : (
            <div className="matches-list">
              <p className="matches-summary">Showing {filteredGroups.length} matched product group(s)</p>
              {filteredGroups.map((group, index) => (
                <div className="match-group-card" key={group.matchId || index}>
                  <div className="match-group-header">
                    <span className="match-id-badge">ID: {group.matchId.substring(0, 30)}</span>
                    <button 
                      className="break-link-btn" 
                      onClick={() => handleGroupUnlink(group)}
                    >
                      🔓 Break Link (De-link)
                    </button>
                  </div>
                  
                  <div className="matched-products-grid">
                    {group.products.map((p, idx) => (
                      <div className="matched-product-subcard" key={p.productCode || idx}>
                        <div className="product-image-container">
                          {p.photo ? (
                            <img src={p.photo} alt={p.title} />
                          ) : (
                            <div className="no-image-placeholder">No Image</div>
                          )}
                          <span className={`platform-badge ${p.storeType.toLowerCase()}`}>{p.storeType}</span>
                        </div>
                        <div className="product-details">
                          <h4 className="product-title" title={p.title}>{p.title}</h4>
                          <div className="product-metadata">
                            <span className="product-code">Code: {p.productCode}</span>
                            <span className="product-price">₹{p.price}</span>
                          </div>
                          <div className="product-actions">
                            <a 
                              href={p.productUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="view-link-btn"
                            >
                              Open Listing ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="manual-tab">
          <div className="manual-forms-grid">
            {/* Manual Linker Card */}
            <div className="matching-card linker">
              <h3>🔗 Manual Product Linker</h3>
              <p className="card-desc">Force two separate listings to share the same unique Match ID so they group as a single product.</p>
              <form onSubmit={handleLink}>
                <div className="form-group">
                  <label>Product 1 (Code or URL)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. B0CHX4W743 or https://amazon.in/..." 
                    value={linkSource}
                    onChange={(e) => setLinkSource(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Product 2 (Code or URL)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. EKTHC2ZP3QKNKHVS or https://flipkart.com/..." 
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                  />
                </div>
                <button type="submit" className="link-btn" disabled={linkLoading}>
                  {linkLoading ? 'Linking...' : 'Merge Products'}
                </button>
              </form>
              {linkError && <div className="alert error">{linkError}</div>}
              {linkSuccess && <div className="alert success">{linkSuccess}</div>}
            </div>

            {/* Manual Unlinker Card */}
            <div className="matching-card unlinker">
              <h3>🔓 Manual Product Unlinker</h3>
              <p className="card-desc">Break the link between two products, resetting them to be displayed as separate individual items.</p>
              <form onSubmit={handleManualUnlink}>
                <div className="form-group">
                  <label>Product 1 (Code or URL)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. B0CHX4W743 or https://amazon.in/..." 
                    value={unlinkSource}
                    onChange={(e) => setUnlinkSource(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Product 2 (Code or URL)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. EKTHC2ZP3QKNKHVS or https://flipkart.com/..." 
                    value={unlinkTarget}
                    onChange={(e) => setUnlinkTarget(e.target.value)}
                  />
                </div>
                <button type="submit" className="unlink-btn" disabled={unlinkLoading}>
                  {unlinkLoading ? 'De-linking...' : 'Separate Products'}
                </button>
              </form>
              {unlinkError && <div className="alert error">{unlinkError}</div>}
              {unlinkSuccess && <div className="alert success">{unlinkSuccess}</div>}
            </div>
          </div>

          <div className="info-card">
            <h3>How it works</h3>
            <p>Matching is driven by model numbers or features parsed by our scraper. If any incorrect matches occur (e.g. products with different capacities or sizes get matched), you can manually separate them using the unlinker or the registry list above.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMatchingPage;
