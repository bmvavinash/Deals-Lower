import React from 'react';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <h2>Deals Management System</h2>
        <div className="header-actions">
          <span className="status-indicator">
            <span className="status-dot"></span>
            System Online
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;


















