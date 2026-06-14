import React, { useState, useEffect } from 'react';
import './MatchingConfigPage.css';

interface CategoryRules {
  [category: string]: string[];
}

const ALL_PLATFORMS = ['Amazon', 'Flipkart', 'Myntra', 'Ajio'];

const MatchingConfigPage: React.FC = () => {
  const [rules, setRules] = useState<CategoryRules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggeringLive, setTriggeringLive] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/matching-config');
      const data = await res.json();
      if (data.success) {
        setRules(data.data || {});
      } else {
        showMessage('Failed to load rules', 'error');
      }
    } catch (error) {
      showMessage('Error loading rules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/matching-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: rules }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Rules saved successfully', 'success');
      } else {
        showMessage('Failed to save rules', 'error');
      }
    } catch (error) {
      showMessage('Error saving rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  const triggerMatching = async () => {
    try {
      setTriggering(true);
      const res = await fetch('/api/matching-config/trigger', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Matching process started in background', 'success');
      } else {
        showMessage('Failed to trigger matching process', 'error');
      }
    } catch (error) {
      showMessage('Error triggering matching process', 'error');
    } finally {
      setTriggering(false);
    }
  };

  const triggerLiveScraping = async () => {
    try {
      setTriggeringLive(true);
      const res = await fetch('/api/matching-config/trigger-live', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Live competitor scraper matching started in background', 'success');
      } else {
        showMessage('Failed to trigger live scraper', 'error');
      }
    } catch (error) {
      showMessage('Error triggering live scraper', 'error');
    } finally {
      setTriggeringLive(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePlatformToggle = (category: string, platform: string) => {
    setRules(prev => {
      const categoryPlatforms = prev[category] || [];
      const newPlatforms = categoryPlatforms.includes(platform)
        ? categoryPlatforms.filter(p => p !== platform)
        : [...categoryPlatforms, platform];
      return { ...prev, [category]: newPlatforms };
    });
  };

  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    const cat = newCategory.trim();
    if (rules[cat]) {
      showMessage('Category already exists', 'error');
      return;
    }
    setRules(prev => ({ ...prev, [cat]: [] }));
    setNewCategory('');
  };

  const handleDeleteCategory = (category: string) => {
    setRules(prev => {
      const newRules = { ...prev };
      delete newRules[category];
      return newRules;
    });
  };

  if (loading) {
    return <div className="matching-config-page"><div className="loading">Loading configuration...</div></div>;
  }

  return (
    <div className="matching-config-page">
      <div className="matching-header">
        <h1>Category-Wise DB Matching Configuration</h1>
        <p>Configure which platforms should be matched together for specific product categories.</p>
      </div>

      {message && (
        <div className={`message-banner ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="config-actions">
        <div className="add-category-box">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New Category (e.g., Electronics)"
            onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <button onClick={handleAddCategory} className="btn-secondary">Add Category</button>
        </div>
        
        <div className="global-actions">
          <button 
            onClick={saveRules} 
            disabled={saving} 
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button 
            onClick={triggerMatching} 
            disabled={triggering} 
            className="btn-accent"
          >
            {triggering ? 'Triggering...' : 'Trigger DB Matching Now'}
          </button>
          <button 
            onClick={triggerLiveScraping} 
            disabled={triggeringLive} 
            className="btn-live-scrape"
          >
            {triggeringLive ? 'Scraping...' : 'Trigger Live Competitor Scraping'}
          </button>
        </div>
      </div>


      <div className="rules-container">
        {Object.keys(rules).length === 0 ? (
          <div className="empty-state">No category rules configured. Add a category above to get started.</div>
        ) : (
          Object.entries(rules).map(([category, platforms]) => (
            <div key={category} className="category-rule-card">
              <div className="category-header">
                <h3>{category}</h3>
                <button onClick={() => handleDeleteCategory(category)} className="btn-icon delete-btn">✕</button>
              </div>
              <div className="platform-toggles">
                {ALL_PLATFORMS.map(platform => (
                  <label key={platform} className="platform-toggle">
                    <input
                      type="checkbox"
                      checked={platforms.includes(platform)}
                      onChange={() => handlePlatformToggle(category, platform)}
                    />
                    <span>{platform}</span>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MatchingConfigPage;
