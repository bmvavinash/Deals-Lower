const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/DealsPage.tsx', 'utf8');

const stateStr =   const [isRetriggering, setIsRetriggering] = useState(false);
  const [productCodeSearch, setProductCodeSearch] = useState('');
  const [isSearchingCode, setIsSearchingCode] = useState(false);
  const [productCodeResult, setProductCodeResult] = useState<any>(null);;
content = content.replace('  const [isRetriggering, setIsRetriggering] = useState(false);', stateStr);

const funcStr =   const handleSearchByProductCode = async () => {
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

  const handleRetrigger = async () => {;
content = content.replace('  const handleRetrigger = async () => {', funcStr);

const viewStr = {viewMode === 'deals' && (
          <div className="deals-page-layout">
            <div className="deals-sidebar">
              <DealFilters filters={filters} onFilterChange={handleFilterChange} isLoading={dealsLoading} />
            </div>
            
            <div className="deals-main-content">
              <div className="deals-view-header search-section" style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div className="product-code-search" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="Search by Product Code..." 
                    value={productCodeSearch}
                    onChange={(e) => setProductCodeSearch(e.target.value)}
                    className="filter-input"
                    style={{ width: '250px', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchByProductCode()}
                  />
                  <button 
                    onClick={handleSearchByProductCode}
                    className="trigger-button"
                    disabled={isSearchingCode}
                    style={{ padding: '10px 16px', backgroundColor: '#3498db' }}
                  >
                    {isSearchingCode ? (
                      <><span className="spinner">?</span> Searching...</>
                    ) : '?? Search'}
                  </button>
                  {productCodeResult && (
                    <button 
                      onClick={() => { setProductCodeSearch(''); setProductCodeResult(null); }}
                      className="trigger-button"
                      style={{ padding: '10px 16px', backgroundColor: '#e74c3c' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                <button 
                  onClick={handleTriggerBanners} 
                  className="trigger-button banner-trigger-button"
                  disabled={isTriggeringBanners}
                  title="Display banners from all platforms"
                >
                  {isTriggeringBanners ? (
                    <><span className="spinner">?</span> Loading...</>
                  ) : '??? Display Banners'}
                </button>
              </div>
              
              {dealsLoading && !productCodeResult && <div className="loading"><span className="spinner">?</span> Loading deals...</div>}
              {dealsError && <div className="error">Error loading deals: {String(dealsError)}</div>}
              {productCodeResult ? (
                <DealList 
                  deals={[productCodeResult]} 
                  database={filters.dealType === 'hotDeal' ? 'deals' : 'productdeals'}
                  pagination={{ total: 1, limit: 1, offset: 0, hasMore: false }}
                  onPageChange={() => {}}
                />
              ) : dealsData && (
                <DealList 
                  deals={(dealsData.data as any).data || []} 
                  database={(dealsData.data as any).database}
                  pagination={(dealsData.data as any).pagination}
                  onPageChange={(offset) => setFilters({ ...filters, offset })}
                />
              )}
            </div>
          </div>
        )};

// replace the entire deals view
const oldRegex = /\{viewMode === 'deals' && \([\s\S]*?onPageChange=\{\(offset\) => setFilters\(\{ ...filters, offset \}\)\}\n\s*\/>\n\s*\)\}\n\s*<\/>\n\s*\)\}/;
content = content.replace(oldRegex, viewStr);

fs.writeFileSync('frontend/src/pages/DealsPage.tsx', content);
