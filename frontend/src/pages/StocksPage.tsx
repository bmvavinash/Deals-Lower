import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { stocksAPI, ipoAPI } from '../services/api';
import './StocksPage.css';

interface FavoriteMember {
  name: string;
  pan: string;
}

interface FavoriteFamily {
  familyName: string;
  members: FavoriteMember[];
}

const StocksPage: React.FC = () => {
  const { data: zerodhaData } = useQuery('zerodha', stocksAPI.getZerodha);
  const { data: xalphaData } = useQuery('xalpha', stocksAPI.getXAlpha);
  const { data: recommendationsData } = useQuery('recommendations', stocksAPI.getRecommendations);

  const [ipoKeyword, setIpoKeyword] = useState('');
  const [checkMode, setCheckMode] = useState<'single' | 'multiple' | 'favorites'>('single');
  const [singlePan, setSinglePan] = useState('');
  const [panNumbersText, setPanNumbersText] = useState('');
  
  // Favorites State
  const [favorites, setFavorites] = useState<FavoriteFamily[]>([]);
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [selectedPans, setSelectedPans] = useState<string[]>([]);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPan, setNewMemberPan] = useState('');

  const [ipoResults, setIpoResults] = useState<any[]>([]);
  const [isIpoLoading, setIsIpoLoading] = useState(false);
  const [ipoError, setIpoError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('ipoFavorites');
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load favorites", e);
      }
    }
  }, []);

  const saveFavorites = (newFavs: FavoriteFamily[]) => {
    setFavorites(newFavs);
    localStorage.setItem('ipoFavorites', JSON.stringify(newFavs));
  };

  const toggleFamily = (familyName: string) => {
    setExpandedFamilies(prev => ({
      ...prev,
      [familyName]: !prev[familyName]
    }));
  };

  const handleSelectPan = (pan: string) => {
    setSelectedPans(prev => 
      prev.includes(pan) ? prev.filter(p => p !== pan) : [...prev, pan]
    );
  };

  const handleSelectFamily = (family: FavoriteFamily, checked: boolean) => {
    const familyPans = family.members.map(m => m.pan);
    if (checked) {
      setSelectedPans(prev => Array.from(new Set([...prev, ...familyPans])));
    } else {
      setSelectedPans(prev => prev.filter(p => !familyPans.includes(p)));
    }
  };

  const handleAddFavorite = () => {
    if (!newFamilyName.trim() || !newMemberName.trim() || !newMemberPan.trim()) return;
    
    const newFavs = [...favorites];
    const familyIndex = newFavs.findIndex(f => f.familyName.toLowerCase() === newFamilyName.trim().toLowerCase());
    
    if (familyIndex >= 0) {
      if (!newFavs[familyIndex].members.some(m => m.pan === newMemberPan.trim().toUpperCase())) {
         newFavs[familyIndex].members.push({
           name: newMemberName.trim(),
           pan: newMemberPan.trim().toUpperCase()
         });
      }
    } else {
      newFavs.push({
        familyName: newFamilyName.trim(),
        members: [{
          name: newMemberName.trim(),
          pan: newMemberPan.trim().toUpperCase()
        }]
      });
    }
    
    saveFavorites(newFavs);
    setNewMemberName('');
    setNewMemberPan('');
    // Optionally clear family name if they want to add to different families, 
    // but keeping it makes adding multiple to one family easier.
  };

  const handleCheckIpo = async () => {
    setIpoError('');
    
    if (!ipoKeyword.trim()) {
      setIpoError('Please enter an IPO keyword.');
      return;
    }
    
    let panNumbers: string[] = [];
    
    if (checkMode === 'single') {
      if (!singlePan.trim()) {
        setIpoError('Please enter a PAN number.');
        return;
      }
      panNumbers = [singlePan.trim().toUpperCase()];
    } else if (checkMode === 'multiple') {
      panNumbers = panNumbersText
        .split(/[\n,]+/)
        .map(p => p.trim().toUpperCase())
        .filter(p => p.length > 0);
        
      if (panNumbers.length === 0) {
        setIpoError('Please enter at least one PAN number.');
        return;
      }
    } else if (checkMode === 'favorites') {
      if (selectedPans.length === 0) {
         setIpoError('Please select at least one member from your favorites.');
         return;
      }
      panNumbers = [...selectedPans];
    }

    setIsIpoLoading(true);
    try {
      const res = await ipoAPI.checkKfintechStatus({ ipoKeyword, panNumbers });
      if (res.data.success) {
        setIpoResults(prevResults => {
          const newResults = res.data.data;
          const resultMap = new Map(prevResults.map(r => [`${r.pan}-${r.ipoName}`, r]));
          newResults.forEach((r: any) => resultMap.set(`${r.pan}-${r.ipoName}`, r));
          return Array.from(resultMap.values());
        });
      } else {
        setIpoError(res.data.message || 'Failed to check IPO status.');
      }
    } catch (err: any) {
      setIpoError(err.response?.data?.message || err.message || 'Error checking IPO status.');
    } finally {
      setIsIpoLoading(false);
    }
  };

  return (
    <div className="stocks-page">
      <h1>Stocks & Trading</h1>

      <div className="stocks-section">
        <h2>IPO Allocation Status Checker</h2>
        <div className="ipo-form">
          <div className="form-group">
            <label>IPO Name (Keyword)</label>
            <input 
              type="text" 
              value={ipoKeyword}
              onChange={e => setIpoKeyword(e.target.value)}
              placeholder="e.g. LIC, Bajaj"
              className="ipo-input"
            />
          </div>

          <div className="ipo-tabs">
            <button 
              className={`ipo-tab ${checkMode === 'single' ? 'active' : ''}`}
              onClick={() => setCheckMode('single')}
            >
              Single
            </button>
            <button 
              className={`ipo-tab ${checkMode === 'multiple' ? 'active' : ''}`}
              onClick={() => setCheckMode('multiple')}
            >
              Multiple
            </button>
            <button 
              className={`ipo-tab ${checkMode === 'favorites' ? 'active' : ''}`}
              onClick={() => setCheckMode('favorites')}
            >
              Favorites
            </button>
          </div>

          {checkMode === 'single' && (
            <div className="form-group">
              <label>PAN Number</label>
              <input 
                type="text"
                value={singlePan}
                onChange={e => setSinglePan(e.target.value)}
                placeholder="ABCDE1234F"
                className="ipo-input"
              />
            </div>
          )}

          {checkMode === 'multiple' && (
            <div className="form-group">
              <label>PAN Numbers (comma or newline separated)</label>
              <textarea 
                value={panNumbersText}
                onChange={e => setPanNumbersText(e.target.value)}
                placeholder="ABCDE1234F&#10;XYZDE5678G"
                className="ipo-textarea"
                rows={5}
              />
            </div>
          )}

          {checkMode === 'favorites' && (
            <div className="form-group">
              <label>Select Favorites (Grouped by Family)</label>
              {favorites.length === 0 ? (
                <p style={{ color: '#7f8c8d', fontSize: '14px' }}>No favorites added yet. Add one below.</p>
              ) : (
                <div className="favorites-list">
                  {favorites.map((fam, idx) => {
                    const allSelected = fam.members.every(m => selectedPans.includes(m.pan));
                    const someSelected = fam.members.some(m => selectedPans.includes(m.pan));
                    
                    return (
                      <div key={idx} className="family-accordion">
                        <div className="family-header" onClick={() => toggleFamily(fam.familyName)}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={allSelected}
                              ref={input => {
                                if (input) input.indeterminate = someSelected && !allSelected;
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectFamily(fam, e.target.checked);
                              }}
                              style={{ marginRight: '10px' }}
                            />
                            <span>{fam.familyName} Family ({fam.members.length})</span>
                          </div>
                          <span>{expandedFamilies[fam.familyName] ? '▲' : '▼'}</span>
                        </div>
                        {expandedFamilies[fam.familyName] && (
                          <div className="family-content">
                            {fam.members.map((m, mIdx) => (
                              <div key={mIdx} className="family-member-item">
                                <input 
                                  type="checkbox" 
                                  checked={selectedPans.includes(m.pan)}
                                  onChange={() => handleSelectPan(m.pan)}
                                />
                                <div className="family-member-info">
                                  <span className="family-member-name">{m.name}</span>
                                  <span className="family-member-pan">{m.pan}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="add-favorite-form">
                <input 
                  className="ipo-input" 
                  placeholder="Family Name" 
                  value={newFamilyName} 
                  onChange={e => setNewFamilyName(e.target.value)} 
                />
                <input 
                  className="ipo-input" 
                  placeholder="Member Name" 
                  value={newMemberName} 
                  onChange={e => setNewMemberName(e.target.value)} 
                />
                <input 
                  className="ipo-input" 
                  placeholder="PAN" 
                  value={newMemberPan} 
                  onChange={e => setNewMemberPan(e.target.value)} 
                />
                <button className="btn-secondary" onClick={handleAddFavorite}>Add</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleCheckIpo} 
              disabled={isIpoLoading}
              className="ipo-button"
            >
              {isIpoLoading ? 'Checking...' : 'Check Status'}
            </button>
            {ipoResults.length > 0 && (
              <button 
                onClick={() => setIpoResults([])} 
                className="ipo-button"
                style={{ backgroundColor: '#e74c3c' }}
              >
                Clear Results
              </button>
            )}
          </div>
          {ipoError && <div className="error-message">{ipoError}</div>}
        </div>

        {ipoResults.length > 0 && (
          <div className="table-container ipo-results">
            <table className="stocks-table responsive-cards">
              <thead>
                <tr>
                  <th>PAN</th>
                  <th>IPO Name</th>
                  <th>Status</th>
                  <th>Shares Applied</th>
                  <th>Shares Allotted</th>
                </tr>
              </thead>
              <tbody>
                {ipoResults.map((res, idx) => (
                  <tr key={idx}>
                    <td data-label="PAN">{res.pan}</td>
                    <td data-label="IPO Name">{res.ipoName || '-'}</td>
                    <td data-label="Status" className={res.status === 'Allotted' ? 'positive' : res.status.includes('Error') ? 'negative' : ''}>{res.status}</td>
                    <td data-label="Shares Applied">{res.sharesApplied}</td>
                    <td data-label="Shares Allotted">{res.sharesAllotted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="stocks-section">
        <h2>Zerodha Holdings</h2>
        {zerodhaData?.data?.success ? (
          <div className="table-container">
            <table className="stocks-table responsive-cards">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Qty</th>
                  <th>Avg Cost</th>
                  <th>LTP</th>
                  <th>Cur Val</th>
                  <th>PnL</th>
                  <th>Day Chg</th>
                </tr>
              </thead>
              <tbody>
                {(zerodhaData.data.data || []).map((stock: any, idx: number) => (
                  <tr key={idx}>
                    <td data-label="Instrument">{stock.Instrument}</td>
                    <td data-label="Qty">{stock.Qty}</td>
                    <td data-label="Avg Cost">{stock.AvgCost}</td>
                    <td data-label="LTP">{stock.LTP}</td>
                    <td data-label="Cur Val">{stock.CurVal}</td>
                    <td data-label="PnL" className={stock.PnL >= 0 ? 'positive' : 'negative'}>{stock.PnL}</td>
                    <td data-label="Day Chg" className={stock.DayChg >= 0 ? 'positive' : 'negative'}>{stock.DayChg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">No Zerodha data available. Ensure the main application is running.</div>
        )}
      </div>

      <div className="stocks-section">
        <h2>X Alpha Crypto Data</h2>
        {xalphaData?.data?.success ? (
          <div className="table-container">
            <pre>{JSON.stringify(xalphaData.data.data, null, 2)}</pre>
          </div>
        ) : (
          <div className="no-data">No X Alpha data available. Ensure the main application is running.</div>
        )}
      </div>

      <div className="stocks-section">
        <h2>Stock Recommendations</h2>
        {recommendationsData?.data?.success ? (
          <div className="table-container">
            <table className="stocks-table responsive-cards">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Score</th>
                  <th>Stock Match</th>
                  <th>Duration Match</th>
                  <th>Low Price Match</th>
                  <th>Target Match</th>
                  <th>Stop Loss Match</th>
                </tr>
              </thead>
              <tbody>
                {(recommendationsData.data.data || []).map((rec: any, idx: number) => (
                  <tr key={idx}>
                    <td data-label="Instrument">{rec.Instrument}</td>
                    <td data-label="Score">{rec.RecommendationScore}</td>
                    <td data-label="Stock Match">{rec.stockMatch ? '✓' : '✗'}</td>
                    <td data-label="Duration Match">{rec.durationMatch ? '✓' : '✗'}</td>
                    <td data-label="Low Price Match">{rec.lowPriceMatch ? '✓' : '✗'}</td>
                    <td data-label="Target Match">{rec.targetMatch ? '✓' : '✗'}</td>
                    <td data-label="Stop Loss Match">{rec.stoplossMatch ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">No recommendations available.</div>
        )}
      </div>
    </div>
  );
};

export default StocksPage;
