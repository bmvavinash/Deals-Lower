import React from 'react';
import './Header.css';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onToggleSidebar && (
            <button 
              className="mobile-hamburger-btn" 
              onClick={onToggleSidebar}
              aria-label="Toggle Navigation Menu"
            >
              ☰
            </button>
          )}
          <h2>Deals Management System</h2>
        </div>
        <div className="header-actions">
          <span className="status-indicator">
            <span className="status-dot"></span>
            <span className="status-text">System Online</span>
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
