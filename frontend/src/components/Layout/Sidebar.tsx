import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

interface MenuItem {
  path?: string;
  label: string;
  icon: string;
  children?: MenuItem[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(['Stocks']);

  const menuItems: MenuItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/users', label: 'Users', icon: '👥' },
    { path: '/affiliates', label: 'Affiliates', icon: '🔗' },
    { path: '/banners', label: 'Banners', icon: '🖼️' },
    { path: '/promo-tiles', label: 'Amazon Promo Tiles', icon: '🎯' },
    { path: '/deals', label: 'Deals', icon: '🛍️' },
    {
      label: 'Stocks',
      icon: '📈',
      children: [
        { path: '/stocks/equity', label: 'Equity', icon: '📊' },
        { path: '/stocks/ipo', label: 'IPO', icon: '🚀' }
      ]
    },
    { path: '/execution', label: 'Execution Monitor', icon: '🔄' },
    { path: '/logs', label: 'Logs', icon: '📝' },
    { path: '/scheduler', label: 'Scheduler', icon: '⏰' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/category-priority', label: 'Category Priority', icon: '📋' },
    { path: '/product-matching', label: 'Product Matching', icon: '🔗' },
    { path: '/commands', label: 'Commands', icon: '⚙️' },
    { path: '/matching-config', label: 'Matching Config', icon: '⚙️' },
    {
      label: 'Others',
      icon: '📁',
      children: [
        { path: '/others/dad-expenses', label: 'Dad Expenses', icon: '💰' }
      ]
    }
  ];

  const toggleSection = (label: string) => {
    setExpandedSections(prev =>
      prev.includes(label)
        ? prev.filter(s => s !== label)
        : [...prev, label]
    );
  };

  const isActive = (item: MenuItem): boolean => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.children) {
      return item.children.some(child => child.path === location.pathname);
    }
    return false;
  };

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h1>Deals Dashboard</h1>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close Sidebar">
            ✕
          </button>
        )}
      </div>
      <nav className="sidebar-nav">
        {menuItems.map(item => {
          if (item.children) {
            const isExpanded = expandedSections.includes(item.label);
            const hasActiveChild = item.children.some(child => child.path === location.pathname);
            
            return (
              <div key={item.label} className="nav-section">
                <div
                  className={`nav-item nav-section-header ${hasActiveChild ? 'active' : ''}`}
                  onClick={() => toggleSection(item.label)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-arrow">{isExpanded ? '▼' : '▶'}</span>
                </div>
                {isExpanded && (
                  <div className="nav-submenu">
                    {item.children.map(child => (
                      <Link
                        key={child.path}
                        to={child.path!}
                        className={`nav-item nav-subitem ${location.pathname === child.path ? 'active' : ''}`}
                        onClick={handleNavClick}
                      >
                        <span className="nav-icon">{child.icon}</span>
                        <span className="nav-label">{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path!}
              className={`nav-item ${isActive(item) ? 'active' : ''}`}
              onClick={handleNavClick}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
