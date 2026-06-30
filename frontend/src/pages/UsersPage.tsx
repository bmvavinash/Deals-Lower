import React, { useState, useEffect } from 'react';
import './UsersPage.css';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface UserProfile {
  email: string;
  displayName: string;
  mobileNumber: string;
  telegramChatId: string;
  whatsappPhone: string;
  createdAt?: number;
}

interface FavoriteItem {
  title: string;
  price?: number;
  storeType?: string;
  productUrl?: string;
}

interface TrackedProduct {
  productCode: string;
  trackedPrice: number;
  dropThreshold: number;
  telegramEnabled?: boolean;
  telegramChatId?: string;
  whatsappEnabled?: boolean;
  whatsappPhone?: string;
}

interface User {
  uid: string;
  email: string;
  displayName: string;
  mobileNumber: string;
  telegramChatId: string;
  whatsappPhone: string;
  telegramConfigured: boolean;
  whatsappConfigured: boolean;
  favoritesCount: number;
  favorites: { [productCode: string]: FavoriteItem };
  trackedProducts: { [productCode: string]: TrackedProduct };
}

interface ProductDetails {
  productCode: string;
  title: string;
  storeType: string;
  price: string;
  usersCount: number;
  users: string[];
}

const UsersPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>({ users: {}, favoritesByProduct: {}, trackersByProduct: {} });
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');

  // Drilldown Selected User State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/favorites/admin/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch admin dashboard data');
      const resData = await response.json();
      if (resData.success) {
        setData(resData);
      } else {
        throw new Error(resData.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Error fetching admin dashboard:', err);
      setError(err.message || 'Error fetching data from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Process users
  const usersObj = data.users || {};
  const usersList: User[] = Object.keys(usersObj).map(uid => {
    const u = usersObj[uid];
    const profile: UserProfile = u.profile || {};
    const tracked = u.trackedProducts || {};
    
    // Resolve fields robustly across all nested schemas (profile, channels, preferences, root level)
    const email = profile.email || u.email || 'N/A';
    const displayName = profile.displayName || u.displayName || 'N/A';
    const mobileNumber = profile.mobileNumber || u.mobileNumber || 'N/A';
    
    const telegramChatId = profile.telegramChatId || u.channels?.telegram?.chatId || u.preferences?.telegram?.chatId || u.telegramChatId || 'N/A';
    const whatsappPhone = profile.whatsappPhone || u.channels?.whatsapp?.phone || u.preferences?.whatsapp?.phone || u.whatsappPhone || 'N/A';

    let telegramConfigured = telegramChatId !== 'N/A' && telegramChatId !== 'null' && !!telegramChatId;
    let whatsappConfigured = whatsappPhone !== 'N/A' && whatsappPhone !== 'null' && !!whatsappPhone;

    // Also check tracked products for active notification flags
    Object.values(tracked).forEach((item: any) => {
      if (item.telegramEnabled || item.telegramChatId) telegramConfigured = true;
      if (item.whatsappEnabled || item.whatsappPhone) whatsappConfigured = true;
    });

    return {
      uid,
      email,
      displayName,
      mobileNumber,
      telegramChatId,
      whatsappPhone,
      telegramConfigured,
      whatsappConfigured,
      favoritesCount: Object.keys(u.favorites || {}).length,
      favorites: u.favorites || {},
      trackedProducts: tracked
    };
  });

  // Extract unique favorited products list
  const favoritesByProduct = data.favoritesByProduct || {};
  const uniqueProductsList: ProductDetails[] = Object.keys(favoritesByProduct).map(pCode => {
    let productTitle = pCode;
    let storeType = 'Unknown';
    let price = 'N/A';

    for (const uid of Object.keys(usersObj)) {
      const userFavs = usersObj[uid]?.favorites || {};
      if (userFavs[pCode]) {
        productTitle = userFavs[pCode].title || productTitle;
        storeType = userFavs[pCode].storeType || storeType;
        price = userFavs[pCode].price !== undefined ? `₹${userFavs[pCode].price}` : price;
        break;
      }
    }

    return {
      productCode: pCode,
      title: productTitle,
      storeType,
      price,
      usersCount: Object.keys(favoritesByProduct[pCode] || {}).length,
      users: Object.keys(favoritesByProduct[pCode] || {})
    };
  });

  // Statistics Counts
  const totalUsers = usersList.length;
  const telegramAlertsCount = usersList.filter(u => u.telegramConfigured).length;
  const whatsappAlertsCount = usersList.filter(u => u.whatsappConfigured).length;
  const totalFavoritesCount = uniqueProductsList.length;

  // Filtered Users List
  const filteredUsers = usersList.filter(u => {
    const matchSearch = 
      u.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.mobileNumber.includes(searchQuery);

    let matchChannel = true;
    if (channelFilter === 'telegram') matchChannel = u.telegramConfigured;
    if (channelFilter === 'whatsapp') matchChannel = u.whatsappConfigured;

    let matchProduct = true;
    if (selectedProductFilter !== 'all') {
      matchProduct = !!u.favorites[selectedProductFilter];
    }

    return matchSearch && matchChannel && matchProduct;
  });

  const selectedUser = usersList.find(u => u.uid === selectedUserId);

  if (loading) {
    return <div className="users-page-loading">Loading users dashboard data...</div>;
  }

  if (error) {
    return (
      <div className="users-page-error">
        <h3>Error Loading Dashboard</h3>
        <p>{error}</p>
        <button onClick={fetchDashboardData} className="btn-retry">Retry Fetch</button>
      </div>
    );
  }

  return (
    <div className="users-dashboard-page">
      <header className="users-dashboard-header">
        <div className="header-title-area">
          <h1>User Alerts & Favorites Dashboard</h1>
          <p>Review user accounts, tracked products, and notification integration details.</p>
        </div>
        <button onClick={fetchDashboardData} className="btn-refresh">Refresh Data</button>
      </header>

      {/* Stats Cards Row */}
      <div className="stats-cards-grid">
        <div className="stats-card user-card-base">
          <span className="stats-card-icon">👥</span>
          <div className="stats-card-content">
            <h3>{totalUsers}</h3>
            <span>Total Users</span>
          </div>
        </div>

        <div className="stats-card favorites-card-base">
          <span className="stats-card-icon">❤️</span>
          <div className="stats-card-content">
            <h3>{totalFavoritesCount}</h3>
            <span>Unique Favorites</span>
          </div>
        </div>

        <div className="stats-card telegram-card-base">
          <span className="stats-card-icon">✈️</span>
          <div className="stats-card-content">
            <h3>{telegramAlertsCount}</h3>
            <span>Telegram Alert Users</span>
          </div>
        </div>

        <div className="stats-card whatsapp-card-base">
          <span className="stats-card-icon">💬</span>
          <div className="stats-card-content">
            <h3>{whatsappAlertsCount}</h3>
            <span>WhatsApp Alert Users</span>
          </div>
        </div>
      </div>

      {/* Filters section */}
      <div className="users-filter-card">
        <h3>Filter Records</h3>
        <div className="filters-inputs-row">
          <div className="filter-input-wrapper">
            <label>Search User</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search UID, Name, Email, Phone..."
            />
          </div>

          <div className="filter-input-wrapper">
            <label>Notification Integration</label>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option value="all">All Integration Choices</option>
              <option value="telegram">Telegram Active Users</option>
              <option value="whatsapp">WhatsApp Active Users</option>
            </select>
          </div>

          <div className="filter-input-wrapper">
            <label>Filter by Favorited Product</label>
            <select value={selectedProductFilter} onChange={(e) => setSelectedProductFilter(e.target.value)}>
              <option value="all">All Favorited Items</option>
              {uniqueProductsList.map(prod => (
                <option key={prod.productCode} value={prod.productCode}>
                  {prod.title.slice(0, 30)}... ({prod.usersCount} users)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="dashboard-content-split">
        {/* Table Area */}
        <div className={`table-container-wrapper ${selectedUser ? 'split-view' : 'full-view'}`}>
          <table className="users-data-table">
            <thead>
              <tr>
                <th>User Profile</th>
                <th>Contact Number</th>
                <th>Telegram Config</th>
                <th>WhatsApp Config</th>
                <th style={{ textAlign: 'center' }}>Favorites</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    No users match the search/filter parameters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr 
                    key={u.uid} 
                    className={`user-table-row ${u.uid === selectedUserId ? 'row-selected' : ''}`}
                    onClick={() => setSelectedUserId(u.uid === selectedUserId ? null : u.uid)}
                  >
                    <td>
                      <div className="user-profile-cell">
                        <strong className="user-display-name">{u.displayName}</strong>
                        <span className="user-email-text">{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="user-phone-text">{u.mobileNumber}</span>
                    </td>
                    <td>
                      {u.telegramConfigured ? (
                        <span className="status-chip success-chip">Active</span>
                      ) : (
                        <span className="status-chip warning-chip">Not Active</span>
                      )}
                    </td>
                    <td>
                      {u.whatsappConfigured ? (
                        <span className="status-chip success-chip">Active</span>
                      ) : (
                        <span className="status-chip warning-chip">Not Active</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {u.favoritesCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sidebar drilldown panel */}
        {selectedUser && (
          <div className="drilldown-sidebar-card">
            <div className="drilldown-card-header">
              <h3>Favorites Drilldown Details</h3>
              <button className="btn-close-sidebar" onClick={() => setSelectedUserId(null)}>✕</button>
            </div>
            
            <div className="drilldown-user-meta">
              <div className="meta-row">
                <span className="meta-label">Display Name</span>
                <span className="meta-val">{selectedUser.displayName}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">User ID (UID)</span>
                <span className="meta-val code-block">{selectedUser.uid}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Contact Number</span>
                <span className="meta-val">{selectedUser.mobileNumber}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Telegram Chat ID</span>
                <span className="meta-val code-block">{selectedUser.telegramChatId}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">WhatsApp Phone</span>
                <span className="meta-val code-block">{selectedUser.whatsappPhone ? `+${selectedUser.whatsappPhone}` : 'N/A'}</span>
              </div>
            </div>

            <div className="drilldown-favorites-section">
              <h4>Favorited Products ({selectedUser.favoritesCount})</h4>
              {selectedUser.favoritesCount === 0 ? (
                <p className="no-favs-text">This user has not favorited any products yet.</p>
              ) : (
                <div className="drilldown-favorites-list">
                  {Object.entries(selectedUser.favorites).map(([pCode, details]) => (
                    <div key={pCode} className="favorites-item-box">
                      <h5>{details.title || pCode}</h5>
                      <div className="favorites-item-footer">
                        <span>Store: <b>{details.storeType || 'Unknown'}</b></span>
                        <span className="item-price-tag">{details.price !== undefined ? `₹${details.price}` : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CDN Cache Warning Card */}
      <div className="dashboard-privacy-card">
        <span className="privacy-card-icon">ℹ️</span>
        <div className="privacy-card-content">
          <h4>Search Queries & Privacy Warning</h4>
          <p>
            To sustain fast query loading times and minimize Firebase database storage, search queries and product keywords are processed <b>statefully on the client-side browser context</b> and are not saved, cached, or logged inside the database.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
