import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

interface BottomNavProps {
  onOpenSidebar: () => void;
  alertCount?: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ onOpenSidebar, alertCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isEquity = location.pathname.startsWith('/stocks/equity') || location.pathname === '/stocks';
  const isIpo = location.pathname === '/stocks/ipo';
  const isDeals = location.pathname === '/deals';

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation Dock">
      {/* 1. Equity */}
      <button 
        className={`bottom-nav-item ${isEquity ? 'active' : ''}`}
        onClick={() => navigate('/stocks/equity')}
      >
        <span className="bottom-nav-icon">📊</span>
        <span className="bottom-nav-label">Equity</span>
      </button>

      {/* 2. IPO */}
      <button 
        className={`bottom-nav-item ${isIpo ? 'active' : ''}`}
        onClick={() => navigate('/stocks/ipo')}
      >
        <span className="bottom-nav-icon">🚀</span>
        <span className="bottom-nav-label">IPO</span>
      </button>

      {/* 3. Deals */}
      <button 
        className={`bottom-nav-item ${isDeals ? 'active' : ''}`}
        onClick={() => navigate('/deals')}
      >
        <span className="bottom-nav-icon">🛍️</span>
        <span className="bottom-nav-label">Deals</span>
      </button>

      {/* 4. Real-time Alerts */}
      <button 
        className="bottom-nav-item"
        onClick={() => {
          if (!isEquity) {
            navigate('/stocks/equity?tab=alerts');
          } else {
            // Trigger alerts tab directly on equity page
            const alertTabBtn = document.querySelector<HTMLButtonElement>('.tab-btn[style*="color: rgb(220, 38, 38)"], .tab-btn:has(span)');
            if (alertTabBtn) alertTabBtn.click();
          }
        }}
      >
        <div style={{ position: 'relative' }}>
          <span className="bottom-nav-icon">🔔</span>
          {alertCount > 0 && (
            <span className="bottom-nav-badge">{alertCount > 99 ? '99+' : alertCount}</span>
          )}
        </div>
        <span className="bottom-nav-label">Alerts</span>
      </button>

      {/* 5. More / Full Sidenav Toggle */}
      <button 
        className="bottom-nav-item menu-trigger"
        onClick={onOpenSidebar}
        aria-label="Open Full Navigation Sidenav"
      >
        <span className="bottom-nav-icon">☰</span>
        <span className="bottom-nav-label">Menu</span>
      </button>
    </nav>
  );
};

export default BottomNav;
