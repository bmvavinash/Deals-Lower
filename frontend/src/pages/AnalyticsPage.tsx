import React from 'react';
import { useQuery } from 'react-query';
import { analyticsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import './AnalyticsPage.css';

const AnalyticsPage: React.FC = () => {
  const { data: dealsData, isLoading: dealsLoading, error: dealsError } = useQuery('analytics-deals', () => analyticsAPI.getDeals());
  const { data: notificationsData, isLoading: notificationsLoading, error: notificationsError } = useQuery('analytics-notifications', () => analyticsAPI.getNotifications());
  const { data: performanceData, isLoading: performanceLoading, error: performanceError } = useQuery('analytics-performance', () => analyticsAPI.getPerformance());
  const { data: bannersData, isLoading: bannersLoading, error: bannersError } = useQuery('analytics-banners', () => analyticsAPI.getBanners());

  const dealsAnalytics = (dealsData as any)?.data?.data;
  const notificationsAnalytics = (notificationsData as any)?.data?.data;
  const performance = (performanceData as any)?.data?.data;
  const bannersAnalytics = (bannersData as any)?.data?.data;

  const COLORS = ['#3498db', '#27ae60', '#e74c3c', '#f39c12', '#9b59b6'];

  return (
    <div className="analytics-page">
      <h1>Analytics Dashboard</h1>

      <div className="analytics-section">
        <h2>Deal Analytics</h2>
        {dealsLoading && <div className="loading">Loading deal analytics...</div>}
        {dealsError && <div className="error">Error loading deal analytics: {(dealsError as any)?.message}</div>}
        {dealsAnalytics && (
          <div>
            <div className="stats-summary">
              <div className="stat-item">
                <span className="stat-label">Total Deals:</span>
                <span className="stat-value">{dealsAnalytics.totalDeals || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Hot Deals:</span>
                <span className="stat-value">{dealsAnalytics.hotDeals || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Product Deals:</span>
                <span className="stat-value">{dealsAnalytics.productDeals || 0}</span>
              </div>
            </div>
            <div className="charts-grid">
              <div className="chart-card">
                <h3>Deals by Platform</h3>
                {Object.keys(dealsAnalytics.byPlatform || {}).length > 0 ? (
                  <BarChart width={400} height={300} data={Object.entries(dealsAnalytics.byPlatform || {}).map(([name, value]) => ({ name, value: value as number }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3498db" />
                  </BarChart>
                ) : (
                  <p>No platform data available</p>
                )}
              </div>

              <div className="chart-card">
                <h3>Price Distribution</h3>
                {Object.keys(dealsAnalytics.priceRange || {}).length > 0 ? (
                  <PieChart width={400} height={300}>
                    <Pie
                      data={Object.entries(dealsAnalytics.priceRange || {}).map(([name, value]) => ({ name, value: value as number }))}
                      cx={200}
                      cy={150}
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(dealsAnalytics.priceRange || {}).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : (
                  <p>No price data available</p>
                )}
              </div>

              <div className="chart-card">
                <h3>Deals by Category</h3>
                {Object.keys(dealsAnalytics.byCategory || {}).length > 0 ? (
                  <BarChart width={400} height={300} data={Object.entries(dealsAnalytics.byCategory || {}).map(([name, value]) => ({ name, value: value as number }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#27ae60" />
                  </BarChart>
                ) : (
                  <p>No category data available</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h2>Notification Analytics</h2>
        {notificationsAnalytics && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Telegram</h3>
                <p>Success Rate: {notificationsAnalytics.successRate?.telegram || 0}%</p>
                <p>Total: {notificationsAnalytics.platformStats?.telegram?.total || 0}</p>
              </div>
              <div className="stat-card">
                <h3>WhatsApp</h3>
                <p>Success Rate: {notificationsAnalytics.successRate?.whatsapp || 0}%</p>
                <p>Total: {notificationsAnalytics.platformStats?.whatsapp?.total || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Facebook</h3>
                <p>Success Rate: {notificationsAnalytics.successRate?.facebook || 0}%</p>
                <p>Total: {notificationsAnalytics.platformStats?.facebook?.total || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Failed Notifications</h3>
                <p>Total: {notificationsAnalytics.totalFailed || 0}</p>
              </div>
            </div>
            
            {/* Favorites-Based Notifications */}
            {notificationsAnalytics.favoritesBased && (
              <div className="favorites-notifications-section">
                <h3>Favorites-Based Notifications</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h4>Total Triggered</h4>
                    <p className="stat-value">{notificationsAnalytics.favoritesBased.totalTriggered || 0}</p>
                  </div>
                  <div className="stat-card">
                    <h4>Total Sent</h4>
                    <p className="stat-value">{notificationsAnalytics.favoritesBased.totalSent || 0}</p>
                  </div>
                  <div className="stat-card">
                    <h4>Users Notified</h4>
                    <p className="stat-value">{notificationsAnalytics.favoritesBased.usersNotified || 0}</p>
                  </div>
                  <div className="stat-card">
                    <h4>Products Notified</h4>
                    <p className="stat-value">{notificationsAnalytics.favoritesBased.productsNotified || 0}</p>
                  </div>
                </div>
                
                <div className="notification-types">
                  <h4>By Notification Type</h4>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h5>Price Drops</h5>
                      <p>{notificationsAnalytics.favoritesBased.byType?.price_drop || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h5>New Deals</h5>
                      <p>{notificationsAnalytics.favoritesBased.byType?.new_deal || 0}</p>
                    </div>
                    <div className="stat-card">
                      <h5>Category Deals</h5>
                      <p>{notificationsAnalytics.favoritesBased.byType?.category_deal || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="notification-channels">
                  <h4>By Channel</h4>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h5>WhatsApp</h5>
                      <p>Triggered: {notificationsAnalytics.favoritesBased.byChannel?.whatsapp?.triggered || 0}</p>
                      <p>Sent: {notificationsAnalytics.favoritesBased.byChannel?.whatsapp?.sent || 0}</p>
                      <p>Success Rate: {notificationsAnalytics.favoritesBased.byChannel?.whatsapp?.successRate || 0}%</p>
                    </div>
                    <div className="stat-card">
                      <h5>Telegram</h5>
                      <p>Triggered: {notificationsAnalytics.favoritesBased.byChannel?.telegram?.triggered || 0}</p>
                      <p>Sent: {notificationsAnalytics.favoritesBased.byChannel?.telegram?.sent || 0}</p>
                      <p>Success Rate: {notificationsAnalytics.favoritesBased.byChannel?.telegram?.successRate || 0}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h2>Banner Analytics</h2>
        {bannersLoading && <div className="loading">Loading banner analytics...</div>}
        {bannersError && <div className="error">Error loading banner analytics: {(bannersError as any)?.message}</div>}
        {bannersAnalytics && (
          <div>
            <div className="stats-summary">
              <div className="stat-item">
                <span className="stat-label">Total Banners:</span>
                <span className="stat-value">{bannersAnalytics.total || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Active Banners:</span>
                <span className="stat-value">{bannersAnalytics.active || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Inactive Banners:</span>
                <span className="stat-value">{bannersAnalytics.inactive || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Active Rate:</span>
                <span className="stat-value">{bannersAnalytics.activeRate || 0}%</span>
              </div>
            </div>
            <div className="charts-grid">
              <div className="chart-card">
                <h3>Banners by Platform</h3>
                {Object.keys(bannersAnalytics.byPlatform || {}).length > 0 ? (
                  <BarChart width={400} height={300} data={Object.entries(bannersAnalytics.byPlatform || {}).map(([name, value]) => ({ name, value: value as number }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#e74c3c" />
                  </BarChart>
                ) : (
                  <p>No platform data available</p>
                )}
              </div>

              <div className="chart-card">
                <h3>Banners by Category</h3>
                {Object.keys(bannersAnalytics.byCategory || {}).length > 0 ? (
                  <PieChart width={400} height={300}>
                    <Pie
                      data={Object.entries(bannersAnalytics.byCategory || {}).map(([name, value]) => ({ name, value: value as number }))}
                      cx={200}
                      cy={150}
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(bannersAnalytics.byCategory || {}).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : (
                  <p>No category data available</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="analytics-section">
        <h2>Performance Metrics</h2>
        {performanceLoading && <div className="loading">Loading performance metrics...</div>}
        {performanceError && <div className="error">Error loading performance metrics: {(performanceError as any)?.message}</div>}
        {performance && (
          <div className="performance-grid">
            <div className="perf-card">
              <h3>System Uptime</h3>
              <p>{Math.round((performance.system?.uptime || 0) / 3600)} hours</p>
            </div>
            <div className="perf-card">
              <h3>Memory Usage</h3>
              <p>{performance.system?.memoryUsage?.used || 0} MB / {performance.system?.memoryUsage?.total || 0} MB</p>
            </div>
            <div className="perf-card">
              <h3>Average Products per Run</h3>
              <p>{performance.scheduler?.averageProductsPerRun || 0}</p>
            </div>
            <div className="perf-card">
              <h3>Total Runs</h3>
              <p>{performance.scheduler?.totalRuns || 0}</p>
            </div>
            <div className="perf-card">
              <h3>Total Products Processed</h3>
              <p>{performance.scheduler?.totalProductsProcessed || 0}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;

