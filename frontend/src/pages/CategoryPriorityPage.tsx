import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CategoryPriorityPage.css';

interface Subcategory {
  id: string;
  name: string;
  priority: number;
  searchTerm: string;
}

interface Category {
  id: string;
  name: string;
  priority: number;
  subcategories: Subcategory[];
}

interface PriorityConfig {
  maxPagesToScrape: number;
  categories: Category[];
}

const CategoryPriorityPage: React.FC = () => {
  const [config, setConfig] = useState<PriorityConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [platformSelections, setPlatformSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/category-priority');
      const data = response.data;
      if (data.categories) {
        data.categories.sort((a: Category, b: Category) => a.priority - b.priority);
        data.categories.forEach((cat: Category) => {
          if (cat.subcategories) {
            cat.subcategories.sort((a: Subcategory, b: Subcategory) => a.priority - b.priority);
          }
        });
      }
      if (!data.maxPagesToScrape) data.maxPagesToScrape = 1;
      setConfig(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch category priority:', err);
      setError('Failed to load category priorities.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      
      const dataToSave = { ...config };
      dataToSave.categories.forEach((cat, index) => {
        cat.priority = index + 1;
        cat.subcategories.forEach((subcat, subIndex) => {
          subcat.priority = subIndex + 1;
        });
      });

      await axios.put('/api/category-priority', dataToSave);
      setSuccessMsg('Saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
      setConfig(dataToSave);
      setError(null);
    } catch (err) {
      console.error('Failed to save category priority:', err);
      setError('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleTrigger = async (categoryId?: string, platform?: string) => {
    try {
      setSaving(true);
      const payload: any = {};
      if (categoryId) payload.categoryId = categoryId;
      if (platform) payload.platform = platform;
      
      await axios.post('/api/category-priority/trigger', payload);
      setSuccessMsg('Scrape triggered successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to trigger scrape:', err);
      setError('Failed to trigger scrape.');
    } finally {
      setSaving(false);
    }
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    if (!config) return;
    const newCategories = [...config.categories];
    if (direction === 'up' && index > 0) {
      [newCategories[index - 1], newCategories[index]] = [newCategories[index], newCategories[index - 1]];
    } else if (direction === 'down' && index < newCategories.length - 1) {
      [newCategories[index + 1], newCategories[index]] = [newCategories[index], newCategories[index + 1]];
    }
    setConfig({ ...config, categories: newCategories });
  };

  const moveSubcategory = (catIndex: number, subIndex: number, direction: 'up' | 'down') => {
    if (!config) return;
    const newCategories = [...config.categories];
    const subcats = [...newCategories[catIndex].subcategories];
    
    if (direction === 'up' && subIndex > 0) {
      [subcats[subIndex - 1], subcats[subIndex]] = [subcats[subIndex], subcats[subIndex - 1]];
    } else if (direction === 'down' && subIndex < subcats.length - 1) {
      [subcats[subIndex + 1], subcats[subIndex]] = [subcats[subIndex], subcats[subIndex + 1]];
    }
    
    newCategories[catIndex].subcategories = subcats;
    setConfig({ ...config, categories: newCategories });
  };

  const updateSearchTerm = (catIndex: number, subIndex: number, value: string) => {
    if (!config) return;
    const newCategories = [...config.categories];
    newCategories[catIndex].subcategories[subIndex].searchTerm = value;
    setConfig({ ...config, categories: newCategories });
  };

  if (loading) {
    return <div className="priority-page loading">Loading priorities...</div>;
  }

  return (
    <div className="priority-page">
      <div className="priority-header">
        <div>
          <h1>Category Prioritization</h1>
          <p>Order categories and define dynamic search terms. The scraper will process these breadth-first.</p>
        </div>
        <div className="header-actions">
          <div className="global-settings">
            <label>Max Pages to Scrape:</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              value={config?.maxPagesToScrape || 1} 
              onChange={(e) => setConfig({ ...config!, maxPagesToScrape: parseInt(e.target.value) || 1 })}
            />
          </div>
          <button className="trigger-btn" onClick={() => handleTrigger(undefined, platformSelections['global'] || 'all')} disabled={saving} style={{ backgroundColor: '#ff9800', marginRight: '10px' }}>
            Trigger Global Scrape
          </button>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}

      <div className="priority-container">
        {config?.categories?.map((cat, catIndex) => (
          <div key={cat.id} className="category-card">
            <div className="category-header">
              <h2>{cat.name}</h2>
              <div className="trigger-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', marginRight: '16px' }}>
                <select 
                  value={platformSelections[cat.id] || 'all'}
                  onChange={e => setPlatformSelections({...platformSelections, [cat.id]: e.target.value})}
                  style={{ padding: '4px', borderRadius: '4px' }}
                >
                  <option value="all">All Platforms</option>
                  <option value="amazon">Amazon</option>
                  <option value="flipkart">Flipkart</option>
                  <option value="myntra">Myntra</option>
                  <option value="ajio">Ajio</option>
                </select>
                <button 
                  onClick={() => handleTrigger(cat.id, platformSelections[cat.id] || 'all')} 
                  disabled={saving}
                  style={{ padding: '4px 8px', backgroundColor: '#4caf50', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                >
                  Scrape
                </button>
              </div>
              <div className="controls">
                <button 
                  onClick={() => moveCategory(catIndex, 'up')} 
                  disabled={catIndex === 0}>
                  ▲
                </button>
                <button 
                  onClick={() => moveCategory(catIndex, 'down')} 
                  disabled={catIndex === config.categories.length - 1}>
                  ▼
                </button>
              </div>
            </div>
            
            <div className="subcategory-list">
              {cat.subcategories?.map((subcat, subIndex) => (
                <div key={subcat.id} className="subcategory-item">
                  <div className="sub-info">
                    <span className="sub-name">{subcat.name}</span>
                    <input 
                      type="text" 
                      className="search-term-input" 
                      value={subcat.searchTerm || ''}
                      onChange={(e) => updateSearchTerm(catIndex, subIndex, e.target.value)}
                      placeholder="e.g., air conditioners"
                    />
                  </div>
                  <div className="trigger-group" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', marginRight: '16px' }}>
                    <select 
                      value={platformSelections[`${cat.id}_${subcat.id}`] || 'all'}
                      onChange={e => setPlatformSelections({...platformSelections, [`${cat.id}_${subcat.id}`]: e.target.value})}
                      style={{ padding: '4px', borderRadius: '4px', fontSize: '12px' }}
                    >
                      <option value="all">All Platforms</option>
                      <option value="amazon">Amazon</option>
                      <option value="flipkart">Flipkart</option>
                      <option value="myntra">Myntra</option>
                      <option value="ajio">Ajio</option>
                    </select>
                    <button 
                      onClick={() => handleTrigger(`${cat.id}_${subcat.id}`, platformSelections[`${cat.id}_${subcat.id}`] || 'all')} 
                      disabled={saving}
                      style={{ padding: '4px 8px', backgroundColor: '#2196f3', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Scrape Sub
                    </button>
                  </div>
                  <div className="controls">
                    <button 
                      onClick={() => moveSubcategory(catIndex, subIndex, 'up')} 
                      disabled={subIndex === 0}>
                      ▲
                    </button>
                    <button 
                      onClick={() => moveSubcategory(catIndex, subIndex, 'down')} 
                      disabled={subIndex === cat.subcategories.length - 1}>
                      ▼
                    </button>
                  </div>
                </div>
              ))}
              {(!cat.subcategories || cat.subcategories.length === 0) && (
                <div className="empty-sub">No subcategories defined</div>
              )}
            </div>
          </div>
        ))}
        {(!config?.categories || config.categories.length === 0) && (
          <div className="empty-state">No categories configured.</div>
        )}
      </div>
    </div>
  );
};

export default CategoryPriorityPage;
