import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/deals', label: 'Deals', icon: '🛍️' },
    { path: '/stocks', label: 'Stocks', icon: '📈' },
    { path: '/execution', label: 'Execution Monitor', icon: '🔄' },
    { path: '/logs', label: 'Logs', icon: '📝' },
    { path: '/scheduler', label: 'Scheduler', icon: '⏰' },
    { path: '/analytics', label: 'Analytics', icon: '📊' }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Deals Dashboard</h1>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

