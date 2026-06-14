import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { newsAPI } from '../services/api';
import './NewsPage.css';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  author?: string;
  publishDate?: string;
  category?: string;
  tags?: string[];
  images?: Array<{ url: string; alt: string }>;
  url: string;
  type: 'news';
}

const NewsPage: React.FC = () => {
  const [filters, setFilters] = useState({ 
    limit: 20, 
    offset: 0, 
    category: '', 
    sortBy: 'publishDate', 
    order: 'desc' 
  });
  const [isScraping, setIsScraping] = useState(false);

  const { data, isLoading, error, refetch } = useQuery(
    ['news', filters],
    () => newsAPI.getAll(filters),
    { keepPreviousData: true }
  );

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters, offset: 0 });
  };

  const handleTriggerScrape = async () => {
    try {
      setIsScraping(true);
      await newsAPI.triggerScrape({ scrapeNews: true, scrapeReviews: false, maxPages: 5, maxArticles: 50 });
      alert('News scraping triggered successfully! It will run in the background.');
      setTimeout(() => refetch(), 5000); // Refetch after 5 seconds
    } catch (error) {
      alert('Failed to trigger news scraping');
    } finally {
      setIsScraping(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="news-page">
      <div className="page-header">
        <h1>News & Updates</h1>
        <button 
          onClick={handleTriggerScrape} 
          className="trigger-button"
          disabled={isScraping}
        >
          {isScraping ? '⏳ Scraping...' : '🔄 Scrape News'}
        </button>
      </div>

      <div className="filters">
        <select 
          value={filters.category} 
          onChange={(e) => handleFilterChange({ category: e.target.value })}
          className="filter-select"
        >
          <option value="">All Categories</option>
          <option value="mobile">Mobile</option>
          <option value="tech">Tech</option>
          <option value="gadgets">Gadgets</option>
          <option value="reviews">Reviews</option>
        </select>
        <select 
          value={filters.sortBy} 
          onChange={(e) => handleFilterChange({ sortBy: e.target.value })}
          className="filter-select"
        >
          <option value="publishDate">Sort by Date</option>
          <option value="title">Sort by Title</option>
        </select>
        <select 
          value={filters.order} 
          onChange={(e) => handleFilterChange({ order: e.target.value })}
          className="filter-select"
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>

      {isLoading && <div className="loading">Loading news...</div>}
      {!!error && <div className="error">Error loading news: {String(error)}</div>}

      {!!data && (
        <>
          <div className="news-list">
            {(data.data as any)?.data?.map((article: NewsArticle) => (
              <div key={article.id} className="news-card">
                {article.images && article.images.length > 0 && (
                  <div className="news-image">
                    <img src={article.images[0].url} alt={article.images[0].alt || article.title} />
                  </div>
                )}
                <div className="news-content">
                  <div className="news-meta">
                    {article.category && <span className="category-badge">{article.category}</span>}
                    {article.publishDate && <span className="date">{formatDate(article.publishDate)}</span>}
                    {article.author && <span className="author">By {article.author}</span>}
                  </div>
                  <h2 className="news-title">{article.title}</h2>
                  <p className="news-excerpt">
                    {article.content?.substring(0, 200)}...
                  </p>
                  {article.tags && article.tags.length > 0 && (
                    <div className="news-tags">
                      {article.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="read-more">
                    Read More →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {(data.data as any)?.pagination && (
            <div className="pagination">
              <button
                onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                disabled={filters.offset === 0}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="pagination-info">
                Showing {filters.offset + 1} - {Math.min(filters.offset + filters.limit, (data.data as any).pagination.total)} of {(data.data as any).pagination.total}
              </span>
              <button
                onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                disabled={!((data.data as any).pagination.hasMore)}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NewsPage;














