import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import './MainLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="main-layout">
      {isSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close Sidebar Backdrop"
        />
      )}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="main-content">
        <Header onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />
        <main className="content-area">
          {children}
        </main>
      </div>
      <BottomNav onOpenSidebar={() => setIsSidebarOpen(true)} />
    </div>
  );
};

export default MainLayout;
